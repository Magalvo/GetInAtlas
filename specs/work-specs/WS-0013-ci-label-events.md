---
id: 'WS-0013'
title: Re-run CI when a human-approval label changes
item: 'WI-0013'
status: approved
owner: Diogo
---

# WS-0013 — Re-run CI when a human-approval label changes

## Approach

1. Write a failing unit test first. It parses `.github/workflows/ci.yml` with
   `yaml`, validates the `on.pull_request.types` shape with Zod (`yaml`
   returns untyped data, and the lint rules forbid `any`), and expects it to
   contain `opened`, `synchronize`, `reopened`, `labeled` and `unlabeled`
   (AC1).
2. Change the `on:` block in `ci.yml`:

   ```yaml
   on:
     pull_request:
       types: [opened, synchronize, reopened, labeled, unlabeled]
     push:
       branches: [main]
   ```

   Listing the three defaults is required: once `types` is declared, GitHub
   runs only for the listed types.

3. Add one comment line explaining why `labeled` and `unlabeled` are there.

## Files to change

| File                                                         | Change                                        |
| ------------------------------------------------------------ | --------------------------------------------- |
| `.github/workflows/ci.yml`                                   | `types:` under `pull_request`, plus a comment |
| `tests/unit/ci-workflow.test.ts`                             | new: AC1                                      |
| `specs/items/WI-0013-…`, this file, `specs/tracks/WT-0002-…` | item, work-spec, item list                    |

4 files, about 90 lines.

## Test plan

| AC      | How                                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1     | `tests/unit/ci-workflow.test.ts`: red before the change, green after                                                                                |
| AC2–AC4 | Manual on GitHub after merge: add and remove each label on an open PR and check that a new run starts with the expected result. Recorded in the PR. |

## Risks and edge cases

- **Extra CI runs:** each label change, including unrelated labels such as
  `documentation`, runs the whole workflow. Acceptable at this repo's volume.
- **Job-level `if` conditions:** the `contract` and `diff-budget` jobs check
  `github.event_name == 'pull_request'`, which is still true for `labeled`
  and `unlabeled` events, so they keep running.
- **Re-running an old run still replays the old event.** That is expected
  GitHub behaviour; the fix is that a label change now creates a new event.

## Assumptions and questions

- **Assumption:** running everything on every label change is preferred over
  per-job conditions, so that required status checks are never skipped.
