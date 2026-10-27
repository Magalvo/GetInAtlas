---
id: 'WS-0018'
title: 'API health route and configuration'
item: 'WI-0018'
status: approved
owner: 'Diogo'
---

# WS-0018 — API health route and configuration

<!-- The implementation plan for WI-0018 (layer 4, ADR-0006). A human must approve it
(status: approved) before any code. If the plan changes, edit it and set it back to draft. -->

## Approach

The API is split into three modules, so tests never need a real port or a
real process: **configuration**, the **app** (routes) and the **entry
point** (process). Fastify 5 is the only new runtime dependency (ADR-0003;
`5.12.7` on 2026-10-27).

1. **Configuration (`src/config.ts`, AC3).**
   - `loadConfig(env)` validates the environment with one Zod schema and
     returns a typed, frozen `Config`. It never reads `process.env` itself,
     so tests pass a plain object.
   - Variables:

     | Variable            | Rule                                        | Default     |
     | ------------------- | ------------------------------------------- | ----------- |
     | `DATABASE_URL`      | required, `postgres://` or `postgresql://`  | —           |
     | `PORT`              | integer 1–65535 (Render sets it)            | `3000`      |
     | `HOST`              | non-empty string                            | `127.0.0.1` |
     | `LOG_LEVEL`         | `fatal`, `error`, `warn`, `info` or `debug` | `info`      |
     | `RENDER_GIT_COMMIT` | optional, set by Render on deploy           | —           |

   - On failure it throws a `ConfigError` that lists **every** invalid
     variable by name, not only the first, for example
     `Configuração inválida: DATABASE_URL em falta; PORT tem de ser um inteiro entre 1 e 65535`.
     Values are never echoed, because `DATABASE_URL` may hold a password.
   - The `DATABASE_URL` rule moves here from `migrate.ts`, which reuses it,
     so the two never drift (one rule, one place).

2. **App (`src/app.ts`, AC1, AC2).**
   - `buildApp({ config, pool, version })`, where `version` is
     `{ version, commit? }` (question 2), returns a Fastify instance that
     isn't listening. Tests use `app.inject()`.
   - `GET /health` runs `SELECT 1` on the pool:

     | Database  | Status | Body                                                                       |
     | --------- | ------ | -------------------------------------------------------------------------- |
     | reachable | 200    | `{ "status": "ok", "version": "…", "commit": "…", "database": "up" }`      |
     | otherwise | 503    | `{ "status": "error", "version": "…", "commit": "…", "database": "down" }` |

   - The body never carries the database error. The error goes to the log
     at `warn`.
   - The check has its own time limit of **2 seconds** (connection and
     query), so a database that hangs gives a 503 instead of a hanging
     request.
   - The route logs at `warn` only, so the platform's health checks every
     few seconds don't flood the log with `info` lines.

3. **The process stays up (AC2).** `pg.Pool` emits `error` when the server
   drops an idle connection (a restart, a failover on Neon). Without a
   listener, Node treats it as an unhandled error and **the process dies**.
   `createPool(databaseUrl, log)` in `app.ts` creates the pool and attaches
   a listener that logs it, and the next request opens a new connection.
   The entry point and the tests both create the pool through it, so the
   test covers the listener the server really uses.

4. **Entry point (`src/server.ts`).**
   - Order: `loadConfig(process.env)` → create the pool → `buildApp` →
     `listen({ host, port })`. Configuration fails before anything opens.
   - It creates the pool with `createPool` (step 3).
   - A `ConfigError` prints its message to stderr and exits with code 1,
     without a stack trace (AC3).
   - `SIGTERM` and `SIGINT` close the server, then the pool. Render sends
     `SIGTERM` on every deploy.
   - The version comes from `apps/api/package.json`, read once at startup
     and parsed with Zod. `commit` comes from `RENDER_GIT_COMMIT`, and the
     body leaves it out when the variable is absent, as in a local run
     (question 2).

5. **Scripts.** `apps/api` gains `start` (`node dist/server.js`). A local
   run is `make db-up`, `npm run build -w @getinatlas/api`, then `start`
   with `DATABASE_URL` set. A `dev` script with reload needs one more
   dependency (`tsx`), so it is left for the PWA item, which will need a
   dev loop anyway.

6. **Example environment.** `apps/api/.env.example` lists the four
   required-or-defaulted variables with local values (the compose
   database). `RENDER_GIT_COMMIT` stays out: only Render sets it. `.env` is already
   in `.gitignore`.

## Deviations during implementation (2026-10-27, for review in the PR)

Small changes that don't touch the ACs or the approved answers:

- **`buildApp({ config, version })` creates the pool itself** through
  `createPool(databaseUrl, app.log)`, and closes it in Fastify's `onClose`
  hook. The plan passed the pool in, but `createPool` needs the app's
  logger, which only exists once the app does. The pool listener is still
  in `createPool`, and both the server and the tests go through it.
  Without the listener, the AC2 test run fails (checked by removing it).
- **`apps/api/src/server.test.ts`** is a separate file for the entry point
  test that the test plan put under AC3, plus `readVersion`.
