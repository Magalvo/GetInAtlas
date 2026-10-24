---
id: 'WI-0010'
title: No-show strikes and disputes
status: draft
track: 'WT-0003'
owner: Diogo
acceptance:
  - AC1: each booking marked `no_show` (WI-0008) gives the traveller one strike, dated at slot start
  - AC2: a traveller with 2 counting strikes whose dates fall within the last 90 days is blocked from new bookings for 30 days from the second strike
  - AC3: a blocked traveller's booking attempt is rejected with the date the block ends
  - AC4: a traveller can dispute a no-show within 7 days of being marked; later disputes are rejected
  - AC5: a strike under dispute does not count towards AC2 until resolved
  - AC6: only an admin resolves a dispute; upholding it removes the strike and moves the booking from `no_show` to `completed` (making it reviewable, WI-0009)
  - AC7: rejecting a dispute keeps the strike, which counts from its original date
  - AC8: an admin can lift an active block early, with a mandatory reason
---

# WI-0010 — No-show strikes and disputes

## Problem

When payment happens on site, a fake or forgotten booking costs the traveller
nothing and costs the operator a lost slot. The only lever the platform has is
access to future bookings. That lever is in the operator's hands, and an
operator could misuse it to punish a traveller (for example one who would have
left a bad review), so the traveller needs a way to dispute it.

## Proposal

Strikes are derived from no-show bookings and are not a separate counter, so
they can never drift from the booking history. A rolling 90-day window counts
strikes that are not disputed, or whose dispute was rejected. Two such strikes
block new bookings for 30 days. A disputed strike is on hold until an admin
resolves the dispute. If the traveller wins, the strike is removed and the
booking becomes `completed`.

## Policies

The policies this item relies on are settled in the
[WT-0003 track decisions](../tracks/WT-0003-lisbon-tuktuk-booking.md#track-decisions-settled-2026-10-24).

## Out of scope

- Operators disputing or appealing anything
- Automated evidence (GPS check-in at the meeting point, photos)
- Penalties for operators who mark false no-shows (see Open questions)
- Notifications about strikes and blocks (they belong to the notifications WI)

## Missing before coding

- **Existing bookings when blocked:** are the traveller's existing future
  bookings kept, or cancelled? The assumed default is that they are kept.
- **Operators who abuse no-shows:** if an operator loses many disputes,
  should an admin review them automatically? This links to WI-0006
  suspension.
- Does the dispute need a free-text explanation, and how long can it be?

## Notes for the agent

- Strike counting is a pure function of `(bookings, disputes, now)`. Cover the
  window edges with fast-check properties: exactly 90 days, a strike disputed
  and then rejected, and a block that ends while another strike ages out.
- 2, 90, 30 and 7 are platform constants: name each one, no magic numbers.
