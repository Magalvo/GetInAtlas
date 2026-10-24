---
id: 'WI-0015'
title: Monorepo workspace skeleton
status: in-progress
track: 'WT-0003'
owner: Diogo
acceptance:
  - AC1: the repository declares npm workspaces for `apps/*` and `packages/*`, and `packages/domain` is a workspace that builds and exports at least one typed symbol
  - AC2: '`make check` typechecks, lints and tests every workspace, and fails when any workspace has a type, lint or test error'
  - AC3: code in `packages/domain` that imports from `apps/*` or from a Node I/O module (`fs`, `net`, `http`, `child_process`) fails `make check`
  - AC4: the existing tests (unit, acceptance and properties) pass without modification
  - AC5: on a clean clone, `npm ci` followed by `make check` passes, locally and in CI
---

# WI-0015 — Monorepo workspace skeleton

## Problem

ADR-0003 puts the app in a monorepo: `apps/web`, `apps/api`, and a pure
`packages/domain` shared by both. The repository is a single package today.
No WT-0003 code has a place to live until the workspaces exist, and
`make check` must keep being the only gate once there are several packages.

## Proposal

Turn the root into an npm-workspaces monorepo with one empty workspace,
`packages/domain`. Extend `make check` so it covers every workspace with the
same strictness as today. Make the "domain has no I/O and never imports apps"
rule from ADR-0003 a check that fails, not a convention. The boilerplate code
in `src/` stays where it is: this item adds structure and moves nothing.

## Out of scope

- `apps/api` and Postgres (WI-0016)
- `apps/web`
- Moving `src/` (the adopter CLI and the order example) into `packages/`
- Publishing packages, or versioning them independently
- Any domain logic in `packages/domain` beyond a placeholder

## Missing before coding

Nothing. ADR-0003 is accepted and WS-0015 is approved.

This item touches the root configuration and CI, so nothing else that
touches them runs in parallel with it.
