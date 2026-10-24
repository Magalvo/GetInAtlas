#!/usr/bin/env node
/**
 * Stop hook do Claude Code (WI-0017) — o self-healing loop dentro da sessão.
 *
 * Quando o agente tenta terminar com alterações por commitar, corre `make check`.
 * Vermelho → exit 2: o Claude Code não deixa parar e devolve o stderr ao agente,
 * que lê o erro e corrige. Árvore limpa → nada a verificar (o pre-commit já
 * validou cada commit).
 *
 * Ao fim de MAX_CONSECUTIVE_BLOCKS bloqueios seguidos na mesma sessão deixa
 * parar e avisa o utilizador: se o agente não consegue corrigir, a decisão é
 * humana, e um loop infinito não ajuda ninguém.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const MAX_CONSECUTIVE_BLOCKS = 5;
const OUTPUT_TAIL_CHARS = 4000;

const HookInputSchema = z.object({ session_id: z.string().min(1) }).passthrough();
// STOP_GATE_COMMAND permite aos testes trocar o check (array JSON, sem shell).
const CommandSchema = z.array(z.string().min(1)).min(1);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const stateDir = process.env.STOP_GATE_STATE_DIR ?? join(tmpdir(), 'ai-sdd-stop-gate');

function readHookInput() {
  try {
    return HookInputSchema.parse(JSON.parse(readFileSync(0, 'utf8')));
  } catch {
    return null;
  }
}

function hasUncommittedChanges() {
  const status = execFileSync('git', ['status', '--porcelain'], {
    cwd: projectDir,
    encoding: 'utf8',
    windowsHide: true,
  });
  return z.string().parse(status).trim() !== '';
}

function checkCommand() {
  const raw = process.env.STOP_GATE_COMMAND;
  return raw === undefined ? ['make', 'check'] : CommandSchema.parse(JSON.parse(raw));
}

// O id da sessão vira nome de ficheiro: só caracteres seguros.
function counterFile(sessionId) {
  return join(stateDir, `${sessionId.replace(/[^\w-]/g, '_')}.count`);
}

function readCounter(file) {
  try {
    return z.coerce.number().int().nonnegative().parse(readFileSync(file, 'utf8').trim());
  } catch {
    return 0;
  }
}

function writeCounter(file, value) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(file, String(value));
}

const input = readHookInput();
if (input === null) {
  console.error('stop-gate: input do hook inválido; o check não correu.');
  process.exit(0);
}

const counter = counterFile(input.session_id);

if (!hasUncommittedChanges()) {
  writeCounter(counter, 0);
  process.exit(0);
}

const [command, ...args] = checkCommand();
const result = spawnSync(command, args, {
  cwd: projectDir,
  encoding: 'utf8',
  windowsHide: true,
});

if (result.status === 0) {
  writeCounter(counter, 0);
  process.exit(0);
}

const blocks = readCounter(counter) + 1;
if (blocks > MAX_CONSECUTIVE_BLOCKS) {
  writeCounter(counter, 0);
  console.log(
    JSON.stringify({
      systemMessage: `⚠ make check continua vermelho ao fim de ${String(MAX_CONSECUTIVE_BLOCKS)} tentativas; o agente parou sem o corrigir. Precisa de decisão humana.`,
    })
  );
  process.exit(0);
}

writeCounter(counter, blocks);
const output = `${result.stdout}\n${result.stderr}`.trim();
console.error(
  `make check está vermelho (tentativa ${String(blocks)}/${String(MAX_CONSECUTIVE_BLOCKS)}). ` +
    'Lê o erro, corrige e volta a correr make check antes de terminar.\n\n' +
    output.slice(-OUTPUT_TAIL_CHARS)
);
process.exit(2);
