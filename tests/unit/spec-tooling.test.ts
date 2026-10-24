import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

const validateScript = resolve('scripts/validate-specs.mjs');
const newSpecScript = resolve('scripts/new-spec.mjs');
const workSpecTemplate = resolve('.agent/templates/work-spec.md');
const temporaryDirectories: string[] = [];

const metric = '## Success metric\n\nSomething measurable.\n';

function track(status: string, body = metric): string {
  return `---\nid: WT-0001\ntitle: Track\nstatus: ${status}\nowner: Diogo\n---\n\n# WT-0001\n\n${body}`;
}

function item(id: string, status: string, title = 'Item'): string {
  return `---\nid: ${id}\ntitle: ${JSON.stringify(title)}\nstatus: ${status}\ntrack: WT-0001\nowner: Diogo\nacceptance:\n  - AC1: something verifiable\n---\n`;
}

function workSpec(id: string, itemId: string, status: string): string {
  return `---\nid: ${id}\ntitle: Spec\nitem: ${itemId}\nstatus: ${status}\nowner: Diogo\n---\n`;
}

async function corpus(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'ai-sdd-specs-'));
  temporaryDirectories.push(root);
  await mkdir(join(root, 'specs', 'tracks'), { recursive: true });
  await mkdir(join(root, 'specs', 'items'), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

function run(script: string, root: string, args: string[] = []): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, SPECS_ROOT: root },
    windowsHide: true,
  });
}

const validate = (root: string): SpawnSyncReturns<string> => run(validateScript, root);

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true }))
  );
});

