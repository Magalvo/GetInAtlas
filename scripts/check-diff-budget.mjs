#!/usr/bin/env node
/**
 * Orçamento de diff — deteta scope creep de agentes.
 *
 * Se a tarefa era "corrigir o parser" e o diff toca 30 ficheiros, algo está
 * errado: o agente saiu do âmbito, ou o work-item devia ter sido partido.
 * Este script compara o branch atual com a base e falha se exceder o orçamento.
 *
 * Uso:  node scripts/check-diff-budget.mjs [base-ref]
 * Env:  DIFF_BUDGET_FILES (default 15) · DIFF_BUDGET_LINES (default 800)
 *
 * Ultrapassar o orçamento conscientemente: DIFF_BUDGET_OVERRIDE=1 com
 * justificação no corpo do PR — decisão humana, não do agente.
 */
import { execSync } from 'node:child_process';

const base = process.argv[2] ?? 'origin/main';
const MAX_FILES = Number(process.env.DIFF_BUDGET_FILES ?? 15);
const MAX_LINES = Number(process.env.DIFF_BUDGET_LINES ?? 800);

if (process.env.DIFF_BUDGET_OVERRIDE === '1') {
  console.log('⚠ Orçamento de diff ignorado por override humano (DIFF_BUDGET_OVERRIDE=1).');
  process.exit(0);
}

let stat;
try {
  stat = execSync(`git diff --shortstat ${base}...HEAD`, { encoding: 'utf8' }).trim();
} catch {
  console.log(`ℹ Base "${base}" indisponível (repo novo?). A saltar verificação.`);
  process.exit(0);
}

if (!stat) {
  console.log('✓ Sem alterações face à base.');
  process.exit(0);
}

const files = Number(/(\d+) files? changed/.exec(stat)?.[1] ?? 0);
const insertions = Number(/(\d+) insertions?/.exec(stat)?.[1] ?? 0);
const deletions = Number(/(\d+) deletions?/.exec(stat)?.[1] ?? 0);
const lines = insertions + deletions;

console.log(
  `Diff vs ${base}: ${files} ficheiro(s), ${lines} linha(s) (+${insertions}/-${deletions})`
);
console.log(`Orçamento: ${MAX_FILES} ficheiros, ${MAX_LINES} linhas`);

if (files > MAX_FILES || lines > MAX_LINES) {
  console.error(
    '\n✗ Orçamento de diff EXCEDIDO.\n' +
      '  Provável scope creep. Opções:\n' +
      '  1. Partir o work-item em tarefas menores (preferível).\n' +
      '  2. Override humano consciente: DIFF_BUDGET_OVERRIDE=1 + justificação no PR.\n'
  );
  process.exit(1);
}

console.log('✓ Dentro do orçamento.');