- **`.gitignore`** gains `!.env.example`, because `.env.*` was ignoring the
  example file.
- **The health route's log level** is `warn` only when `LOG_LEVEL` is
  `info` or `debug`, so a stricter `LOG_LEVEL` still applies to it.

## Files to change

| #   | File                          | Change                                                |
| --- | ----------------------------- | ----------------------------------------------------- |
| 1   | `apps/api/package.json`       | `fastify` dependency, `start` script                  |
| 2   | `apps/api/src/config.ts`      | new: Zod schema, `loadConfig`, `ConfigError`          |
| 3   | `apps/api/src/config.test.ts` | new: AC3                                              |
| 4   | `apps/api/src/app.ts`         | new: `createPool`, `buildApp`, `GET /health`          |
| 5   | `apps/api/src/app.test.ts`    | new: AC1, AC2                                         |
| 6   | `apps/api/src/server.ts`      | new: entry point, shutdown                            |
| 7   | `apps/api/src/migrate.ts`     | reuses the `DATABASE_URL` rule from `config.ts`       |
| 8   | `apps/api/.env.example`       | new: the variables, with local values                 |
| 9   | `package-lock.json`           | Fastify (~687 lines, **outside the budget**, WI-0019) |
| 10  | `specs/items/WI-0018-…`       | status                                                |

That is 9 counted files and about 450 lines, within the budget. The CI job
will list `fastify@^5.12.7` as a new direct dependency.

## Test plan

| AC  | Cases                                                                                                                                                                                                                                                                                                                                                                                                                             | Level     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| AC1 | `app.test.ts`, with a fresh test database (WI-0016): `GET /health` → 200, `database: "up"`, `version` equal to the one passed to `buildApp`, and `commit` present only when given.                                                                                                                                                                                                                                                | unit + DB |
| AC2 | A pool aimed at a closed port → 503, `database: "down"`, no error text in the body. **Recovery and survival:** health is `up`, then the test drops the database with `WITH (FORCE)`, which kills the pool's idle connection (the `error` event), and health returns 503 while the app keeps answering. A hanging database is not simulated; the 2-second limit is set in the pool options and reviewed.                           | unit + DB |
| AC3 | `config.test.ts`: a valid environment gives the typed config with defaults. Each variable missing or invalid (`DATABASE_URL` absent or `mysql://`, `PORT` `abc`, `0` or `70000`, `LOG_LEVEL` `verbose`) gives a `ConfigError` naming it. Two invalid variables are both named. The message never contains the `DATABASE_URL` value. Plus one test that the entry point's startup rejects a bad environment before opening a port. | unit      |
| —   | Existing `migrate.test.ts` still passes after the `DATABASE_URL` rule moves.                                                                                                                                                                                                                                                                                                                                                      | unit + DB |

These are unit tests (ADR-0007: infrastructure, not product behaviour).
**Manual probe, recorded in the PR:** build, start with an empty
environment (exit 1 and the message), start with the compose database and
`curl /health` (200), `docker compose stop db` and `curl` again (503, the
process still up), then `docker compose start db` and `curl` (200).

## Risks and edge cases

- **The pool `error` listener is the whole of AC2's "keeps running".** If a
  later item creates another pool and forgets the listener, the crash comes
  back. The listener lives in `createPool`, the one way to create a pool,
  and the AC2 test fails without it.
- **Health on every check opens a connection** only when the pool has none
  idle. The pool keeps one, so the load is negligible.
- **`HOST` on Render:** with the `127.0.0.1` default, Render can't reach
  the app. Render's configuration (not in this item) must set
  `HOST=0.0.0.0`. The deploy item has to record it (question 1).
- **Health is public** and shows the version. It shows nothing else:
  no hostnames, no errors.
- **Zod v3 messages** are in English by default. The schema sets its own
  messages in Portuguese, like `migrate.ts`.

## Assumptions and questions

**Approved by the owner on 2026-10-27**, with the three recommendations:

1. **`HOST` default: `127.0.0.1`.** Render's configuration sets
   `HOST=0.0.0.0`, and the deploy item records it. Option (b), `0.0.0.0` by
   default, was rejected: every local run would listen on every interface.
2. **Version: `version` from `apps/api/package.json`, plus an optional
   `commit` from `RENDER_GIT_COMMIT`.** The commit says exactly what is
   deployed. Rejected: (b) the package version only, which stays `0.0.0`
   for a long time; (c) an `APP_VERSION` variable, required and set by
   nothing local.
3. **Zod at the routes: no type provider yet.** `GET /health` has no input,
   and its response is typed in TypeScript. `fastify-type-provider-zod`
   arrives with the first route that has input (the auth spike). Option
   (b), adding it now, was rejected: a dependency wired for a route that
   validates nothing. This reads ADR-0003's "Zod schemas at every route" as
   every route **with input**.

- **Assumption:** these variables are enough for now. Authentication
  (secrets, SMS keys) adds its own in its own item, with the same schema.
- **Assumption:** no `dev` script with reload in this item (step 5).
