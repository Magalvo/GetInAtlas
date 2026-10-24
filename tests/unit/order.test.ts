/**
 * Testes unitários — o agente escreve e itera livremente aqui (TDD: red → green → refactor).
 * Diferença para tests/acceptance/: estes testam detalhes de implementação;
 * aqueles testam o contrato e são intocáveis.
 */
import { describe, expect, it } from 'vitest';
import { cancelOrder, createOrder, parseOrderInput } from '../../src/order.js';

const validInput = {
  id: '3f8a2c1e-9b4d-4e6f-8a1b-2c3d4e5f6a7b',
  items: [{ sku: 'A', quantity: 1, unitPriceCents: 100 }],
  currency: 'EUR',
};

describe('parseOrderInput', () => {
  it('aceita input válido', () => {
    expect(parseOrderInput(validInput).currency).toBe('EUR');
  });

  it('rejeita moeda desconhecida', () => {
    expect(() => parseOrderInput({ ...validInput, currency: 'BTC' })).toThrow();
  });

  it('rejeita id que não é UUID', () => {
    expect(() => parseOrderInput({ ...validInput, id: '123' })).toThrow();
  });

  it('rejeita preços negativos', () => {
    expect(() =>
      parseOrderInput({
        ...validInput,
        items: [{ sku: 'A', quantity: 1, unitPriceCents: -1 }],
      })
    ).toThrow();
  });
});

describe('cancelOrder', () => {
  it('cancela uma encomenda pendente com motivo', () => {
    const cancelled = cancelOrder(createOrder(validInput), 'sem stock');
    expect(cancelled.status).toBe('cancelled');
    if (cancelled.status === 'cancelled') {
      expect(cancelled.reason).toBe('sem stock');
    }
  });
});
