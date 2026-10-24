# `evals/` — Avaliação de componentes probabilísticos

## Objetivo

Testes (`tests/`) verificam código **determinístico**: o mesmo input dá sempre o
mesmo output, portanto `expect(x).toBe(y)` funciona. Quando o produto contém um
**LLM** (chatbot, classificador, geração de texto, RAG), o output é
probabilístico — a mesma pergunta pode dar duas respostas diferentes, ambas
aceitáveis. Um teste binário sobre isso ou é _flaky_ ou é tão frouxo que não
verifica nada.

Um **eval** substitui o veredicto binário por um veredicto estatístico:

> dataset de casos + métrica + threshold → "≥ 90% dos casos corretos" em vez de
> "este caso passa".

É TDD em espírito — o contrato continua a existir e a falha continua a bloquear
— mas com estatística em vez de booleanos.

## A fronteira (importante)

Se o teu produto usa um LLM, **só o comportamento do modelo precisa de evals**.
Todo o código à volta — parsing da resposta, validação Zod do JSON devolvido,
retries, fallbacks — continua determinístico e continua em `tests/`. Um erro
comum é migrar tudo para evals assim que entra um LLM no sistema.

## Estrutura

```
evals/
├── README.md            ← estás aqui
├── thresholds.json      ← ⚠ CONTRATO: métricas mínimas por dataset (protegido)
├── datasets/            ← ⚠ CONTRATO: casos em JSONL, versionados (protegido)
│   └── intent-classification.jsonl
├── subjects/            ← o sistema sob avaliação (o agente PODE editar)
│   └── intent-classifier.mjs
└── (runner: scripts/run-evals.mjs)
```

**`datasets/` e `thresholds.json` são contrato**, como `tests/acceptance/`:
o hook de pre-commit bloqueia alterações sem `ACCEPT_CONTRACT_CHANGE=1`.
Motivo: a versão estatística do reward hacking é o agente "resolver" um eval
a falhar baixando o threshold ou removendo os casos difíceis do dataset.

## Como correr

```bash
make eval
```

Sai com código ≠ 0 se alguma métrica ficar abaixo do threshold — bloqueante,
tal como um teste vermelho.

## Porque NÃO está no `make check`

Evals com modelos reais custam dinheiro (chamadas de API) e tempo. Correm:

- localmente, quando alteras o prompt/modelo/subject (`make eval`);
- no CI, em agenda noturna e em PRs que tocam `evals/` ou prompts
  (`.github/workflows/evals.yml`) — não em cada commit.

## O exemplo incluído

`subjects/intent-classifier.mjs` é um classificador de intenções de apoio ao
cliente. Para o boilerplate funcionar **offline e sem chaves de API**, o subject
incluído é uma heurística determinística que faz de "modelo". O contrato do
subject é uma função `classify(text) → Promise<label>`; para o teu caso real,
substitui o interior por uma chamada ao teu LLM (o comentário no ficheiro mostra
como). O runner, o dataset e os thresholds não mudam.

Threshold do exemplo: 0.9 de accuracy — e o subject incluído acerta ~0.93 no
dataset, de propósito **imperfeito**, para lembrar que 100% num eval é suspeito
(dataset fácil demais) e para deixar margem de melhoria como exercício.

## Métricas suportadas pelo runner

- `exact_match` — accuracy sobre labels (classificação). É o que o exemplo usa.
- `llm_judge` — esqueleto documentado no runner: um segundo modelo pontua o
  output contra uma rubrica. Necessário para geração de texto livre. Requer
  chave de API; ver comentários em `scripts/run-evals.mjs`.

## Boas práticas

1. O dataset nasce pequeno (20–50 casos) e cresce com **falhas reais de
   produção** — cada bug vira um caso, como regressão.
2. Casos difíceis e adversariais valem mais do que casos fáceis em quantidade.
3. Threshold define-se pelo custo do erro, não pelo que o modelo consegue hoje.
4. Mudanças de prompt/modelo exigem correr o eval ANTES do merge — o eval é a
   rede de segurança da iteração de prompts.
