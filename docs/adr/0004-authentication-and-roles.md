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
- One account can hold both `traveller` and `operator`, and each request
  checks the role it needs. An operator can't book their own slots, so they
  can't inflate their own reviews.

**Minimum age:** travellers declare they are 18 or older when they accept the
terms. Nothing verifies it. The rule keeps us outside GDPR article 8 (parental
consent), and a booking is a commitment.

**Phone verification:** a traveller must verify a phone number by SMS one-time
code (OTP) before their first booking. Each normalised (E.164) phone number
can belong to at most one account, enforced by a unique constraint. Operators
also verify a phone number during onboarding.

The SMS provider is **Bird** (formerly MessageBird), a Dutch company. It
keeps the vendor in the EU, and its Verify API doesn't charge for checking a
code, only for each send. The free alternatives were rejected for the MVP:

- **Reverse WhatsApp or Telegram verification** (the traveller sends us a
  code or shares their contact) costs nothing per verification. But
  travellers without either app are left out, and the data goes through Meta
  or Telegram.
- **Dropping phone verification** would let a blocked traveller escape their
  strikes with a new email.

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

**Acceptance is conditional on a spike** (settled 2026-10-24). This ADR stays
`proposto` until a spike work-item (WT-0003, item 4) confirms all of the
following. If any check fails, the ADR is revised before it is accepted.

- **Better Auth:** its plugins cover magic link, phone OTP with a custom SMS
  sender, and TOTP two-factor authentication.
- **Bird Verify:**
  - it sends to Portuguese and foreign numbers from an EU account;
  - its per-SMS price for our main destination countries, which Bird quotes
    on request rather than publishing;
  - whether fraud protection against SMS pumping is included, or a paid
    add-on;
  - its product status, since Bird's verification product page says it is
    "being upgraded".

  If Bird fails these checks, Twilio Verify is the fallback.
