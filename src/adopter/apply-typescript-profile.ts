import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import {
  assertManagedFilesIntact,
  checksum,
  CoreManifestSchema,
  type CoreManifest,
  MANIFEST_PATH,
  readManifest,
  targetPath,
} from './apply-core.js';
import { discoverProject } from './discover-project.js';

const PackageJsonSchema = z
  .object({
    scripts: z.record(z.string()).optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
  })
  .passthrough();

const REQUIRED_SCRIPTS = ['typecheck', 'lint', 'test', 'ai-sdd:check'] as const;
const RECOMMENDED_PACKAGES = [
  { name: 'typescript', version: '^5.7.0' },
  { name: 'eslint', version: '^9.17.0' },
  { name: '@eslint/js', version: '^9.17.0' },
  { name: 'typescript-eslint', version: '^8.19.0' },
  { name: 'prettier', version: '^3.4.0' },
  { name: 'vitest', version: '^2.1.0' },
  { name: 'zod', version: '^3.24.0' },
  { name: 'fast-check', version: '^3.23.0' },
] as const;
const SCRIPT_DEFAULTS: Readonly<Record<string, string>> = {
  typecheck: 'tsc -p tsconfig.ai-sdd.json --noEmit',
  lint: 'eslint --config eslint.config.ai-sdd.js .',
  test: 'vitest run',
  'ai-sdd:check': 'node .ai-sdd/run-checks.mjs',
};

const RUNNER = `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const packageManager = process.env.npm_execpath;
for (const script of ['typecheck', 'lint', 'test']) {
  const command = packageManager ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = packageManager ? [packageManager, 'run', script] : ['run', script];
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
`;

interface ProfileAsset {
  relativePath: string;
  content: string;
}

export interface ApplyTypescriptOptions {
  beforeWrite?: (relativePath: string) => void | Promise<void>;
}

