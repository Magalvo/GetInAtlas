---
id: 'WI-0005'
title: Aplicar profile TypeScript estrito
status: done
track: 'WT-0002'
owner: Diogo
acceptance:
  - AC1: O comando `--apply --profile typescript` exige core instalado, Git limpo, projeto TypeScript e `package.json` válido.
  - AC2: O profile cria configuração strict namespaced e um runner cross-platform sem substituir configurações existentes.
  - AC3: O merge de `package.json` preserva chaves existentes, adiciona apenas scripts e dependências em falta e bloqueia colisão no script `ai-sdd:check`.
  - AC4: O manifesto passa a registar o profile, checksums e requisitos TypeScript; reaplicar um profile intacto é no-op.
  - AC5: A aplicação não instala dependências nem executa scripts do projeto e reporta `ready` ou `dependencies-pending`.
  - AC6: Qualquer falha restaura `package.json`, manifesto e ficheiros criados nessa tentativa.
---

# WI-0005 — Profile TypeScript estrito

## Problema

O core instala governação agnóstica, mas ainda não fornece ao agente um loop
determinístico para projetos TypeScript nem garante uma configuração strict.

## Proposta

Adicionar profiles `typescript` e `auto` ao comando de aplicação. Criar um
`tsconfig` namespaced e runner Node que encadeia scripts npm sem shell. Fazer
merge aditivo de `package.json`, sem instalar dependências. Atualizar o
manifesto de forma transacional e verificar requisitos em reaplicações.

## Fora de âmbito

Executar `npm install`, escolher ou migrar frameworks, substituir ESLint/Vitest,
alterar lockfiles, suportar monorepos ou aplicar outros profiles.

## Notas para o agente

O core deve ser aplicado e commitado primeiro. Não congelar todo o
`package.json`: registar requisitos e ficheiros geridos no manifesto. Dados do
package e manifesto entram por Zod. Escritas com rollback e sem execução de
scripts do alvo.
