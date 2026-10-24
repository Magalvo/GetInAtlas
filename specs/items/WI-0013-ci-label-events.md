---
id: 'WI-0013'
title: Re-run CI when a human-approval label changes
status: in-progress
track: 'WT-0002'
owner: Diogo
acceptance:
  - AC1: the CI workflow runs on pull_request events of types opened, synchronize, reopened, labeled and unlabeled
  - AC2: adding `diff-budget-override` to an open PR starts a new run whose diff-budget job sees the label
  - AC3: adding `contract-change-approved` to an open PR starts a new run whose contract job sees the label
  - AC4: removing either label starts a new run in which the matching job no longer sees it
---

# WI-0013 — Re-run CI when a human-approval label changes

## Problem

The `diff-budget` and `contract` jobs read two labels that record a human
decision: `diff-budget-override` and `contract-change-approved`. The workflow
only reacts to the default `pull_request` events (`opened`, `synchronize`,
`reopened`). Adding a label therefore starts no run, and "Re-run" replays the
original event, in which the label didn't exist yet. The only workaround is to
close and reopen the PR, or push a new commit.

Seen on 2026-10-24 on PR #2 (WI-0012): the override label didn't help until
the PR was closed and reopened.

## Proposal

Declare the `pull_request` event types explicitly, adding `labeled` and
`unlabeled` to the defaults. Every job re-runs when any label changes. That
costs one extra run per label change, and keeps the required status checks
simple: no job is ever skipped.

## Out of scope

- Creating the labels in the repository (done by hand on GitHub)
- Running only the jobs that read a label (for example with job-level `if`
  conditions)
- Branch protection settings and CODEOWNERS for `.github/`

## Missing before coding

Nothing.

## Notes for the agent

- `.github/workflows/ci.yml` is a gate the agent doesn't control. Keep the
  change to the `on:` block, and leave the jobs as they are.
- AC2–AC4 can only be checked on GitHub, after merge, by a human adding and
  removing a label. AC1 is covered by a unit test that reads the workflow
  file, the same pattern `hooks-portability.test.ts` uses for `lefthook.yml`.
