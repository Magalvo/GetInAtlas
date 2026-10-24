import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { domainPackageName } from '@getinatlas/domain';
import { ESLint } from 'eslint';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

// WI-0015: o monorepo tem um só gate, e o domínio fica puro (ADR-0003).
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true }))
  );
});

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

// tsconfig.json tem comentários (JSONC): lê-se com o parser do TypeScript.
function readTsconfig(path: string): unknown {
  const result = ts.readConfigFile(resolve(path), (file) => ts.sys.readFile(file));
  if (result.error !== undefined) {
    throw new Error(ts.flattenDiagnosticMessageText(result.error.messageText, '\n'));
  }
  const config: unknown = result.config;
  return config;
}

// O project service do ESLint só analisa ficheiros que existem no disco: a sonda é
// escrita, analisada e apagada. Um erro de parsing falha o teste, para que
// "zero violações" nunca seja um falso verde.
async function restrictedImportMessages(source: string, directory: string): Promise<string[]> {
  const probe = resolve(directory, `__probe_${randomUUID()}.ts`);
  await writeFile(probe, `import * as imported from '${source}';\nexport const used = imported;\n`);
  try {
    const [result] = await new ESLint({ cwd: resolve('.') }).lintFiles([probe]);
    const messages = result?.messages ?? [];
    expect(messages.filter((message) => message.fatal === true)).toEqual([]);
    return messages
      .filter((message) => message.ruleId === 'no-restricted-imports')
      .map((message) => message.message);
  } finally {
    await rm(probe, { force: true });
  }
}

describe('workspaces (WI-0015)', () => {
  it('AC1: a raiz resolve @getinatlas/domain pelo link do workspace', () => {
    expect(domainPackageName).toBe('@getinatlas/domain');
  });

  it('AC1: packages/domain compila para dist sem os testes', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'ai-sdd-domain-build-'));
    temporaryDirectories.push(outDir);

    const result = spawnSync(
      process.execPath,
      [
        resolve('node_modules/typescript/bin/tsc'),
        '-p',
        'packages/domain/tsconfig.build.json',
        '--outDir',
        outDir,
      ],
      { encoding: 'utf8', windowsHide: true }
    );

    expect(result.stdout + result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(existsSync(join(outDir, 'index.js'))).toBe(true);
    expect(existsSync(join(outDir, 'index.d.ts'))).toBe(true);
    expect(existsSync(join(outDir, 'index.test.js'))).toBe(false);
  });

  it('AC1: a raiz declara os workspaces apps/* e packages/*', async () => {
    const pkg = z.object({ workspaces: z.array(z.string()) }).parse(await readJson('package.json'));

    expect(pkg.workspaces).toEqual(['apps/*', 'packages/*']);
  });

  it('AC2: typecheck, testes e lint cobrem os workspaces', async () => {
    const tsconfig = z
      .object({ include: z.array(z.string()) })
      .parse(readTsconfig('tsconfig.json'));
    const scripts = z
      .object({ scripts: z.object({ lint: z.string(), typecheck: z.string(), test: z.string() }) })
      .parse(await readJson('package.json')).scripts;
    const vitestConfig = await readFile(resolve('vitest.config.ts'), 'utf8');

    expect(tsconfig.include).toEqual(
      expect.arrayContaining(['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'])
    );
    expect(vitestConfig).toContain('packages/*/src/**/*.test.ts');
    expect(vitestConfig).toContain('apps/*/src/**/*.test.ts');
    expect(scripts.lint).toMatch(/\beslint src tests scripts packages apps\b/);
  });

  it('AC2: make, lefthook e CI correm os mesmos scripts npm', async () => {
    const callers = await Promise.all(
      ['Makefile', 'lefthook.yml', '.github/workflows/ci.yml'].map(async (path) =>
        readFile(resolve(path), 'utf8')
      )
    );

    for (const content of callers) {
      expect(content).toContain('npm run typecheck');
      expect(content).toContain('npm run lint');
      expect(content).toContain('npm run test');
      expect(content).not.toMatch(/npx (tsc|eslint|vitest run)\b(?! tests\/)/);
    }
  });

  it('AC3: o domínio não pode importar módulos de I/O do Node', async () => {
    for (const source of ['node:fs', 'fs', 'net', 'http', 'child_process']) {
      const messages = await restrictedImportMessages(source, 'packages/domain/src');
      expect(messages, source).toHaveLength(1);
    }
  });

  it('AC3: o domínio não pode importar de apps/*', async () => {
    for (const source of [
      '../../../apps/api/src/server.js',
      '@getinatlas/api',
      '@getinatlas/web',
    ]) {
      const messages = await restrictedImportMessages(source, 'packages/domain/src');
      expect(messages, source).toHaveLength(1);
    }
  });

  it('AC3: a regra só vale para o domínio', async () => {
    const messages = await restrictedImportMessages('node:fs', 'src');

    expect(messages).toHaveLength(0);
  });
});
