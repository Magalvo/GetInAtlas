import { describe, expect, it } from 'vitest';
import { domainPackageName } from './index.js';

describe('@getinatlas/domain', () => {
  it('exporta o nome do pacote (placeholder até ao WI-0006)', () => {
    expect(domainPackageName).toBe('@getinatlas/domain');
  });
});
