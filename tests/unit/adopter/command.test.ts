import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { applyCore } from '../../../src/adopter/apply-core.js';
import { runAdopterCli } from '../../../src/adopter/command.js';

const temporaryDirectories: string[] = [];

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ai-sdd-cli-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true }))
  );
});

function outputCollector(): { lines: string[]; write: (value: string) => void } {
  const lines: string[] = [];
  return { lines, write: (value) => lines.push(value) };
}

describe('runAdopterCli', () => {
  it('produz JSON determinístico para adopt --json', async () => {
    const project = await temporaryProject();
    await writeFile(join(project, 'tsconfig.json'), '{}');
    const stdout = outputCollector();
    const stderr = outputCollector();

    const exitCode = await runAdopterCli(['adopt', project, '--json'], {
      stdout: stdout.write,
      stderr: stderr.write,
    });

    expect(exitCode).toBe(0);
    expect(stderr.lines).toEqual([]);
    const output: unknown = JSON.parse(stdout.lines.join(''));
    expect(output).toMatchObject({ mode: 'dry-run', recommendedProfile: 'typescript' });
  });

  it('produz um plano humano por defeito', async () => {
    const project = await temporaryProject();
    const stdout = outputCollector();
    const stderr = outputCollector();

    const exitCode = await runAdopterCli(['adopt', project], {
      stdout: stdout.write,
      stderr: stderr.write,
    });

    expect(exitCode).toBe(0);
    expect(stdout.lines.join('')).toContain('Plano de adoção (dry-run)');
    expect(stdout.lines.join('')).toContain('Profile recomendado: core');
  });

  it('aplica o core quando --apply é explícito', async () => {
    const project = await temporaryProject();
    execFileSync('git', ['init', project], { stdio: 'ignore', windowsHide: true });
    const stdout = outputCollector();
    const stderr = outputCollector();

    const exitCode = await runAdopterCli(['adopt', project, '--apply'], {
      stdout: stdout.write,
      stderr: stderr.write,
    });

    expect(exitCode).toBe(0);
    expect(stderr.lines).toEqual([]);
    expect(stdout.lines.join('')).toContain('Core AI-SDD aplicado');
  });

  it('resolve --profile auto e aplica TypeScript depois do core', async () => {
    const project = await temporaryProject();
    execFileSync('git', ['init', project], { stdio: 'ignore', windowsHide: true });
    execFileSync('git', ['-C', project, 'config', 'user.email', 'tests@example.invalid']);
    execFileSync('git', ['-C', project, 'config', 'user.name', 'AI-SDD Tests']);
    await writeFile(join(project, 'package.json'), '{"name":"demo"}\n');
    await writeFile(join(project, 'tsconfig.json'), '{}\n');
    execFileSync('git', ['-C', project, 'add', '.'], { stdio: 'ignore', windowsHide: true });
    execFileSync('git', ['-C', project, 'commit', '-m', 'baseline'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await applyCore(project);
    execFileSync('git', ['-C', project, 'add', '.'], { stdio: 'ignore', windowsHide: true });
    execFileSync('git', ['-C', project, 'commit', '-m', 'core'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    const stdout = outputCollector();
    const stderr = outputCollector();

    const exitCode = await runAdopterCli(['adopt', project, '--apply', '--profile', 'auto'], {
      stdout: stdout.write,
      stderr: stderr.write,
    });

    expect(exitCode).toBe(0);
    expect(stderr.lines).toEqual([]);
    expect(stdout.lines.join('')).toContain('Profile TypeScript aplicado');
  });

  it('rejeita opções desconhecidas', async () => {
    const stdout = outputCollector();
    const stderr = outputCollector();

    const exitCode = await runAdopterCli(['adopt', '.', '--force'], {
      stdout: stdout.write,
      stderr: stderr.write,
    });

    expect(exitCode).toBe(2);
    expect(stdout.lines).toEqual([]);
    expect(stderr.lines.join('')).toContain('Opção desconhecida: --force');
    expect(stderr.lines.join('')).toContain(
      'Uso: ai-sdd adopt <diretório> [--apply] [--profile core|typescript|auto] [--json]'
    );
  });
});
