# ADR-0006 — Four-layer spec model, shaped one feature at a time

- **Estado:** aceite
- **Data:** 2026-10-24
- **Decisor(es):** Diogo

## Contexto

The spec corpus has three layers: canonical docs and ADRs, work-tracks, and
work-items. Planning WT-0003 exposed three problems:

- **Implementation detail leaks into work-items.** WI-0008's "Notes for the
  agent" name indexes, row locks and job runners next to the acceptance
  criteria. "What must be true" and "how we'll do it" change at different
  speeds, and only the first one is the contract.
- **Lasting knowledge gets buried in tracks.** WT-0003 held the product's domain
  model (Operator → Vehicle → Tour → Slot → Booking), which future tracks
  (guides, beacons) will reuse. Once the track is `done`, nobody looks there.
- **Work-items are too big for one agent run.** WI-0006, WI-0007, WI-0008 and
  WI-0010 had 6 to 12 acceptance criteria each.

We also tried re-shaping the whole app at once: about 50 files, 36
work-items, and canonical docs holding policies decided that same day. We
rejected it:

- most of the breakdown was guesswork made before any code existed
- understanding one feature meant opening seven files
- decisions nobody had tested became hard to change

Shaping each feature when it starts keeps the benefits without those costs.

## Decisão

**Four layers. Every topic lives in exactly one; a topic that fits two is
split.**

| Layer         | Where                           | Holds                                                                                                                          | Changes                                 |
| ------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| 1. Canonical  | `docs/canonical/`, `docs/adr/`  | What is true beyond any one feature: product, glossary, domain model, architecture, conventions, security; ADRs keep the _why_ | Rarely; human approval                  |
| 2. Work-track | `specs/tracks/WT-NNNN-*.md`     | One initiative: objective, scope in and out, **success metric**, decisions that apply only to this track (e.g. its policies)   | During the initiative                   |
| 3. Work-item  | `specs/items/WI-NNNN-*.md`      | One task for one agent run: problem, verifiable acceptance criteria, out of scope, **missing before coding**                   | Until `ready`                           |
| 4. Work-spec  | `specs/work-specs/WS-NNNN-*.md` | How to implement one work-item: design, files, data, test plan, risks                                                          | Written when the item is about to start |

**A work-spec belongs to exactly one work-item and uses the same number**
(WS-0012 implements WI-0012), so an item has at most one work-spec. Its
frontmatter is `id`, `title`, `item`, `status` (`draft | approved`) and
`owner`. When the plan changes, the work-spec is edited and goes back to
`draft` for re-approval; git keeps the history. It replaces the plan in step 2
of the AGENTS.md workflow, which used to exist only in chat: the plan now
lives in the repository, and you approve it there.

**Routine for each feature.** The whole app is never shaped in advance:

1. **Starting a feature:** create the track with objective, scope, success
   metric and its own decisions. Do a **promotion check**: read canonical
   first, and promote to canonical anything the feature needs that is true
   beyond it. Promote when a second track needs it, or when it is clearly
   lasting (vision, domain model, security). List every work-item roughly,
   and **split only the next one or two** to one-run size.
2. **Before an item starts:** split it if it is still too big. Its "missing
   before coding" list must be empty.
3. **The item goes `ready`:** the agent writes the work-spec, and a human
   approves it before any code.
4. **Closing a track:** decisions that held up are promoted to canonical. The
   track shrinks to a record of what was built.

**Tooling** (its own work-item):

- `.agent/templates/work-spec.md`
- `make new-spec ITEM=WI-NNNN`, which derives the work-spec's ID and file name
  from the item
- `make new-track` prints the checklist for starting a feature
- the work-spec schema in `specs/_schema/README.md`

**New validator rules:**

- A work-spec's `item` must exist, and its number must match the item's.
- An item in `ready` or `in-progress` needs an `approved` work-spec. Items
  already `done` are exempt, so finished work needs no backfill.
- An `active` track must have a non-empty `## Success metric` (or
  `## Métrica de sucesso`) section.

## Consequências

Better:

- Acceptance criteria hold only what must be true, so the contract is easier
  to review.
- The implementation plan is versioned and reviewable, instead of disappearing
  with the chat.
- Lasting knowledge has one home, and it grows only when real use shows the
  need.
- Items sized for one run make agent work and its review predictable.

Worse:

- One more file per item, and one more human approval before code starts.
- The promotion check needs judgement and can't be automated. It depends on
  the workflow step and the checklist.
- There is a short delay between an item becoming `ready` and its first line
  of code.

Now mandatory:

- No code for a work-item without an `approved` work-spec.
- Each topic lives in one layer; other layers link to it, never copy it.
- Splitting just in time: no item is broken down until it is next to be
  worked on.

Now forbidden:

- Implementation detail in a work-item's acceptance criteria.
- Shaping tracks other than the one starting, beyond a coarse item list.

Migration:

- WT-0001 and WT-0002 (both `active`) get a `## Success metric` section in the
  tooling PR.
- WT-0003 is the first track to follow this routine. Its policies stay in the
  track; its items are split just before each one starts.
- The existing "Notes for the agent" stay in the items until each item gets
  its work-spec.
