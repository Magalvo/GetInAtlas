import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { CORE_ASSETS } from './core-assets.js';
import { discoverProject } from './discover-project.js';

export const MANIFEST_PATH = '.ai-sdd/manifest.json';
const ChecksumSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const CoreManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    adopterVersion: z.literal('0.1.0'),
    profile: z.enum(['core', 'typescript']),
    managedFiles: z.record(ChecksumSchema),
    typescript: z
      .object({
        requiredScripts: z.array(z.string()),
        requiredPackages: z.array(z.string()),
      })
      .optional(),
  })
  .strict();

export type CoreManifest = z.infer<typeof CoreManifestSchema>;

export interface ApplyCoreOptions {
  beforeWrite?: (relativePath: string) => void | Promise<void>;
}

export interface ApplyCoreResult {
  status: 'applied' | 'unchanged';
  createdFiles: string[];
}

export function targetPath(target: string, relativePath: string): string {
  return join(target, ...relativePath.split('/'));
}

export function checksum(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export function expectedCoreManifest(): CoreManifest {
  const managedFiles: Record<string, string> = {};
  for (const asset of CORE_ASSETS) managedFiles[asset.relativePath] = checksum(asset.content);
  return CoreManifestSchema.parse({
    schemaVersion: 1,
    adopterVersion: '0.1.0',
    profile: 'core',
    managedFiles,
  });
}

export async function readManifest(target: string): Promise<CoreManifest | undefined> {
  const path = targetPath(target, MANIFEST_PATH);
  if (!(await exists(path))) return undefined;

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    throw new Error(`Manifesto inválido: ${MANIFEST_PATH} não contém JSON válido`);
  }
  const result = CoreManifestSchema.safeParse(raw);
  if (!result.success) throw new Error(`Manifesto inválido: ${result.error.message}`);
  return result.data;
}

export async function assertManagedFilesIntact(
  target: string,
  manifest: CoreManifest
): Promise<void> {
  for (const [relativePath, recordedChecksum] of Object.entries(manifest.managedFiles)) {
    const path = targetPath(target, relativePath);
    if (!(await exists(path))) throw new Error(`Ficheiro gerido em falta: ${relativePath}`);
    if (checksum(await readFile(path)) !== recordedChecksum) {
      throw new Error(`Ficheiro gerido alterado: ${relativePath}`);
    }
  }
  const expected = expectedCoreManifest();
  for (const [relativePath, expectedChecksum] of Object.entries(expected.managedFiles)) {
    if (manifest.managedFiles[relativePath] !== expectedChecksum) {
      throw new Error('A versão instalada do core não corresponde a este adopter');
    }
  }
}

async function filesToCreate(target: string): Promise<(typeof CORE_ASSETS)[number][]> {
  const missing: (typeof CORE_ASSETS)[number][] = [];
  for (const asset of CORE_ASSETS) {
    const path = targetPath(target, asset.relativePath);
    if (!(await exists(path))) {
      missing.push(asset);
    } else if (checksum(await readFile(path)) !== checksum(asset.content)) {
      throw new Error(
        `Conflito em ${asset.relativePath}: o ficheiro existente não será substituído`
      );
    }
  }
  return missing;
}

async function rollback(target: string, createdFiles: readonly string[]): Promise<void> {
  await Promise.allSettled(
    [...createdFiles]
      .reverse()
      .map(async (relativePath) => rm(targetPath(target, relativePath), { force: true }))
  );
}

async function createExclusive(
  target: string,
  relativePath: string,
  content: string,
  options: ApplyCoreOptions
): Promise<void> {
  await options.beforeWrite?.(relativePath);
  const path = targetPath(target, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, { encoding: 'utf8', flag: 'wx' });
}

export async function applyCore(
  rawTarget: string,
  options: ApplyCoreOptions = {}
): Promise<ApplyCoreResult> {
  const existingManifest = await readManifest(rawTarget);
  if (existingManifest) {
    await assertManagedFilesIntact(rawTarget, existingManifest);
    return { status: 'unchanged', createdFiles: [] };
  }

  const report = await discoverProject(rawTarget);
  if (report.git.status !== 'clean') {
    throw new Error(
      `A aplicação exige um repositório Git limpo; estado atual: ${report.git.status}`
    );
  }

  const missing = await filesToCreate(report.target);
  const manifest = `${JSON.stringify(expectedCoreManifest(), null, 2)}\n`;
  const createdFiles: string[] = [];
  try {
    for (const asset of missing) {
      await createExclusive(report.target, asset.relativePath, asset.content, options);
      createdFiles.push(asset.relativePath);
    }
    await createExclusive(report.target, MANIFEST_PATH, manifest, options);
    createdFiles.push(MANIFEST_PATH);
    return { status: 'applied', createdFiles };
  } catch (error: unknown) {
    await rollback(report.target, createdFiles);
    throw error;
  }
}
