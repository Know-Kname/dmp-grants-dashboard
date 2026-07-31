# 14 — Auth Platform Evaluation

> **TL;DR:** Keep Supabase as the token issuer. Add Microsoft Entra ID as a single-tenant OAuth provider so the 24 DMP staff sign in with their existing work accounts. That costs $0 in new licensing, changes ~40 lines, requires zero SQL, and lets us delete 932 lines of the riskiest code in this repo. Clerk, WorkOS, Auth0 and Entra External ID are all viable products that solve problems we do not have. Families on `deathcare-live-redesign` are a **separate** decision — they must never land in the Microsoft 365 tenant.

**Evaluated 2026-07-30.** Pricing and feature tiers change without notice; re-check every
dollar figure against the linked source before anyone budgets against it.

---

## Table of Contents
- [Why this document exists](#why-this-document-exists)
- [Two decisions, not one](#two-decisions-not-one)
- [What we run today](#what-we-run-today)
- [The constraint that eliminates most options](#the-constraint-that-eliminates-most-options)
- [The four architectural shapes](#the-four-architectural-shapes)
- [Platform notes](#platform-notes)
- [Our Microsoft licensing math](#our-microsoft-licensing-math)
- [deathcare-live-redesign](#deathcare-live-redesign)
- [RBAC and audit: a separate workstream](#rbac-and-audit-a-separate-workstream)
- [Recommendation](#recommendation)
- [Prerequisites and open questions](#prerequisites-and-open-questions)
- [Sources](#sources)

---

## Why this document exists

This is a decision record, not a tutorial. It exists so that the next time someone asks
"should we move to Clerk?" the answer is a link rather than a week of re-research.

Four things drove the evaluation:

1. **Simplicity** — the app should not break in eighteen months because a vendor changed something.
2. **Reduced security surface** — less hand-written auth code we have to keep correct.
3. **Real RBAC and audit** — today every logged-in user has identical, total access.
4. **Cost and vendor count** — prefer what the company already pays for.

Read [§ Recommendation](#recommendation) if you want the answer. Read the rest if you want
to know why the other options lost, which is the part that saves time later.

---

## Two decisions, not one

The single biggest risk in this evaluation is answering both apps at once. They are
different problems.

| | `dmp-grants-dashboard` | `deathcare-live-redesign` |
|---|---|---|
| Who signs in | 24 DMP staff | Families / the public |
| Identity type | **Workforce** | **Consumer (CIAM)** |
| Do the accounts already exist? | Yes — in Microsoft 365 | No |
| Self-registration | **Forbidden** (admin-provisioned, no `signUp`) | **Required** |
| Data exposure if compromised | Every burial, contract, financial record | One family's own records |
| Right IdP shape | Federate to the company directory | Standalone consumer directory |

**Families must never be created in the Microsoft 365 tenant.** Beyond the licensing
consequences, it puts thousands of external consumer identities inside the same directory
that governs staff mailboxes, SharePoint, and Azure. Microsoft's own product split reflects
this: Entra **ID** for workforce, Entra **External ID** for customers. Mixing them is not a
shortcut, it is a blast-radius decision.

Everything from here to [§ deathcare-live-redesign](#deathcare-live-redesign) is about the
staff app.

---

## What we run today

100% Supabase Auth. `@supabase/supabase-js` is the only auth dependency in `package.json`.
The browser talks straight to Supabase Postgres; RLS is the entire authorization layer
(see [09 — Security](09-security.md)).

**The authorization model is flat.** Verified against `supabase/migrations/`:

- **17** policies of the shape `FOR ALL TO authenticated USING (true) WITH CHECK (true)`
- **0** occurrences of `auth.uid()` in any migration
- **1** exception: `anon_memorial_read` on `burials`, `TO anon`, for published memorials

So today the JWT's *identity* is load-bearing for nothing. Only the `role: authenticated`
claim matters. That has two consequences, and the second one matters more:

- **Good:** any replacement that yields a Supabase-verifiable JWT costs **0 lines of SQL**.
- **Bad:** switching auth vendors delivers **no RBAC by itself**. See
  [§ RBAC and audit](#rbac-and-audit-a-separate-workstream).

**The password paths are the risk concentration.** Four files exist almost entirely to
compensate for bugs that were found and fixed, not to implement features:

| File | Lines | Why it exists |
|---|---|---|
| `src/pages/ResetPassword.tsx` | 383 | Guard against shared-workstation account takeover |
| `src/lib/recovery.ts` | 231 | Prove a recovery actually happened; latch + URL snapshot |
| `src/lib/recovery.test.ts` | 178 | Pin that classification — it is a security boundary |
| `src/pages/ForgotPassword.tsx` | 140 | Non-enumerating reset request |
| **Total** | **932** | |

Plus `src/lib/authStorage.ts` (141 lines), which reimplements auth-js's *private* storage-key
formula because `signOut()` is not network-independent.

The three bugs these encode, from [09 — Security](09-security.md):

1. **Account takeover on a shared workstation.** `/reset-password` used to render whenever
   *any* session existed. `updateUser({ password })` changes the current session's password
   with no challenge, so anyone typing that URL on a machine where a colleague was signed in
   could seize the account with no credentials and no email.
2. **Cross-user OAuth session confusion.** auth-js deliberately keeps an existing session
   when a URL login fails, so "is there a session?" reads a *failed* exchange as success.
3. **Network-dependent sign-out.** `GoTrueClient._signOut` can return early before
   `_removeSession()` runs, leaving a valid refresh token in `localStorage` while the UI
   shows signed-out.

**Any replacement provider must be independently evaluated against those three failure
modes.** A naive port silently reintroduces them. This is the strongest argument in the whole
document — and it points at *deleting* the subsystem rather than reimplementing it against a
new vendor.

---

## The constraint that eliminates most options

Supabase's **Third-Party Auth** feature — where an external IdP issues the JWT and Supabase
honors it for RLS — supports exactly five providers:

> Clerk · Firebase Auth · Auth0 · AWS Cognito · WorkOS

There is **no generic OIDC option**. The list is fixed. Signed JWTs must use asymmetric keys
and carry a `kid` header.

**Microsoft Entra is not on that list.** This is the fact that collapses the option space.
Entra can reach Supabase only two ways, neither of which makes it the issuer:

| Path | Supabase plan | Client call |
|---|---|---|
| Entra as an OAuth social provider | **Free** | `signInWithOAuth({ provider: 'azure' })` |
| Entra as a SAML 2.0 IdP (Enterprise SSO) | **Pro** ($0.015/SSO MAU) | `signInWithSSO({ domain })` |

For a single tenant with 24 users, the free OAuth path is sufficient. SAML buys domain-based
routing across *many* customer IdPs — a multi-tenant B2B feature we have no use for. Do not
pay $25/mo for it.

The alternative is to make Entra the issuer and stop trusting Supabase Auth — which means a
server tier that mints Supabase-compatible JWTs. See shape D below.

---

## The four architectural shapes

Blast radius is measured against the seam analysis above: 17 RLS policies, ~50 data hooks in
`src/hooks/useData.ts`, and ~1,400 lines of auth-coupled application code.

### A. Supabase issues tokens, Entra authenticates the human ✅

`signInWithOAuth({ provider: 'azure' })`, single-tenant. Supabase Auth stays the issuer, so
every RLS policy and every data hook is untouched.

- **SQL:** 0 lines
- **App code:** ~40 lines (one provider button, one config change)
- **Deletable once password sign-in is off:** 932 lines
- **New vendors:** 0 · **New spend:** $0
- **Who owns password reset and MFA:** Microsoft
- **Risk:** Azure client secret expires on a schedule; calendar it or logins break

### B. Third-party issuer over Supabase Postgres (Clerk / WorkOS / Auth0)

Clerk registers as a native third-party provider; the client passes `accessToken()` to
`createClient`; policies read `auth.jwt()->>'sub'`.

- **SQL:** 0 lines today (17 flat policies don't read identity), but any future
  identity-scoped policy binds to the vendor's `sub` format
- **App code:** rewrite ~813 lines, substantially edit ~600 more
- **New vendors:** 1 · **New spend:** $0 until you need SOC 2/HIPAA, then $300/mo
- **Extra work:** the vendor does *not* sync user records into Postgres — you own webhooks
- **Honest read:** technically clean, and a real option if you want Clerk's pre-built
  organization/role UI. It buys UI, at the price of a vendor.

### C. Supabase Enterprise SSO via SAML

Same shape as A, via SAML instead of OIDC. Requires Pro ($25/mo). Documented limitations
that matter: **no Single Logout**, no identity linking, emails not treated as unique, and
you cannot extract the signing private key. Strictly worse than A for our case.

### D. Full Entra + a token-minting backend

MSAL React (`@azure/msal-react`, auth code + PKCE) in the browser; a server exchanges the
Entra token for a Supabase-compatible JWT.

- Contradicts [02 — Architecture](02-architecture.md)'s "no backend server" decision
- We would own the most security-critical code in the system
- Directly opposes the "simplicity / don't break later" driver
- **Rejected.** Listed so nobody re-proposes it.

---

## Platform notes

### Supabase Auth

| | |
|---|---|
| Plans | Free $0 · Pro $25/mo · Team $599/mo · Enterprise custom |
| MAU | 50,000 on Free; 100,000 on Pro, then **$0.00325/MAU** |
| MFA | TOTP + phone on all plans; **Advanced MFA (Phone)** $75/mo first project, $10/mo each additional (Pro/Team) |
| MFA enforcement | `aal` claim in the JWT — `aal1` = password only, `aal2` = second factor |
| SAML SSO | Pro/Team: 50 included, then $0.015/MAU |
| Custom SMTP | All tiers |
| Auth audit log retention | Free **1 hour** · Pro 7 days · Team 28 days |
| SOC 2 / ISO 27001 | Team and Enterprise only |
| HIPAA | Paid add-on, Team+ |

MFA is enforced in the database, not the client — a restrictive policy that rejects any JWT
below `aal2`:

```sql
create policy "Require MFA"
  on table_name
  as restrictive
  to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2');
```

**Built-in rate limits** (relevant to the "no login rate limiting" gap in
[09 — Security](09-security.md)) — some of this is already handled:

| Endpoint | Default | Configurable |
|---|---|---|
| Email sends (signup / recover / user) | **2 per hour** on built-in SMTP | Only via custom SMTP |
| OTP sends | 30/hour | Yes |
| Password reset, per user | 60-second window | Yes |
| `/verify`, per IP | 360/hour (bursts to 30) | No |
| Token refresh, per IP | 1,800/hour (bursts to 30) | No |
| MFA challenge, per IP | 15/hour | No |

The 2-emails-per-hour built-in limit is worth knowing: it is a hard cap that makes the
default SMTP unusable for real staff password resets. Another quiet argument for letting
Microsoft own password reset.

### Clerk

| | |
|---|---|
| Plans | Hobby $0 · Pro $25/mo ($20 annual) · Business $300/mo ($250 annual) · Enterprise custom |
| Users | **50,000 MRU included on every plan**, including Hobby |
| Overage | $0.02/user/mo (50,001–100,000), declining to $0.012 at 10M+ |
| Dashboard seats | 3 on Hobby/Pro; 10 on Business, +$20/mo each |
| Enterprise SAML/OIDC connections | 1 included on Pro/Business, then **$75/mo each** (2–15) |
| Organizations | 100 MRO included, then $1/mo each |
| B2B add-on | $100/mo · **Administration add-on** $100/mo (impersonation beyond 5/month) |
| SOC 2 / HIPAA | **Business tier and above**; BAA at Enterprise |

React SPA fit is good — `@clerk/clerk-react`, `useAuth()` returns
`{ isLoaded, isSignedIn, userId, sessionId, orgId, orgRole, getToken, signOut }`. No server
required. Supabase integration is native: register Clerk as a third-party provider, then

```typescript
createClient(url, key, {
  async accessToken() {
    return session?.getToken() ?? null
  },
})
```

Clerk injects `"role": "authenticated"` automatically. The old JWT-template approach required
sharing the Supabase JWT secret with Clerk; that is deprecated and no longer necessary.

**The caveat, from Clerk's own docs:** the integration "restricts what data authenticated
users can access in the database, but does not synchronize user records between Clerk and
Supabase." User sync is webhooks you write and maintain.

**Verdict:** a good product. For 24 staff it adds a vendor to solve a problem Entra already
solves for free, and the compliance tier we would eventually want is $300/mo. Reconsider if
DMP ever needs self-serve multi-org tenancy.

### Microsoft Entra ID (workforce) — the company-paid option

| Plan | Price | Notes |
|---|---|---|
| Entra ID **Free** | $0 | Included with Microsoft 365. Unlimited SSO to your own registered apps |
| Entra ID **P1** | $7.00/user/mo | Conditional Access, dynamic groups, App Proxy |
| Entra ID **P2** | $10.00/user/mo | + ID Protection, PIM, risk-based Conditional Access |
| Entra Suite | $12.00/user/mo | Requires P1 |

Registering this SPA as an app and signing staff in is an **Entra ID Free** capability. It
costs nothing extra for all 24 users.

MFA on the Free tier comes via **security defaults** and is limited: authenticator app only.
Phone call and SMS as a second factor require Office 365 or P1. Conditional Access —
"only from a managed device", "only from the office IP", "block legacy auth" — requires P1.
See [§ Our Microsoft licensing math](#our-microsoft-licensing-math), which is where this gets
specific and slightly ugly.

Supabase-side setup (record these; they're the whole integration):

- Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` — **not** the app's URL
- Azure Tenant URL: `https://login.microsoftonline.com/<tenant-id>`, app registered as
  "My organization only" → nobody outside DMP can sign in
- `email` scope is **required** — Supabase Auth needs a valid email back
- `offline_access` for refresh tokens
- Set the `xms_edov` optional claim in the app manifest — it protects against unverified
  email domains, and Microsoft explicitly recommends it for single-tenant apps
- **The client secret expires.** Put the renewal date in a shared calendar; when it lapses,
  every staff login fails at once

### Microsoft Entra External ID (CIAM)

The customer-facing sibling. Relevant to `deathcare-live-redesign`, not to staff.

- First **50,000 MAU free**; roughly **$0.03/MAU** beyond that — ⚠️ *this figure is from
  secondary sources; Microsoft's own pricing page renders it as a `$-` placeholder. Confirm
  with the Azure pricing calculator before relying on it.*
- Requires linking the tenant to an Azure subscription for billing
- Add-ons have **no free tier**: M2M auth (per transaction), SMS phone auth (per
  verification), Go-Local data residency (AU/JP only), ID Governance, GSA for Guests
- **No SMS for first-factor sign-in or self-service password reset** in external tenants;
  SMS is second-factor only, at extra cost
- The first 50,000 MAU get MFA and other P1/P2-grade features free

### WorkOS

Startling free tier: **AuthKit's first 1,000,000 MAU are free**, then $2,500/mo per
additional 1M. No base platform fee. The money is in the enterprise add-ons — SSO **$125 per
connection/mo**, Directory Sync (SCIM) **$125 per connection/mo**, audit log streaming
$125/mo per SIEM connection, event retention $99/mo per 1M events.

WorkOS is on Supabase's third-party list, so it is architecturally viable. It is built for
B2B SaaS selling *into* enterprises that bring their own IdP. DMP is the enterprise, not the
vendor. Wrong shape.

### Auth0

Free to **25,000 MAU** — the most generous free tier among the classic incumbents, and
enough for us. Paid tiers are priced for a different customer: B2C Essentials $35/mo and
Professional $240/mo *at 500 MAU*; B2B Essentials $150/mo and Professional $800/mo at the
same 500 MAU. Enterprise connections: 1 free, 3 on B2B Essentials, 5 on Professional, then
$100/mo each.

Also on Supabase's third-party list, so viable. But the pricing cliff past the free tier is
steep, and it adds a vendor to do what Entra already does. No reason to choose it here.

---

## Our Microsoft licensing math

DMP has **24 active Microsoft users: 8 Business Premium, 11 Basic, ~5 Standard** (the last
figure inferred as 24 − 8 − 11; confirm in the M365 admin center).

**Business Premium bundles Entra ID P1. Basic and Standard do not.** So 8 users are
P1-licensed and 16 are on Entra ID Free.

For the recommendation this does not matter — **SSO to a registered app is free for all 24**.
But the moment anyone reaches for Conditional Access, two Microsoft rules collide:

1. Conditional Access requires **P1 per user targeted by the policy** — not per tenant, not
   per admin. Microsoft's position is that "each user that benefits from a feature must be
   licensed."
2. > "Conditional Access and security defaults aren't meant to be combined because creating
   > Conditional Access policies prevents you from enabling security defaults."

Security defaults are what currently give the 16 unlicensed users free MFA. **Creating the
first CA policy to protect the 8 Premium users turns security defaults off tenant-wide and
strips baseline MFA from the other 16.** That is a silent security regression disguised as a
security improvement.

Three ways out:

| Option | Cost | Trade-off |
|---|---|---|
| Buy P1 for the other 16 | 16 × $7 = **$112/mo** ($1,344/yr) | Clean; everyone covered by CA |
| Upgrade Basic → Business Premium | Larger, but adds Intune/Defender | Best value if device management is wanted anyway |
| Keep security defaults; no CA at all | **$0** | Authenticator-app MFA for all 24, no device/location rules |

**The third option is fine for now** and is what the recommendation assumes. The point of
recording this is that it must be a *decision*, not something discovered after MFA quietly
disappears for two-thirds of staff.

One more trap: if CA policies exist and the licenses later lapse, the policies are not
deleted — they persist read-only, and you cannot re-enable security defaults until you
remove them.

---

## deathcare-live-redesign

⚠️ **Its auth stack is unverified.** This session's GitHub access is hard-scoped to
`dmp-grants-dashboard`; attaching and cloning the repo were both refused. What follows is a
decision rule, not a review of what is actually there. **Verify before acting.**

Families are consumer identities. The rule:

1. **Do not use Entra ID (workforce).** Families in the M365 tenant is the wrong blast radius.
2. **Prefer Supabase Auth** — free to 50,000 MAU, already the house platform, adds no vendor,
   and directly serves "fewer vendors" and "simplicity."
3. **Use a separate Supabase project from the staff app.** Family sign-in requires
   self-registration; the staff app forbids it by design. One project cannot hold both
   postures safely, and separate projects mean a family-side RLS mistake cannot reach burial
   or financial records.
4. **Entra External ID is the fallback**, not the default — also free to 50,000 MAU, but it
   adds an identity system to operate and cannot issue tokens Supabase will trust
   (see [§ The constraint](#the-constraint-that-eliminates-most-options)).
5. If families ever need to see their own records, RLS **must** be identity-scoped
   (`auth.uid()`) from day one. The staff app's flat `USING (true)` pattern would be a data
   breach in a family-facing app. Do not copy it.

Things to check when the repo is available: who issues tokens today; whether families
self-register; whether any RLS is identity-scoped; whether it shares the staff Supabase
project (if so, that is the first thing to fix).

---

## RBAC and audit: a separate workstream

**No auth vendor solves this.** Worth stating plainly, because vendor migrations are often
sold on it.

Today `User.role` exists as a TypeScript field, is read from `user_metadata` — which is
**user-writable** — and is consumed by exactly two lines in `src/components/Layout.tsx`,
both of which render it as text. Nothing in the database reads it. Every authenticated user
can read and write every burial, contract, customer, and financial record.

Clerk and Auth0 would put roles in the JWT, which makes policies easier to *write*. They do
not write them. The work is the same either way:

1. **A `profiles` table** with `role` as a real column, writable only by an admin — never
   `user_metadata`, which the user controls.
2. **Rewrite the 17 flat policies** off `USING (true)` onto role and identity checks. This is
   the actual project, and it is independent of who issues tokens.
3. **A Postgres audit trigger** writing to an append-only table. Note that Supabase's *auth*
   audit log retains **1 hour on Free** and 7 days on Pro — useless for "who changed this
   burial record last March." An application-level trigger table is free, retained forever,
   and records the thing you actually want. Cheaper *and* better.

Sequencing note: do the Entra federation first. It is small, it deletes code, and it changes
nothing about the schema — so it will not conflict with the RBAC work that follows.

---

## Recommendation

**Keep Supabase. Federate staff sign-in to Entra ID. Add no vendors.**

| Driver | How this serves it |
|---|---|
| Simplicity | One vendor, one token issuer, both apps. Nothing new to operate. |
| Security surface | Deletes **932 lines** of password-path code; Microsoft owns reset + MFA |
| RBAC + audit | Unblocked, and unaffected — see the separate workstream above |
| Cost / vendors | **$0** new spend, **0** new vendors |

Concretely, for `dmp-grants-dashboard`:

1. Register the SPA in Entra ID (free), single-tenant, redirect URI
   `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Enable the Azure provider in Supabase Auth with the tenant-scoped authority URL.
3. Add a "Sign in with Microsoft" button; keep password sign-in during the cutover.
4. Once every staff account has signed in via Microsoft at least once, disable password
   sign-in and delete `ResetPassword.tsx`, `ForgotPassword.tsx`, `recovery.ts`, and
   `recovery.test.ts` — plus the recovery latch in `App.tsx` and the `PASSWORD_RECOVERY`
   listener in `supabase.ts`.
5. Decide the Conditional Access question deliberately
   ([§ licensing math](#our-microsoft-licensing-math)). Doing nothing is an acceptable answer;
   doing it accidentally is not.

Note that step 4 also retires the still-unapplied `{{ .TokenHash }}` email-template fix from
[06 — Supabase](06-supabase.md) — the bug stops mattering when the feature is gone.

**Do not** migrate to Clerk, WorkOS, or Auth0 for this app. They are good products aimed at
B2B SaaS with many customer organizations. DMP has one organization, and it already has a
directory that the company pays for.

**Revisit this decision if** DMP acquires or merges with another cemetery group (multi-tenant
becomes real), the app is ever sold or licensed to other cemeteries (Clerk/WorkOS become
right), or family-facing features move into the staff app (CIAM in the same codebase changes
the calculus).

---

## Prerequisites and open questions

**Before implementing**
- [ ] Confirm the exact M365 SKU split in the admin center — the ~5 Standard figure is inferred
- [ ] Confirm who administers the Entra tenant and can create an app registration
- [ ] Decide the Conditional Access / security defaults question explicitly

**Pre-existing gaps this evaluation surfaced but does not fix** (all from
[09 — Security](09-security.md))
- [ ] `/api/chat` has **no authentication at all** — it never verifies a Supabase session.
      Unrelated to this decision, more urgent than it.
- [ ] `anon_memorial_read` is row-filtered but **not column-filtered** — `contact_name`,
      `contact_phone`, `contact_email`, `permit_number` and `notes` are reachable via direct
      PostgREST calls on published memorials
- [ ] No Content-Security-Policy
- [ ] `dmp-grants-dashboard` is a **public** GitHub repo while sibling DMP business repos are
      private. Probably deliberate — the code is separate from the data — but it deserves a
      conscious confirmation rather than an assumption.

**Unverified in this document**
- Entra External ID per-MAU pricing beyond the free tier (Microsoft renders it as `$-`)
- Everything in [§ deathcare-live-redesign](#deathcare-live-redesign)

---

## Sources

**Supabase**
- [Pricing](https://supabase.com/pricing) · [Third-party auth overview](https://supabase.com/docs/guides/auth/third-party/overview)
- [Login with Azure](https://supabase.com/docs/guides/auth/social-login/auth-azure) · [Enterprise SSO with SAML 2.0](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml)
- [Multi-factor authentication](https://supabase.com/docs/guides/auth/auth-mfa) · [Rate limits](https://supabase.com/docs/guides/auth/rate-limits)

**Clerk**
- [Pricing](https://clerk.com/pricing) · [Supabase integration](https://clerk.com/docs/guides/development/integrations/databases/supabase)

**Microsoft**
- [Entra plans and pricing](https://www.microsoft.com/en-us/security/business/microsoft-entra-pricing) · [Entra licensing](https://learn.microsoft.com/entra/fundamentals/licensing)
- [External ID pricing and billing](https://learn.microsoft.com/entra/external-id/external-identities-pricing) · [External ID FAQ](https://learn.microsoft.com/entra/external-id/customers/faq-customers)
- [What is Conditional Access? — license requirements](https://learn.microsoft.com/entra/identity/conditional-access/overview#license-requirements) · [Plan a Conditional Access deployment](https://learn.microsoft.com/entra/identity/conditional-access/plan-conditional-access)
- [Features and licenses for Entra MFA](https://learn.microsoft.com/entra/identity/authentication/concept-mfa-licensing) · [SPA sign-in quickstart (MSAL React)](https://learn.microsoft.com/entra/identity-platform/quickstart-single-page-app-sign-in)

**Others**
- [WorkOS pricing](https://workos.com/pricing) · [Auth0 pricing](https://auth0.com/pricing)

**This repo**
- [09 — Security](09-security.md) · [06 — Supabase](06-supabase.md) · [02 — Architecture](02-architecture.md)

---

← Back to [docs/README.md](README.md)
