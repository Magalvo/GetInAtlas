# AI-Driven Development Boilerplate

Ponto de partida para desenvolvimento de software com coding agents (Claude Code,
Codex, Cursor, Aider), combinando **SDD** (spec-driven development), **TDD** e
**defesa em profundidade**. A filosofia completa está em
`docs/adr/0001-defesa-em-profundidade.md`; as regras para o agente em `AGENTS.md`.

A premissa: nenhum sistema previne todos os erros de um modelo probabilístico.
Este desenha o ambiente onde os erros **não sobrevivem** — baratos de detetar,
impossíveis de esconder, triviais de reverter.

## Setup

```bash
npm install        # instala deps + hooks do lefthook (via "prepare")
make check         # tudo deve ficar verde à primeira
```

Requisitos: Node 22+, make, git.

## As cinco camadas (e onde vivem)

| #   | Camada                             | Neste repo                                                                     |
| --- | ---------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Estados inválidos irrepresentáveis | `tsconfig.json` estrito · Zod nas fronteiras (`src/order.ts`)                  |
| 2   | Portão de planeamento              | Workflow obrigatório no `AGENTS.md` (plano + perguntas antes de código)        |
| 3   | Loop determinístico                | `make check` · `lefthook.yml` · `tests/acceptance/` intocável · property tests |
| 4   | Isolamento e reversibilidade       | Branch por work-item · `.agent/permissions.json` · worktrees                   |
| 5   | Assumir falha                      | `.github/workflows/ci.yml` — verificação independente + orçamento de diff      |

## O fluxo de trabalho

1. `make new-track ID=WT-0002 SLUG=meu-epico` — define a iniciativa
2. `make new-item ID=WI-0002 SLUG=minha-tarefa TRACK=WT-0002` — tarefa atómica com critérios de aceitação
3. Humano escreve (ou aprova) os testes de aceitação em `tests/acceptance/`
4. Agente lê o work-item, **apresenta plano e perguntas**, humano aprova
5. Agente faz TDD (`make test-unit` no loop) até `make check` verde
6. PR → CI independente → review humano do diff → merge

Com componentes LLM: passo extra — alterou prompt/modelo/subject? `make eval`
antes do merge. Com núcleo crítico formalizado: o desenho muda primeiro na spec
TLA+ (`make formal-check`), só depois no código.

## Decisões estruturais que interessam

- **`tests/acceptance/` é o contrato.** O agente não pode tocar-lhe: o hook de
  pre-commit bloqueia, e o CI bloqueia mesmo com `--no-verify`. Alterar o
  contrato é decisão humana (`ACCEPT_CONTRACT_CHANGE=1` local, label
  `contract-change-approved` no PR) e registada em ADR.
- **Testes de aceitação vêm de fonte independente do código.** Escritos pelo
  humano, ou por outro modelo/sessão sem acesso à implementação — testes do
  mesmo modelo partilham os mesmos pontos cegos.
- **Orçamento de diff** (15 ficheiros / 800 linhas por defeito): scope creep
  de agente falha o CI em vez de passar despercebido. O `package-lock.json`
  fica de fora (é gerado), mas o relatório mostra as suas linhas e lista as
  dependências diretas novas.
- **Specs têm lint** (`make validate-specs`): schema, IDs únicos, refs
  quebradas, tracks órfãos. SDD sem validação não escala.
- **Makefile como interface única**: o agente nunca adivinha comandos.

## All-in-one: o que ativar no TEU projeto

Este boilerplate traz todas as camadas instaladas, mas nem todas se pagam em
todos os projetos. Guia de decisão por tipo de projeto:

