---
id: 'WT-0005'
title: Close the gaps against the SDD reference methodology
status: active
owner: Diogo
---

# WT-0005 — Close the gaps against the SDD reference methodology

## Objective

We compared our spec workflow with the SDD methodology we follow (Oktogon
Labs training, 2025-05-09). The artefacts and guardrails match it, but three
practices are missing:

- "the test is the spec": nobody writes acceptance tests for new items;
- retrieving the right slice of context for an item;
- tracing work back to the issue that triggered it.

This track closes those gaps, so the four-layer model (ADR-0006) is backed by
an executable contract and by context an agent can find.

## Métrica de sucesso

- The first WT-0003 item with product behaviour reaches `done` with its
  acceptance tests ratified in a PR before its implementation PR. Its
  implementation PR needs neither `ACCEPT_CONTRACT_CHANGE` nor the
  `contract-change-approved` label.
- From then on, every `ready` work-item names the canonical docs and ADRs it
  depends on, and `make validate-specs` checks that they exist.

## Âmbito

In scope:

- contract ratification (ADR-0007)
- a context field on work-items
- an issue link on work-items
- a warning when two items in progress plan to touch the same files

Out of scope:

- Shipping any of this through the adopter CLI (WT-0002)
- Full-text search over the spec corpus beyond a simple `make` target
- Evals and formal methods

## Work-items

- WI-0014 — Let the agent propose acceptance tests and remove expected-failure
  markers
- WI-0017 — Stop hook that keeps the agent working while make check is red
- WI-0019 — Leave lockfiles out of the diff budget (before WI-0018)
- _(rough)_ Validator rule: no `.fails` left in a `done` item; the work-spec
  test plan states acceptance or unit level per AC
- _(rough)_ `context:` and `issue:` fields on work-items, validated
- _(rough)_ Warn when `ready`/`in-progress` work-specs plan to touch the same
  files; `depends_on` between items
