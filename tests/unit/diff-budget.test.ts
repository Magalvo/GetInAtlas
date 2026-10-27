import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

// WI-0019: o package-lock.json (gerado) não conta no orçamento de diff.
const checkScript = resolve('scripts/check-diff-budget.mjs');
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true }))
  );
});

type Files = Record<string, string | Buffer>;

function git(repository: string, args: string[]): void {
  execFileSync('git', ['-C', repository, ...args], { stdio: 'ignore', windowsHide: true });
}

async function writeFiles(repository: string, files: Files): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(repository, path)), { recursive: true });
    await writeFile(join(repository, path), content);
  }
}

/** Um repositório com `main` (base) e um branch com a alteração. */
async function repositoryWithChange(baseFiles: Files, changedFiles: Files): Promise<string> {
  const repository = await mkdtemp(join(tmpdir(), 'ai-sdd-diff-budget-'));
  temporaryDirectories.push(repository);
  git(repository, ['init', '-b', 'main']);
  git(repository, ['config', 'user.email', 'tests@example.invalid']);
  git(repository, ['config', 'user.name', 'Tests']);
  await writeFiles(repository, { 'README.md': 'base\n', ...baseFiles });
  git(repository, ['add', '.']);
  git(repository, ['commit', '-m', 'base']);
  git(repository, ['checkout', '-b', 'feature']);
  await writeFiles(repository, changedFiles);
  git(repository, ['add', '.']);
  git(repository, ['commit', '-m', 'change']);
  return repository;
}

function runBudget(repository: string, env: NodeJS.ProcessEnv = {}): SpawnSyncReturns<string> {
  // Sem as variáveis do orçamento herdadas do ambiente (o job de CI define o override).
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('DIFF_BUDGET_'))
  );
  return spawnSync(process.execPath, [checkScript, 'main'], {
    cwd: repository,
    encoding: 'utf8',
    env: { ...inherited, ...env },
    windowsHide: true,
  });
}

function lines(count: number): string {
  return Array.from({ length: count }, (_, index) => `line ${String(index)}`).join('\n') + '\n';
}

function manyFiles(count: number): Files {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`src/file-${String(index)}.ts`, 'x\n'])
  );
}

describe('orçamento de diff (WI-0019)', () => {
  it('AC1: o package-lock.json não conta nos ficheiros nem nas linhas', async () => {
    const repository = await repositoryWithChange(
      {},
      { 'package-lock.json': lines(1000), 'src/a.ts': lines(10) }
    );

    const result = runBudget(repository);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1 ficheiro(s), 10 linha(s)');
  });

  it('AC1: 15 ficheiros normais mais o lockfile cabem no orçamento', async () => {
    const repository = await repositoryWithChange(
      {},
      { ...manyFiles(15), 'package-lock.json': lines(5) }
    );

    expect(runBudget(repository).status).toBe(0);
  });

  it('AC1: um package-lock.json dentro de um workspace também fica de fora', async () => {
    const repository = await repositoryWithChange(
      {},
      { 'apps/api/package-lock.json': lines(1000) }
    );

    expect(runBudget(repository).status).toBe(0);
  });

  it('AC2: o relatório mostra as linhas do lockfile que deixou de fora', async () => {
    const repository = await repositoryWithChange(
      {},
      { 'package-lock.json': lines(1000), 'src/a.ts': lines(10) }
    );

    expect(runBudget(repository).stdout).toContain(
      'Fora do orçamento (gerado): package-lock.json (+1000/-0)'
    );
  });

  it('AC3: lista as dependências diretas novas, com a versão', async () => {
    const repository = await repositoryWithChange(
      { 'apps/api/package.json': JSON.stringify({ dependencies: { pg: '^8.0.0' } }) },
      {
        'apps/api/package.json': JSON.stringify({
          dependencies: { pg: '^8.23.1', fastify: '^5.6.0' },
          devDependencies: { vitest: '^2.1.0' },
        }),
      }
    );

    const result = runBudget(repository);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('apps/api/package.json: fastify@^5.6.0, vitest@^2.1.0');
    expect(result.stdout).not.toContain('pg@');
  });

  it('AC3: um package.json novo lista todas as suas dependências', async () => {
    const repository = await repositoryWithChange(
      {},
      { 'apps/web/package.json': JSON.stringify({ dependencies: { react: '^18.3.1' } }) }
    );

    expect(runBudget(repository).stdout).toContain('apps/web/package.json: react@^18.3.1');
  });

  it('AC3: um package.json inválido falha a nomear o ficheiro', async () => {
    const repository = await repositoryWithChange({}, { 'apps/api/package.json': '{ not json' });

    const result = runBudget(repository);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('apps/api/package.json');
  });

  it('AC4: um ficheiro normal de 900 linhas continua a exceder', async () => {
    const repository = await repositoryWithChange({}, { 'src/big.ts': lines(900) });

    const result = runBudget(repository);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('EXCEDIDO');
  });

  it('AC4: 16 ficheiros normais continuam a exceder, e um binário conta como ficheiro', async () => {
    const tooManyFiles = await repositoryWithChange({}, manyFiles(16));
    const withBinary = await repositoryWithChange(
      {},
      { ...manyFiles(15), 'assets/logo.png': Buffer.from([0, 1, 2, 0, 255]) }
    );

    expect(runBudget(tooManyFiles).status).toBe(1);
    expect(runBudget(withBinary).status).toBe(1);
  });

  it('AC4: o override humano continua a funcionar', async () => {
    const repository = await repositoryWithChange({}, { 'src/big.ts': lines(900) });

    expect(runBudget(repository, { DIFF_BUDGET_OVERRIDE: '1' }).status).toBe(0);
  });
});
