/**
 * Configuração da API a partir do ambiente (WI-0018, WS-0018).
 *
 * Validada com Zod no arranque (AGENTS.md regra 4): uma variável em falta ou
 * inválida para o processo antes de abrir a base de dados ou a porta. As
 * mensagens nomeiam a variável e nunca mostram o valor — o DATABASE_URL pode
 * ter uma password.
 */
import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug'] as const;

/** A regra do DATABASE_URL, partilhada com o runner de migrations. */
export const DatabaseUrlSchema = z
  .string({ required_error: 'DATABASE_URL em falta' })
  .url('DATABASE_URL não é um URL válido')
  .refine((url) => /^postgres(ql)?:\/\//.test(url), 'DATABASE_URL tem de ser postgres://');

const EnvSchema = z.object({
  DATABASE_URL: DatabaseUrlSchema,
  PORT: z
    .string()
    .default('3000')
    .refine((port) => /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535, {
      message: 'PORT tem de ser um inteiro entre 1 e 65535',
    })
    .transform(Number),
  HOST: z.string().min(1, 'HOST não pode ser vazio').default('127.0.0.1'),
  LOG_LEVEL: z
    .enum(LOG_LEVELS, {
      errorMap: () => ({ message: `LOG_LEVEL tem de ser um de: ${LOG_LEVELS.join(', ')}` }),
    })
    .default('info'),
  // Definido pelo Render em cada deploy (WS-0018, pergunta 2).
  RENDER_GIT_COMMIT: z.string().min(1, 'RENDER_GIT_COMMIT não pode ser vazio').optional(),
});

export interface Config {
  readonly databaseUrl: string;
  readonly port: number;
  readonly host: string;
  readonly logLevel: (typeof LOG_LEVELS)[number];
  readonly commit?: string;
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => issue.message);
    throw new ConfigError(`Configuração inválida: ${problems.join('; ')}`);
  }
  const { DATABASE_URL, PORT, HOST, LOG_LEVEL, RENDER_GIT_COMMIT } = result.data;
  return Object.freeze({
    databaseUrl: DATABASE_URL,
    port: PORT,
    host: HOST,
    logLevel: LOG_LEVEL,
    ...(RENDER_GIT_COMMIT === undefined ? {} : { commit: RENDER_GIT_COMMIT }),
  });
}