describe('validador de specs — work-specs (WI-0012)', () => {
  it('AC1: aceita uma work-spec válida', async () => {
    const root = await corpus({
      'specs/tracks/WT-0001-t.md': track('active'),
      'specs/items/WI-0001-i.md': item('WI-0001', 'draft'),
      'specs/work-specs/WS-0001-i.md': workSpec('WS-0001', 'WI-0001', 'draft'),
    });

    expect(validate(root).status).toBe(0);
  });

  it('AC1: rejeita frontmatter inválido e nomeia o campo', async () => {
    const root = await corpus({
      'specs/tracks/WT-0001-t.md': track('active'),
      'specs/items/WI-0001-i.md': item('WI-0001', 'draft'),
      'specs/work-specs/WS-0001-i.md': workSpec('WS-0001', 'WI-0001', 'done'),
    });

    const result = validate(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('status');
  });

  it('AC2: rejeita uma work-spec cujo item não existe', async () => {
    const root = await corpus({
      'specs/tracks/WT-0001-t.md': track('active'),
      'specs/items/WI-0001-i.md': item('WI-0001', 'draft'),
      'specs/work-specs/WS-0099-x.md': workSpec('WS-0099', 'WI-0099', 'draft'),
    });

    const result = validate(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('WI-0099');
  });

  it('AC3: rejeita uma work-spec com número diferente do item', async () => {
    const root = await corpus({
      'specs/tracks/WT-0001-t.md': track('active'),
      'specs/items/WI-0001-i.md': item('WI-0001', 'draft'),
      'specs/work-specs/WS-0002-i.md': workSpec('WS-0002', 'WI-0001', 'draft'),
    });

    const result = validate(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('WS-0002');
  });

  it.each([
    ['sem work-spec', {}],
    [
      'com work-spec em draft',
      { 'specs/work-specs/WS-0001-i.md': workSpec('WS-0001', 'WI-0001', 'draft') },
    ],
  ])('AC4: rejeita um item ready %s', async (_, extra) => {
    const root = await corpus({
      'specs/tracks/WT-0001-t.md': track('active'),
      'specs/items/WI-0001-i.md': item('WI-0001', 'ready'),
      ...extra,
    });

    const result = validate(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('approved');
  });

  it('AC4: aceita um item in-progress com work-spec aprovada', async () => {
    const root = await corpus({
      'specs/tracks/WT-0001-t.md': track('active'),
      'specs/items/WI-0001-i.md': item('WI-0001', 'in-progress'),
      'specs/work-specs/WS-0001-i.md': workSpec('WS-0001', 'WI-0001', 'approved'),
    });

    expect(validate(root).status).toBe(0);
  });

  it.each(['draft', 'done'])('AC4: um item %s não precisa de work-spec', async (status) => {
    const root = await corpus({
      'specs/tracks/WT-0001-t.md': track('active'),
      'specs/items/WI-0001-i.md': item('WI-0001', status),
    });

    expect(validate(root).status).toBe(0);
  });

  it.each([
    ['sem a secção', '## Objective\n\nText.\n'],
    ['com a secção vazia', '## Success metric\n\n## Scope\n\nText.\n'],
  ])('AC5: rejeita um track ativo %s', async (_, body) => {
    const root = await corpus({
      'specs/tracks/WT-0001-t.md': track('active', body),
      'specs/items/WI-0001-i.md': item('WI-0001', 'draft'),
    });

    const result = validate(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('métrica de sucesso');
  });

  it.each([
    ['active', '## Métrica de sucesso\r\n\r\nAlgo mensurável.\r\n'],
    ['active', metric],
    ['draft', '## Objective\n\nText.\n'],
  ])('AC5: aceita um track %s com corpo válido', async (status, body) => {
    const root = await corpus({
      'specs/tracks/WT-0001-t.md': track(status, body),
      'specs/items/WI-0001-i.md': item('WI-0001', 'draft'),
    });

    expect(validate(root).status).toBe(0);
  });
});

describe('scaffold de work-specs — make new-spec (WI-0012)', () => {
  async function corpusWithTemplate(files: Record<string, string>): Promise<string> {
    const root = await corpus(files);
    await mkdir(join(root, '.agent', 'templates'), { recursive: true });
    await copyFile(workSpecTemplate, join(root, '.agent', 'templates', 'work-spec.md'));
    return root;
  }

  it('AC6: cria a work-spec a partir do item, em draft e válida', async () => {
    const root = await corpusWithTemplate({
      'specs/tracks/WT-0001-t.md': track('active'),
      'specs/items/WI-0007-book-a-slot.md': item(
        'WI-0007',
        'draft',
        "Book a slot: the traveller's flow"
      ),
    });

    const result = run(newSpecScript, root, ['WI-0007']);
    const created = join(root, 'specs', 'work-specs', 'WS-0007-book-a-slot.md');

    expect(result.status).toBe(0);
    const content = await readFile(created, 'utf8');
    expect(content).toContain("id: 'WS-0007'");
    expect(content).toContain("title: 'Book a slot: the traveller''s flow'");
    expect(content).toContain("item: 'WI-0007'");
    expect(content).toContain('status: draft');
    expect(content).toContain("owner: 'Diogo'");
    expect(validate(root).status).toBe(0);
  });

  it('AC7: falha sem escrever nada quando o item não existe', async () => {
    const root = await corpusWithTemplate({ 'specs/tracks/WT-0001-t.md': track('draft') });

    const result = run(newSpecScript, root, ['WI-0042']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('WI-0042');
    expect(existsSync(join(root, 'specs', 'work-specs'))).toBe(false);
  });

  it('AC7: falha sem alterar uma work-spec existente', async () => {
    const existing = workSpec('WS-0007', 'WI-0007', 'approved');
    const root = await corpusWithTemplate({
      'specs/tracks/WT-0001-t.md': track('active'),
      'specs/items/WI-0007-x.md': item('WI-0007', 'draft'),
      'specs/work-specs/WS-0007-x.md': existing,
    });

    const result = run(newSpecScript, root, ['WI-0007']);

    expect(result.status).not.toBe(0);
    expect(await readFile(join(root, 'specs', 'work-specs', 'WS-0007-x.md'), 'utf8')).toBe(
      existing
    );
  });

  it('AC8: make new-track imprime a checklist de arranque', async () => {
    const makefile = await readFile(resolve('Makefile'), 'utf8');
    const recipe = /^new-track:.*\n((?:\t.*\n)+)/m.exec(makefile)?.[1] ?? '';

    expect(recipe).toContain('ADR-0006');
    expect(recipe).toContain('métrica de sucesso');
    expect(recipe).toContain('docs/canonical/');
    expect(recipe).toContain('make new-spec');
  });
});
