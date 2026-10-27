---
id: 'WI-0018'
title: API health route and configuration
status: done
track: 'WT-0003'
owner: Diogo
acceptance:
  - AC1: '`apps/api` serves `GET /health`, which returns 200 with the app version and `database: up` when Postgres is reachable'
  - AC2: 'when Postgres is unreachable, `GET /health` returns 503 with `database: down`, and the process keeps running'
  - AC3: at startup, configuration from environment variables is validated with Zod; a missing or invalid variable stops the process with a message naming it
---

# WI-0018 — API health route and configuration

## Problem

With Postgres in the gate (WI-0016), the API still has no server. The PWA
skeleton and the authentication spike both need a running API to talk to,
and the platform (Render, ADR-0003) needs a health route to decide whether
an instance is alive.

## Proposal

Add the Fastify server to `apps/api` (ADR-0003). It gets one health route
that reports the database's state without crashing when the database is
down, and a configuration module that validates the environment with Zod
before the server starts. Split out of WI-0016 on 2026-10-26.

## Out of scope

- Authentication, roles and any domain route
- Deploying to Render
- Logging and metrics beyond Fastify's defaults

## Missing before coding

Nothing. WI-0016 and WI-0019 are `done`, and the owner approved WS-0018 on
2026-10-27.
