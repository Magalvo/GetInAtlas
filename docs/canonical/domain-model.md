# Domain model

The entities every GetInAtlas track shares. A track adds its own states and
policies, but it uses these names and relationships, and does not redefine
them. Changing this file needs human approval (ADR-0006).

```
Operator  1 ── N  Vehicle
Operator  1 ── N  Tour       N ── 1  Vehicle   (one of the operator's own vehicles)
Tour      1 ── N  Slot
Slot      1 ── N  Booking                      (at most one active, WT-0003)
Traveller 1 ── N  Booking
Booking   1 ── 0..1 Review
```

| Entity        | What it is                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Operator**  | Someone who offers experiences. Today, a TukTuk operator. Later, also local guides with no vehicle.                |
| **Vehicle**   | A vehicle that belongs to one operator. Optional for future operators that offer no ride.                          |
| **Tour**      | What an operator offers: a description, a duration, a price and a meeting point.                                   |
| **Slot**      | A concrete start time for a tour. A slot occupies its whole vehicle.                                               |
| **Booking**   | A traveller's commitment to a slot. With payment on site, the app is the only record of that commitment.           |
| **Review**    | A traveller's rating of an operator, tied to one completed booking.                                                |
| **Traveller** | Someone who books. Every account is a traveller (ADR-0004 roles).                                                  |
| **Admin**     | Someone on the platform staff who approves operators and resolves disputes. A role, not a separate kind of person. |

## Naming decisions

- **"Operator", not "TukTuk driver".** Guides and beacons (see
  [product.md](product.md)) reuse the same model, so the name must not assume
  a vehicle.
- **A beacon is a `Slot` that starts now**, at the operator's location. No
  separate entity is planned.
- Times are instants in UTC, displayed in the city's time zone. Money is
  integer cents ([conventions.md](conventions.md)).

## Where the rest lives

- States and policies (booking lifecycle, cancellation cutoff, strikes):
  [WT-0003](../../specs/tracks/WT-0003-lisbon-tuktuk-booking.md). They are
  promoted here when the track closes, or when a second track needs them.
- Database invariants and how they are enforced: ADR-0005.
