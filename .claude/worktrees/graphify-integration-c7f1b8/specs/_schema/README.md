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

## Regras verificadas pelo validador

1. Frontmatter parseia e cumpre o schema (Zod).
2. IDs únicos em todo o corpus.
3. O nome do ficheiro começa pelo ID (`WI-0001-*.md`).
4. Toda a referência `track:` aponta para um track existente.
5. Nenhum track `active` fica órfão (sem work-items) — sinal de drift.
6. Work-items `ready`/`in-progress`/`done` têm ≥1 critério de aceitação.
