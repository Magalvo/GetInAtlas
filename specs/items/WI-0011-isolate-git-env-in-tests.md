---
id: 'WI-0011'
title: Isolate tests from the git hook environment
status: done
track: 'WT-0002'
owner: Diogo
acceptance:
  - AC1: before any test runs, the test process has none of the repository-local git variables listed by `git rev-parse --local-env-vars`
  - AC2: a `git init` in a temporary directory during the test run creates that directory's own repository, even when the runner was started with `GIT_DIR` and `GIT_INDEX_FILE` pointing at another repository
  - AC3: running the whole suite with `GIT_DIR`/`GIT_INDEX_FILE` pointing at another repository leaves that repository's config unchanged
  - AC4: a normal commit runs the full pre-commit hook without `--no-verify` and without modifying `.git/config`
---

# WI-0011 — Isolate tests from the git hook environment

## Problem

The pre-commit hook runs `npx vitest run`. Git exports repository-local
variables to hooks (`GIT_DIR`, `GIT_INDEX_FILE` and others), and every `git`
process the tests start inherits them. These include the adopter test helpers,
`discoverProject`, and the scripts spawned by `hooks-portability.test.ts`.
Commands such as `git -C <tmp> init` or `git -C <tmp> config user.email …`
then act on the **real** repository instead of the temporary one.

Seen on 2026-10-24: a commit attempt set `core.bare=true` and a test identity
(`tests@example.invalid`) in the shared `.git/config`, and 17 tests failed. The
only way to commit was `--no-verify`, which WI-0004 AC5 was meant to make
unnecessary.

## Proposal

Add a Vitest setup file that removes every repository-local git variable from
`process.env` before the tests load, using the list from
`git rev-parse --local-env-vars` rather than a hand-written list. Every child
process (test helpers, production code under test, spawned scripts) then
inherits a clean environment. Doing it once in the runner, rather than in each
helper, also covers code in `src/` that shells out to git.

## Out of scope

- Changing `lefthook.yml` or the order of hook commands
- Changing how production code (`src/adopter/*`) calls git: when a user runs
  the CLI from a hook, inheriting the hook's repository is correct behaviour
- Making the tests stop setting a local `user.email`/`user.name` in their
  temporary repositories (harmless once isolated)

## Notes for the agent

- Do the AC3 check against a throwaway repository, never the real one.
- Back up `.git/config` before the AC4 check, which uses a real commit.
