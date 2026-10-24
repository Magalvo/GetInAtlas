#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('./check-diff-budget.mjs', import.meta.url));
const result = spawnSync(process.execPath, [checker], {
  cwd: process.cwd(),
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error || result.status !== 0) {
  console.warn('⚠ Diff-budget excedido localmente; o CI será bloqueante.');
}
