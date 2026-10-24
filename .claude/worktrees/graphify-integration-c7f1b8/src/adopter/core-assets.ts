export interface CoreAsset {
  relativePath: string;
  content: string;
}

export const CORE_ASSETS = [
  {
    relativePath: '.agent/templates/adr.md',
    content: `# ADR-{{NUM}} — <título>

- **Estado:** proposto
- **Data:** <YYYY-MM-DD>
- **Decisor(es):** <nome-humano>

## Contexto

<Porque é necessária uma decisão.>

## Decisão

<O que foi decidido.>

## Consequências

<Trade-offs e obrigações resultantes.>
`,
  },
  {
    relativePath: '.agent/templates/track.md',
    content: `---
id: '{{ID}}'
title: <título do épico>
status: draft
owner: <nome-humano>
---

# {{ID}} — <título>

## Objetivo

<Resultado pretendido.>

## Âmbito

<Dentro e fora do âmbito.>

## Work-items

<Lista de work-items.>
`,
  },
  {
    relativePath: '.agent/templates/work-item.md',
    content: `---
id: '{{ID}}'
title: <título da tarefa>
status: draft
track: '{{TRACK}}'
owner: <nome-humano>
acceptance:
  - AC1: <critério verificável>
---

# {{ID}} — <título>

## Problema

<O que está em falta.>

## Proposta

<Abordagem aprovada.>

## Fora de âmbito

<Limites explícitos.>
`,
  },
  {
    relativePath: 'AGENTS.md',
    content: `# AGENTS.md — Constituição do projeto

Lê este ficheiro por inteiro antes de qualquer ação.

## Propósito e stack

Preencher e manter estes campos antes de entregar trabalho a coding agents.

## Regras duras

1. Nunca editar ou enfraquecer contratos humanos para fazer uma alteração passar.
2. Dados externos são validados na fronteira antes de entrarem no domínio.
3. Nunca desligar checks de qualidade sem decisão humana registada num ADR.
4. Nunca incluir segredos, credenciais ou dados pessoais no repositório.
5. Nunca trabalhar diretamente na branch principal; usar branch por work-item.
6. Tocar apenas nos ficheiros necessários ao work-item aprovado.

## Workflow obrigatório

1. Ler o work-item em specs/items; pedir um ao humano se não existir.
2. Antes de escrever código, apresentar plano, assunções e casos-limite e esperar aprovação.
3. Fazer TDD: teste vermelho, implementação mínima e refactor.
4. Executar a interface de checks do projeto até tudo ficar verde.
5. Atualizar documentação e estado do work-item no mesmo branch.

## Contratos protegidos

Testes de aceitação, datasets de avaliação e thresholds são decisões humanas.
Se parecem errados, parar e propor um ADR; nunca alterá-los silenciosamente.

## Adoção AI-SDD

Os ficheiros geridos estão registados em .ai-sdd/manifest.json. Não editar o
manifesto manualmente. Completar a stack, comandos e paths protegidos deste
documento através de um profile técnico antes de declarar o projeto agent-ready.
`,
  },
  {
    relativePath: 'docs/adr/README.md',
    content: `# Architecture Decision Records

Regista aqui decisões de arquitetura não óbvias, incluindo contexto,
alternativas, decisão humana e consequências. Cria ADRs através do template em
\`.agent/templates/adr.md\` e nunca reescrevas retroativamente uma decisão aceite.
`,
  },
  {
    relativePath: 'specs/_schema/README.md',
    content: `# Schema das specs

Tracks usam IDs \`WT-NNNN\` e estados \`draft | active | done | abandoned\`.
Work-items usam IDs \`WI-NNNN\`, referenciam um track e usam estados
\`draft | ready | in-progress | done | abandoned\`.

Todo o work-item ready, in-progress ou done tem pelo menos um critério de
aceitação verificável. Owner é sempre uma pessoa responsável, não um agente.
Usa os templates em \`.agent/templates/\` para evitar drift estrutural.
`,
  },
  { relativePath: 'specs/items/.gitkeep', content: '' },
  { relativePath: 'specs/tracks/.gitkeep', content: '' },
] satisfies readonly CoreAsset[];
