#!/usr/bin/env node
/**
 * Orçamento de diff — deteta scope creep de agentes.
 *
 * Se a tarefa era "corrigir o parser" e o diff toca 30 ficheiros, algo está
 * errado: o agente saiu do âmbito, ou o work-item devia ter sido partido.
 * Este script compara o branch atual com a base e falha se exceder o orçamento.
 *
 * O package-lock.json é gerado: fica fora da contagem (WI-0019), mas o relatório
 * mostra as linhas que deixou de fora e lista as dependências diretas novas —
 * é aí que está o custo real de uma dependência, para um humano rever.
 *
 * Uso:  node scripts/check-diff-budget.mjs [base-ref]
 * Env:  DIFF_BUDGET_FILES (default 15) · DIFF_BUDGET_LINES (default 800)
 *
 * Ultrapassar o orçamento conscientemente: DIFF_BUDGET_OVERRIDE=1 com
 * justificação no corpo do PR — decisão humana, não do agente.
 */
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { z } from 'zod';

const base = process.argv[2] ?? 'origin/main';
const MAX_FILES = Number(process.env.DIFF_BUDGET_FILES ?? 15);
const MAX_LINES = Number(process.env.DIFF_BUDGET_LINES ?? 800);
// Ficheiros gerados que não contam no orçamento (por nome, em qualquer pasta).
const GENERATED_FILES = new Set(['package-lock.json']);
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

const PackageJsonSchema = z
  .object(
    Object.fromEntries(DEPENDENCY_FIELDS.map((field) => [field, z.record(z.string()).optional()]))
  )
  .passthrough();

if (process.env.DIFF_BUDGET_OVERRIDE === '1') {
  console.log('⚠ Orçamento de diff ignorado por override humano (DIFF_BUDGET_OVERRIDE=1).');
  process.exit(0);
}

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  });
}

let numstat;
let mergeBase;
try {
  numstat = git(['diff', '--numstat', `${base}...HEAD`]);
  mergeBase = git(['merge-base', base, 'HEAD']).trim();
} catch {
  console.log(`ℹ Base "${base}" indisponível (repo novo?). A saltar verificação.`);
  process.exit(0);
}

// numstat: "<adicionadas>\t<removidas>\t<caminho>"; binários reportam "-".
const changes = numstat
  .split(/\r?\n/)
  .filter((line) => line !== '')
  .map((line) => {
    const [added, deleted, ...path] = line.split('\t');
    return {
      path: path.join('\t'),
      added: added === '-' ? 0 : Number(added),
      deleted: deleted === '-' ? 0 : Number(deleted),
    };
  });

const isGenerated = (change) => GENERATED_FILES.has(basename(change.path));
const counted = changes.filter((change) => !isGenerated(change));
const generated = changes.filter(isGenerated);

const sum = (list, key) => list.reduce((total, change) => total + change[key], 0);
const insertions = sum(counted, 'added');
const deletions = sum(counted, 'deleted');
const files = counted.length;
const lines = insertions + deletions;

if (changes.length === 0) {
  console.log('✓ Sem alterações face à base.');
  process.exit(0);
}

console.log(
  `Diff vs ${base}: ${files} ficheiro(s), ${lines} linha(s) (+${insertions}/-${deletions})`
);
console.log(`Orçamento: ${MAX_FILES} ficheiros, ${MAX_LINES} linhas`);
for (const change of generated) {
  console.log(`Fora do orçamento (gerado): ${change.path} (+${change.added}/-${change.deleted})`);
}

function readPackageJson(ref, path) {
  let raw;
  try {
    raw = git(['show', `${ref}:${path}`]);
  } catch {
    return null; // não existe nesta ref (novo ou apagado)
  }
  try {
    return PackageJsonSchema.parse(JSON.parse(raw));
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new Error(
      `${path} (${ref === 'HEAD' ? 'HEAD' : base}) não é um package.json válido: ${reason}`
    );
  }
}

function dependencyNames(pkg) {
  return new Map(DEPENDENCY_FIELDS.flatMap((field) => Object.entries(pkg?.[field] ?? {})));
}

try {
  const packageFiles = changes.filter((change) => basename(change.path) === 'package.json');
  for (const { path } of packageFiles) {
    const after = readPackageJson('HEAD', path);
    if (after === null) continue;
    const before = dependencyNames(readPackageJson(mergeBase, path));
    const added = [...dependencyNames(after)].filter(([name]) => !before.has(name));
    if (added.length > 0) {
      const list = added.map(([name, version]) => `${name}@${version}`).join(', ');
      console.log(`Dependências diretas novas — ${path}: ${list}`);
    }
  }
} catch (error) {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

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