export interface ApplyTypescriptResult {
  status: 'applied' | 'unchanged';
  profile: 'typescript';
  readiness: 'ready' | 'dependencies-pending';
  createdFiles: string[];
  addedScripts: string[];
  addedDevDependencies: string[];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readPackageJson(target: string): Promise<{
  raw: string;
  data: z.infer<typeof PackageJsonSchema>;
}> {
  const path = join(target, 'package.json');
  let raw: string;
  let value: unknown;
  try {
    raw = await readFile(path, 'utf8');
    value = JSON.parse(raw);
  } catch {
    throw new Error('O profile TypeScript exige package.json com JSON válido');
  }
  const parsed = PackageJsonSchema.safeParse(value);
  if (!parsed.success) throw new Error(`package.json inválido: ${parsed.error.message}`);
  return { raw, data: parsed.data };
}

function profileAssets(hasTsconfig: boolean): readonly ProfileAsset[] {
  const config = {
    ...(hasTsconfig ? { extends: './tsconfig.json' } : {}),
    compilerOptions: {
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      noImplicitReturns: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      forceConsistentCasingInFileNames: true,
      noEmit: true,
    },
  };
  return [
    { relativePath: 'tsconfig.ai-sdd.json', content: `${JSON.stringify(config, null, 2)}\n` },
    {
      relativePath: 'eslint.config.ai-sdd.js',
      content: `import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.ai-sdd.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  }
);
`,
    },
    { relativePath: '.ai-sdd/run-checks.mjs', content: RUNNER },
  ];
}

function mergePackageJson(packageJson: z.infer<typeof PackageJsonSchema>): {
  content: string;
  addedScripts: string[];
  addedDevDependencies: string[];
} {
  const scripts = { ...packageJson.scripts };
  const dependencies = packageJson.dependencies ?? {};
  const devDependencies = { ...packageJson.devDependencies };
  if (
    scripts['ai-sdd:check'] !== undefined &&
    scripts['ai-sdd:check'] !== SCRIPT_DEFAULTS['ai-sdd:check']
  ) {
    throw new Error('Colisão em scripts.ai-sdd:check; merge manual necessário');
  }

  const addedScripts: string[] = [];
  for (const name of REQUIRED_SCRIPTS) {
    if (scripts[name] === undefined) {
      const defaultValue = SCRIPT_DEFAULTS[name];
      if (defaultValue === undefined) throw new Error(`Script default em falta: ${name}`);
      scripts[name] = defaultValue;
      addedScripts.push(name);
    }
  }

  const addedDevDependencies: string[] = [];
  for (const dependency of RECOMMENDED_PACKAGES) {
    if (
      dependencies[dependency.name] === undefined &&
      devDependencies[dependency.name] === undefined
    ) {
      devDependencies[dependency.name] = dependency.version;
      addedDevDependencies.push(dependency.name);
    }
  }

  return {
    content: `${JSON.stringify({ ...packageJson, scripts, devDependencies }, null, 2)}\n`,
    addedScripts,
    addedDevDependencies,
  };
}

async function assertRequirements(target: string, manifest: CoreManifest): Promise<void> {
  const requirements = manifest.typescript;
  if (!requirements) throw new Error('Manifesto TypeScript sem requisitos registados');
  const { data } = await readPackageJson(target);
  const scripts = data.scripts ?? {};
  const dependencies = data.dependencies ?? {};
  const devDependencies = data.devDependencies ?? {};
  for (const script of requirements.requiredScripts) {
    if (scripts[script] === undefined) throw new Error(`Script TypeScript em falta: ${script}`);
  }
  if (scripts['ai-sdd:check'] !== SCRIPT_DEFAULTS['ai-sdd:check']) {
    throw new Error('Script gerido alterado: ai-sdd:check');
  }
  for (const dependency of requirements.requiredPackages) {
    if (dependencies[dependency] === undefined && devDependencies[dependency] === undefined) {
      throw new Error(`Dependência TypeScript em falta: ${dependency}`);
    }
  }
}

async function readiness(target: string): Promise<'ready' | 'dependencies-pending'> {
  for (const dependency of RECOMMENDED_PACKAGES) {
    if (!(await pathExists(join(target, 'node_modules', ...dependency.name.split('/'))))) {
      return 'dependencies-pending';
    }
  }
  return 'ready';
}

async function assetsToCreate(
  target: string,
  assets: readonly ProfileAsset[]
): Promise<ProfileAsset[]> {
  const missing: ProfileAsset[] = [];
  for (const asset of assets) {
    const path = targetPath(target, asset.relativePath);
    if (!(await pathExists(path))) missing.push(asset);
    else if (checksum(await readFile(path)) !== checksum(asset.content)) {
      throw new Error(
        `Conflito em ${asset.relativePath}: o ficheiro existente não será substituído`
      );
    }
  }
  return missing;
}

function upgradedManifest(manifest: CoreManifest, assets: readonly ProfileAsset[]): CoreManifest {
  const managedFiles = { ...manifest.managedFiles };
  for (const asset of assets) managedFiles[asset.relativePath] = checksum(asset.content);
  return CoreManifestSchema.parse({
    ...manifest,
    profile: 'typescript',
    managedFiles,
    typescript: {
      requiredScripts: [...REQUIRED_SCRIPTS],
      requiredPackages: RECOMMENDED_PACKAGES.map(({ name }) => name),
    },
  });
}

async function rollback(
  target: string,
  createdFiles: readonly string[],
  packageRaw: string,
  manifestRaw: string,
  packageWasWritten: boolean,
  manifestWasWritten: boolean
): Promise<void> {
  const operations: Promise<unknown>[] = createdFiles.map(async (relativePath) =>
    rm(targetPath(target, relativePath), { force: true })
  );
  if (packageWasWritten) operations.push(writeFile(join(target, 'package.json'), packageRaw));
  if (manifestWasWritten)
    operations.push(writeFile(targetPath(target, MANIFEST_PATH), manifestRaw));
  await Promise.allSettled(operations);
}

export async function applyTypescriptProfile(
  rawTarget: string,
  options: ApplyTypescriptOptions = {}
): Promise<ApplyTypescriptResult> {
  const report = await discoverProject(rawTarget);
  const manifest = await readManifest(report.target);
  if (!manifest) throw new Error('Aplica e commita o core primeiro');
  await assertManagedFilesIntact(report.target, manifest);
  if (!report.detectedStacks.some(({ name }) => name === 'typescript')) {
    throw new Error('O profile TypeScript exige evidência de um projeto TypeScript');
  }
  if (manifest.profile === 'typescript') {
    await assertRequirements(report.target, manifest);
    return {
      status: 'unchanged',
      profile: 'typescript',
      readiness: await readiness(report.target),
      createdFiles: [],
      addedScripts: [],
      addedDevDependencies: [],
    };
  }
  if (report.git.status !== 'clean') {
    throw new Error(`O profile exige um repositório Git limpo; estado atual: ${report.git.status}`);
  }

  const packageJson = await readPackageJson(report.target);
  const merged = mergePackageJson(packageJson.data);
  const assets = profileAssets(await pathExists(join(report.target, 'tsconfig.json')));
  const missingAssets = await assetsToCreate(report.target, assets);
  const oldManifest = await readFile(targetPath(report.target, MANIFEST_PATH), 'utf8');
  const newManifest = `${JSON.stringify(upgradedManifest(manifest, assets), null, 2)}\n`;
  const createdFiles: string[] = [];
  let packageWasWritten = false;
  let manifestWasWritten = false;
  try {
    for (const asset of missingAssets) {
      await options.beforeWrite?.(asset.relativePath);
      const path = targetPath(report.target, asset.relativePath);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, asset.content, { encoding: 'utf8', flag: 'wx' });
      createdFiles.push(asset.relativePath);
    }
    await options.beforeWrite?.('package.json');
    if ((await readFile(join(report.target, 'package.json'), 'utf8')) !== packageJson.raw) {
      throw new Error('package.json mudou durante a aplicação; operação cancelada');
    }
    await writeFile(join(report.target, 'package.json'), merged.content, 'utf8');
    packageWasWritten = true;
    await options.beforeWrite?.(MANIFEST_PATH);
    manifestWasWritten = true;
    await writeFile(targetPath(report.target, MANIFEST_PATH), newManifest, 'utf8');
    return {
      status: 'applied',
      profile: 'typescript',
      readiness: await readiness(report.target),
      createdFiles,
      addedScripts: merged.addedScripts,
      addedDevDependencies: merged.addedDevDependencies,
    };
  } catch (error: unknown) {
    await rollback(
      report.target,
      createdFiles,
      packageJson.raw,
      oldManifest,
      packageWasWritten,
      manifestWasWritten
    );
    throw error;
  }
}
