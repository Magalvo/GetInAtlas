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
- `make new-item ID=WI-NNNN SLUG=... TRACK=WT-NNNN` — scaffolding (nunca cries specs à mão)
- `make eval` — evals dos componentes probabilísticos (corre quando mudares prompts/subjects)
- `make help` — lista completa

## Estrutura

| Pasta                                      | O que é                                               | Podes editar?                |
| ------------------------------------------ | ----------------------------------------------------- | ---------------------------- |
| `specs/tracks/`                            | Épicos (WT-NNNN)                                      | Sim, via scaffold            |
| `specs/items/`                             | Tarefas atómicas com critérios de aceitação (WI-NNNN) | Sim, via scaffold            |
| `docs/adr/`                                | Decisões de arquitetura e o porquê                    | Sim (novos ADRs)             |
| `docs/canonical/`                          | Convenções e arquitetura — memória longa              | Com aprovação humana         |
| `src/`                                     | Código de produção                                    | Sim                          |
| `tests/unit/`, `tests/properties/`         | Testes que escreves e iteras                          | Sim                          |
| `tests/acceptance/`                        | **O CONTRATO** (determinístico)                       | **NÃO. NUNCA.**              |
| `evals/subjects/`                          | Sistemas probabilísticos sob avaliação (prompts)      | Sim                          |
| `evals/datasets/`, `evals/thresholds.json` | **O CONTRATO** (estatístico)                          | **NÃO. NUNCA.**              |
| `formal/`                                  | Specs TLA+ do núcleo crítico (camada opcional)        | Propor sim; aprovar é humano |

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
   O orçamento de diff (15 ficheiros / 800 linhas) é verificado no CI.

## Workflow obrigatório

1. Lê o work-item em `specs/items/` (ou pede um ao humano se não existir).
2. **Antes de escrever código: apresenta o teu plano e as tuas perguntas.**
   Que assunções estás a fazer? Que casos-limite vês? Espera aprovação.
3. TDD sobre os critérios de aceitação: teste vermelho → código mínimo → refactor.
4. Corre `make check` até tudo verde.
5. Atualiza docs afetados (ADR se houve decisão de arquitetura) no mesmo branch.
6. Atualiza o `status` do work-item.

## Referências

- Schema das specs: `specs/_schema/README.md`
- Decisões existentes: `docs/adr/` — **lê antes de propor mudanças de arquitetura**
- Convenções: `docs/canonical/conventions.md`
- Evals (componentes LLM): `evals/README.md`
- Métodos formais (núcleo crítico, opcional): `formal/README.md`
