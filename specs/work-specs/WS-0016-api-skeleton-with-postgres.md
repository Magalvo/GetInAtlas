---
id: 'WS-0016'
title: 'API skeleton with Postgres in the gate'
item: 'WI-0016'
status: draft
owner: 'Diogo'
---

# WS-0016 — API skeleton with Postgres in the gate

<!-- The implementation plan for WI-0016 (layer 4, ADR-0006). A human must approve it
(status: approved) before any code. If the plan changes, edit it and set it back to draft. -->

## Size first: this item doesn't fit in one run

On 2026-10-26 I measured what the dependencies add to `package-lock.json`,
which the diff budget counts:

| Dependency                    | Lockfile lines |
| ----------------------------- | -------------- |
| `pg` + `@types/pg`            | ~110           |
| `fastify` (5.x, transitively) | ~687           |

With the code, the whole item comes to about 19 files and more than 1,100
lines, which breaks both limits (15 files and 800 lines). ADR-0006 says an
item that is still too big is split before it starts. So **this plan splits
WI-0016 in two**:

| Item                                     | ACs (current numbering) | Estimate                       |
| ---------------------------------------- | ----------------------- | ------------------------------ |
| **WI-0016**: Postgres in the gate        | AC3, AC4, AC6           | 12 files, ~460 lines           |
| **WI-0018** (new): API health and config | AC1, AC2, AC5           | 8 files, ~950 lines (lockfile) |

WI-0018 still goes over 800 lines because of Fastify's lockfile alone. It is
the first of many: Drizzle, Better Auth, pg-boss, React and Vite will each
add hundreds of generated lines. See the lockfile question at the end.

The rest of this work-spec plans **WI-0016 after the split**. WI-0018 gets
its own work-spec just before it starts.

## Approach (WI-0016 after the split)

1. **`apps/api` workspace** (`@getinatlas/api`, private, ESM).
   - Its only runtime dependency is `pg`. Its `tsconfig.json` has Node types
     (the API does I/O).
   - A `tsconfig.build.json` emits to `dist/`.
   - Fastify comes in WI-0018.
2. **Local Postgres.**
   - A `compose.yaml` runs one `postgres:16-alpine` service (ADR-0003:
     "16+"), published on `127.0.0.1:54329` so it doesn't clash with a
     Postgres you may already run on 5432.
   - It has no volume, because test data is disposable.
   - A `pg_isready` healthcheck lets `docker compose up --wait` return only
     once the database accepts connections.
3. **Make targets:**
   - `make db-up` checks that Docker exists and runs
     `docker compose up -d --wait db`. Without Docker it fails with
     instructions: install Docker Desktop, or point `DATABASE_URL_TEST` at an
     existing Postgres. If `DATABASE_URL_TEST` is already set, it skips
     Docker.
   - `make check` gains `db-up` before `test`.
   - `make db-migrate` builds the API and runs the migrations against
     `DATABASE_URL` (AC3's "one command").
4. **Migration runner** (`apps/api/src/migrate.ts`), an own runner of about
   60 lines (see the questions):
   - takes a Postgres advisory lock, so two runs never migrate at once (two
     parallel sessions, or two app instances);
   - creates `schema_migrations (id, checksum, applied_at)`;
   - applies, in order, each `migrations/*.sql` not yet applied, each in its
     own transaction, and records its SHA-256;
   - **refuses to run** if an applied migration's file changed (its checksum
     differs). Migrations are immutable, like the contract.

   Reading `DATABASE_URL` uses Zod, and an invalid URL stops the run with its
   name (AGENTS.md rule 4).

5. **First migration**, `migrations/0001_btree_gist.sql`:
   `CREATE EXTENSION IF NOT EXISTS btree_gist;` (ADR-0005).
6. **Isolated test databases** (`apps/api/src/test-database.ts`):
   - each API test creates a fresh database named
     `getinatlas_test_<random>` on the test server, and drops it at the end
     (`DROP DATABASE … WITH (FORCE)`);
   - parallel test files, worktrees and sessions never share data.
7. **No skipping (AC6).** The helper's first connection has a 3-second
   timeout. If it fails, the API tests fail with:

   > `Postgres unavailable at 127.0.0.1:54329. Run make db-up (Docker) or set DATABASE_URL_TEST.`

   This check sits in the test files themselves, not in a global
   `globalSetup`. Tests that don't need a database (`make test-unit`,
   adopter, specs) keep running without Docker, and `vitest.config.ts`
   doesn't change.

8. **CI.** The `check` job gains a `services: postgres` (`postgres:16-alpine`,
   with a healthcheck) and `DATABASE_URL_TEST`. The other jobs are unchanged.

## Files to change

