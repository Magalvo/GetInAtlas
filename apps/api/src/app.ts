/**
 * A app Fastify, sem porta aberta (WI-0018, WS-0018): o entry point faz o
 * listen, os testes usam `app.inject()`.
 *
 * `GET /health` diz à plataforma (Render, ADR-0003) se a instância está viva
 * e se chega ao Postgres. Nunca devolve o erro da base de dados no corpo.
 */
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import pg from 'pg';
import type { Config } from './config.js';

// Limite do health, ligação e query incluídas: uma base de dados pendurada dá 503.
const HEALTH_TIMEOUT_MS = 2000;
// Sem limite, o pg espera para sempre por uma ligação que não chega.
const CONNECT_TIMEOUT_MS = 5000;

export interface AppVersion {
  readonly version: string;
  readonly commit?: string;
}

export interface AppOptions {
  readonly config: Config;
  readonly version: AppVersion;
}

/**
 * O único sítio onde se cria um pool. O listener de `error` é o que mantém o
 * processo vivo quando o Postgres corta uma ligação inativa (AC2): sem ele, o
 * Node trata o evento como erro não tratado e o processo morre.
 */
export function createPool(databaseUrl: string, log: FastifyBaseLogger): pg.Pool {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
  });
  pool.on('error', (error) => {
    log.warn({ err: error }, 'Ligação inativa ao Postgres perdida');
  });
  return pool;
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Sem resposta do Postgres em ${String(milliseconds)} ms`));
    }, milliseconds);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function buildApp({ config, version }: AppOptions): FastifyInstance {
  const app = Fastify({ logger: { level: config.logLevel } });
  const pool = createPool(config.databaseUrl, app.log);
  app.addHook('onClose', async () => pool.end());

  const versionFields = {
    version: version.version,
    ...(version.commit === undefined ? {} : { commit: version.commit }),
  };

  // Os health checks da plataforma não enchem o log de linhas info, mas um
  // LOG_LEVEL mais restrito continua a valer.
  const healthLogLevel =
    config.logLevel === 'info' || config.logLevel === 'debug' ? 'warn' : config.logLevel;
  app.get('/health', { logLevel: healthLogLevel }, async (request, reply) => {
    try {
      await withTimeout(pool.query('SELECT 1'), HEALTH_TIMEOUT_MS);
      return await reply.code(200).send({ status: 'ok', ...versionFields, database: 'up' });
    } catch (error) {
      request.log.warn({ err: error }, 'Health: Postgres inacessível');
      return await reply.code(503).send({ status: 'error', ...versionFields, database: 'down' });
    }
  });

  return app;
}
