/**
 * Runner de migrations SQL (WI-0016, WS-0016 decisão 3).
 *
 * SQL primeiro: as constraints do ADR-0005 escrevem-se como são. Garantias:
 * - um advisory lock: duas execuções (sessões paralelas, instâncias) nunca migram ao mesmo tempo;
 * - uma transação por migration: uma que falha só se desfaz a si própria;
 * - checksums SHA-256: uma migration já aplicada é imutável, como o contrato.
 *
 * CLI: `make db-migrate` (aplica a DATABASE_URL).
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { z } from 'zod';

const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));
// Chave fixa do advisory lock das migrations deste projeto.
const MIGRATION_LOCK_KEY = 4_747_016;

const DatabaseUrlSchema = z.object({
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL em falta' })
    .url('DATABASE_URL não é um URL válido')
    .refine((url) => /^postgres(ql)?:\/\//.test(url), 'DATABASE_URL tem de ser postgres://'),
});

export function parseDatabaseUrl(env: Record<string, string | undefined>): string {
  const result = DatabaseUrlSchema.safeParse(env);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join('; '));
  }
  return result.data.DATABASE_URL;
}

function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Aplica, por ordem, as migrations em falta. Devolve os nomes das que aplicou. */
export async function migrate(
  databaseUrl: string,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR
): Promise<string[]> {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const migrations = await Promise.all(
    files.map(async (id) => {
      const sql = await readFile(join(migrationsDir, id), 'utf8');
      return { id, sql, checksum: checksum(sql) };
    })
  );

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         id text PRIMARY KEY,
         checksum text NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`
    );
    const { rows } = await client.query<{ id: string; checksum: string }>(
      'SELECT id, checksum FROM schema_migrations'
    );
    const applied = new Map(rows.map((row) => [row.id, row.checksum]));

    for (const migration of migrations) {
      const recorded = applied.get(migration.id);
      if (recorded !== undefined && recorded !== migration.checksum) {
        throw new Error(
          `A migration ${migration.id} já aplicada foi alterada (checksum diferente). ` +
            'As migrations são imutáveis: cria uma nova.'
        );
      }
    }

    const newlyApplied: string[] = [];
    for (const migration of migrations.filter((m) => !applied.has(m.id))) {
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)', [
          migration.id,
          migration.checksum,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`A migration ${migration.id} falhou: ${messageOf(error)}`, {
          cause: error,
        });
      }
      newlyApplied.push(migration.id);
    }
    return newlyApplied;
  } finally {
    await client
      .query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY])
      .catch(() => undefined);
    await client.end();
  }
}

async function main(): Promise<void> {
  try {
    const applied = await migrate(parseDatabaseUrl(process.env));
    console.log(
      applied.length === 0
        ? '✓ Migrations em dia.'
        : `✓ Migrations aplicadas: ${applied.join(', ')}`
    );
  } catch (error) {
    console.error(`✗ ${messageOf(error)}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  await main();
}
