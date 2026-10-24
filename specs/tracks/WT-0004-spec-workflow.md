---
id: 'WT-0004'
title: Four-layer spec workflow
status: active
owner: Diogo
---

# WT-0004 — Four-layer spec workflow

## Objective

Make the four-layer spec model in ADR-0006 enforceable rather than a matter of
discipline. Every work-item gets a reviewable implementation plan (a
work-spec) before code, and every active initiative states how its success
will be measured.

## Success metric

- From the moment this track is `done`, every work-item that reaches `ready`
  has an `approved` work-spec in the repository. `make validate-specs` makes
  any other outcome fail.
- The next feature track (the first one after this) goes through the starting
  checklist without manual steps outside `make new-track`, `make new-item` and
  `make new-spec`.

## Scope

In scope: the work-spec template, schema and scaffold; the validator rules
from ADR-0006; the starting checklist; the AGENTS.md workflow; and the
success-metric migration for the tracks that are already active.

Out of scope:

- Shipping the work-spec layer through the adopter CLI. `src/adopter/core-assets.ts`
  embeds its own copies of the templates and AGENTS.md; that belongs to WT-0002.
- Creating the starter canonical docs (product, glossary, domain model,
  security). They come with the first feature that needs them.

## Work-items

- WI-0012 — Work-spec tooling and validator rules
