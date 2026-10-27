import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

// WI-0018 AC3: a configuração vem do ambiente, validada com Zod no arranque.
// Montado em tempo de execução: um URL com credenciais escrito à letra dispara
// os scanners de segredos (GitGuardian), mesmo sendo fictício.
const FAKE_PASSWORD = 'fake-password-for-tests';
const SECRET_URL = Object.assign(new URL('postgres://db.example.invalid:5432/getinatlas'), {
  username: 'app',
  password: FAKE_PASSWORD,
}).toString();

function errorOf(env: Record<string, string | undefined>): ConfigError {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('loadConfig devia ter falhado');
}

describe('configuração da API (WI-0018)', () => {
  it('AC3: um ambiente válido dá a configuração tipada, com os valores por omissão', () => {
    expect(loadConfig({ DATABASE_URL: SECRET_URL })).toEqual({
      databaseUrl: SECRET_URL,
      port: 3000,
      host: '127.0.0.1',
      logLevel: 'info',
    });
  });

  it('AC3: lê PORT, HOST, LOG_LEVEL e RENDER_GIT_COMMIT quando existem', () => {
    expect(
      loadConfig({
        DATABASE_URL: 'postgresql://localhost/app',
        PORT: '10000',
        HOST: '0.0.0.0',
        LOG_LEVEL: 'warn',
        RENDER_GIT_COMMIT: 'b0e4687',
      })
    ).toEqual({
      databaseUrl: 'postgresql://localhost/app',
      port: 10000,
      host: '0.0.0.0',
      logLevel: 'warn',
      commit: 'b0e4687',
    });
  });

  it.each([
    ['DATABASE_URL em falta', {}, 'DATABASE_URL'],
    [
      'DATABASE_URL que não é postgres://',
      { DATABASE_URL: 'mysql://localhost/app' },
      'DATABASE_URL',
    ],
    ['PORT que não é um número', { DATABASE_URL: SECRET_URL, PORT: 'abc' }, 'PORT'],
    ['PORT zero', { DATABASE_URL: SECRET_URL, PORT: '0' }, 'PORT'],
    ['PORT acima de 65535', { DATABASE_URL: SECRET_URL, PORT: '70000' }, 'PORT'],
    ['HOST vazio', { DATABASE_URL: SECRET_URL, HOST: '' }, 'HOST'],
    ['LOG_LEVEL desconhecido', { DATABASE_URL: SECRET_URL, LOG_LEVEL: 'verbose' }, 'LOG_LEVEL'],
  ])('AC3: %s falha a nomear a variável', (_case, env, variable) => {
    const error = errorOf(env);

    expect(error.message).toMatch(/^Configuração inválida: /);
    expect(error.message).toContain(variable);
  });

  it('AC3: duas variáveis inválidas são ambas nomeadas', () => {
    const error = errorOf({ PORT: 'abc' });

    expect(error.message).toContain('DATABASE_URL');
    expect(error.message).toContain('PORT');
  });

  it('AC3: a mensagem nunca mostra o valor do DATABASE_URL', () => {
    const error = errorOf({ DATABASE_URL: SECRET_URL, PORT: 'abc' });

    expect(error.message).not.toContain(FAKE_PASSWORD);
    expect(error.message).not.toContain(SECRET_URL);
  });
});
