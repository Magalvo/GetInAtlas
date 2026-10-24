---
id: '{{ID}}'
title: <título da tarefa>
status: draft
track: '{{TRACK}}'
owner: <nome-humano>
acceptance:
  - AC1: <critério verificável — vira um teste em tests/acceptance/>
---

# {{ID}} — <título>

## Problema

<O que está mal ou em falta, do ponto de vista de quem usa.>

## Proposta

<Abordagem em 3-6 frases. Ficheiros, desenho e armadilhas vão para a work-spec
(`make new-spec ITEM={{ID}}`), não para aqui (ADR-0006).>

## Fora de âmbito

<Explícito. Cada omissão é uma decisão que o agente toma em silêncio.>

## Em falta antes de codificar

<Decisões, dados ou acessos que ainda faltam. Tem de ficar "Nada." antes de o item passar a ready.>
