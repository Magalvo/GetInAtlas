import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverProject } from '../../../src/adopter/discover-project.js';

const temporaryDirectories: string[] = [];

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ai-sdd-adopter-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function tree(directory: string): Promise<string[]> {
  return (await readdir(directory, { recursive: true })).sort();
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true }))
  );
});

describe('discoverProject', () => {
  it('deteta TypeScript por evidência validada no package.json', async () => {
    const project = await temporaryProject();
    await writeFile(
      join(project, 'package.json'),
      JSON.stringify({ devDependencies: { typescript: '^5.7.0' } })
    );

    const report = await discoverProject(project);

    expect(report.detectedStacks).toEqual([
      { name: 'typescript', evidence: ['package.json:devDependencies.typescript'] },
    ]);
    expect(report.recommendedProfile).toBe('typescript');
    expect(report.git.status).toBe('not-repository');
  });

  it('deteta stacks conhecidas através de marcadores locais', async () => {
    const project = await temporaryProject();
    await writeFile(join(project, 'pyproject.toml'), '[project]\nname = "demo"\n');
    await writeFile(join(project, 'Cargo.toml'), '[package]\nname = "demo"\n');
    await writeFile(join(project, 'pubspec.yaml'), 'dependencies:\n  flutter:\n    sdk: flutter\n');

    const report = await discoverProject(project);

    expect(report.detectedStacks.map(({ name }) => name)).toEqual(['flutter', 'python', 'rust']);
    expect(report.recommendedProfile).toBe('flutter');
  });

  it('reporta governação parcial e conflitos sem escrever no projeto', async () => {
    const project = await temporaryProject();
    await mkdir(join(project, 'specs'));
    await mkdir(join(project, '.github', 'workflows'), { recursive: true });
    await writeFile(join(project, 'AGENTS.md'), '# Existing rules\n');
    await writeFile(join(project, 'Makefile'), 'check:\n\t@echo ok\n');
    const before = await tree(project);

    const report = await discoverProject(project);

    expect(report.governance).toEqual({
      agentsInstructions: true,
      specs: true,
      commandInterface: true,
      continuousIntegration: true,
    });
    expect(report.conflicts).toEqual(['AGENTS.md', 'Makefile', 'specs/', '.github/workflows/']);
    expect(await tree(project)).toEqual(before);
    expect(await readFile(join(project, 'AGENTS.md'), 'utf8')).toBe('# Existing rules\n');
  });

  it('distingue repositórios Git limpos e com alterações', async () => {
    const project = await temporaryProject();
    execFileSync('git', ['init', project], { stdio: 'ignore', windowsHide: true });

    expect((await discoverProject(project)).git.status).toBe('clean');

    await writeFile(join(project, 'untracked.txt'), 'change');
    expect((await discoverProject(project)).git.status).toBe('dirty');
  });

  it('mantém package.json inválido como warning e recomenda o core', async () => {
    const project = await temporaryProject();
    await writeFile(join(project, 'package.json'), '{ invalid');

    const first = await discoverProject(project);
    const second = await discoverProject(project);

    expect(second).toEqual(first);
    expect(first.detectedStacks).toEqual([{ name: 'unknown', evidence: [] }]);
    expect(first.recommendedProfile).toBe('core');
    expect(first.warnings).toContain('package.json não contém JSON válido; ignorado na deteção');
  });

  it('rejeita paths inexistentes e ficheiros', async () => {
    const project = await temporaryProject();
    const file = join(project, 'not-a-directory');
    await writeFile(file, 'content');

    await expect(discoverProject(join(project, 'missing'))).rejects.toThrow('não existe');
    await expect(discoverProject(file)).rejects.toThrow('não é um diretório');
  });
});
