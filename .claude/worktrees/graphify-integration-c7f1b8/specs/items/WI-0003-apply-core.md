---
id: 'WI-0003'
title: Aplicar o core AI-SDD de forma segura e idempotente
status: done
track: 'WT-0002'
owner: Diogo
acceptance:
  - AC1: O comando `adopt --apply` instala o manifesto e os artefactos mínimos de governação apenas num repositório Git limpo.
  - AC2: Uma segunda aplicação com os ficheiros geridos intactos é um no-op e produz o mesmo manifesto.
  - AC3: Ficheiros existentes com conteúdo diferente ou ficheiros geridos alterados bloqueiam toda a operação sem sobrescrita parcial.
  - AC4: O manifesto valida com Zod e regista checksums SHA-256 de todos os ficheiros geridos.
  - AC5: Uma falha durante a escrita remove todos os ficheiros criados nessa tentativa.
---

# WI-0003 — Aplicar o core AI-SDD

## Problema

O dry-run identifica o trabalho necessário, mas o utilizador ainda tem de
copiar manualmente a governação base. Isso introduz drift e não permite ao CLI
distinguir ficheiros geridos de configuração pertencente ao projeto.

## Proposta

Adicionar `--apply` com preflight completo antes da primeira escrita. Instalar
um conjunto agnóstico de artefactos e um manifesto determinístico com checksums.
Nunca substituir conteúdo divergente. Reaplicações intactas são no-op e uma
falha de I/O aciona rollback dos ficheiros criados nessa tentativa.

## Fora de âmbito

Dependências, CI remoto, Makefile específico da stack, profiles técnicos,
merge automático de configuração, uninstall e upgrades de versão do manifesto.

## Notas para o agente

O manifesto é input externo e deve passar por Zod. Escritas usam criação
exclusiva, nunca truncate. Um no-op pode ocorrer com ficheiros ainda untracked,
mas qualquer operação que escreva exige Git limpo. Manter os contratos
existentes intocáveis.
