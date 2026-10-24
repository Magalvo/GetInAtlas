---
id: 'WI-0006'
title: Operator and vehicle onboarding with admin approval
status: draft
track: 'WT-0003'
owner: Diogo
acceptance:
  - AC1: an operator application missing any required field or document is rejected with the list of missing items
  - AC2: a new operator starts in `pending_review` and cannot publish tours
  - AC3: only an admin can move an operator from `pending_review` to `approved` or `rejected`
  - AC4: rejecting an operator requires a non-empty reason, which is shown to the operator
  - AC5: a vehicle's licence plate is unique across the platform (case and whitespace insensitive)
  - AC6: a vehicle's seating capacity is an integer between 1 and the regulatory maximum
  - AC7: an admin can suspend an approved operator; a suspended operator's future slots are no longer bookable
  - AC8: an operator's public profile shows only approved data (name, photo, vehicle, languages, rating), never their documents
---

# WI-0006 — Operator and vehicle onboarding with admin approval

## Problem

Travellers in Lisbon can't tell a licensed, insured TukTuk operator from an
informal one. Operators have nowhere to build a reputation. Before anyone can
book, the platform has to know who the operators are and vouch for them.

## Proposal

An operator applies with identity details, their tourism-operator licence,
insurance, and one or more vehicles (plate, capacity, photos). The application
enters a state machine, `pending_review → approved | rejected`, plus
`approved → suspended → approved`, which an admin drives from a back-office
view. Documents are stored privately and only admins can see them. An approved
operator gets a public profile. The state is a discriminated union, as in
`src/order.ts`, and every input passes through a Zod schema at the boundary.

## Out of scope

- Automated KYC and document OCR
- Vehicles shared between several operators (each vehicle has one operator)
- Admins editing an operator's data (they can only approve, reject or suspend)
- Document expiry reminders

## Missing before coding

- **Which documents are legally required** for a TukTuk in Lisbon (tourism
  operator registration, municipal permit, insurance, driving licence
  category)? This defines AC1's required-field list. It needs a check with
  someone who knows the local regulations.
- **Maximum seating capacity** for AC6: what is the legal limit for this type
  of vehicle?
- Is one operator a company with several drivers, or one person? This changes
  whether `Driver` is a separate entity from `Operator`.
- Can a rejected operator re-apply, and if so, how many times?

## Notes for the agent

- Follow the patterns in `src/order.ts` (discriminated-union state, Zod at the
  boundary, pure transition functions).
- Documents are PII. Never log their contents, and never return them from a
  public endpoint. Store them in private EU object storage (ADR-0003).
- Approval is the only way to get the `operator` role, and the operator must
  verify a phone during onboarding (ADR-0004). Admin actions require
  two-factor authentication.
