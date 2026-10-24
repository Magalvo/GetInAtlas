# Product

**GetInAtlas** connects travellers with local operators of experiences
(TukTuk tours, guides) and makes what they offer bookable and trustworthy.
Changing this file needs human approval (ADR-0006).

## Principles

- **Trust first.** Operators are verified by a human before they can publish.
  Reviews come only from completed bookings.
- **Phone-first, no install.** Travellers use the product on the street, in a
  city they don't know.
- **EU data residency.** Users are in the EU, so GDPR applies (ADR-0003).

## Roadmap, coarse

Each item becomes a work-track only when it starts (ADR-0006).

1. **Lisbon TukTuk registry and booking** (WT-0003): one city, one kind of
   operator, payment on site.
2. Notifications: email, SMS and push for bookings, cancellations and strikes.
3. Local guides, operators with no vehicle, on the same
   [domain model](domain-model.md).
4. Beacons: an operator announces "starting now, here".
5. More cities.

Payments, native apps and traveller social features are out of scope until a
track says otherwise.
