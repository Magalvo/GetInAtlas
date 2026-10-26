/**
 * Bases de dados de teste isoladas (WI-0016).
 *
 * Cada teste cria a sua base de dados no servidor de teste e apaga-a no fim:
 * ficheiros de teste, worktrees e sessões em paralelo nunca partilham dados.
 * Sem Postgres, os testes falham com uma mensagem acionável — nunca são saltados.
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { z } from 'zod';

export const DEFAULT_TEST_SERVER_URL = 'postgres://postgres@127.0.0.1:54329/postgres';
const CONNECT_TIMEOUT_MS = 3000;

export interface TestDatabase {
  readonly url: string;
  drop(): Promise<void>;
}

export function testServerUrl(env: NodeJS.ProcessEnv = process.env): string {
  return z
    .string()
    .url()
    .parse(env.DATABASE_URL_TEST ?? DEFAULT_TEST_SERVER_URL);
}

async function connectToServer(serverUrl: string): Promise<pg.Client> {
  const client = new pg.Client({
    connectionString: serverUrl,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  });
  try {
    await client.connect();
    return client;
  } catch (error) {
    throw new Error(
      `Postgres indisponível em ${new URL(serverUrl).host}. ` +
        'Corre `make db-up` (Docker) ou define DATABASE_URL_TEST.',
      { cause: error }
    );
  }
}

export async function createTestDatabase(serverUrl = testServerUrl()): Promise<TestDatabase> {
  const name = `getinatlas_test_${randomUUID().replaceAll('-', '')}`;
  const admin = await connectToServer(serverUrl);
  try {
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }

  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    async drop() {
      const client = await connectToServer(serverUrl);
      try {
        await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      } finally {
        await client.end();
      }
    },
  };
}
