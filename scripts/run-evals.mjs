#!/usr/bin/env node
/**
 * Runner de evals — o "vitest" dos componentes probabilísticos.
 *
 * Para cada dataset em evals/thresholds.json:
 *   1. Carrega os casos (JSONL) de evals/datasets/
 *   2. Importa o subject (o sistema sob avaliação) e corre cada caso
 *   3. Calcula a métrica e compara com o threshold mínimo
 *
 * Exit code ≠ 0 se alguma métrica ficar abaixo do mínimo — bloqueante no CI,
 * tal como um teste vermelho.
 *
 * Métricas:
 *   - exact_match: accuracy sobre labels (implementada)
 *   - llm_judge:   um segundo modelo pontua o output contra uma rubrica —
 *                  necessária para texto livre. Esqueleto: pontuar cada output
 *                  de 1-5 com um prompt de rubrica + exigir média ≥ min.
 *                  Requer ANTHROPIC_API_KEY/OPENAI_API_KEY; por isso não vem
 *                  implementada por defeito num boilerplate offline.
 *
 * Nota anti-reward-hacking: este runner lê thresholds.json e datasets/, que são
 * CONTRATO (protegidos pelo hook). A versão estatística de "enfraquecer o teste"
 * é baixar o threshold ou apagar casos difíceis — ambas bloqueadas.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;

const config = JSON.parse(await readFile(join(ROOT, 'evals/thresholds.json'), 'utf8'));

let anyFailed = false;

for (const [name, spec] of Object.entries(config.datasets)) {
  const datasetPath = join(ROOT, 'evals/datasets', `${name}.jsonl`);
  const lines = (await readFile(datasetPath, 'utf8')).split('\n').filter(Boolean);
  const cases = lines.map((line) => JSON.parse(line));

  const subjectModule = await import(pathToFileURL(join(ROOT, spec.subject)).href);
  const subject = subjectModule.default;

  if (spec.metric !== 'exact_match') {
    console.error(`✗ [${name}] métrica "${spec.metric}" não implementada neste runner.`);
    anyFailed = true;
    continue;
  }

  const failures = [];
  for (const testCase of cases) {
    const actual = await subject(testCase.input);
    if (actual !== testCase.expected) {
      failures.push({ ...testCase, actual });
    }
  }

  const score = (cases.length - failures.length) / cases.length;
  const passed = score >= spec.min;
  anyFailed ||= !passed;

  const icon = passed ? '✓' : '✗';
  console.log(
    `${icon} [${name}] ${spec.metric}: ${score.toFixed(3)} ` +
      `(mínimo ${spec.min}) — ${cases.length - failures.length}/${cases.length} casos`
  );

  // Mostrar falhas: são o material para melhorar o subject (ou promover a caso de estudo)
  for (const f of failures.slice(0, 10)) {
    console.log(`    · ${f.id}: "${f.input}" → esperado ${f.expected}, obtido ${f.actual}`);
  }
  if (failures.length > 10) console.log(`    · … +${failures.length - 10} falhas`);
}

if (anyFailed) {
  console.error(
    '\n✗ Eval abaixo do threshold. Melhora o subject (prompt/modelo/lógica).\n' +
      '  NÃO baixes o threshold nem removas casos — isso é contrato\n' +
      '  (decisão humana: ACCEPT_CONTRACT_CHANGE=1 + ADR).\n'
  );
  process.exit(1);
}

console.log('\n✓ Todos os evals acima dos thresholds.');
