# ADR-0004 — Authentication, roles and phone verification

- **Estado:** proposto
- **Data:** 2026-10-24
- **Decisor(es):** Diogo

## Contexto

GetInAtlas has three kinds of user: travellers, operators and admins.

- **Travellers** want to sign in with as little friction as possible, usually
  on a phone, abroad.
- **Operators** go through a manual approval (WI-0006).
- **Admins** can approve operators, suspend them, resolve disputes and lift
  blocks (WI-0006, WI-0010), so a compromised admin account is the
  highest-impact breach.

No-show strikes (WI-0010) only work if a traveller can't escape them by
creating a new account. An email address is free to create; a phone number is
not.

Alternatives considered:

- **Managed providers (Clerk, Auth0):** fastest to integrate, with hosted UI
  and MFA. But they charge per active user, users live outside our database
  (roles and strikes would have to sync), and lock-in is high.
- **Supabase Auth:** ties auth to one database vendor and pushes
  authorisation into RLS. Rejected for the same reasons as in ADR-0003.
- **Building auth ourselves:** rejected, because the security risk is too high
  for a small team.
- **Passwords:** rejected. Magic links and social sign-in avoid password
  storage and reset flows.

## Decisão

Use a self-hosted TypeScript auth library (Better Auth) that stores users and
sessions in our own Postgres. Sign-in methods are an email magic link plus
Google and Apple sign-in.

Sessions are httpOnly, Secure, SameSite cookies, served from the same
registrable domain as the PWA.

**Roles** are `traveller`, `operator` and `admin`, stored in our tables and
checked in the API, never only in the client:

- Every account is a traveller.
- `operator` is granted only by the WI-0006 approval transition.
- `admin` is granted only by a seed or migration, never through the product.

**Phone verification:** a traveller must verify a phone number by SMS one-time
code (OTP) before their first booking. Each normalised (E.164) phone number
can belong to at most one account, enforced by a unique constraint. Operators
also verify a phone number during onboarding.

**Admins must use two-factor authentication** (TOTP).

## Consequências

Better:

- Users, roles, phone numbers and strikes live in one database, with no
  syncing.
- No per-user fees, and the data stays in the EU.
- Strikes follow the phone number, so creating a new account no longer resets
  them.

Worse:

- We own security patches for the auth library and its configuration.
- Each SMS costs a few cents, and SMS gateways attract SMS-pumping fraud.
- Apple sign-in requires a paid Apple Developer account.

Now mandatory:

- Rate limits on sending OTPs, per phone number, per IP and per account.
- A country allow-list or deny-list for SMS.
- Phone numbers are personal data: exclude them from logs, and delete them
  when the account is deleted.
- Every API route declares the role it requires. The default is to deny.

Now forbidden:

- Granting a role from client input.
- Admin accounts without two-factor authentication.
- Showing a traveller's phone number to an operator before the booking exists.

Open:

- The SMS provider (Twilio Verify, MessageBird or another).
- Whether one account can be both traveller and operator. The assumed default
  is yes, with separate role checks.
- A minimum age for travellers.
- The auth library's plugin coverage (magic link, phone OTP, two-factor) must
  be confirmed in a spike before this ADR is accepted.
