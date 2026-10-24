---
id: 'WI-0012'
title: Work-spec tooling and validator rules
status: done
track: 'WT-0004'
owner: Diogo
acceptance:
  - AC1: a work-spec in `specs/work-specs/` with a valid frontmatter passes validation; a missing or invalid field fails with the field name
  - AC2: a work-spec whose `item` does not exist fails validation
  - AC3: a work-spec whose number differs from its item's number fails validation
  - AC4: an item in `ready` or `in-progress` without an `approved` work-spec fails validation; `draft` and `done` items do not need one
  - AC5: an `active` track without a non-empty `## Success metric` or `## Métrica de sucesso` section fails validation; other statuses are exempt
  - AC6: running `make new-spec ITEM=WI-NNNN` creates `specs/work-specs/WS-NNNN-<item slug>.md` from the template with `id`, `title` and `item` filled in and `status` set to `draft`
  - AC7: the `make new-spec` scaffold fails without writing anything when the item does not exist or the work-spec file already exists
  - AC8: after creating a track, `make new-track` prints the starting checklist from ADR-0006
  - AC9: the repository corpus passes `make validate-specs`, with WT-0001 and WT-0002 migrated
---

# WI-0012 — Work-spec tooling and validator rules

## Problem

ADR-0006 adds a fourth spec layer (work-specs) and a routine for starting each
feature. Without tooling, nothing creates work-specs consistently, and nothing
notices when an item starts without an approved plan or an active track has
no success metric. The rule would last only as long as people remember it.

## Proposal

- Add a work-spec template and a Node scaffold script, called by
  `make new-spec`, that derives the work-spec from the item.
- Extend `scripts/validate-specs.mjs` with the work-spec schema and the
  ADR-0006 rules, and make it testable against fixture folders.
- Have `make new-track` print the starting checklist.
- Update the schema README and the AGENTS.md workflow.
- Add the success-metric sections to WT-0001 and WT-0002 so the corpus stays
  valid.

## Out of scope

- The adopter CLI's embedded copies of templates and AGENTS.md (WT-0002)
- Backfilling work-specs for items that are already `done`
- Checking the content of a work-spec beyond its frontmatter
- Changing how `make new-item` or `make new-adr` work

## Missing before coding

Nothing. This item is the bootstrap for the work-spec layer, so its own
work-spec (WS-0012) is written by hand and approved in chat.

## Notes for the agent

- Read ADR-0006 and `specs/_schema/README.md`.
- Spec tooling runs in the pre-commit hook. WI-0011 must be on the branch, or
  committing will corrupt `.git/config`.
