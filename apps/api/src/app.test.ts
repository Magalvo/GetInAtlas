import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

// WI-0018 AC1–AC2: o health reporta o estado do Postgres real (WI-0016), sem fakes.
const CLOSED_PORT_URL = 'postgres://postgres@127.0.0.1:1/postgres';
const VERSION = { version: '1.2.3' };

const apps: FastifyInstance[] = [];
const databases: TestDatabase[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
  await Promise.all(databases.splice(0).map(async (database) => database.drop()));
});

async function freshDatabase(): Promise<TestDatabase> {
  const database = await createTestDatabase();
  databases.push(database);
  return database;
}

function appFor(databaseUrl: string, version: { version: string; commit?: string } = VERSION) {
  const app = buildApp({
    config: loadConfig({ DATABASE_URL: databaseUrl, LOG_LEVEL: 'fatal' }),
    version,
  });
  apps.push(app);
  return app;
}

async function health(app: FastifyInstance) {
  const response = await app.inject({ method: 'GET', url: '/health' });
  return { status: response.statusCode, body: response.json<unknown>(), raw: response.body };
}

describe('GET /health (WI-0018)', () => {
  it('AC1: com o Postgres acessível responde 200, com a versão e database: up', async () => {
    const database = await freshDatabase();

    expect(await health(appFor(database.url))).toMatchObject({
      status: 200,
      body: { status: 'ok', version: '1.2.3', database: 'up' },
    });
  });

  it('AC1: o commit só aparece quando existe', async () => {
    const database = await freshDatabase();

    const withoutCommit = await health(appFor(database.url));
    const withCommit = await health(appFor(database.url, { version: '1.2.3', commit: 'b0e4687' }));

    expect(withoutCommit.body).toEqual({ status: 'ok', version: '1.2.3', database: 'up' });
    expect(withCommit.body).toEqual({
      status: 'ok',
      version: '1.2.3',
      commit: 'b0e4687',
      database: 'up',
    });
  });

  it('AC2: com o Postgres inacessível responde 503 e database: down, sem o erro no corpo', async () => {
    const result = await health(appFor(CLOSED_PORT_URL));

    expect(result.status).toBe(503);
    expect(result.body).toEqual({ status: 'error', version: '1.2.3', database: 'down' });
    expect(result.raw).not.toMatch(/ECONNREFUSED|127\.0\.0\.1/);
  });

  it('AC2: se o Postgres cai depois do arranque, o processo continua a responder', async () => {
    const database = await freshDatabase();
    const app = appFor(database.url);
    expect((await health(app)).status).toBe(200);

    // WITH (FORCE) mata a ligação inativa do pool: o pool emite 'error'.
    // Sem o listener, o Node trataria o evento como erro não tratado.
    await database.drop();

    expect(await health(app)).toMatchObject({ status: 503, body: { database: 'down' } });
    expect(await health(app)).toMatchObject({ status: 503, body: { database: 'down' } });
  });
});
