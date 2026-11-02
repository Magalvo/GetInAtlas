import { describe, expect, it } from 'vitest';
import { ConfigError } from './config.js';
import { readVersion, start } from './server.js';

// WI-0018: o arranque valida a configuração antes de abrir a base de dados ou a porta.
describe('arranque da API (WI-0018)', () => {
  it('AC3: um ambiente inválido falha antes de abrir a porta', async () => {
    await expect(start({ PORT: 'abc' })).rejects.toBeInstanceOf(ConfigError);
  });

  it('AC1: a versão vem do package.json, e o commit só quando existe', async () => {
    expect(await readVersion(undefined)).toEqual({ version: '0.0.0' });
    expect(await readVersion('b0e4687')).toEqual({ version: '0.0.0', commit: 'b0e4687' });
  });
});
