---
id: 'WT-0003'
title: Lisbon TukTuk registry and tour booking
status: active
owner: Diogo
---

# WT-0003 — Lisbon TukTuk registry and tour booking

## Objective

Bring order to Lisbon's TukTuk market. Verified operators publish tours on
fixed time slots, and travellers book them in the app, with payment on site.
This is the first slice of GetInAtlas ([product](../../docs/canonical/product.md)),
with one city and one kind of operator. It should prove two things: that
travellers will book through the app, and that operators will keep their
availability up to date.

The entities and their names are in the canonical
[domain model](../../docs/canonical/domain-model.md). This track adds the
states and policies below.

## Success metric

Confirmed by the owner on 2026-10-24. Measured over the first 8 weeks after launch in Lisbon:

- **Operators keep availability current:** at least 10 approved operators,
  and at least 70% of them publish future slots every week.
- **Travellers book through the app:** at least 150 bookings end
  `completed`.
- **The commitment holds without payment:** fewer than 15% of bookings end
  `no_show`.
- **Integrity:** zero double bookings of a slot, and zero overlapping slots
  on a vehicle (ADR-0005, I1 and I2).

## Scope

In scope:

- Operator sign-up, vehicle registration and **manual admin approval**
  (WI-0006)
- Tours with **scheduled slots**, each slot booking the **whole vehicle**
  (WI-0007)
- Booking and cancellation, with **pay on site** and a **free-cancellation
  cutoff** for travellers (WI-0008)
- Reviews of an operator after a completed booking (WI-0009)
- No-show strikes for travellers, and disputes resolved by an admin (WI-0010)
- Mobile-first PWA in front of a TypeScript API (ADR-0003)

Out of scope:

- In-app payments, deposits, refunds, commissions and payouts
- On-demand or Uber-style requests, live vehicle tracking and beacons
- Shared or per-seat tours
- Traveller social features: connections, groups and insights
- Guides outside Lisbon, and multi-city support
- Chat between traveller and operator
- Native mobile apps
- Notifications (the most important follow-up, but it gets its own track)

## Track decisions (settled 2026-10-24)

These policies apply only to this track. They are promoted to canonical if a
second track needs them.

| Topic                   | Decision                                                                                                                                                                                  | Items         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Buffer between slots    | Set per vehicle by the operator: 0 to 60 min, default 15. It counts after the slot ends.                                                                                                  | WI-0007       |
| Cancellation cutoff     | Platform constant of 24h, the same for all tours. Operators can't change it.                                                                                                              | WI-0008       |
| Booking limits          | No overlapping bookings, and at most 3 active future bookings per traveller                                                                                                               | WI-0008       |
| Completion              | Automatic at slot end + 24h, unless the operator marks `no_show` in that window                                                                                                           | WI-0008, 0009 |
| Strike threshold        | 2 strikes within a rolling 90-day window                                                                                                                                                  | WI-0010       |
| Block                   | No new bookings for 30 days from the 2nd strike. An admin can lift it early.                                                                                                              | WI-0010       |
| Dispute window          | 7 days after the booking is marked `no_show`. A disputed strike doesn't count until resolved.                                                                                             | WI-0010       |
| Who resolves            | Admin only                                                                                                                                                                                | WI-0010       |
| Anti-gaming             | An operator can't block a review by staying silent, because completion is automatic. A false no-show can be disputed.                                                                     | WI-0009, 0010 |
| Operator                | A company or a sole trader, with one or more vehicles. Drivers are not modelled in the MVP.                                                                                               | WI-0006       |
| Re-application          | No sooner than 30 days after a rejection, at most 3 times                                                                                                                                 | WI-0006       |
| Seating capacity        | Platform maximum of 6, a named constant, pending a legal check                                                                                                                            | WI-0006       |
| Required documents      | A provisional list kept in configuration, validated legally before WI-0006 is `ready`                                                                                                     | WI-0006       |
| Pricing                 | A base price plus a per-person price, in integer cents. The slot still books the whole vehicle.                                                                                           | WI-0007, 0008 |
| Minimum lead time       | A slot can't be booked less than 60 minutes before it starts (platform constant)                                                                                                          | WI-0007, 0008 |
| Restricted zones        | The meeting point and the route are checked against Lisbon's restricted zones (polygons in configuration)                                                                                 | WI-0007       |
| Operator suspended      | Their active future bookings are cancelled automatically, with the reason "operator suspended"                                                                                            | WI-0008       |
| Operator accountability | The profile shows the operator's cancellation rate over the last 90 days. 3 or more operator cancellations in 30 days, or 2 lost disputes in 90 days, open a case for an admin to review. | item 10       |
| Reviews                 | Open for 14 days after completion, with up to 1000 characters of text. The traveller can edit while the window is open (marked "edited"). Reports go to an admin.                         | WI-0009       |
| Blocked traveller       | Existing future bookings are kept; the block stops new bookings only                                                                                                                      | WI-0010       |
| Disputes                | A mandatory explanation of up to 1000 characters                                                                                                                                          | WI-0010       |

