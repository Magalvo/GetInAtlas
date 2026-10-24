/**
 * ⚠️  TESTES DE ACEITAÇÃO — PASTA PROTEGIDA
 *
 * Estes testes são o CONTRATO. São escritos/aprovados por humanos e correspondem
 * aos critérios de aceitação dos work-items em specs/items/.
 *
 * O agente NÃO PODE editar ficheiros nesta pasta. O hook de pre-commit
 * (lefthook.yml) bloqueia qualquer commit que os altere sem a variável
 * ACCEPT_CONTRACT_CHANGE=1 — que só um humano deve definir, conscientemente.
 *
 * Se um teste aqui falha, o problema está no CÓDIGO (ou, raramente, no contrato —
 * e nesse caso a alteração é uma decisão humana registada em ADR).
 */
import { describe, expect, it } from 'vitest';
import { cancelOrder, createOrder, orderTotalCents, payOrder } from '../../src/order.js';

const validInput = {
  id: '3f8a2c1e-9b4d-4e6f-8a1b-2c3d4e5f6a7b',
  items: [
    { sku: 'CAFE-001', quantity: 2, unitPriceCents: 350 },
    { sku: 'PASTEL-NATA', quantity: 6, unitPriceCents: 120 },
  ],
  currency: 'EUR',
};

describe('WI-0001 — ciclo de vida de uma encomenda', () => {
  it('AC1: rejeita input sem itens', () => {
    expect(() => createOrder({ ...validInput, items: [] })).toThrow();
  });

  it('AC2: rejeita quantidades não positivas', () => {
    expect(() =>
      createOrder({
        ...validInput,
        items: [{ sku: 'X', quantity: 0, unitPriceCents: 100 }],
      })
    ).toThrow();
  });

  it('AC3: calcula o total correto em cêntimos', () => {
    const order = createOrder(validInput);
    expect(orderTotalCents(order)).toBe(2 * 350 + 6 * 120);
  });

  it('AC4: uma encomenda pendente pode ser paga', () => {
    const order = createOrder(validInput);
    const paid = payOrder(order, new Date('2026-07-05T10:00:00Z'));
    expect(paid.status).toBe('paid');
  });

  it('AC5: uma encomenda paga não pode ser paga de novo', () => {
    const paid = payOrder(createOrder(validInput), new Date());
    expect(() => payOrder(paid, new Date())).toThrow();
  });

  it('AC6: uma encomenda paga não pode ser cancelada', () => {
    const paid = payOrder(createOrder(validInput), new Date());
    expect(() => cancelOrder(paid, 'mudei de ideias')).toThrow();
  });
});
// tentativa de enfraquecer o contrato
