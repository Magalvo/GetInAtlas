---
id: 'WI-0007'
title: Tours and time slots
status: draft
track: 'WT-0003'
owner: Diogo
acceptance:
  - AC1: only an approved operator can create a tour
  - AC2: a tour has a title, description, duration in minutes, a base price and a per-person price in integer euro cents, languages, a meeting point, a route and one of the operator's vehicles
  - AC3: a base or per-person price that is negative or not a whole number of cents is rejected
  - AC4: an operator can publish slots for a tour; a slot's start is stored in UTC and shown in Europe/Lisbon time
  - AC5: two slots on the same vehicle cannot overlap in time, where each slot occupies start to start + duration + the vehicle's buffer
  - AC5b: each vehicle has a turnaround buffer, an integer number of minutes from 0 to 60, default 15, set by its operator
  - AC5c: changing a vehicle's buffer is rejected if it would make existing future slots overlap
  - AC6: a slot in the past cannot be created
  - AC7: travellers can list available slots for a date range, filtered by language, excluding past, booked, cancelled and suspended-operator slots, and slots that start within the minimum lead time (60 min)
  - AC8: deleting a slot that has an active booking is rejected; the operator must cancel it instead (WI-0008)
  - AC9: a tour whose meeting point lies inside a restricted zone is rejected, naming the zone
  - AC10: a tour whose route crosses a restricted zone is rejected, naming the zone
---

# WI-0007 — Tours and time slots

## Problem

Lisbon's TukTuk tours are sold on the street, with no visible schedule and no
fixed price. Travellers can't plan ahead, and operators can't fill quiet hours.

## Proposal

An approved operator defines **tours**: a route described in text, with a
duration, a fixed price in cents, languages, a meeting point and a vehicle.
The operator then publishes **slots**, each one a concrete start time for a
tour. A slot books the whole vehicle, so the same vehicle can never be in two
overlapping slots. Travellers browse available slots by date and language.
Price is shown for information only, because payment happens on site.

## Out of scope

- Recurring schedules ("every day at 10:00"). Slots are created one at a time
  or in a simple batch in v1.
- Group-size tiers beyond a base price plus a per-person price
- GPS tracking during the tour. The route is a line the operator draws, used
  for the zone checks and shown to travellers.
- Discovery by map (that belongs to the future beacon track)

## Policies

The policies this item relies on are settled in the
[WT-0003 track decisions](../tracks/WT-0003-lisbon-tuktuk-booking.md#track-decisions-settled-2026-10-24).

## Missing before coding

- **Restricted zones (AC9, AC10).** We need the source data: Lisbon's
  municipal rules for TukTuks, drawn as polygons. Someone has to provide it,
  and someone has to keep it current.
- **When the zones change,** what happens to existing tours that no longer
  comply? They could be flagged to the admin, or hidden automatically.
- **Geometry.** The route checks need a map component in the PWA and
  geometry in `packages/domain`, which must stay pure TypeScript
  (ADR-0003). Decide the library, and whether drawing the route becomes its
  own item when WI-0007 is split.

## Notes for the agent

- Money is integer cents (AGENTS.md rule 5). Dates are stored in UTC and
  displayed in `Europe/Lisbon` (conventions.md). Daylight-saving changes are
  an edge case: add property-based tests for slots that cross a DST change.
- The overlap rule (AC5) is a good candidate for fast-check properties.
