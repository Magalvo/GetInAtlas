---
id: 'WI-0016'
title: API skeleton with Postgres in the gate
status: draft
track: 'WT-0003'
owner: Diogo
acceptance:
  - AC1: '`apps/api` serves `GET /health`, which returns 200 with the app version and `database: up` when Postgres is reachable'
  - AC2: 'when Postgres is unreachable, `GET /health` returns 503 with `database: down`, and the process keeps running'
  - AC3: one command applies the SQL migrations to an empty database; running it a second time changes nothing
  - AC4: the first migration enables the `btree_gist` extension, and a test confirms it is present (ADR-0005)
  - AC5: at startup, configuration from environment variables is validated with Zod; a missing or invalid variable stops the process with a message naming it
  - AC6: '`make check` runs the API tests against a real Postgres (Docker locally, a service container in CI); if Postgres cannot be started, it fails with an actionable message instead of skipping the tests'
---

# WI-0016 — API skeleton with Postgres in the gate

## Problem

Every WT-0003 invariant ends in Postgres (ADR-0005), and ADR-0005 rules out
in-memory fakes for concurrency tests. Before the first domain item, the API
needs to exist, reach a real database and run migrations. `make check` also
needs to exercise all of that. Otherwise the first product item has to build
infrastructure and behaviour together, and won't fit in one agent run.

## Proposal

Add `apps/api`, a Fastify server with one health route, and Zod-validated
configuration. Add a migration runner with SQL migrations, starting with the
extension ADR-0005 needs. Postgres becomes part of the gate, locally and in
CI. The tests skip nothing silently: without a database, `make check` fails
and says how to start one.

## Out of scope

- Authentication and roles (ADR-0004, its own item)
- Domain routes and tables
- Deploying to a PaaS, and choosing the hosted Postgres vendor
- `apps/web`
- Background jobs (pg-boss arrives with the first item that needs it,
  WI-0008)

## Missing before coding

- WI-0015 is `done`.
- ADR-0003 and ADR-0005 are accepted.
- A human approves the change to `.github/workflows/ci.yml` (a Postgres
  service container). It is a gate the agent doesn't control.
- A human confirms that `make check` may require Docker locally (ADR-0003
  says so, as a consequence).
