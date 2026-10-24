---
id: 'WI-0004'
title: Tornar hooks e setup portáteis em Windows
status: done
track: 'WT-0002'
owner: Diogo
acceptance:
  - AC1: O pre-commit bloqueia alterações staged ao contrato em Windows, Linux e macOS sem depender de sintaxe shell POSIX.
  - AC2: O override `ACCEPT_CONTRACT_CHANGE=1` permite uma alteração humana consciente e mantém a recomendação de ADR.
  - AC3: O hook de formatação e o pre-push não contêm `||`, `&&`, substituição de comandos ou scripts YAML multiline.
  - AC4: O script `prepare` termina com sucesso quando Lefthook não pode instalar hooks e funciona sem o comando Unix `true`.
  - AC5: Um commit normal no Windows executa os hooks sem exigir `--no-verify`.
---

# WI-0004 — Hooks portáteis em Windows

## Problema

Os hooks atuais embebem Bash no YAML e o `prepare` usa `|| true`. Em Windows,
isto produz erros de quoting antes dos checks e impede commits normais mesmo
quando specs, tipos, lint e testes estão verdes.

## Proposta

Mover a proteção do contrato e o diff-budget informativo para scripts Node sem
shell. Manter o Lefthook como orquestrador de comandos simples. Substituir o
`prepare` por um instalador Node best-effort que reporta falhas mas não quebra
instalações fora de um repositório Git.

## Fora de âmbito

Alterar contratos, reduzir checks, mudar thresholds, configurar branch
protection remota ou tornar o diff-budget local bloqueante.

## Notas para o agente

Alteração de `lefthook.yml` explicitamente aprovada pelo humano. Preservar o
CI como verificação independente. Testar os scripts em repositórios temporários
e confirmar o resultado com um commit real sem `--no-verify`.
