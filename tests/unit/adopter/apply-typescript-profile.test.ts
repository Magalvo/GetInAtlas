import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { applyCore, CoreManifestSchema } from '../../../src/adopter/apply-core.js';
import { applyTypescriptProfile } from '../../../src/adopter/apply-typescript-profile.js';

const temporaryDirectories: string[] = [];
const PackageOutputSchema = z.object({
  scripts: z.record(z.string()),
  devDependencies: z.record(z.string()),
});

async function temporaryRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ai-sdd-typescript-'));
  temporaryDirectories.push(directory);
  execFileSync('git', ['init', directory], { stdio: 'ignore', windowsHide: true });
  execFileSync('git', ['-C', directory, 'config', 'user.email', 'tests@example.invalid']);
  execFileSync('git', ['-C', directory, 'config', 'user.name', 'AI-SDD Tests']);
  return directory;
}

function commitAll(directory: string, message: string): void {
  execFileSync('git', ['-C', directory, 'add', '.'], { stdio: 'ignore', windowsHide: true });
  execFileSync('git', ['-C', directory, 'commit', '-m', message], {
    stdio: 'ignore',
    windowsHide: true,
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function prepareTypescriptProject(
  packageJson: Readonly<Record<string, unknown>> = { name: 'demo', private: true }
): Promise<string> {
  const project = await temporaryRepository();
  await writeFile(join(project, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  await writeFile(join(project, 'tsconfig.json'), '{"compilerOptions": {}}\n');
  commitAll(project, 'typescript baseline');
  await applyCore(project);
  commitAll(project, 'ai-sdd core');
  return project;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true }))
  );
});

describe('applyTypescriptProfile', () => {
  it('faz merge aditivo e preserva scripts e versões existentes', async () => {
    const project = await prepareTypescriptProject({
      name: 'demo',
      scripts: { test: 'vitest --run', custom: 'node custom.mjs' },
      devDependencies: { typescript: '^5.9.0' },
    });

    const result = await applyTypescriptProfile(project);
    const packageRaw: unknown = JSON.parse(await readFile(join(project, 'package.json'), 'utf8'));
    const packageJson = PackageOutputSchema.parse(packageRaw);
    const manifestRaw: unknown = JSON.parse(
      await readFile(join(project, '.ai-sdd', 'manifest.json'), 'utf8')
    );
    const manifest = CoreManifestSchema.parse(manifestRaw);

    expect(result.status).toBe('applied');
    expect(result.readiness).toBe('dependencies-pending');
    expect(packageJson.scripts.test).toBe('vitest --run');
    expect(packageJson.scripts.custom).toBe('node custom.mjs');
    expect(packageJson.scripts['ai-sdd:check']).toBe('node .ai-sdd/run-checks.mjs');
    expect(packageJson.scripts.typecheck).toBe('tsc -p tsconfig.ai-sdd.json --noEmit');
    expect(packageJson.devDependencies.typescript).toBe('^5.9.0');
    expect(packageJson.devDependencies.vitest).toBeDefined();
    expect(manifest.profile).toBe('typescript');
    expect(manifest.typescript?.requiredScripts).toEqual([
      'typecheck',
      'lint',
      'test',
      'ai-sdd:check',
    ]);
    expect(await exists(join(project, 'tsconfig.ai-sdd.json'))).toBe(true);
    expect(await exists(join(project, 'eslint.config.ai-sdd.js'))).toBe(true);
    expect(await exists(join(project, 'package-lock.json'))).toBe(false);
  });

  it('é no-op quando o profile e os requisitos continuam intactos', async () => {
    const project = await prepareTypescriptProject();
    await applyTypescriptProfile(project);
    const packageBefore = await readFile(join(project, 'package.json'), 'utf8');
    const manifestBefore = await readFile(join(project, '.ai-sdd', 'manifest.json'), 'utf8');
    const manifestRaw: unknown = JSON.parse(manifestBefore);
    const manifest = CoreManifestSchema.parse(manifestRaw);
    for (const dependency of manifest.typescript?.requiredPackages ?? []) {
      await mkdir(join(project, 'node_modules', ...dependency.split('/')), { recursive: true });
    }

    const result = await applyTypescriptProfile(project);

    expect(result.status).toBe('unchanged');
    expect(result.readiness).toBe('ready');
    expect(await readFile(join(project, 'package.json'), 'utf8')).toBe(packageBefore);
    expect(await readFile(join(project, '.ai-sdd', 'manifest.json'), 'utf8')).toBe(manifestBefore);
  });

  it('bloqueia colisão no script namespaced sem escrita parcial', async () => {
    const project = await prepareTypescriptProject({
      name: 'demo',
      scripts: { 'ai-sdd:check': 'node something-else.mjs' },
    });
    const packageBefore = await readFile(join(project, 'package.json'), 'utf8');

    await expect(applyTypescriptProfile(project)).rejects.toThrow(
      'Colisão em scripts.ai-sdd:check'
    );
    expect(await readFile(join(project, 'package.json'), 'utf8')).toBe(packageBefore);
    expect(await exists(join(project, 'tsconfig.ai-sdd.json'))).toBe(false);
  });

  it('exige o core instalado e commitado', async () => {
    const project = await temporaryRepository();
    await writeFile(join(project, 'package.json'), '{"devDependencies":{"typescript":"^5"}}\n');
    commitAll(project, 'typescript baseline');

    await expect(applyTypescriptProfile(project)).rejects.toThrow(
      'Aplica e commita o core primeiro'
    );
  });

  it('não executa scripts do alvo nem instala dependências', async () => {
    const project = await prepareTypescriptProject({
      name: 'demo',
      scripts: { preinstall: 'node malicious.mjs' },
    });
    await applyTypescriptProfile(project);

    expect(await exists(join(project, 'node_modules'))).toBe(false);
    expect(await exists(join(project, 'package-lock.json'))).toBe(false);
  });

  it('restaura package, manifesto e assets perante falha', async () => {
    const project = await prepareTypescriptProject();
    const packageBefore = await readFile(join(project, 'package.json'), 'utf8');
    const manifestBefore = await readFile(join(project, '.ai-sdd', 'manifest.json'), 'utf8');

    await expect(
      applyTypescriptProfile(project, {
        beforeWrite: (relativePath) => {
          if (relativePath === '.ai-sdd/manifest.json') throw new Error('simulated failure');
        },
      })
    ).rejects.toThrow('simulated failure');

    expect(await readFile(join(project, 'package.json'), 'utf8')).toBe(packageBefore);
    expect(await readFile(join(project, '.ai-sdd', 'manifest.json'), 'utf8')).toBe(manifestBefore);
    expect(await exists(join(project, 'tsconfig.ai-sdd.json'))).toBe(false);
    expect(await exists(join(project, '.ai-sdd', 'run-checks.mjs'))).toBe(false);
  });
});
