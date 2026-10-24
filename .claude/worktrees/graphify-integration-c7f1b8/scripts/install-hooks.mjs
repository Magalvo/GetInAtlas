#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const lefthookEntry = fileURLToPath(
  new URL('../node_modules/lefthook/bin/index.js', import.meta.url)
);
const result = spawnSync(process.execPath, [lefthookEntry, 'install'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error || result.status !== 0) {
  console.warn(
    '⚠ Lefthook não instalado; continua sem hooks locais até existir um repositório Git válido.'
  );
}
