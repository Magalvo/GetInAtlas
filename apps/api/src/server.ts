/**
 * Entry point da API (WI-0018, WS-0018): `npm run start -w @getinatlas/api`.
 *
 * Ordem: configuração → app (cria o pool) → listen. Uma configuração inválida
 * para o processo antes de abrir a base de dados ou a porta, com uma mensagem
 * sem stack trace. SIGTERM (o Render envia-o em cada deploy) fecha o servidor
 * e depois o pool.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildApp, type AppVersion } from './app.js';
import { ConfigError, loadConfig } from './config.js';

const PACKAGE_JSON = new URL('../package.json', import.meta.url);
const PackageJsonSchema = z.object({ version: z.string().min(1) });

/** A versão do `apps/api/package.json`, mais o commit do deploy quando existe. */
export async function readVersion(commit: string | undefined): Promise<AppVersion> {
  const { version } = PackageJsonSchema.parse(JSON.parse(await readFile(PACKAGE_JSON, 'utf8')));
  return commit === undefined ? { version } : { version, commit };
}

export async function start(env: Record<string, string | undefined>): Promise<FastifyInstance> {
  const config = loadConfig(env);
  const app = buildApp({ config, version: await readVersion(config.commit) });
  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    await app.close();
    throw error;
  }
  return app;
}

async function main(): Promise<void> {
  let app: FastifyInstance;
  try {
    app = await start(process.env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
    return;
  }
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      app.log.info({ signal }, 'A fechar');
      void app.close();
    });
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  await main();
}
