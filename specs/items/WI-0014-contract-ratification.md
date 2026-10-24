---
id: 'WI-0014'
title: Let the agent propose acceptance tests and remove expected-failure markers
status: draft
track: 'WT-0005'
owner: Diogo
acceptance:
  - AC1: a staged new file under `tests/acceptance/` is accepted by the pre-commit hook without `ACCEPT_CONTRACT_CHANGE`
  - AC2: a staged modification of an acceptance test whose only difference from `HEAD` is removing `.fails` from `it.fails`/`test.fails` calls is accepted without `ACCEPT_CONTRACT_CHANGE`
  - AC3: without `ACCEPT_CONTRACT_CHANGE`, the hook still blocks every other staged change to the contract. This covers any other modification to an acceptance test (such as adding `.fails`, `.skip` or `.todo`, or changing an assertion), a rename, a deletion, and any change under `evals/datasets/` or to `evals/thresholds.json`
  - AC4: the CI `contract` job classifies changes against the PR base the same way. Marker-only modifications pass without a label; new acceptance files and every change from AC3 still need `contract-change-approved`
  - AC5: AGENTS.md hard rule 1 and the README workflow describe the propose → ratify → remove-markers flow from ADR-0007
---

# WI-0014 — Let the agent propose acceptance tests and remove expected-failure markers

## Problem

No document says who writes the acceptance tests for a new work-item.
AGENTS.md forbids the agent from touching `tests/acceptance/`, and the hook
blocks any change to it. So every item since WI-0001 verified its ACs with
unit tests, which the agent can change in the same commit as the code. The
contract protects nothing that came after WI-0001 (ADR-0007).

## Proposal

Teach the contract check the three kinds of change ADR-0007 defines:

- a new acceptance file is a proposal;
- removing `.fails` markers is implementation;
- anything else is a contract change.

The pre-commit hook and the CI `contract` job share one implementation, so
local and CI give the same answer. A new file needs no override locally,
because the human ratifies it in CI with the label. Then update AGENTS.md and
the README so the written rule matches what the tools enforce.

## Out of scope

- The validator rule that a `done` item has no `.fails` left (WI-0015)
- The work-spec template's test plan, and the per-AC choice between
  acceptance and unit tests (WI-0015)
- Writing acceptance tests for existing items (WI-0002 to WI-0013), or for
  WT-0003
- The header comment of `tests/acceptance/order.acceptance.test.ts`: editing
  it is itself a contract change
- Any change to how `evals/` is protected

## Missing before coding

- A human approves the change to AGENTS.md hard rule 1. It is the project's
  constitution.
- A human approves the change to `.github/workflows/ci.yml`. It is a gate the
  agent does not control (as in WI-0013).
