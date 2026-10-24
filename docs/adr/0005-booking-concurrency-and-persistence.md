# ADR-0005 — Booking concurrency: invariants enforced in the database

- **Estado:** aceite
- **Data:** 2026-10-24
- **Decisor(es):** Diogo

## Contexto

WT-0003 has invariants that must hold when requests arrive at the same time,
not only one after another:

| #   | Invariant                                                                                          | Spec          |
| --- | -------------------------------------------------------------------------------------------------- | ------------- |
| I1  | A slot has at most one `active` booking                                                            | WI-0008 AC3   |
| I2  | A vehicle's slots never overlap, buffer included                                                   | WI-0007 AC5   |
| I3  | A traveller's active bookings never overlap in time                                                | WI-0008 AC4   |
| I4  | A traveller has at most 3 active future bookings                                                   | WI-0008 AC5   |
| I5  | A blocked traveller cannot book                                                                    | WI-0010 AC2–3 |
| I6  | Each booking makes exactly one transition out of `active` (cancel, no-show and auto-complete race) | WI-0008 AC12  |

Checking an invariant in application code and then writing ("check then
insert") is exactly the race that `formal/OrderLifecycle.tla` demonstrates
with its naive variant. Two requests both pass the check and both write.
Application-level checks alone are therefore not enough (ADR-0001, defence in
depth).

Alternatives considered:

- **SERIALIZABLE isolation for everything:** correct, but every write needs
  retry logic, and contention errors become hard to explain to the user.
- **A distributed lock (for example Redis):** adds infrastructure (ADR-0003
  rules out Redis), and the lock and the data can disagree.
- **Optimistic version columns:** these protect a single row, and I1–I4 span
  several rows.

## Decisão

Every invariant gets an **enforcer in the database**. The domain package
(`packages/domain`) still checks first, so users get friendly errors; the
database is the backstop that cannot be bypassed.

- **I1:** a partial unique index,
  `UNIQUE (slot_id) WHERE status = 'active'`. Of N concurrent inserts, one
  succeeds and the others fail with `23505`, which the API maps to "slot
  unavailable".
- **I2:** an exclusion constraint,
  `EXCLUDE USING gist (vehicle_id WITH =, occupied WITH &&) WHERE (status <> 'cancelled')`,
  where `occupied` is a `tstzrange` of
  `[start, start + duration + buffer)` captured when the slot is created.
  This needs the `btree_gist` extension. When the buffer or duration changes,
  `occupied` is recalculated in the same transaction, and the constraint
  rejects the change if it would create an overlap (WI-0007 AC5c).
- **I3:** an exclusion constraint on bookings,
  `EXCLUDE USING gist (traveller_id WITH =, slot_range WITH &&) WHERE (status = 'active')`,
  with `slot_range` copied from the slot when the booking is created.
- **I4 and I5:** the booking transaction starts with
  `SELECT … FROM travellers WHERE id = $1 FOR UPDATE`. This makes one
  traveller's own booking attempts run one at a time (other travellers are
  not affected). The transaction then checks the block status and the
  active-booking count, and inserts. A count can't be expressed as a
  constraint, so the row lock serves that purpose.
- **I6:** every state transition is a conditional update,
  `UPDATE bookings SET status = $to WHERE id = $id AND status = $from`.
  When zero rows change, the request lost a race and the API returns a
  conflict. The auto-complete job uses the same rule, in batches.

**Formal model:** add `formal/BookingSlot.tla`, modelled on
`OrderLifecycle.tla`. Its processes are concurrent travellers booking and
cancelling, the operator marking no-shows, and the system auto-completing.
It checks I1, I3, I4 and I6 as invariants. Its naive variant (check then
insert, with no constraint) must fail under TLC, which demonstrates why the
constraints exist.

## Consequências

Better:

- The invariants hold even if the domain code has a bug, a new endpoint
  forgets a check, or someone writes directly to the database.
- Conflicts surface as specific errors that can be mapped to user-facing
  messages.

Worse:

- Some rules exist in two places (the domain and SQL). Acceptance tests must
  cover both:
  - a domain-level rejection
  - a constraint-level rejection, reached by skipping the domain check in a
    test-only path
- It depends on Postgres-specific features (`btree_gist`, exclusion
  constraints, partial indexes). Moving to another database means
  re-implementing them.
- The ranges are copied into the slot and booking rows, so recalculating them
  must happen in the same transaction as the change that caused it.

Now mandatory:

- Concurrency acceptance tests (WI-0008 AC3, and AC4–5 under concurrency) run
  against real Postgres with N parallel connections. In-memory fakes don't
  count.
- Every new state transition follows the conditional-update rule (I6).
- Migrations that add or change these constraints need a human review.

Settled (2026-10-24):

- **`btree_gist`:** Neon is the chosen host (ADR-0003). The first migration
  enables the extension, and WI-0016 AC4 checks that it is there. If Neon
  turns out not to offer it, this ADR has to be revised before WI-0007.
- **The TLA+ model is a gate.** WI-0008 can't become `ready` until
  `formal/BookingSlot.tla` exists, `make formal-check` passes on the correct
  variant, and TLC finds the race in the naive one. Bookings are the
  product's critical core: one resource, never two owners.