| Camada                          | Protótipo / PoC | Produto standard | Produto com LLM | Sistema crítico\* |
| ------------------------------- | --------------- | ---------------- | --------------- | ----------------- |
| Tipos estritos + Zod (1)        | ✓ (grátis)      | ✓                | ✓               | ✓                 |
| Portão de planeamento (2)       | —               | ✓                | ✓               | ✓                 |
| `make check` + hooks (3)        | parcial\*\*     | ✓                | ✓               | ✓                 |
| Contrato protegido (3)          | —               | ✓                | ✓               | ✓                 |
| Specs SDD + validador (2/3)     | —               | ✓                | ✓               | ✓                 |
| Orçamento de diff (5)           | —               | ✓                | ✓               | ✓                 |
| Property-based tests (3)        | —               | recomendado      | recomendado     | ✓                 |
| **Evals** (`evals/`)            | —               | —                | **✓**           | se tiver LLM      |
| **Métodos formais** (`formal/`) | —               | —                | —               | **✓ no núcleo**   |

\* Pagamentos, saúde, infraestrutura, concorrência/distribuição não-trivial.
\*\* Num protótipo, mantém tipos+lint (custam zero) e dispensa o resto — código
que vive três dias não justifica cerimónia. O erro simétrico também existe:
levar hábitos de protótipo para produção.

Como desativar o que não precisas:

- **Evals**: apaga `evals/`, `scripts/run-evals.mjs` e `.github/workflows/evals.yml`.
- **Métodos formais**: apaga `formal/` (não tem dependências no resto).
- **Contrato/hooks** (só em protótipos): `npx lefthook uninstall` e ignora `tests/acceptance/`.
- Cada pasta opcional tem o seu `README.md` com o racional completo de
  quando ativar — decide com base no custo do erro, não no entusiasmo.

E o inverso — sinais de que está na hora de ativar uma camada que deixaste fora:

- O produto ganhou um LLM (chatbot, classificação, geração) → ativa `evals/`
- Apareceu concorrência com dinheiro/dados em jogo (webhooks, stock, locks) → ativa `formal/`
- O protótipo "temporário" vai fazer seis meses e tem utilizadores → ativa tudo o resto

## Adaptar ao teu projeto

### Adopter CLI

O primeiro estágio do adopter analisa um projeto e propõe um plano sem escrever
no alvo. No repositório do boilerplate:

```bash
npm run build
node dist/adopter/cli.js adopt /caminho/do/projeto
node dist/adopter/cli.js adopt /caminho/do/projeto --json
node dist/adopter/cli.js adopt /caminho/do/projeto --apply
# rever e commitar o core, depois:
node dist/adopter/cli.js adopt /caminho/do/projeto --apply --profile auto
```

Quando o pacote for instalado, o mesmo comando fica disponível como
`ai-sdd adopt <diretório> [--apply] [--profile core|typescript|auto] [--json]`.
Sem `--apply` é sempre dry-run.
A aplicação exige Git limpo, nunca substitui ficheiros divergentes e regista os
ficheiros geridos com checksums em `.ai-sdd/manifest.json`. Reaplicar um core
intacto não escreve nada; alterações posteriores são reportadas como conflito.
O profile TypeScript acrescenta configuração strict e faz merge aditivo do
`package.json`, mas não instala dependências nem executa scripts. Depois de
rever o diff, corre o package manager do projeto e `npm run ai-sdd:check`.

1. Substitui `src/order.ts` (e testes) pelo teu domínio — mantém os padrões.
2. Reescreve o `AGENTS.md`: propósito, stack, regras duras específicas.
3. Cria o teu primeiro track e work-item reais; apaga os exemplos WT/WI-0001
   quando já não precisares deles como referência.
4. Configura branch protection no GitHub (instruções no topo do `ci.yml`).
5. Opcional mas recomendado: mutation testing (Stryker) como job noturno no
   CI — mede se os testes realmente falham quando o código muda.

## Stack

TypeScript 5 (`strict` máximo) · Zod · Vitest · fast-check · ESLint
(typescript-eslint strictTypeChecked) · Prettier · Lefthook · GitHub Actions.

A metodologia é agnóstica de linguagem: para Python, o equivalente é
mypy `--strict` + Pydantic + pytest + Hypothesis + ruff + pre-commit.
