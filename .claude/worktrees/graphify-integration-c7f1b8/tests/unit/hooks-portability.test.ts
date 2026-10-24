import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

const protectContractScript = resolve('scripts/protect-contract.mjs');
const installHooksScript = resolve('scripts/install-hooks.mjs');
const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ai-sdd-hooks-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function temporaryRepository(): Promise<string> {
  const directory = await temporaryDirectory();
  execFileSync('git', ['init', directory], { stdio: 'ignore', windowsHide: true });
  return directory;
}

function runNodeScript(
  script: string,
  cwd: string,
  environment: NodeJS.ProcessEnv = {}
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [script], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...environment },
    windowsHide: true,
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true }))
  );
});

describe('hooks portáteis', () => {
  it('bloqueia alterações staged ao contrato e lista os ficheiros', async () => {
    const repository = await temporaryRepository();
    await mkdir(join(repository, 'tests', 'acceptance'), { recursive: true });
    await writeFile(join(repository, 'tests', 'acceptance', 'contract.test.ts'), 'contract\n');
    execFileSync('git', ['-C', repository, 'add', '.'], { stdio: 'ignore', windowsHide: true });

    const result = runNodeScript(protectContractScript, repository);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('BLOQUEADO: alterações ao CONTRATO');
    expect(result.stderr).toContain('tests/acceptance/contract.test.ts');
  });

  it('aceita o override humano explícito e recomenda ADR', async () => {
    const repository = await temporaryRepository();
    await mkdir(join(repository, 'evals', 'datasets'), { recursive: true });
    await writeFile(join(repository, 'evals', 'datasets', 'cases.jsonl'), '{}\n');
    execFileSync('git', ['-C', repository, 'add', '.'], { stdio: 'ignore', windowsHide: true });

    const result = runNodeScript(protectContractScript, repository, {
      ACCEPT_CONTRACT_CHANGE: '1',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('alteração ao contrato autorizada');
    expect(result.stdout).toContain('ADR');
  });

  it('permite alterações fora do contrato', async () => {
    const repository = await temporaryRepository();
    await writeFile(join(repository, 'README.md'), '# Readme\n');
    execFileSync('git', ['-C', repository, 'add', '.'], { stdio: 'ignore', windowsHide: true });

    expect(runNodeScript(protectContractScript, repository).status).toBe(0);
  });

  it('faz setup best-effort fora de um repositório Git', async () => {
    const directory = await temporaryDirectory();

    const result = runNodeScript(installHooksScript, directory);

    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('Lefthook não instalado');
  });

  it('não deixa sintaxe shell POSIX nos comandos do Lefthook', async () => {
    const config = await readFile(resolve('lefthook.yml'), 'utf8');

    expect(config).not.toContain('run: |');
    expect(config).not.toContain('||');
    expect(config).not.toContain('&&');
    expect(config).not.toContain('$(');
  });
});
