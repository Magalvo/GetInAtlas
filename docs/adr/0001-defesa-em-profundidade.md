# ADR-0001 — Defesa em profundidade em vez de "prevenção perfeita"

- **Estado:** aceite
- **Data:** 2026-07-05
- **Decisor(es):** equipa fundadora

## Contexto

Modelos de IA são probabilísticos: nenhum processo elimina erros na origem.
Precisávamos de decidir a filosofia de qualidade do projeto: investir em
tentar prevenir todos os erros, ou em torná-los baratos de detetar,
impossíveis de esconder e triviais de reverter.

## Decisão

Adotamos defesa em profundidade com cinco camadas: (1) estados inválidos
irrepresentáveis — tipos estritos e schemas nas fronteiras; (2) portão de
planeamento — o agente apresenta plano e perguntas antes de código;
(3) loop determinístico — format/lint/typecheck/testes num só `make check`,
com testes de aceitação intocáveis pelo agente e orçamento de diff;
(4) isolamento e reversibilidade — branch por work-item, worktrees para
paralelismo, main protegida; (5) assumir falha — CI independente, e em
produção feature flags e observabilidade.

## Consequências

Melhor: erros apanhados cedo e de forma automática; agentes não conseguem
"resolver" testes enfraquecendo-os. Pior: mais fricção inicial e setup.
Proibido: relaxar tsconfig/eslint sem ADR; editar tests/acceptance/ sem
decisão humana explícita (ACCEPT_CONTRACT_CHANGE=1 + ADR).
