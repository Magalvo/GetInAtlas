---
id: 'WS-0012'
title: Work-spec tooling and validator rules
item: 'WI-0012'
status: approved
owner: Diogo
---

# WS-0012 — Work-spec tooling and validator rules

## Approach

1. **Make the validator testable.** `scripts/validate-specs.mjs` reads the
   corpus root from `SPECS_ROOT` and falls back to the repository root. Tests
   point it at temporary fixture folders. Nothing else about how it is called
   changes.
2. **Work-spec schema** (Zod, like the existing ones): `id` matches
   `WS-NNNN`, `title` is at least 3 characters, `item` matches `WI-NNNN`,
   `status` is `draft | approved`, and `owner` is not empty. Files are loaded
   with the existing `loadSpecs`. The `specs/work-specs/` folder is optional,
   so a missing folder counts as zero work-specs.
3. **Rules** (AC1–5), added after the existing checks:
   - Work-spec IDs go into the existing unique-ID check.
   - `item` must be a known item ID (AC2).
   - The number after `WS-` must equal the number after `WI-` (AC3).
   - Items in `ready` or `in-progress` need a work-spec with
     `status: approved` (AC4).
   - `active` tracks need a `## Success metric` or `## Métrica de sucesso`
     heading followed by non-blank text before the next `## ` heading or the
     end of file (AC5). This means `loadSpecs` must also keep the Markdown
     body, which it currently discards.
4. **Scaffold:** `scripts/new-spec.mjs <WI-NNNN>`:
   - finds `specs/items/<WI-NNNN>-*.md` and reads its `title` from the
     frontmatter
   - derives `WS-NNNN` and the slug from the item's file name
   - refuses to run if the item is missing or the target file exists (AC7)
   - fills `{{ID}}`, `{{TITLE}}` and `{{ITEM}}` in
     `.agent/templates/work-spec.md` and writes the file (AC6)

   It uses Node rather than `sed` in the Makefile, so it runs the same on
   every operating system (the WI-0004 direction) and can be tested directly.
   The Makefile target is `new-spec`, which checks `ITEM` and runs
   `node scripts/new-spec.mjs $(ITEM)`.

5. **Starting checklist:** after `new-track` scaffolds the file, it echoes
   four lines (AC8):
   - fill in objective, scope and success metric
   - promotion check against `docs/canonical/`
   - list items roughly and split only the next one or two
   - `make new-spec` before any code
6. **Docs and migration:**
   - the schema README gains a work-spec section and the rules
   - the track template gains `## Métrica de sucesso` (it stays in
     Portuguese, like the rest of the template)
   - the AGENTS.md and ADR-0006 drafts are already written
   - WT-0001 and WT-0002 get a success-metric section (AC9)

## Files to change

| File                                                                                         | Change                                                     |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `scripts/validate-specs.mjs`                                                                 | `SPECS_ROOT`, work-spec schema, 4 new rules, keep the body |
| `scripts/new-spec.mjs`                                                                       | new                                                        |
| `Makefile`                                                                                   | `new-spec` target, checklist echo in `new-track`           |
| `.agent/templates/work-spec.md`                                                              | new                                                        |
| `.agent/templates/track.md`                                                                  | + `## Métrica de sucesso`                                  |
| `specs/_schema/README.md`                                                                    | work-spec schema and rules 7–10                            |
| `specs/tracks/WT-0001-…`, `WT-0002-…`                                                        | + success metric                                           |
| `tests/unit/spec-tooling.test.ts`                                                            | new: validator and scaffold tests                          |
| `AGENTS.md`, `docs/adr/0006-…`, `specs/tracks/WT-0004-…`, `specs/items/WI-0012-…`, this file | already drafted                                            |

That makes 15 files, which is exactly the diff budget. The lines will be
close to 800 because ADR-0006 and AGENTS.md alone are about 210.

## Test plan

All tests go in one file, `tests/unit/spec-tooling.test.ts`. Each test builds
a minimal corpus in a temporary folder (one track, one item, optionally one
work-spec) and runs the script with `spawnSync(process.execPath, …)` and
`SPECS_ROOT`, the same pattern `hooks-portability.test.ts` uses.

| AC  | Cases                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | valid work-spec → exit 0; `status: done` → exit 1, message names `status`                                                                                       |
| AC2 | `item: WI-0099` with no such item → exit 1, "referência quebrada"                                                                                               |
| AC3 | `WS-0002` pointing at `WI-0001` → exit 1                                                                                                                        |
| AC4 | `ready` item without a work-spec → 1; with a `draft` work-spec → 1; with an `approved` one → 0; `draft` and `done` items without one → 0                        |
| AC5 | `active` track without the section → 1; with an empty section → 1; with the English or the Portuguese heading → 0; `draft` track without it → 0                 |
| AC6 | scaffold writes the expected file, with `id`, `title`, `item` and `status: draft`                                                                               |
| AC7 | missing item → non-zero exit, no file; existing file → non-zero exit, file unchanged                                                                            |
| AC8 | a check that the `new-track` recipe in the Makefile contains the four checklist lines (running `make` inside the tests would add a dependency on `make` itself) |
| AC9 | `make validate-specs` in `make check`                                                                                                                           |

These are unit tests in `tests/unit/`, not `tests/acceptance/`. The spec
tooling isn't product behaviour, and WI-0004 set this precedent.

## Risks and edge cases

- **Two work-specs with the same number but different slugs:** the duplicate-ID
  check catches them.
- **Windows line endings in the body:** the heading regex accepts `\r?\n`.
- **The track template's headings are in Portuguese, the new tracks' in
  English:** that's why both headings are accepted. If the repo settles on one
  language, drop the other.
- **The adopter CLI keeps installing the old workflow** into adopted projects
  until WT-0002 is updated. That gap is known and out of scope.

## Assumptions and questions

- **Assumption:** existing `done` items stay exempt forever, with no
  backfill.
- **Question:** the PR has to start from `main`, and this session's branch
  already holds two unrelated commits (the WT-0003 specs and ADRs, and the
  WI-0011 hook fix). See the branching proposal in the chat.
