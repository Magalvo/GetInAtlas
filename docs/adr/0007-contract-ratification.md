# ADR-0007 — The agent proposes acceptance tests, a human ratifies them

- **Estado:** aceite
- **Data:** 2026-10-24
- **Decisor(es):** Diogo

## Contexto

`tests/acceptance/` is the contract (ADR-0001), and AGENTS.md hard rule 1
forbids the agent from ever editing it. No document says who writes the
acceptance tests for a **new** work-item. The two places that come close
contradict each other:

- README: "a human writes (or approves) the acceptance tests"
- AGENTS.md: the agent never touches the folder, and the work-item template
  says each AC "becomes a test in `tests/acceptance/`"

In practice nobody writes them. Only WI-0001 has acceptance tests. Every item
since then put its ACs in `tests/unit/`, where the agent can change an
assertion in the same commit as the code that makes it pass. The contract
protects nothing new.

The SDD reference methodology we follow says: "the test is the spec". A human
writes the criterion, or the agent drafts it and a human confirms it. Then the
agent writes the failing test. Two constraints make that hard here:

- **The pre-commit hook runs the whole suite.** A red test cannot be
  committed, so a test cannot be reviewed red before any code exists.
- **Tests import code that doesn't exist yet.** The import fails typecheck
  and stops the whole file from loading.

Alternatives considered:

1. **A human writes every acceptance test.** It is safe, but the human
   becomes the bottleneck. In practice it means nobody writes them, which is
   today's state.
2. **The agent writes the acceptance tests together with the code, and a human
   reviews the PR.** There is no ordering. The test can be fitted to the
   implementation, which is exactly what the contract is meant to prevent.
3. **Acceptance tests land disabled (`.skip`/`.todo`) and get enabled later.**
   Enabling them is an edit to the contract. Nothing stops a test from staying
   disabled forever, or from being changed while it is being enabled.
4. **Expected-failure tests (`it.fails`), ratified before code (chosen).**

## Decisão

**The agent drafts the acceptance tests when it writes the work-spec, and they
are expected to fail. A human ratifies them together with the work-spec,
before any implementation. After that, the only change the agent may make is
to remove the `.fails` markers.**

1. **Proposal (spec phase).** Alongside the draft work-spec, the agent adds a
   **new** file `tests/acceptance/WI-NNNN-<slug>.acceptance.test.ts`:
   - one `it.fails('ACn: …')` per acceptance criterion;
   - a typed stub of the public interface the tests call, in `src/`, which
     throws `not implemented: WI-NNNN`. It is part of the contract, and is
     what lets the tests typecheck and load.

   `it.fails` passes while the test fails, so `make check` stays green and
   the proposal can be committed.

2. **Ratification (human).** The human reviews the work-spec, the tests and
   the stub together. Ratifying means two things:
   - setting the work-spec to `approved`;
   - adding the `contract-change-approved` label in CI, because the PR adds
     contract files.

   The ratification is its **own PR**: the work-spec, the tests, the stub and
   the item moved to `ready`. Once it merges, the file is part of the
   contract on `main`. The implementation PR comes after it, so CI compares
   the implementation against a contract that is already ratified. If both
   lived in one PR, CI would see only the end state and could not tell
   whether a test changed between ratification and code.

3. **Implementation (TDD).** For each AC, the agent:
   - removes the `.fails` marker, which makes the test red;
   - writes the minimum code to make it green.

   If the code makes a test pass while its marker is still there, `it.fails`
   itself fails. So a marker cannot be forgotten.

4. **Done.** An item cannot be `done` while its acceptance file still has a
   `.fails` marker.

**Enforcement.** The pre-commit hook and the CI `contract` job apply the same
rules, implemented once in a Node script:

| Change under `tests/acceptance/`                                | Without override/label                             |
| --------------------------------------------------------------- | -------------------------------------------------- |
| New file (proposal)                                             | local: allowed; CI: needs the label (ratification) |
| Modification whose only difference is removing `.fails` markers | allowed                                            |
| Any other modification, rename or deletion                      | blocked, as today                                  |

**Scope of the rule.** Items whose ACs describe product behaviour get
acceptance tests. Items about tooling, CI or the spec workflow may verify
their ACs with unit tests (the WI-0004 and WS-0012 precedent). The work-spec's
test plan states which level each AC uses, and a human approves that with the
plan.

`evals/datasets/` and `evals/thresholds.json` are unchanged: a statistical
contract has no equivalent of an expected failure.

## Consequências

Better:

- Every product item gets an executable contract, written before the code and
  reviewed by a human, as the reference methodology asks.
- The agent can no longer fit the test to its implementation: after
  ratification, any change other than removing a marker is blocked.
- The human reviews the tests and the plan in one pass, as one decision.
- Removing a marker is ordinary TDD: no override or label in the
  implementation PR.

Worse:

- The spec phase gets heavier. The agent writes the tests and an interface
  stub before approval, and a rejected plan throws that work away.
- An interface stub in `src/` exists between ratification and
  implementation.
- A product item takes two PRs: ratification, then implementation.
- Checking that a diff "only removes markers" needs a careful comparison
  script. Its edge cases (formatting, `test.fails` vs `it.fails`) need their
  own tests.

Now mandatory:

- An item with product behaviour has its acceptance tests ratified before any
  implementation code.
- An item cannot be `done` while its acceptance tests still carry `.fails`.

Now allowed (and before forbidden):

- The agent **adds** new files to `tests/acceptance/` during the spec phase.
- The agent **removes** `.fails` markers from ratified tests.

Still forbidden:

- Any other change to an existing acceptance test without
  `ACCEPT_CONTRACT_CHANGE=1` and an ADR (local), or the label (CI).

AGENTS.md hard rule 1 and the README workflow change to match. That is a
canonical change and needs human approval (WI-0014).
