#!/usr/bin/env node
/**
 * Scaffold de uma work-spec (camada 4, ADR-0006) a partir do seu work-item.
 *
 * Uso: node scripts/new-spec.mjs WI-NNNN   (via `make new-spec ITEM=WI-NNNN`)
 *
 * Deriva o id (WS com o mesmo número), o título, o dono e o slug do item.
 * Nunca sobrescreve: uma work-spec existente edita-se e volta a draft.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

// SPECS_ROOT permite correr o scaffold contra um corpus de teste.
const ROOT = process.env.SPECS_ROOT ?? fileURLToPath(new URL('..', import.meta.url));
const itemId = process.argv[2] ?? '';

function abort(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!/^WI-\d{4}$/.test(itemId)) abort('uso: make new-spec ITEM=WI-NNNN');

const itemFile = (await readdir(join(ROOT, 'specs/items'))).find(
  (file) => file.startsWith(`${itemId}-`) && file.endsWith('.md')
);
if (!itemFile) abort(`o work-item ${itemId} não existe em specs/items/`);

const raw = await readFile(join(ROOT, 'specs/items', itemFile), 'utf8');
const item = parseYaml(/^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1] ?? '') ?? {};
const id = `WS-${itemId.slice(3)}`;
const relativeTarget = `specs/work-specs/${id}${itemFile.slice(itemId.length)}`;
if (existsSync(join(ROOT, relativeTarget))) {
  abort(`${relativeTarget} já existe — edita-a e volta a pô-la em draft`);
}

const title = String(item.title ?? '');
const owner = String(item.owner ?? '<nome-humano>');
// Valores entre aspas simples no YAML: a aspa escapa-se duplicando-a.
const yamlQuoted = (value) => value.replaceAll("'", "''");
const template = await readFile(join(ROOT, '.agent/templates/work-spec.md'), 'utf8');
const content = template
  .replaceAll('{{ID}}', id)
  .replaceAll('{{ITEM}}', itemId)
  .replaceAll('{{TITLE_YAML}}', yamlQuoted(title))
  .replaceAll('{{TITLE}}', title)
  .replaceAll('{{OWNER_YAML}}', yamlQuoted(owner));

await mkdir(join(ROOT, 'specs/work-specs'), { recursive: true });
await writeFile(join(ROOT, relativeTarget), content, { flag: 'wx' });
console.log(`✓ ${relativeTarget}`);
