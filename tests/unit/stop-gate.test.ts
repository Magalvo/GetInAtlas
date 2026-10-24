import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

// WI-0017: o Stop hook não deixa o agente terminar enquanto o check estiver vermelho.
const stopGateScript = resolve('scripts/stop-gate.mjs');
const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ai-sdd-stop-gate-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function temporaryRepository({ dirty }: { dirty: boolean }): Promise<string> {
  const directory = await temporaryDirectory();
  execFileSync('git', ['init', directory], { stdio: 'ignore', windowsHide: true });
  if (dirty) await writeFile(join(directory, 'changed.ts'), 'export {};\n');
  return directory;
}

function nodeCommand(code: string): string {
  return JSON.stringify([process.execPath, '-e', code]);
}

function runStopGate(
  repository: string,
  stateDirectory: string,
  checkCommand: string,
  sessionId = 'session-1'
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [stopGateScript], {
    cwd: repository,
    encoding: 'utf8',
    input: JSON.stringify({ session_id: sessionId, stop_hook_active: false }),
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: repository,
      STOP_GATE_COMMAND: checkCommand,
      STOP_GATE_STATE_DIR: stateDirectory,
    },
    windowsHide: true,
  });
}

const failingCheck = nodeCommand(
  "console.error('lint: regra violada em src/x.ts'); process.exit(1)"
);
const passingCheck = nodeCommand('process.exit(0)');

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true }))
  );
});

describe('stop gate (WI-0017)', () => {
  it('AC1: com a árvore limpa deixa parar sem correr o check', async () => {
    const repository = await temporaryRepository({ dirty: false });
    const state = await temporaryDirectory();
    const marker = join(state, 'check-ran');

    const result = runStopGate(
      repository,
      state,
      nodeCommand(`require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'x')`)
    );

    expect(result.status).toBe(0);
    expect(existsSync(marker)).toBe(false);
  });

  it('AC2: com alterações e o check verde deixa parar', async () => {
    const repository = await temporaryRepository({ dirty: true });

    const result = runStopGate(repository, await temporaryDirectory(), passingCheck);

    expect(result.status).toBe(0);
  });

  it('AC3: com alterações e o check vermelho bloqueia e devolve o output', async () => {
    const repository = await temporaryRepository({ dirty: true });

    const result = runStopGate(repository, await temporaryDirectory(), failingCheck);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('make check');
    expect(result.stderr).toContain('lint: regra violada em src/x.ts');
  });

  it('AC4: ao fim de 5 bloqueios seguidos deixa parar e avisa o utilizador', async () => {
    const repository = await temporaryRepository({ dirty: true });
    const state = await temporaryDirectory();

    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(runStopGate(repository, state, failingCheck).status).toBe(2);
    }
    const sixth = runStopGate(repository, state, failingCheck);

    expect(sixth.status).toBe(0);
    const output = z.object({ systemMessage: z.string() }).parse(JSON.parse(sixth.stdout));
    expect(output.systemMessage).toContain('vermelho');
  });

  it('AC4: um check verde volta a pôr o contador a zero', async () => {
    const repository = await temporaryRepository({ dirty: true });
    const state = await temporaryDirectory();

    for (let attempt = 1; attempt <= 4; attempt++) runStopGate(repository, state, failingCheck);
    runStopGate(repository, state, passingCheck);

    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(runStopGate(repository, state, failingCheck).status).toBe(2);
    }
  });

  it('AC4: o contador é por sessão', async () => {
    const repository = await temporaryRepository({ dirty: true });
    const state = await temporaryDirectory();

    for (let attempt = 1; attempt <= 5; attempt++) {
      runStopGate(repository, state, failingCheck, 'session-a');
    }

    expect(runStopGate(repository, state, failingCheck, 'session-b').status).toBe(2);
  });

  it('AC5: o settings.json do projeto regista o hook no evento Stop, sem sintaxe de shell', async () => {
    const SettingsSchema = z.object({
      hooks: z.object({
        Stop: z.array(
          z.object({
            hooks: z.array(z.object({ type: z.literal('command'), command: z.string() })),
          })
        ),
      }),
    });

    const settings = SettingsSchema.parse(
      JSON.parse(await readFile(resolve('.claude/settings.json'), 'utf8'))
    );
    const commands = settings.hooks.Stop.flatMap((entry) =>
      entry.hooks.map((hook) => hook.command)
    );

    expect(commands.some((command) => command.includes('scripts/stop-gate.mjs'))).toBe(true);
    for (const command of commands) {
      expect(command).not.toMatch(/\|\||&&|`|\$\(/);
    }
  });
});
