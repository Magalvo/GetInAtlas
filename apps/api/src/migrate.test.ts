import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import pg from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate, parseDatabaseUrl } from './migrate.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

// WI-0016: migrations SQL num Postgres real (ADR-0005), sem fakes em memória.
const databases: TestDatabase[] = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => database.drop()));
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true }))
  );
});

async function freshDatabase(): Promise<string> {
  const database = await createTestDatabase();
  databases.push(database);
  return database.url;
}

async function migrationsFolder(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ai-sdd-migrations-'));
  temporaryDirectories.push(directory);
  await Promise.all(
    Object.entries(files).map(async ([name, sql]) => writeFile(join(directory, name), sql))
  );
  return directory;
}

async function query<Row extends pg.QueryResultRow>(url: string, sql: string): Promise<Row[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query<Row>(sql)).rows;
  } finally {
    await client.end();
  }
}

describe('migrations (WI-0016)', () => {
  it('AC1: aplica as migrations numa base vazia; a segunda vez não muda nada', async () => {
    const url = await freshDatabase();

    expect(await migrate(url)).toEqual(['0001_btree_gist.sql']);
    expect(await migrate(url)).toEqual([]);
  });

  it('AC2: a primeira migration ativa a extensão btree_gist', async () => {
    const url = await freshDatabase();

    await migrate(url);

    const rows = await query(url, "SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'");
    expect(rows).toHaveLength(1);
  });

  it('aplica por ordem, e uma migration que falha só desfaz a si própria', async () => {
    const url = await freshDatabase();
    const folder = await migrationsFolder({
      '0002_b.sql': 'CREATE TABLE b (id int); SELECT 1 / 0;',
      '0001_a.sql': 'CREATE TABLE a (id int);',
    });

    await expect(migrate(url, folder)).rejects.toThrow(/0002_b\.sql/);

    const tables = await query<{ name: string }>(
      url,
      "SELECT table_name AS name FROM information_schema.tables WHERE table_name IN ('a', 'b')"
    );
    expect(tables.map((table) => table.name)).toEqual(['a']);
    const applied = await query<{ id: string }>(url, 'SELECT id FROM schema_migrations');
    expect(applied.map((row) => row.id)).toEqual(['0001_a.sql']);
  });

  it('recusa correr se uma migration já aplicada foi alterada', async () => {
    const url = await freshDatabase();
    const folder = await migrationsFolder({ '0001_a.sql': 'CREATE TABLE a (id int);' });
    await migrate(url, folder);

    await writeFile(join(folder, '0001_a.sql'), 'CREATE TABLE a (id bigint);');

    await expect(migrate(url, folder)).rejects.toThrow(/0001_a\.sql.*alterada/);
  });

  it('duas execuções em simultâneo aplicam cada migration uma só vez', async () => {
    const url = await freshDatabase();
    const folder = await migrationsFolder({
      '0001_a.sql': 'CREATE TABLE a (id int);',
      '0002_b.sql': 'CREATE TABLE b (id int);',
    });

    const [first, second] = await Promise.all([migrate(url, folder), migrate(url, folder)]);

    expect([...first, ...second].sort()).toEqual(['0001_a.sql', '0002_b.sql']);
    const applied = await query(url, 'SELECT id FROM schema_migrations');
    expect(applied).toHaveLength(2);
  });

  it('valida DATABASE_URL com Zod e nomeia a variável quando falta ou é inválida', () => {
    expect(parseDatabaseUrl({ DATABASE_URL: 'postgres://u:p@localhost:5432/db' })).toBe(
      'postgres://u:p@localhost:5432/db'
    );
    expect(() => parseDatabaseUrl({})).toThrow(/DATABASE_URL/);
    expect(() => parseDatabaseUrl({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/
    );
  });
});

describe('Postgres no gate (WI-0016)', () => {
  it('AC3: sem Postgres, falha com uma mensagem acionável em vez de saltar', async () => {
    await expect(
      createTestDatabase('postgres://postgres:postgres@127.0.0.1:1/postgres')
    ).rejects.toThrow(/Postgres indisponível em 127\.0\.0\.1:1\. Corre `make db-up`/);
  });
});