## Architecture decisions

Their open points were settled on 2026-10-24 (#6):

- [ADR-0003](../../docs/adr/0003-platform-and-stack.md): platform and stack
  (Neon, Render, Cloudflare R2). It must be accepted before WI-0015.
- [ADR-0004](../../docs/adr/0004-authentication-and-roles.md): authentication
  and roles (Better Auth, Bird SMS). It is accepted only after the spike
  (item 4) confirms the library plugins and Bird's pricing and fraud
  protection.
- [ADR-0005](../../docs/adr/0005-booking-concurrency-and-persistence.md):
  booking concurrency enforced in Postgres. The TLA+ model is a gate for
  WI-0008. It must be accepted before WI-0016.

## Work-items

Ordered by dependency. Following ADR-0006, only the next two are split to
one-run size. The rest stay coarse until just before they start. The coarse
items (WI-0006 to WI-0010) have 9 to 15 ACs each and are split again when
their turn comes.

| #   | Item                                                                                      | Size       | Depends on       |
| --- | ----------------------------------------------------------------------------------------- | ---------- | ---------------- |
| 1   | WI-0015 — Monorepo workspace skeleton (done)                                              | split      | ADR-0003         |
| 2   | WI-0016 — Postgres in the gate                                                            | split      | WI-0015          |
| 2b  | WI-0018 — API health route and configuration                                              | split      | WI-0016, WI-0019 |
| 3   | _(rough)_ PWA skeleton on the same domain as the API, plus the AGENTS.md structure update | not split  | WI-0015          |
| 4   | _(rough)_ Authentication spike, then sign-in                                              | not split  | WI-0018          |
| 5   | WI-0006 — Operator and vehicle onboarding                                                 | coarse, 10 | 3, 4, WI-0014    |
| 6   | WI-0007 — Tours and time slots                                                            | coarse, 12 | WI-0006          |
| 7   | WI-0008 — Slot booking and cancellation                                                   | coarse, 15 | WI-0007          |
| 8   | WI-0009 — Operator reviews                                                                | coarse, 9  | WI-0008          |
| 9   | WI-0010 — No-show strikes and disputes                                                    | coarse, 9  | WI-0008          |
| 10  | _(rough)_ Operator accountability: cancellation rate and admin review queue               | not split  | WI-0008, WI-0010 |

**Parallelism**, following the rule "items that don't touch the same files
can run in parallel":

- Items 1, 2 and 2b run in sequence: they touch the root configuration, CI
  and the same `apps/api` workspace. WI-0016 was split on 2026-10-26
  (WS-0016) because the whole item broke the diff budget.
- **WI-0019 (WT-0005) must be done before WI-0018.** It leaves lockfiles
  out of the diff budget, and Fastify alone adds about 687 lockfile lines.
  WI-0019 touches only the budget scripts, so it can run alongside WI-0016.
- **WI-0014 (WT-0005) must be done before WI-0006.** WI-0006 is the first
  item with product behaviour, so its acceptance tests are ratified through
  ADR-0007, which WI-0014 implements. WI-0014 can run alongside items 1 and 2
  only if the work-specs show they don't share files. Both touch `ci.yml`, so
  by default they run in sequence.
- After item 2b, items 3 and 4 can run in parallel.
- After item 7, items 8 and 9 can run in parallel. The dispute path of
  WI-0009 AC1 is only exercised once WI-0010 lands.
- Each work-spec lists its files, and that list confirms or refutes the
  parallelism before work starts.

## Still open

- Whether to remove the WT-0001 example domain (`src/order.ts`) once real
  code lands (WI-0015)
