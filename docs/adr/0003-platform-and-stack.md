# ADR-0003 — Platform and stack for GetInAtlas

- **Estado:** aceite
- **Data:** 2026-10-24
- **Decisor(es):** Diogo

## Contexto

WT-0003 (Lisbon TukTuk booking) is the first real product slice. It needs:

- a phone-first client that travellers can use on the street without an app
  store install
- an API that enforces booking invariants under concurrency (ADR-0005)
- a database that can express those invariants as constraints
- background jobs (auto-completing bookings 24h after slot end, WI-0008 AC11)
- private document storage for operator licences (WI-0006)

Forces at play:

- One developer working with agents.
- MVP budget.
- EU users, so GDPR applies.
- The boilerplate's rules: strict TypeScript, Zod at the boundaries, and
  `make check` as the single gate.
- The repo already holds boilerplate code that must keep working: the adopter
  CLI (WT-0002) and the order example (WT-0001).

Alternatives considered:

- **Native apps (Expo / React Native):** better GPS and push notifications, but
  app store friction and a second build pipeline. Postponed until the beacon
  track needs background location.
- **Next.js full-stack:** SSR and SEO for operator profiles, but it couples UI
  and API. A plain SPA with a separate API keeps the domain portable to a
  native app later.
- **Supabase as backend-as-a-service:** quick to start, but booking rules would
  be split between SQL/RLS and TypeScript, which weakens the "domain in pure
  TS, tested by `make check`" model.
- **AWS or GCP directly:** more control than an MVP needs, and more operations
  work.

## Decisão

A monorepo of npm workspaces:

- `apps/web`: mobile-first PWA built with React, Vite and a PWA plugin
- `apps/api`: Node 22 running Fastify, with Zod schemas at every route
- `packages/domain`: pure TypeScript domain logic (state machines, rules,
  Zod schemas), with no I/O, shared by the API and the web app

The database is managed PostgreSQL 16+ on **Neon**, in an EU region
(Frankfurt), accessed through Drizzle ORM with SQL migrations (constraints are
written in raw SQL). The API runs on **Render**, in an EU region (Frankfurt),
with the PWA served from the same registrable domain. Background jobs run on
a Postgres-backed queue (pg-boss), as a separate Render background worker, so
there's no Redis. Operator documents go in a private **Cloudflare R2** bucket
with EU jurisdiction, behind short-lived signed URLs.

Why these vendors (settled 2026-10-24):

- **Neon over Supabase:** Neon is only Postgres. Supabase bundles auth,
  storage and RLS, which this ADR and ADR-0004 reject. Neon also gives each
  PR its own database branch, which suits several agents working in
  parallel.
- **Render over Fly.io:** for one person, Render means less operations work:
  deploy on git push, a preview environment per PR, and a background worker
  as just another service.
- **R2 over Scaleway or S3:** R2 speaks the S3 API, can keep data under EU
  jurisdiction, and charges nothing for egress. Scaleway would be the
  sovereignty-first alternative, if a customer or regulator ever asks for it.

## Consequências

Better:

- One language and one gate (`make check`) from the domain to the UI.
- Domain rules stay pure functions in `packages/domain` and can be
  property-tested without a database.
- Postgres constraints back up the invariants (ADR-0005), and data stays in
  the EU.

Worse:

- `make check` and CI now need a real Postgres for acceptance tests (Docker
  locally, a service container in CI).
- A PWA gets weaker push notifications on iOS, and no background location.
- The monorepo tooling (workspaces, shared tsconfig and ESLint config) adds
  setup work.
- Neon scales to zero, so the first request after a quiet period pays a cold
  start. pg-boss needs a direct connection, not the pooled one.
- Cloudflare is a US company. Data stored under EU jurisdiction is still
  subject to the US CLOUD Act.

Now mandatory:

- Domain logic lives in `packages/domain` and never imports from `apps/*`.
- Every external input passes through Zod (AGENTS.md rule 4).
- Times are stored as `timestamptz` (UTC) and money as integer cents.

Now forbidden:

- Business rules that exist only in SQL triggers or in the client.

Diff budget: setting up the monorepo will exceed 15 files / 800 lines. Split
it across several small work-items (workspace skeleton → domain package → API
skeleton → web skeleton) rather than asking for a budget exception.

The existing `src/` (adopter CLI and order example) **stays where it is**.
The monorepo skeleton (WI-0015) moves nothing. Moving or removing it is a
later cleanup item. That item would touch `tests/acceptance/`, which makes it
a contract change.
