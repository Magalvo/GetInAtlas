---
id: 'WI-0016'
title: Postgres in the gate
status: ready
track: 'WT-0003'
owner: Diogo
acceptance:
  - AC1: one command applies the SQL migrations to an empty database; running it a second time changes nothing
  - AC2: the first migration enables the `btree_gist` extension, and a test confirms it is present (ADR-0005)
  - AC3: '`make check` runs the API tests against a real Postgres (Docker locally, a service container in CI); if Postgres cannot be started, it fails with an actionable message instead of skipping the tests'
---

# WI-0016 — Postgres in the gate

## Problem

Every WT-0003 invariant ends in Postgres (ADR-0005), and ADR-0005 rules out
in-memory fakes for concurrency tests. Before the first domain item, the API
workspace needs to reach a real database and run migrations, and
`make check` needs to exercise both. Otherwise the first product item has to
build infrastructure and behaviour together, and won't fit in one agent run.

## Proposal

Add the `apps/api` workspace with a migration runner and the first SQL
migration, the extension ADR-0005 needs. Postgres becomes part of the gate,
locally (Docker) and in CI (a service container). The tests skip nothing
silently: without a database, `make check` fails and says how to start one.

Split on 2026-10-26 (WS-0016). The HTTP server, the health route and the
configuration moved to WI-0018, because together the item broke the diff
budget.

## Out of scope

- The Fastify server, `GET /health` and the configuration (WI-0018)
- Authentication and roles (ADR-0004, its own item)
- Domain routes and tables, and Drizzle as the query layer (WI-0006)
- Deploying to a PaaS, and choosing the hosted Postgres vendor
- `apps/web`
- Background jobs (pg-boss arrives with the first item that needs it,
  WI-0008)

## Missing before coding

Nothing. Settled on 2026-10-26:

- WI-0015 is `done`, and ADR-0003 and ADR-0005 are accepted.
- The owner approved the Postgres service container in
  `.github/workflows/ci.yml`, and Docker as a local requirement of
  `make check`.
- WS-0016 is approved.
