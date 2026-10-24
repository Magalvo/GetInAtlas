# ADR-0002 — Camada de evals e camada opcional de métodos formais

- **Estado:** aceite
- **Data:** 2026-07-05
- **Decisor(es):** equipa fundadora

## Contexto

Testes binários (pass/fail) assumem determinismo. Dois tipos de sistema quebram
essa assunção ou excedem-na: (a) componentes com LLM, cujo output é
probabilístico — um assert binário é flaky ou vazio; (b) desenhos concorrentes/
distribuídos, onde testes não exploram todos os entrelaçamentos e "passou" não
prova ausência de races. Queríamos um boilerplate all-in-one onde cada equipa
ativa o que o seu tipo de projeto exige.

## Decisão

(1) Adicionar `evals/` com runner próprio (`make eval`), datasets JSONL e
thresholds estatísticos; datasets e thresholds passam a fazer parte do CONTRATO
protegido, ao lado de `tests/acceptance/` — baixar um threshold ou remover
casos difíceis é a versão estatística de enfraquecer um teste. Evals correm
fora do `make check` (custo de API/tempo): nightly e em PRs que tocam evals.
(2) Adicionar `formal/` como camada OPCIONAL com TLA+/TLC para o núcleo
crítico, incluindo a spec do ciclo de vida da encomenda com concorrência e a
demo da race condition (variante naive). A ligação spec↔código é disciplinar:
desenho muda primeiro na spec.
(3) Documentar no README a matriz de decisão por tipo de projeto
(protótipo / standard / com LLM / crítico) e como desativar cada camada.

## Consequências

Melhor: cobertura honesta de componentes probabilísticos; provas de ausência de
races no núcleo crítico; o boilerplate serve vários tipos de projeto sem
imposição. Pior: mais superfície para manter; TLC exige Java; evals com modelos
reais custam dinheiro. Obrigatório: alterações a `evals/datasets/` e
`evals/thresholds.json` exigem ACCEPT_CONTRACT_CHANGE=1 + ADR (local) e a label
`contract-change-approved` (CI).
