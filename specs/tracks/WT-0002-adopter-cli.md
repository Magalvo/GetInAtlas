---
id: WT-0002
title: Adotar projetos existentes para desenvolvimento com agentes
status: active
owner: Diogo
---

# WT-0002 — Adopter CLI

## Objetivo

Disponibilizar um CLI seguro e incremental que prepare projetos novos ou
existentes para o workflow SDD/TDD e para coding agents sujeitos a gates
determinísticos.

## Métrica de sucesso

Um projeto TypeScript existente adota o core com o CLI (descoberta → plano →
aplicação → profile) e passa `make check` sem edições manuais; uma segunda
aplicação é um no-op.

## Âmbito

Inclui descoberta read-only, planos de adoção, instalação idempotente do core,
profiles por stack e diagnóstico de readiness. A migração automática de código
de negócio e a ratificação automática de contratos ficam fora do âmbito.

## Work-items

- WI-0002 — descoberta e plano dry-run
- WI-0003 — aplicação segura e idempotente do core
- WI-0004 — hooks e setup portáteis em Windows
- WI-0005 — profile TypeScript estrito
- WI-0011 — isolar os testes do ambiente git dos hooks
