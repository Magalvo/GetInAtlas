import { execFileSync } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: tmpdir(), encoding: 'utf8', windowsHide: true }).trim();
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true }))
  );
});

describe('isolamento do ambiente git', () => {
  it('remove as variáveis locais do repositório herdadas de um hook', () => {
    const localVariables = git('rev-parse', '--local-env-vars').split('\n');

    expect(localVariables).toContain('GIT_DIR');
    expect(localVariables.filter((name) => process.env[name] !== undefined)).toEqual([]);
  });

  it('git init num diretório temporário cria o repositório desse diretório', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ai-sdd-git-env-'));
    temporaryDirectories.push(directory);

    git('init', directory);

    expect(await realpath(git('-C', directory, 'rev-parse', '--absolute-git-dir'))).toBe(
      await realpath(join(directory, '.git'))
    );
  });
});
