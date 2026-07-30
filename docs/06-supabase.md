# 06 — Supabase Guide

> **TL;DR:** Supabase is a cloud PostgreSQL database with a built-in REST API, real-time subscriptions, and auth. The app talks to it directly from the browser using the `@supabase/supabase-js` library. Row-Level Security (RLS) is what controls who can read or write what — the frontend enforces nothing itself.

---

## Table of Contents
- [What Supabase is](#what-supabase-is)
- [Accessing the dashboard](#accessing-the-dashboard)
- [The database tables](#the-database-tables)
- [Authentication](#authentication)
- [Supabase dashboard configuration checklist](#supabase-dashboard-configuration-checklist)
- [Row-Level Security (RLS)](#row-level-security-rls)
- [How the app talks to Supabase](#how-the-app-talks-to-supabase)
- [Viewing and editing data](#viewing-and-editing-data)
- [The SQL editor](#the-sql-editor)
- [Making a schema change](#making-a-schema-change)
- [Supabase vocab glossary](#supabase-vocab-glossary)

---

## What Supabase is

Supabase gives you a hosted PostgreSQL database plus several services on top of it:

- **Database** — Standard PostgreSQL. Tables, relationships, indexes, triggers, everything.
- **Auth** — Built-in user management: sign up, sign in, email verification, password reset, JWT sessions.
- **REST API** — Automatically generated HTTP API for every table. You don't write any API code — Supabase generates it from your schema.
- **Realtime** — WebSocket subscriptions to watch for database changes (not used in this app yet).
- **Storage** — File storage (not used in this app).

The app uses Supabase Auth for logins and the REST API (via the JS client) for all database operations.

**Why Supabase instead of a custom server?** A custom backend would require maintaining an Express/Node server, writing all the API routes, managing auth tokens manually, and hosting the server somewhere. Supabase handles all of that — we focus on the React frontend instead.

---

## Accessing the dashboard

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Select the project with reference ID `mgpwjnxtqcnoyjgebytg` (region: us-east-1).
   Its internal Supabase project id was corrected from an earlier `dmpgrants`
   misconfiguration to `supaduba` — don't look for a project literally named
   "dmpgrants."

**Key sections:**

| Section | What you'll do there |
|---|---|
| **Table Editor** | Browse, filter, add, edit, delete rows. Like a spreadsheet view of the database. |
| **SQL Editor** | Run any SQL query. Powerful for bulk operations and schema changes. |
| **Authentication → Users** | See all registered users, add users manually, reset passwords. |
| **Authentication → Policies** | Manage Row-Level Security policies (who can read/write what). |
| **Settings → API** | Get your Project URL and anon key. |
| **Settings → Database** | Connection strings for direct PostgreSQL access. |
| **Logs** | Real-time logs of API requests and auth events. Useful for debugging. |

---

## The database tables

The app has 16 tables. Each one maps to a module in the UI.

| Table | Module | What it stores |
|---|---|---|
| `work_orders` | Work Orders | Maintenance and service tasks |
| `grants` | Grants | Grant opportunities and applications |
| `burials` | Burials | Deceased records with plot locations |
| `customers` | Customers | Family and contact information |
| `inventory` | Inventory | Stock items with quantities |
| `contracts` | Contracts | Pre-need and at-need agreements |
| `contract_items` | Contracts | Line items within a contract |
| `deposits` | Financial | Cash/check/card deposits received |
| `accounts_receivable` | Financial | Money owed to DMP |
| `accounts_payable` | Financial | Money DMP owes to vendors |
| `vendors` | Vendors / Financial | Supplier records, referenced by Accounts Payable |
| `cemeteries` | Cemeteries | The 3 DMP locations — root of the plot hierarchy |
| `sections` | Cemeteries | Sections within a cemetery |
| `lots` | Cemeteries | Lots within a section |
| `graves` | Cemeteries | Individual graves within a lot — GPS-taggable, status-tracked |
| `payment_schedule` | Contracts | Installment schedule for pre-need contracts |

There is no `users` table — staff accounts live in Supabase's built-in `auth.users`.
An earlier `public.users` table (a redundant, zero-row mirror with no application
reads) was dropped via migration; don't recreate it.

**Column naming:** All columns use `snake_case` (e.g. `first_name`, `burial_date`, `created_at`). The JavaScript code uses `camelCase` (`firstName`, `burialDate`, `createdAt`). The `api.ts` layer converts between them automatically.

**Common columns on all tables:**
- `id` — UUID, auto-generated primary key
- `created_at` — timestamp, auto-set on INSERT
- `updated_at` — timestamp, updated on every change

### Burials table (example)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Auto-generated |
| `deceased_first_name` | text | Required |
| `deceased_last_name` | text | Required |
| `deceased_middle_name` | text | Optional |
| `date_of_birth` | date | Optional |
| `date_of_death` | date | Optional |
| `burial_date` | date | Required |
| `plot_location` | text | Format: `SECTION-LOT-GRAVE` (e.g. `A-14-3`) |
| `section` | text | Cemetery section |
| `lot` | text | Lot number within section |
| `grave` | text | Grave number within lot |
| `contact_name` | text | Next of kin / primary contact |
| `contact_phone` | text | |
| `contact_email` | text | |
| `permit_number` | text | State burial permit number |
| `notes` | text | Free-form notes |
| `created_at` / `updated_at` | timestamp | Auto-managed |

---

## Authentication

Supabase Auth handles user logins. There are two accounts of interest:

### Real user login

Staff accounts are Supabase Auth users, with `role` stored in `user_metadata` (e.g.
`admin`). Ask a Supabase project admin to create you an account (Authentication →
Users → "Add user") rather than relying on any credential written down in a doc —
none are recorded in this file, and if you find one committed anywhere in this repo's
history, treat it as compromised and rotate it immediately.

To add another user:
1. Supabase dashboard → Authentication → Users → "Add user"
2. Enter email and password
3. The user can then sign in to the app
4. To set their `name` and `role`, use SQL:
   ```sql
   UPDATE auth.users
   SET raw_user_meta_data = '{"name": "Jane Smith", "role": "staff"}'::jsonb
   WHERE email = 'jsmith@detroitmemorialpark.com';
   ```

> **Note — forgotten passwords no longer need an admin.** Staff can reset their own
> password from the app: **Forgot password?** on the login page → `/forgot-password`
> → emailed link → `/reset-password` (12-character minimum). Only *creating* an
> account still requires the steps above.
>
> A proper admin invite UI is planned; until then the dashboard + SQL flow above is
> the current process, and there is deliberately no self-service sign-up in the app.

### How the JWT session works

When a user signs in:
1. Supabase verifies email/password
2. Returns a **JWT (JSON Web Token)** — a signed, time-limited token
3. The Supabase JS client stores the token in `localStorage`
4. Every API request includes the token in the `Authorization: Bearer <token>` header
5. Supabase validates the token on every request
6. RLS policies can read `auth.uid()` from the token to know who's asking

Tokens auto-refresh before expiry. If the browser is closed and reopened within the session window, the user stays logged in.

---

## Supabase dashboard configuration checklist

These settings live in the dashboard, not in the repo — nothing in a code review will
catch them being wrong. They were previously flagged **UNKNOWN** in `AUDIT_REPORT.md`;
verify them and keep them verified.

### Authentication → URL Configuration

| Setting | Value |
|---|---|
| **Site URL** | The production domain (e.g. `https://dmpgrants.vercel.app`). This is the fallback Supabase uses when an email link has no explicit redirect. |
| **Redirect URLs** (allow-list) | `<prod>/auth/callback`<br>`<prod>/reset-password`<br>`http://localhost:5173/**`<br>`https://*-<team>.vercel.app/**` |

Every entry matters:

- **`<prod>/auth/callback`** — where Google OAuth returns the browser.
- **`<prod>/reset-password`** — where the emailed recovery link lands.
- **`http://localhost:5173/**`** — without it, neither flow works in local dev.
- **`https://*-<team>.vercel.app/**`** — Vercel gives every preview deploy a unique
  hostname. Without the wildcard, OAuth and password reset are rejected on every
  preview, even though production works fine.

### Google Cloud Console → OAuth 2.0 Client

> ⚠️ **The most common misconfiguration.** The authorized redirect URI on the Google
> OAuth client must be the **Supabase** callback:
>
> ```
> https://<project-ref>.supabase.co/auth/v1/callback
> ```
>
> **Not** the app's `/auth/callback`. Google redirects to Supabase; Supabase then
> redirects to the app. Putting the app URL here produces a `redirect_uri_mismatch`
> error from Google before Supabase is ever reached.

The app-side `/auth/callback` URL belongs in Supabase's redirect allow-list (above),
which is a different list in a different product. Both are required.

### Authentication → Email

- Confirm the recovery ("Reset Password") template is enabled.
- The default Supabase SMTP has a low hourly cap intended for testing. Configure a
  custom SMTP provider before relying on password reset for real staff.
- **Change the recovery template to use `{{ .TokenHash }}`** — see below. Without
  this change, reset links only work in the browser that requested them.

#### ⚠️ REQUIRED: make reset links work across devices

> **Status: not yet applied.** This is a dashboard change; no code change can
> substitute for it. The app already handles both link formats, so applying it is
> safe at any time and takes effect on the next email sent.

**The problem.** `src/lib/supabase.ts` sets `flowType: 'pkce'`, which is correct
for a browser SPA. Under PKCE, `resetPasswordForEmail` stores a *code verifier* in
the requesting browser's `localStorage`, and the default email template produces a
link that comes back as `?code=…`. auth-js only attempts that exchange when the
matching verifier is present — `_isPKCECallback` requires
`params.code && <verifier in storage>`.

So the ordinary real-world flow — request the reset on the office desktop, open the
email on a phone — has no verifier, no exchange is even attempted, and the user is
told the link expired. The link is fine; the browser is wrong. Staff can burn reset
after reset and never succeed.

**The fix.** Switch the recovery email to the token-hash form, which carries a
`token_hash` the app verifies with `supabase.auth.verifyOtp({ token_hash, type:
'recovery' })`. That call needs no local verifier, so the link works from any
device.

In **Authentication → Emails → Reset Password**, replace the `{{ .ConfirmationURL }}`
link with:

```html
<a href="{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery">
  Reset your password
</a>
```

Notes:

- `{{ .SiteURL }}` is the **Site URL** configured above, so keep it accurate — this
  link does not pass through Supabase's `/verify` endpoint or the `redirectTo`
  parameter, and is therefore not governed by the redirect allow-list.
- Keep `<prod>/reset-password` in the redirect allow-list regardless: `?code=` links
  already in flight, and any future `redirectTo` use, still need it.
- `/reset-password` accepts `token_hash`, `code`, and implicit-grant fragments, so
  links already sitting in inboxes keep working through the transition.

**Until this is applied,** a cross-device link shows "Open this link in the browser
you requested it from" with instructions — deliberately *not* "expired", which was
both wrong and unactionable.

---

## Row-Level Security (RLS)

**RLS is the most important security concept to understand.**

> **What it means:** Without RLS, any user with the anon key could read/write any row in any table — the entire database would be exposed. RLS adds per-row, per-user permissions enforced by the database itself.

### How it works

RLS policies are SQL rules attached to a table. When any request comes in, PostgreSQL evaluates the policy for that user. If the policy doesn't return `true`, the operation is denied.

### The actual policy this app uses

Every table uses the same **one** flat policy — not separate per-operation policies:

```sql
CREATE POLICY "auth_all" ON public.TABLE_NAME
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

This is a deliberate, documented design choice (see the header of migration
`20260506002815_enable_rls_all_business_tables.sql` and `RUNBOOK.md`'s "RLS Policy
Reference" section) — not an oversight. DMP CMS has no public user accounts; every
authenticated session is a staff member who was issued credentials, so **any
authenticated user currently has full read/write access to every table.** There is no
role-based restriction anywhere in the database today, despite `User.role` existing as
a client-side TypeScript field — RBAC is a tracked future improvement, not something
partially built (see [docs/12-roadmap.md](12-roadmap.md)).

**One exception:** `burials` also carries an anonymous-read policy, which is what
powers the public `/memorial/:id` pages:
```sql
CREATE POLICY "anon_memorial_read" ON public.burials
  FOR SELECT TO anon
  USING (memorial_published = true);
```

⚠️ **Known gap, not yet fixed:** this policy filters *rows* (only published burials),
not *columns*. RLS policies can't restrict which columns a SELECT returns — so an
anonymous caller querying the table directly (bypassing the app's own narrower
`select()`) can read every column on a published row, including
`contact_name`/`contact_phone`/`contact_email`/`permit_number`/internal `notes`, not
just the name and dates a memorial page actually displays. The app's own
`usePublicBurial()` hook (`src/hooks/useData.ts`) already selects a safe, narrow
column list, but that's an application-layer convention, not a database-enforced one
— anyone with the (intentionally public) anon key can query the base table with a
wider `select()`. The correct fix is a column-restricted view or `SECURITY DEFINER`
function for anonymous reads instead of a policy on the base table; that requires a
coordinated schema + app-code change, so it's flagged here rather than silently
patched.

### Current RLS status

Check the current policies in Supabase dashboard → Authentication → Policies.

If a table has **no policies**, it depends on whether RLS is enabled:
- RLS **disabled** → all operations allowed for all users (risky!)
- RLS **enabled** with no policies → all operations **blocked** (safe but non-functional)

**The policy to add for any new table** (matching every existing table):
```sql
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.new_table
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## How the app talks to Supabase

The Supabase JS client is initialized once in `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

All queries live in `src/hooks/useData.ts` and call Supabase directly. A small
`sb()` helper unwraps the `{ data, error }` shape and `toCamelCaseKeys` converts
the snake_case response:

```ts
// Inside useBurials() — what every list hook looks like:
const rows = await sb(
  supabase.from('burials').select('*').order('burial_date', { ascending: false })
);
return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as Burial);
```

The pattern:
1. `supabase.from('table').select/insert/update/delete()` — RLS still applies
2. `sb()` throws on `error`, returns `data` (non-null)
3. `toCamelCaseKeys` recurses into the result; `toSnakeCaseKeys` recurses into
   insert/update payloads
4. React Query handles caching/refetching via `queryKey` invalidation

There is no Express/REST layer — `api.ts` only exports the `ApiRequestError` type
used by the retry policy in `query.tsx` and the user-facing message helpers in
`errors.ts`.

---

## Viewing and editing data

The **Table Editor** in the Supabase dashboard is the easiest way to browse data.

1. Go to Supabase → Table Editor → select a table
2. You can filter rows using the filter controls at the top
3. Click any row to edit it inline
4. Click the "+ Insert row" button to add data

> ⚠️ **Careful with direct edits.** Editing data directly in the dashboard bypasses the app's validation. Column names are in snake_case here (e.g. `burial_date`), not camelCase.

---

## The SQL editor

The SQL Editor lets you run any PostgreSQL query. It's useful for:

- Bulk updates
- Complex queries across multiple tables
- Schema changes
- Debugging

**How to open it:** Supabase dashboard → SQL Editor → "New Query"

**Example queries:**

```sql
-- Count burials per month in 2025
SELECT
  DATE_TRUNC('month', burial_date) AS month,
  COUNT(*) AS burial_count
FROM burials
WHERE burial_date >= '2025-01-01'
GROUP BY month
ORDER BY month;

-- Find all overdue receivables
SELECT *
FROM accounts_receivable
WHERE status = 'overdue'
ORDER BY due_date ASC;

-- Update a user's role
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data,
  '{role}',
  '"admin"'
)
WHERE email = 'user@detroitmemorialpark.com';
```

---

## Making a schema change

> ⚠️ Schema changes affect the live production database. Be careful.

> **The SQL Editor steps below are for prototyping only.** Anything that should
> actually ship needs to be a committed migration file in `supabase/migrations/` —
> that's the only thing that keeps this repo's migration history able to reproduce the
> schema, and it's what `supabase-migrations.yml`/`drift-check.yml`
> ([docs/04-github.md](04-github.md)) depend on. Create one with
> `supabase migration new description_here`, start it with the standard header
> documented in `CONTRIBUTING.md`, and commit the file — a change that only exists in
> the SQL Editor's history isn't really documented anywhere. This repo has already hit
> the failure mode of migration files drifting from what's actually applied — twice.
> See [docs/13-ci-and-database-operations.md](13-ci-and-database-operations.md) for
> the current divergence log (including a migration that had to be recovered out of
> production's `schema_migrations` table), and
> [docs/archive/2026-05-06-platform-audit.md](archive/2026-05-06-platform-audit.md)'s
> Change Log for how the first round was reconciled.

**Process for adding a column:**

1. Open SQL Editor in Supabase dashboard.
2. Write and preview your ALTER TABLE statement:
   ```sql
   ALTER TABLE burials
   ADD COLUMN cemetery_location text DEFAULT 'east';
   ```
3. Run it.
4. Update the TypeScript type in `src/types/index.ts` to include the new field.
5. Update `src/lib/supabase.ts` (the `Database` type) if needed.
6. Update any forms/tables in the relevant page component.
7. Test locally, then push to trigger a Vercel deploy.

**Process for adding a table:**

1. Create the table in SQL Editor:
   ```sql
   CREATE TABLE reports (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     title text NOT NULL,
     type text NOT NULL,
     generated_at timestamptz DEFAULT now(),
     data jsonb,
     created_by uuid REFERENCES auth.users(id)
   );
   ```
2. Enable RLS and add the standard policy (see [Row-Level Security](#row-level-security-rls) above — one `FOR ALL` policy, not separate per-operation ones):
   ```sql
   ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "auth_all" ON reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
   ```
3. Add the TypeScript type, data hooks in `useData.ts`, and UI.

---

## Supabase vocab glossary

| Term | Definition |
|---|---|
| **PostgreSQL** | The industry-standard open-source relational database that Supabase uses under the hood |
| **RLS (Row-Level Security)** | Database-enforced rules controlling which rows a user can read, insert, update, or delete |
| **JWT (JSON Web Token)** | A signed token that proves who you are; passed in every API request |
| **anon key** | The public API key — safe to expose in frontend code; RLS controls what it can access |
| **service_role key** | A bypass key with full database access — NEVER put this in frontend code or commit it |
| **Schema** | The structure of the database: which tables exist, which columns, what types |
| **Policy** | An RLS rule; SQL expression that must evaluate to `true` for an operation to proceed |
| **auth.uid()** | SQL function that returns the UUID of the currently authenticated user |
| **UUID** | Universally Unique Identifier — a random 128-bit string used as a primary key |
| **Trigger** | A database function that runs automatically on INSERT/UPDATE/DELETE |
| **Foreign key** | A column that references the primary key of another table, creating a relationship |

---

← [05 Vercel](05-vercel.md) | Next: [07 Deployment Pipeline](07-deployment.md) →
