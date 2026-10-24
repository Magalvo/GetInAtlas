/**
 * Property-based tests — provam propriedades sobre TODOS os inputs gerados,
 * não só os exemplos que alguém se lembrou de escrever.
 *
 * Porquê isto num projeto AI-driven: testes de exemplo escritos pelo mesmo
 * modelo que escreveu o código partilham os mesmos pontos cegos. Propriedades
 * geradas aleatoriamente não.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createOrder, orderTotalCents, payOrder } from '../../src/order.js';

const itemArb = fc.record({
  sku: fc.string({ minLength: 1, maxLength: 20 }),
  quantity: fc.integer({ min: 1, max: 1000 }),
  unitPriceCents: fc.integer({ min: 0, max: 1_000_000 }),
});

const inputArb = fc.record({
  id: fc.uuid(),
  items: fc.array(itemArb, { minLength: 1, maxLength: 50 }),
  currency: fc.constantFrom('EUR', 'USD', 'GBP'),
});

describe('propriedades de Order', () => {
  it('o total nunca é negativo, para qualquer input válido', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(orderTotalCents(createOrder(input))).toBeGreaterThanOrEqual(0);
      })
    );
  });

  it('o total é sempre um inteiro (dinheiro em cêntimos, nunca floats)', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(Number.isInteger(orderTotalCents(createOrder(input)))).toBe(true);
      })
    );
  });

  it('pagar não altera o total', () => {
    fc.assert(
      fc.property(inputArb, fc.date(), (input, when) => {
        const order = createOrder(input);
        expect(orderTotalCents(payOrder(order, when))).toBe(orderTotalCents(order));
      })
    );
  });
});
