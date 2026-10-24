/**
 * Módulo de exemplo — demonstra os padrões da Camada 1:
 *
 * 1. Validação de schema NA FRONTEIRA (Zod): dados inválidos nunca entram no domínio.
 * 2. Estados inválidos irrepresentáveis: uma Order paga tem obrigatoriamente paidAt;
 *    uma pendente não pode tê-lo. O compilador garante isto, não um `if`.
 * 3. Funções puras: fáceis de testar, fáceis de raciocinar, fáceis para o agente.
 *
 * Substitui este módulo pelo teu domínio real — mantém os padrões.
 */
import { z } from 'zod';

// ---------- Fronteira: schema de entrada (dados externos, não confiáveis) ----------

export const OrderInputSchema = z.object({
  id: z.string().uuid(),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPriceCents: z.number().int().nonnegative(),
      })
    )
    .min(1),
  currency: z.enum(['EUR', 'USD', 'GBP']),
});

export type OrderInput = z.infer<typeof OrderInputSchema>;

// ---------- Domínio: união discriminada — estados inválidos não compilam ----------

export type Order =
  | { status: 'pending'; input: OrderInput }
  | { status: 'paid'; input: OrderInput; paidAt: Date }
  | { status: 'cancelled'; input: OrderInput; reason: string };

/** Parse na fronteira. Lança ZodError se o dado for inválido — nunca entra lixo. */
export function parseOrderInput(raw: unknown): OrderInput {
  return OrderInputSchema.parse(raw);
}

export function createOrder(raw: unknown): Order {
  return { status: 'pending', input: parseOrderInput(raw) };
}

/** Total em cêntimos. Inteiros para dinheiro — nunca floats. */
export function orderTotalCents(order: Order): number {
  return order.input.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
}

export function payOrder(order: Order, paidAt: Date): Order {
  if (order.status !== 'pending') {
    throw new Error(`Cannot pay an order with status "${order.status}"`);
  }
  return { status: 'paid', input: order.input, paidAt };
}

export function cancelOrder(order: Order, reason: string): Order {
  if (order.status === 'paid') {
    throw new Error('Cannot cancel a paid order; issue a refund instead');
  }
  return { status: 'cancelled', input: order.input, reason };
}
