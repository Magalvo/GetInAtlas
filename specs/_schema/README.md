# Schema das specs

Toda a spec é um ficheiro Markdown com frontmatter YAML obrigatório.
O validador (`scripts/validate-specs.mjs`, corrido via `make validate-specs`)
falha o build se alguma regra for violada — as specs têm lint, tal como o código.

## Frontmatter obrigatório

### Work-tracks (`specs/tracks/WT-NNNN-slug.md`)

```yaml
---
id: WT-0001 # único, formato WT-NNNN
title: Título curto
status: draft | active | done | abandoned
owner: nome-humano # accountability: uma pessoa, não "a equipa"
---
```

### Work-items (`specs/items/WI-NNNN-slug.md`)

```yaml
---
id: WI-0001 # único, formato WI-NNNN
title: Título curto
status: draft | ready | in-progress | done | abandoned
track: WT-0001 # tem de existir em specs/tracks/ (refs quebradas falham)
owner: nome-humano
acceptance: # ≥1 critério; cada um vira um teste em tests/acceptance/
  - AC1: descrição verificável
---
```

### Work-specs (`specs/work-specs/WS-NNNN-slug.md`)

A camada 4 (ADR-0006): o plano de implementação de um work-item. Cria-se com
`make new-spec ITEM=WI-NNNN`, que copia o número e o slug do item.

```yaml
---
id: WS-0001 # o mesmo número do item que implementa
title: Título curto
item: WI-0001 # tem de existir em specs/items/
status: draft | approved # approved = um humano aprovou o plano
owner: nome-humano
---
```

Um item tem no máximo uma work-spec. Se o plano muda, edita-se e volta a
`draft` até ser aprovado de novo.

## Regras verificadas pelo validador

1. Frontmatter parseia e cumpre o schema (Zod).
2. IDs únicos em todo o corpus.
3. O nome do ficheiro começa pelo ID (`WI-0001-*.md`).
4. Toda a referência `track:` aponta para um track existente.
5. Nenhum track `active` fica órfão (sem work-items) — sinal de drift.
6. Work-items `ready`/`in-progress`/`done` têm ≥1 critério de aceitação.
7. Toda a referência `item:` de uma work-spec aponta para um work-item existente.
8. Uma work-spec tem o mesmo número que o seu item (`WS-0001` ↔ `WI-0001`).
9. Work-items `ready`/`in-progress` têm uma work-spec `approved` (os `done`
   ficam isentos).
10. Tracks `active` têm uma secção `## Métrica de sucesso` (ou
    `## Success metric`) preenchida.
