---
id: 'WI-0009'
title: Operator reviews after completed bookings
status: draft
track: 'WT-0003'
owner: Diogo
acceptance:
  - AC1: only the traveller of a `completed` booking can review it — whether completed automatically (WI-0008 AC11) or by an upheld dispute (WI-0010 AC6)
  - AC1b: a booking marked `no_show` cannot be reviewed while the no-show stands
  - AC2: at most one review per booking
  - AC3: a review has an integer rating 1-5 and optional text of up to 1000 characters
  - AC4: the review window closes 14 days after the booking became `completed`; later submissions are rejected
  - AC5: an operator's rating is the mean of their reviews, shown with the review count; operators with zero reviews show "new", not 0
  - AC6: an operator can post one public reply per review; they cannot edit or delete the review
  - AC7: any signed-in user can report a review with a reason; an admin hides it or keeps it, and the review stays visible until the decision
  - AC8: a traveller can edit their review while the window is open; an edited review shows "edited", and earlier versions are kept for moderation
---

# WI-0009 — Operator reviews after completed bookings

## Problem

Lisbon's street TukTuk market runs on trust. A traveller choosing between
operators needs honest signals from people who actually took the tour.

## Proposal

Once a booking is `completed`, the traveller can leave one review for it.
Reviews belong to an operator (and to the vehicle used, for context), and the
operator's public profile shows the average rating and the list of reviews.
Because only completed bookings can be reviewed, reviews come from verified
customers.

**Anti-gaming (settled 2026-10-24):** the operator can't block a review by
staying silent. A booking becomes `completed` automatically 24h after slot end
unless the operator marks `no_show` (WI-0008 AC11). A false no-show can be
disputed, and if the traveller wins, the booking becomes reviewable
(WI-0010).

## Out of scope

- Operators reviewing travellers (two-sided reviews)
- Photos in reviews
- Automated content moderation or LLM moderation (if added, it would go
  through `evals/`)
- Weighted, decaying or Bayesian ratings

## Missing before coding

Nothing.

## Notes for the agent

- Store the rating as an integer. Compute the mean only when displaying it,
  and round it in one place.
