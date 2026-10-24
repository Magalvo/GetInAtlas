---
id: WI-0002
title: Descoberta read-only e plano de adoção
status: done
track: WT-0002
owner: Diogo
acceptance:
  - AC1: O CLI aceita um diretório e deteta TypeScript, Python, Flutter, Rust ou stack desconhecida através de evidência local.
  - AC2: O relatório identifica o estado Git, a governação AI-SDD existente, conflitos e o profile recomendado.
  - AC3: O comando disponibiliza output humano e JSON determinístico sem escrever no projeto analisado.
  - AC4: Paths inexistentes, ficheiros em vez de diretórios e argumentos inválidos falham com uma mensagem acionável.
---

# WI-0002 — Descoberta read-only e plano de adoção

## Problema

Hoje adaptar o boilerplate exige inspeção e edição manuais, o que torna
arriscado aplicá-lo a projetos brownfield e impede prever conflitos antes da
primeira alteração.

## Proposta

Criar o comando `ai-sdd adopt <path>`, inicialmente sempre em modo dry-run. O
comando recolhe apenas evidência local, valida inputs externos com Zod e produz
um plano determinístico em texto ou JSON. A descoberta recomenda um profile,
mas não instala nem altera configuração neste work-item.

## Fora de âmbito

Aplicar o plano, copiar templates, instalar dependências, alterar CI remoto,
gerar testes de aceitação ou suportar profiles completos além de TypeScript.

## Notas para o agente

Manter `tests/acceptance/` intocável. Não executar scripts encontrados no
projeto alvo. A deteção deve funcionar mesmo com `package.json` inválido e o
dry-run deve ser testado contra uma árvore temporária antes/depois.
