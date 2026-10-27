---
id: 'WS-0019'
title: 'Leave lockfiles out of the diff budget'
item: 'WI-0019'
status: approved
owner: 'Diogo'
---

# WS-0019 — Leave lockfiles out of the diff budget

<!-- The implementation plan for WI-0019 (layer 4, ADR-0006). A human must approve it
(status: approved) before any code. If the plan changes, edit it and set it back to draft. -->

## Approach

The budget has **one implementation**. `report-diff-budget.mjs` (pre-push)
only calls `check-diff-budget.mjs`, and CI calls the same script. So the
change lives in `check-diff-budget.mjs` alone, and neither `ci.yml` nor
`lefthook.yml` changes.

1. **Count per file, not in total.** `git diff --shortstat` (one total line)
   gives way to `git diff --numstat <base>...HEAD`, which reports added and
   removed lines per file. Binary files report `-`, and count as a file with
   0 lines, as today.
2. **Leave the lockfile out (AC1, AC4).**
   - The excluded set has one entry: a file whose name (basename) is
     `package-lock.json`. Using the basename also covers a renamed path or a
     workspace lockfile.
   - Everything else counts as before.
   - The limits (15 files / 800 lines) and the `DIFF_BUDGET_FILES`,
     `DIFF_BUDGET_LINES` and `DIFF_BUDGET_OVERRIDE` environment variables
     don't change.
3. **Keep it visible (AC2).** The report gains a line:
   `Fora do orçamento (gerado): package-lock.json (+687/-2)`.
4. **List new direct dependencies (AC3).**
   - For each `package.json` the diff touches (root and workspaces), the
     script reads both versions with `git show <base>:<path>` and
     `git show HEAD:<path>`. A file missing at the base counts as empty.
   - It validates them with Zod (AGENTS.md rule 4), because the content is
     data from outside the script.
   - It lists the names in `dependencies`, `devDependencies`,
     `optionalDependencies` or `peerDependencies` that are new at `HEAD`,
     for example `Dependências diretas novas — apps/api/package.json: fastify@^5.6.0`.
   - Removed dependencies and version changes are left out (the AC only asks
     for new ones).
   - The list is informational: it never fails the job. Its purpose is to
     show a human what the budget no longer counts.
5. **Testable.** The script keeps its interface (`[base-ref]` argument and
   environment variables). The tests run it in temporary git repositories,
   the same pattern as `hooks-portability.test.ts`.
6. **Docs.** AGENTS.md rule 8 and the README line on the budget say that
   `package-lock.json` doesn't count, and why.

## Files to change

| #   | File                             | Change                                                |
| --- | -------------------------------- | ----------------------------------------------------- |
| 1   | `scripts/check-diff-budget.mjs`  | `--numstat`, lockfile exclusion, report, dependencies |
| 2   | `tests/unit/diff-budget.test.ts` | new: AC1–AC4 in temporary repositories                |
| 3   | `AGENTS.md`                      | rule 8: the lockfile doesn't count                    |
| 4   | `README.md`                      | the budget line                                       |
| 5   | `specs/items/WI-0019-…`          | status                                                |

That is 5 files and about 250 lines.

## Test plan

Each test creates a temporary repository: a `main` with a base commit, then
a branch with the change. It runs the script with `main` as the base.

| AC  | Cases                                                                                                                                                                                                                                                                                                                                       | Level |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| AC1 | a `package-lock.json` of 1,000 lines plus a 10-line file → exit 0, "1 file, 10 lines". 15 normal files plus the lockfile → exit 0 (16 changed, 15 counted). A `package-lock.json` inside `apps/api/` is excluded too.                                                                                                                       | unit  |
| AC2 | the output of the AC1 case contains `Fora do orçamento (gerado): package-lock.json (+1000/-0)`.                                                                                                                                                                                                                                             | unit  |
| AC3 | `apps/api/package.json` gains `fastify` in `dependencies` and `vitest` in `devDependencies` → both are listed with their version. A `package.json` new at `HEAD` (a new workspace) lists all its dependencies. An existing dependency whose version changes is not listed. A malformed `package.json` fails with a message naming the file. | unit  |
| AC4 | a normal 900-line file → exit 1, "EXCEDIDO". 16 normal files → exit 1. `DIFF_BUDGET_OVERRIDE=1` still exits 0. A binary file counts as a file.                                                                                                                                                                                              | unit  |

These are unit tests: the item is tooling (ADR-0007).

## Risks and edge cases

- **A hand-edited lockfile** (rare, and a smell) would also go through
  uncounted. The AC3 dependency list and the human review of the PR are the
  barrier. GitHub's dependency review would be a separate decision (out of
  scope).
- **Renames:** `--numstat` shows `dir/{a => b}.ts`. The basename check only
  applies to the lockfile, and a renamed normal file still counts as one
  file.
- **A shallow clone in CI:** the `diff-budget` job already uses
  `fetch-depth: 0`, which `git show <base>:<path>` also needs.
- **Malformed JSON at the base:** with Zod, the error names the file and the
  ref instead of a stack trace.

## Assumptions and questions

**Approved by the owner on 2026-10-27**, including:

- the change to how the CI gate counts (AC1), with the new wording of
  AGENTS.md rule 8, which is the constitution;
- the AC3 dependency list going **in the CI job output**. A PR comment was
  rejected for now, because it needs `pull-requests: write` permissions in
  CI.

- **Assumption:** only `package-lock.json` is excluded. Other generated
  files (for example a future `pnpm-lock.yaml` or generated code) each need
  their own decision.