| #   | File                                      | Change                                      |
| --- | ----------------------------------------- | ------------------------------------------- |
| 1   | `apps/api/package.json`                   | new: `pg`, `@types/pg`, `build` script      |
| 2   | `apps/api/tsconfig.json`                  | new: extends the root, Node types           |
| 3   | `apps/api/tsconfig.build.json`            | new: emits `dist/`, excludes tests          |
| 4   | `apps/api/src/migrate.ts`                 | new: runner + CLI                           |
| 5   | `apps/api/src/migrate.test.ts`            | new: AC3, AC4, checksum, lock               |
| 6   | `apps/api/src/test-database.ts`           | new: per-test database, actionable error    |
| 7   | `apps/api/migrations/0001_btree_gist.sql` | new                                         |
| 8   | `compose.yaml`                            | new: `db` service                           |
| 9   | `Makefile`                                | `db-up`, `db-migrate`, `check` adds `db-up` |
| 10  | `.github/workflows/ci.yml`                | Postgres service + `DATABASE_URL_TEST`      |
| 11  | `package-lock.json`                       | `pg` (~110 lines)                           |
| 12  | `specs/items/WI-0016-…`                   | status                                      |

That is 12 files and about 460 lines, within the budget.

## Test plan

| AC  | Test                                                                                                                                                                                                                                                                                                                             | Level         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| AC3 | `migrate.test.ts`, on a fresh database: the first run applies `0001` and records it, and the second run applies nothing and returns `[]`. Also a test with a fixture folder of two migrations, where the order is respected and a failing migration rolls back only itself.                                                      | unit + DB     |
| AC4 | `migrate.test.ts`: after migrating, `SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'` returns one row.                                                                                                                                                                                                                   | unit + DB     |
| AC6 | `test-database.test` behaviour inside `migrate.test.ts`: with `DATABASE_URL_TEST` pointing at a closed port, the helper rejects with the actionable message. **Manual probe, recorded in the PR**: `docker compose down`, then `make check` brings it back up and stays green. A run without Docker fails with the instructions. | unit + manual |
| —   | Immutability: changing an applied migration file makes the runner refuse to run, naming the file. Two concurrent `migrate()` calls apply each migration once.                                                                                                                                                                    | unit + DB     |

These are unit tests (ADR-0007: infrastructure, not product behaviour).

## Risks and edge cases

- **The pre-commit hook runs `npm run test`**, so it needs the database. With
  Docker stopped, a commit fails with the actionable message. `make check`
  and the WI-0017 Stop hook start the database on their own, but the
  pre-commit hook doesn't.
- **Port 54329 already taken:** `make db-up` fails and Docker says why.
  `DATABASE_URL_TEST` is the way around it.
- **`DROP DATABASE … WITH (FORCE)`** needs Postgres 13 or later. We are on 16.
- **Neon's `btree_gist`:** it is on the list of supported extensions. If it
  isn't available in production, the first migration fails on deploy, which
  is visible, not silent.
- **Windows:** `make` and Docker Desktop are prerequisites, which the README
  already assumes for `make`.

## Assumptions and questions

- **Question 1: split.** Do you accept splitting WI-0016 (AC3, AC4, AC6) from
  the new WI-0018 (AC1, AC2, AC5)? If yes, before coding I:
  - move AC1, AC2 and AC5 to WI-0018;
  - renumber the ACs;
  - update the WT-0003 item table.
- **Question 2: lockfiles in the diff budget.** Every dependency item will
  break the 800 lines on generated lines alone. Options:
  - **(a, recommended)** a small WT-0005 item: `check-diff-budget` leaves
    `package-lock.json` out of the count, and the PR lists the new direct
    dependencies for review. _Pros:_ the budget measures human-written
    scope, which is what it is for. _Cons:_ a large transitive dependency
    goes through without the budget noticing (GitHub's dependency review
    covers it).
  - **(b)** a `diff-budget-override` label on every PR that adds
    dependencies. _Pros:_ nothing to change, and each case is a conscious
    decision. _Cons:_ the override becomes routine and loses its meaning.
- **Question 3: migration runner.**
  - **(a, recommended)** an own runner of about 60 lines: SQL first, with an
    advisory lock and checksums. _Pros:_ no dependency, and exclusion
    constraints (ADR-0005) are written as they are. _Cons:_ our own code to
    maintain.
  - **(b)** `drizzle-kit migrate` with `--custom` files. _Pros:_ the tool
    ADR-0003 names. _Cons:_ a `_journal.json` managed by the tool, an extra
    dependency in this item, and exclusion constraints are still raw SQL.

  Drizzle as the query layer comes with the first item that has tables
  (WI-0006), whichever option is chosen.

- **Assumption:** `make check` starts Docker on its own, but the pre-commit
  hook doesn't.
