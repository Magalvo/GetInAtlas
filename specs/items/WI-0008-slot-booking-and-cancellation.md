---
id: 'WI-0008'
title: Slot booking and cancellation
status: draft
track: 'WT-0003'
owner: Diogo
acceptance:
  - AC1: a signed-in traveller with a verified phone (ADR-0004) can book an available slot by giving a party size; a traveller without a verified phone is rejected with "verify your phone"
  - AC2: party size must be an integer between 1 and the vehicle's seating capacity
  - AC3: a slot has at most one active booking — of N concurrent attempts to book the same slot, exactly one succeeds and the rest receive "slot unavailable"
  - AC4: a traveller cannot hold two active bookings whose slot intervals (start to start + duration) overlap
  - AC5: a traveller cannot hold more than 3 active future bookings; a 4th attempt is rejected with "booking limit reached"
  - AC6: a traveller can cancel free of charge until 24h before slot start (platform constant, inclusive at exactly 24h)
  - AC7: a traveller cannot cancel less than 24h before slot start (the booking stays active)
  - AC8: an operator can cancel a booking at any time before slot start, with a mandatory reason shown to the traveller
  - AC9: after any cancellation the slot becomes bookable again if it is still in the future
  - AC10: an operator can mark a booking `no_show` only between slot end and slot end + 24h
  - AC11: a booking still `active` 24h after slot end becomes `completed` automatically
  - AC12: the booking state machine rejects every transition not listed in the spec (e.g. cancelled → active, completed → cancelled, no_show → completed except via WI-0010 dispute)
  - AC13: a slot that starts in less than 60 minutes (platform constant) cannot be booked
  - AC14: 'the booking shows its total in integer cents, base price + per-person price × party size, marked "pay on site"'
  - AC15: suspending an operator (WI-0006 AC7) cancels their active future bookings as `cancelled_by_operator`, with the reason "operator suspended" shown to the traveller
---

# WI-0008 — Slot booking and cancellation

## Problem

A traveller who sees a slot needs to be able to reserve it with confidence,
and the operator needs to know the booking is real. With payment on site, the
app is the only record of the commitment between them.

## Proposal

The booking state machine is:

```
active ──(traveller, ≥24h before start)───────▶ cancelled_by_traveller
active ──(operator, before start)─────────────▶ cancelled_by_operator
active ──(operator, end ≤ t < end+24h)────────▶ no_show
active ──(system, at end+24h)─────────────────▶ completed
no_show ─(admin upholds traveller dispute)────▶ completed     (WI-0010)
```

**Invariants:**

- At most one active booking per slot. This must hold under concurrent
  requests.
- A traveller's active bookings never overlap in time and are never more than 3.

**Silence means the tour happened.** If the operator doesn't mark a no-show
within 24h of slot end, the booking becomes `completed` automatically. This
stops operators blocking reviews by leaving bookings open (WI-0009).

Nothing is charged: the booking shows the price and "pay on site".

## Policies

The policies this item relies on are settled in the
[WT-0003 track decisions](../tracks/WT-0003-lisbon-tuktuk-booking.md#track-decisions-settled-2026-10-24).

## Out of scope

- Any payment, deposit, refund or penalty
- Waitlists for booked slots
- Rescheduling (in v1 the traveller cancels and books again)
- Email, SMS and push notifications. These have their own WI, but for v1 they
  are the most important follow-up.
- Booking on behalf of someone else, and group bookings across several
  vehicles
- Operators changing the cutoff
- Consequences for operators who cancel often: the WT-0003 item on operator
  accountability

## Missing before coding

- **Formal gate (ADR-0005):** `formal/BookingSlot.tla` must exist, and
  `make formal-check` must pass on the correct variant. TLC must also find
  the race in the naive variant.

## Notes for the agent

- **Read ADR-0005 before anything else.** It maps each invariant to a database
  enforcer:
  - AC3: partial unique index
  - AC4: exclusion constraint
  - AC5 and the WI-0010 block: lock on the traveller row
  - AC10–12: conditional update on the expected from-state

  Concurrency tests run against real Postgres with N parallel connections.

- AC11 runs as a pg-boss job (ADR-0003). Test the transition as a pure
  function of `now`, and test the job's conditional update separately.
- The 24h values in AC6, AC10 and AC11 are platform constants: one named
  constant each, no magic numbers.
- Read `formal/README.md` and `docs/adr/0002-evals-e-metodos-formais.md`. This
  item matches the "reservations / a resource never has two owners" profile.
