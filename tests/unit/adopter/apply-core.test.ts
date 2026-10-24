import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { applyCore, CoreManifestSchema } from '../../../src/adopter/apply-core.js';

const temporaryDirectories: string[] = [];

async function temporaryRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ai-sdd-apply-'));
  temporaryDirectories.push(directory);
  execFileSync('git', ['init', directory], { stdio: 'ignore', windowsHide: true });
  return directory;
}

function git(directory: string, ...args: string[]): void {
  execFileSync('git', ['-C', directory, ...args], { stdio: 'ignore', windowsHide: true });
}

function commitAll(directory: string): void {
  git(directory, 'config', 'user.email', 'tests@example.invalid');
  git(directory, 'config', 'user.name', 'AI-SDD Tests');
  git(directory, 'add', '.');
  git(directory, 'commit', '-m', 'baseline');
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true }))
  );
});

describe('applyCore', () => {
  it('instala o core e regista o SHA-256 de cada ficheiro gerido', async () => {
    const project = await temporaryRepository();

    const result = await applyCore(project);
    const manifestRaw: unknown = JSON.parse(
      await readFile(join(project, '.ai-sdd', 'manifest.json'), 'utf8')
    );
    const manifest = CoreManifestSchema.parse(manifestRaw);

    expect(result.status).toBe('applied');
    expect(Object.keys(manifest.managedFiles)).toEqual([
      '.agent/templates/adr.md',
      '.agent/templates/track.md',
      '.agent/templates/work-item.md',
      'AGENTS.md',
      'docs/adr/README.md',
      'specs/_schema/README.md',
      'specs/items/.gitkeep',
      'specs/tracks/.gitkeep',
    ]);
    for (const [relativePath, expectedChecksum] of Object.entries(manifest.managedFiles)) {
      const content = await readFile(join(project, ...relativePath.split('/')));
      expect(createHash('sha256').update(content).digest('hex')).toBe(expectedChecksum);
    }
  });

  it('transforma uma segunda aplicação intacta num no-op determinístico', async () => {
    const project = await temporaryRepository();
    await applyCore(project);
    const before = await readFile(join(project, '.ai-sdd', 'manifest.json'), 'utf8');

    const result = await applyCore(project);

    expect(result).toEqual({ status: 'unchanged', createdFiles: [] });
    expect(await readFile(join(project, '.ai-sdd', 'manifest.json'), 'utf8')).toBe(before);
  });

  it('bloqueia conflitos existentes antes de criar qualquer ficheiro', async () => {
    const project = await temporaryRepository();
    await writeFile(join(project, 'AGENTS.md'), '# Existing project rules\n');
    commitAll(project);

    await expect(applyCore(project)).rejects.toThrow('Conflito em AGENTS.md');
    expect(await readFile(join(project, 'AGENTS.md'), 'utf8')).toBe('# Existing project rules\n');
    expect(await exists(join(project, '.ai-sdd', 'manifest.json'))).toBe(false);
    expect(await exists(join(project, 'specs', '_schema', 'README.md'))).toBe(false);
  });

  it('bloqueia uma primeira aplicação num repositório dirty', async () => {
    const project = await temporaryRepository();
    await writeFile(join(project, 'work-in-progress.txt'), 'dirty');

    await expect(applyCore(project)).rejects.toThrow('repositório Git limpo');
    expect(await exists(join(project, '.ai-sdd', 'manifest.json'))).toBe(false);
  });

  it('deteta alterações posteriores em ficheiros geridos', async () => {
    const project = await temporaryRepository();
    await applyCore(project);
    await writeFile(join(project, 'AGENTS.md'), '# Modified after adoption\n');

    await expect(applyCore(project)).rejects.toThrow('Ficheiro gerido alterado: AGENTS.md');
    expect(await readFile(join(project, 'AGENTS.md'), 'utf8')).toBe('# Modified after adoption\n');
  });

  it('remove ficheiros criados quando uma escrita falha', async () => {
    const project = await temporaryRepository();
    let writes = 0;

    await expect(
      applyCore(project, {
        beforeWrite: () => {
          writes += 1;
          if (writes === 3) throw new Error('simulated failure');
        },
      })
    ).rejects.toThrow('simulated failure');

    expect(await exists(join(project, 'AGENTS.md'))).toBe(false);
    expect(await exists(join(project, '.agent', 'templates', 'adr.md'))).toBe(false);
    expect(await exists(join(project, '.ai-sdd', 'manifest.json'))).toBe(false);
  });
});
