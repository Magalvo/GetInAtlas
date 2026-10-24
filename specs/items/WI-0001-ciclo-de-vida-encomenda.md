---
id: WI-0001
title: Ciclo de vida de uma encomenda
status: done
track: WT-0001
owner: filipe
acceptance:
  - AC1: input sem itens é rejeitado
  - AC2: quantidades não positivas são rejeitadas
  - AC3: o total é calculado corretamente em cêntimos
  - AC4: uma encomenda pendente pode ser paga
  - AC5: uma encomenda paga não pode ser paga de novo
  - AC6: uma encomenda paga não pode ser cancelada
---

# WI-0001 — Ciclo de vida de uma encomenda

## Problema

Precisamos de um exemplo de domínio que demonstre os padrões da Camada 1
(schema na fronteira, estados inválidos irrepresentáveis, funções puras).

## Proposta

Módulo `src/order.ts` com união discriminada para o estado, Zod na fronteira,
dinheiro em cêntimos inteiros. Cada AC acima corresponde a um teste em
`tests/acceptance/order.acceptance.test.ts`.

## Fora de âmbito

Persistência, reembolsos, API.

## Notas para o agente

Este item está `done` — serve de referência do formato. Não alterar.
