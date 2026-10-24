#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { z } from 'zod';

const ContractPaths = ['tests/acceptance/', 'evals/datasets/', 'evals/thresholds.json'];
const OverrideSchema = z.union([z.literal('1'), z.undefined()]);
const override = OverrideSchema.safeParse(process.env.ACCEPT_CONTRACT_CHANGE);

if (!override.success) {
  console.error('ACCEPT_CONTRACT_CHANGE só aceita o valor "1" ou deve ficar ausente.');
  process.exitCode = 1;
} else {
  let output;
  try {
    output = execFileSync('git', ['diff', '--cached', '--name-only', '--', ...ContractPaths], {
      encoding: 'utf8',
      windowsHide: true,
    });
  } catch (error) {
    console.error('Não foi possível verificar alterações staged ao contrato. Commit bloqueado.');
    console.error(error instanceof Error ? error.message : 'Erro Git desconhecido');
    process.exitCode = 1;
  }

  if (output !== undefined) {
    const changed = z
      .string()
      .parse(output)
      .split(/\r?\n/u)
      .filter((path) => path !== '');

    if (changed.length > 0 && override.data !== '1') {
      console.error('\n✗ BLOQUEADO: alterações ao CONTRATO:');
      for (const path of changed) console.error(`    ${path}`);
      console.error('\nO contrato humano↔agente não pode ser alterado silenciosamente.');
      console.error('Decisão humana: ACCEPT_CONTRACT_CHANGE=1 git commit ...');
      console.error('Regista também a justificação num ADR em docs/adr/.\n');
      process.exitCode = 1;
    } else if (changed.length > 0) {
      console.log('✓ alteração ao contrato autorizada explicitamente; confirma o ADR associado.');
    }
  }
}
