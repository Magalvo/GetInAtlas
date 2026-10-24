# Convenções

## Código

- ESM, TypeScript estrito. Um módulo = uma responsabilidade.
- Fronteiras validam com Zod; o interior confia nos tipos.
- Uniões discriminadas para máquinas de estado; nunca flags booleanas soltas.
- Dinheiro: inteiros em cêntimos. Datas: `Date` em UTC.

## Nomes e estrutura

- Branches: `wi/WI-NNNN-slug`. Commits: imperativos, pequenos, frequentes.
- Testes: `tests/unit/**` espelha `src/**`; aceitação nomeada pelo work-item.

## Specs e memória

- Specs criadas SEMPRE via `make new-item` / `make new-track` (nunca à mão).
- Toda a decisão de arquitetura não-óbvia gera ADR no mesmo PR.
- Docs desatualizados são bugs: atualizar no mesmo branch que os invalida.
