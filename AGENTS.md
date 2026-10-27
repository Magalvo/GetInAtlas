# AGENTS.md — Constituição do projeto

> Lê este ficheiro por inteiro antes de qualquer ação. É a tua memória de longo prazo.
> Lido por Claude Code, Codex, Cursor, Aider — qualquer agente.

## Propósito

<!-- SUBSTITUIR: um parágrafo sobre porque é que este código existe. -->

Boilerplate de referência para desenvolvimento AI-driven: SDD + TDD + defesa em
profundidade. O módulo `src/order.ts` é um exemplo de domínio a substituir.

## Stack

- TypeScript 5.x em modo `strict` máximo (Node 22+, ESM)
- Zod para validação de schema nas fronteiras
- Vitest (unit, acceptance, property-based com fast-check)
- ESLint (typescript-eslint strictTypeChecked) + Prettier
- Lefthook para hooks de git · GitHub Actions para CI

## Interface única de comandos

Não adivinhes comandos. Usa o Makefile:

- `make check` — **corre isto até ficar tudo verde antes de dar a tarefa por concluída**
- `make test-unit` — loop rápido de TDD
- `make validate-specs` — lint do corpus de specs
- `make new-track ID=WT-NNNN SLUG=...` — novo feature; imprime a checklist de arranque
- `make new-item ID=WI-NNNN SLUG=... TRACK=WT-NNNN` — scaffolding (nunca cries specs à mão)
- `make new-spec ITEM=WI-NNNN` — work-spec de um work-item (WS com o mesmo número)
- `make eval` — evals dos componentes probabilísticos (corre quando mudares prompts/subjects)
- `make help` — lista completa

## Estrutura

As specs vivem em **quatro camadas** (ADR-0006). Cada tópico vive numa só
camada; se cabe em duas, parte-se. As outras camadas apontam para ele, nunca o
copiam.

| Camada        | Pasta                          | O que é                                                                    |
| ------------- | ------------------------------ | -------------------------------------------------------------------------- |
| 1. Canónico   | `docs/canonical/`, `docs/adr/` | O que é verdade para além de um feature; os ADRs guardam o porquê          |
| 2. Work-track | `specs/tracks/`                | Uma iniciativa: objetivo, âmbito, métrica de sucesso, decisões do track    |
| 3. Work-item  | `specs/items/`                 | Uma tarefa para uma execução de agente, com critérios de aceitação         |
| 4. Work-spec  | `specs/work-specs/`            | Como implementar um work-item: desenho, ficheiros, plano de testes, riscos |

| Pasta                                      | O que é                                               | Podes editar?                         |
| ------------------------------------------ | ----------------------------------------------------- | ------------------------------------- |
| `specs/tracks/`                            | Épicos (WT-NNNN)                                      | Sim, via scaffold                     |
| `specs/items/`                             | Tarefas atómicas com critérios de aceitação (WI-NNNN) | Sim, via scaffold                     |
| `specs/work-specs/`                        | Plano de implementação de um WI (WS-NNNN = WI-NNNN)   | Sim; aprovação humana antes de código |
| `docs/adr/`                                | Decisões de arquitetura e o porquê                    | Sim (novos ADRs)                      |
| `docs/canonical/`                          | Convenções e arquitetura — memória longa              | Com aprovação humana                  |
| `src/`                                     | Código de produção                                    | Sim                                   |
| `tests/unit/`, `tests/properties/`         | Testes que escreves e iteras                          | Sim                                   |
| `tests/acceptance/`                        | **O CONTRATO** (determinístico)                       | **NÃO. NUNCA.**                       |
| `evals/subjects/`                          | Sistemas probabilísticos sob avaliação (prompts)      | Sim                                   |
| `evals/datasets/`, `evals/thresholds.json` | **O CONTRATO** (estatístico)                          | **NÃO. NUNCA.**                       |
| `formal/`                                  | Specs TLA+ do núcleo crítico (camada opcional)        | Propor sim; aprovar é humano          |

## Regras duras (violação = trabalho rejeitado)

1. **NUNCA edites, apagues ou enfraqueças o CONTRATO: `tests/acceptance/`,
   `evals/datasets/` ou `evals/thresholds.json`.** Se um teste de aceitação
   falha, o erro está no teu código; se um eval falha, melhora o subject —
   nunca baixes o threshold nem removas casos difíceis. Se acreditas
   genuinamente que o contrato está errado, PÁRA e reporta ao humano — a
   decisão é dele e fica registada em ADR.
2. **Nunca uses `any`, `@ts-ignore`, `@ts-expect-error` ou `!` (non-null assertion).**
   Se o tipo não encaixa, o desenho está errado — corrige o desenho.
3. **Nunca desligues regras de lint nem baixes o rigor do `tsconfig.json`.**
   Exceções exigem ADR aprovado por humano.
4. **Dados externos entram SEMPRE por um schema Zod.** Nada de `as Tipo` em
   input não confiável.
5. **Dinheiro em cêntimos inteiros.** Nunca floats para valores monetários.
6. **Nunca comites segredos.** Nada de chaves, tokens ou credenciais no código.
7. **Nunca trabalhes diretamente em `main`.** Branch por work-item
   (`wi/WI-NNNN-slug`), commits pequenos e frequentes.
8. **Âmbito é sagrado.** Só tocas nos ficheiros necessários ao work-item.
   O orçamento de diff (15 ficheiros / 800 linhas) é verificado no CI. O
   `package-lock.json` não conta, por ser gerado; em troca, o job lista as
   dependências diretas novas para revisão humana (WI-0019).

## Workflow obrigatório

Nunca se dá forma à app inteira de uma vez: cada feature ganha forma quando
arranca (ADR-0006).

### Ao arrancar um feature (novo work-track)

1. Cria o track (`make new-track`): objetivo, âmbito dentro/fora, **métrica de
   sucesso** e as decisões que só valem para este track.
2. **Verificação de promoção:** lê `docs/canonical/` primeiro. O que este
   feature precisa e é verdade para além dele vai para o canónico (quando um
   segundo track precisa, ou é claramente durável). Canónico exige aprovação
   humana.
3. Lista os work-items de forma grosseira. **Parte só os próximos 1–2** ao
   tamanho de uma execução de agente.

### Por work-item

1. Lê o work-item em `specs/items/` (ou pede um ao humano se não existir).
2. Se não cabe numa execução, parte-o. A lista "em falta antes de codificar"
   tem de estar vazia.
3. **Antes de escrever código: escreve a work-spec** (`make new-spec`) com o
   teu plano, assunções, casos-limite e perguntas. **Espera aprovação** — o
   item só passa a `ready` com a work-spec `approved`.
4. TDD sobre os critérios de aceitação: teste vermelho → código mínimo → refactor.
5. Corre `make check` até tudo verde.
6. Atualiza docs afetados (ADR se houve decisão de arquitetura) no mesmo branch.
7. Atualiza o `status` do work-item.

### Ao fechar um track

Promove ao canónico as decisões que se confirmaram; o track fica como registo
do que foi construído.

## Referências

- Schema das specs: `specs/_schema/README.md`
- Modelo de quatro camadas: `docs/adr/0006-four-layer-spec-model.md`
- Decisões existentes: `docs/adr/` — **lê antes de propor mudanças de arquitetura**
- Convenções: `docs/canonical/conventions.md`
- Evals (componentes LLM): `evals/README.md`
- Métodos formais (núcleo crítico, opcional): `formal/README.md`
