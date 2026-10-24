# `formal/` — Métodos formais no núcleo crítico (OPCIONAL)

## Objetivo

Testes e evals mostram **presença** de comportamento em casos concretos.
Métodos formais provam **ausência** de classes inteiras de erros, explorando
exaustivamente todos os estados possíveis do desenho. É a diferença entre
"corri 14 testes e passaram" e "não existe nenhuma sequência de eventos, em
nenhum entrelaçamento de concorrência, que viole este invariante".

Esta camada é **opt-in** e cirúrgica: aplica-se aos ~5% do sistema onde a
correção tem de ser provada e não apenas testada. Para o resto, testes e evals
são a ferramenta certa — model checking do sistema inteiro não escala nem
compensa.

## Quando ativar (e quando não)

**Ativa se o teu projeto tem:**

- Concorrência ou sistemas distribuídos: pagamentos com webhooks concorrentes,
  reservas de stock, locks, filas, consenso, sagas, retries com idempotência
- Máquinas de estado onde uma transição errada custa dinheiro ou dados
  (o exemplo incluído: pagar e cancelar a mesma encomenda em corrida)
- Protocolos entre serviços onde a ordem das mensagens importa
- Invariantes de segurança/contabilidade ("dinheiro nunca se perde",
  "nunca há double-charge", "um recurso nunca tem dois donos")

**Deixa de fora se:**

- O projeto é maioritariamente CRUD sem concorrência não-trivial
- Os invariantes críticos são cobertos por constraints da base de dados
  (UNIQUE, transações serializáveis) — nesse caso verifica que usas essas
  constraints, não precisas de TLA+
- Estás em fase de protótipo — formalizar um desenho que muda todos os dias
  é desperdício

## O que está incluído

```
formal/
├── README.md                  ← estás aqui
├── OrderLifecycle.tla         ← a especificação (o MESMO domínio de src/order.ts)
├── OrderLifecycle.cfg         ← config TLC: variante correta → deve passar
└── OrderLifecycleNaive.cfg    ← config TLC: variante com race → deve FALHAR (demo)
```

`OrderLifecycle.tla` modela o ciclo de vida da encomenda com **N processos
concorrentes** (webhooks, utilizador, jobs) e dois desenhos:

1. **SpecSafe** — transições atómicas com guarda (compare-and-set). O TLC prova
   que os invariantes `NoDoubleCharge` e `NoMoneyLost` valem em _todos_ os
   estados alcançáveis.
2. **SpecNaive** — o padrão "ler estado → decidir → escrever" em passos não
   atómicos (o clássico `if (order.status === 'pending') { pagar() }` com
   queries separadas). O TLC encontra automaticamente os contra-exemplos, com o
   trace passo-a-passo de cada bug. O desenho naive viola **ambos** os
   invariantes: dois processos leem `pending` e ambos pagam → **cobrança dupla**
   (`NoDoubleCharge`); ou um lê e paga enquanto outro, que também leu `pending`,
   cancela → **dinheiro capturado numa encomenda cancelada** (`NoMoneyLost`).
   O TLC reporta a primeira violação que a pesquisa encontra; para ver a outra,
   remove um `INVARIANT` do `.cfg` e volta a correr.

O ponto pedagógico: os 14 testes do repo passam alegremente sobre o desenho
naive, porque testes não exploram entrelaçamentos. O model checker sim.

## Como correr

Requisitos: Java 11+ instalado.

```bash
make formal-setup       # descarrega tla2tools.jar (uma vez)
make formal-check       # verifica a variante correta — deve passar
make formal-demo-race   # a variante naive — o TLC encontra e mostra a race
```

A ligação spec↔código é **disciplina, não automação**: quando o TLC aprova um
desenho, o código que o implementa deve referenciar a spec (comentário
`// implementa formal/OrderLifecycle.tla: Pay`) e a spec ganha um ADR. Se o
desenho muda, a spec muda primeiro.

## Escalar para além do exemplo

- **TLA+/TLC** (incluído): desenho de sistemas concorrentes/distribuídos.
  Usado pela AWS (DynamoDB, S3), Microsoft (Cosmos DB), MongoDB. É o melhor
  rácio esforço/valor para a maioria das equipas.
- **PlusCal**: sintaxe tipo-pseudocódigo que compila para TLA+ — mais acessível
  para quem vem de linguagens imperativas; bom primeiro passo.
- **Apalache**: model checker simbólico para TLA+ (SMT), escala melhor em
  certos modelos.
- **Property-based testing** (já incluído em `tests/properties/`): o degrau
  abaixo — não é prova, mas explora muito mais espaço do que testes de exemplo.
- *_Verificação total (Coq/Lean/F_/Dafny)**: prova matemática do próprio
  código, não só do desenho. Custo altíssimo; reservado para criptografia,
  kernels, aviação.

Nota honesta sobre o rácio esforço/valor: escrever specs TLA+ era trabalho
especializado e lento — é exatamente o tipo de tarefa em que um coding agent
ajuda muito (esta spec foi escrita por um). Mas o valor da spec depende de ela
modelar o desenho _real_: a revisão humana da spec é ainda mais crítica do que
a revisão de código, porque uma spec errada dá falsa confiança provada.
