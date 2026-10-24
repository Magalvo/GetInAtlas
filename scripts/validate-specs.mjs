#!/usr/bin/env node
/**
 * Validador do corpus de specs — "lint para markdown".
 *
 * O problema que resolve: SDD escala mal sem validação. Com dezenas/centenas de
 * specs, aparecem refs quebradas, IDs duplicados, tracks órfãos e drift de schema
 * — e o agente carrega a slice errada de contexto sem ninguém reparar.
 *
 * Regras: ver specs/_schema/README.md. Exit code ≠ 0 se algo falhar,
 * para que o pre-commit e o CI bloqueiem.
 */
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TRACKS_DIR = join(ROOT, 'specs/tracks');
const ITEMS_DIR = join(ROOT, 'specs/items');

const TrackSchema = z.object({
  id: z.string().regex(/^WT-\d{4}$/, 'id deve ter o formato WT-NNNN'),
  title: z.string().min(3),
  status: z.enum(['draft', 'active', 'done', 'abandoned']),
  owner: z.string().min(1),
});

const ItemSchema = z.object({
  id: z.string().regex(/^WI-\d{4}$/, 'id deve ter o formato WI-NNNN'),
  title: z.string().min(3),
  status: z.enum(['draft', 'ready', 'in-progress', 'done', 'abandoned']),
  track: z.string().regex(/^WT-\d{4}$/),
  owner: z.string().min(1),
  acceptance: z.array(z.record(z.string())).optional(),
});

const errors = [];
const fail = (file, msg) => errors.push(`  ✗ ${file}: ${msg}`);

function extractFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  return match ? parseYaml(match[1]) : null;
}

async function loadSpecs(dir, schema, label) {
  let files;
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  } catch {
    fail(dir, `pasta em falta`);
    return [];
  }
  const specs = [];
  for (const file of files) {
    const path = join(dir, file);
    const raw = await readFile(path, 'utf8');
    const fm = extractFrontmatter(raw);
    if (!fm) {
      fail(file, 'sem frontmatter YAML');
      continue;
    }
    const result = schema.safeParse(fm);
    if (!result.success) {
      for (const issue of result.error.issues) {
        fail(file, `${label}.${issue.path.join('.')}: ${issue.message}`);
      }
      continue;
    }
    if (!basename(file).startsWith(result.data.id)) {
      fail(file, `o nome do ficheiro deve começar pelo id "${result.data.id}"`);
    }
    specs.push({ file, ...result.data });
  }
  return specs;
}

function checkUniqueIds(specs) {
  const seen = new Map();
  for (const spec of specs) {
    if (seen.has(spec.id)) {
      fail(spec.file, `id duplicado "${spec.id}" (também em ${seen.get(spec.id)})`);
    } else {
      seen.set(spec.id, spec.file);
    }
  }
}

const tracks = await loadSpecs(TRACKS_DIR, TrackSchema, 'track');
const items = await loadSpecs(ITEMS_DIR, ItemSchema, 'item');

checkUniqueIds([...tracks, ...items]);

// Refs quebradas: todo o item aponta para um track existente
const trackIds = new Set(tracks.map((t) => t.id));
for (const item of items) {
  if (!trackIds.has(item.track)) {
    fail(item.file, `referência quebrada: track "${item.track}" não existe`);
  }
}

// Tracks ativos órfãos (sem nenhum work-item): sinal de drift
const referencedTracks = new Set(items.map((i) => i.track));
for (const track of tracks) {
  if (track.status === 'active' && !referencedTracks.has(track.id)) {
    fail(track.file, `track ativo sem work-items (órfão)`);
  }
}

// Items prontos para execução precisam de critérios de aceitação
for (const item of items) {
  const needsAcceptance = ['ready', 'in-progress', 'done'].includes(item.status);
  if (needsAcceptance && (!item.acceptance || item.acceptance.length === 0)) {
    fail(item.file, `status "${item.status}" exige ≥1 critério de aceitação`);
  }
}

if (errors.length > 0) {
  console.error(`\nValidação de specs FALHOU (${errors.length} erro(s)):\n`);
  console.error(errors.join('\n'));
  console.error('\nVer specs/_schema/README.md para o schema.\n');
  process.exit(1);
}

console.log(`✓ Specs válidas: ${tracks.length} track(s), ${items.length} work-item(s).`);
