---
id: 'WI-0019'
title: Leave lockfiles out of the diff budget
status: done
track: 'WT-0005'
owner: Diogo
acceptance:
  - AC1: changes to `package-lock.json` are not counted in the diff budget's files or lines
  - AC2: the budget report lists the lockfile lines it left out, so they stay visible
  - AC3: a PR that adds direct dependencies lists them (name and version) in the CI diff-budget job's output
  - AC4: every other file still counts as before, and the 15-file / 800-line limits are unchanged
---

# WI-0019 — Leave lockfiles out of the diff budget

## Problem

The diff budget (15 files / 800 lines) exists to catch scope creep in
human- and agent-written changes. `package-lock.json` is generated: Fastify
alone adds about 687 lines (measured on 2026-10-26, WS-0016). Every item that
adds a dependency (Drizzle, Better Auth, pg-boss, React, Vite) would break
the budget on generated lines, and the `diff-budget-override` label would
become routine and lose its meaning.

## Proposal

`check-diff-budget` (CI) and `report-diff-budget` (pre-push) stop counting
the lockfile, but report how many lines they left out. A dependency's real
cost is in the direct dependencies a PR adds, so the job lists those
instead, where a human can review them. Chosen by the owner on 2026-10-26
(WS-0016, question 2, option a).

## Out of scope

- Changing the 15-file / 800-line limits
- Automatic dependency review (licences, vulnerabilities). GitHub's
  dependency review is a separate decision.
- Lockfiles of other package managers

## Missing before coding

Nothing. The owner approved this change to a CI gate on 2026-10-26, and
WS-0019 on 2026-10-27.
