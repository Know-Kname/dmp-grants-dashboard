# 09 — Security

> **TL;DR:** Security rests on three pillars: Row-Level Security (RLS) in Supabase controls who can touch data; secrets (API keys) are kept out of git and scoped to environments; security headers on every HTTP response protect against common browser attacks. No action by any user — not even an admin — can bypass RLS without the `service_role` key, which never leaves the server.

---

## Table of Contents
- [The security model in plain language](#the-security-model-in-plain-language)
- [Secret classification: what's public vs. private](#secret-classification-whats-public-vs-private)
- [Row-Level Security (RLS): the authorization layer](#row-level-security-rls-the-authorization-layer)
- [Authentication: how logins work](#authentication-how-logins-work)
- [HTTP security headers](#http-security-headers)
- [Secrets in code: what never to do](#secrets-in-code-what-never-to-do)
- [OWASP Top 10 and how we address each](#owasp-top-10-and-how-we-address-each)
- [Key rotation procedures](#key-rotation-procedures)
- [Demo mode and security](#demo-mode-and-security)
- [Future security improvements](#future-security-improvements)

---

## The security model in plain language

The app has no traditional backend server — the browser talks directly to Supabase. This sounds scary until you understand that Supabase enforces access control at the database level via **Row-Level Security (RLS)**.

Here's the mental model:

```
Browser (React app)
      │
      │  Uses ANON KEY (public, safe to expose)
      │  Sends JWT proving "I am user X"
      ▼
Supabase PostgreSQL
      │
      ├── RLS Policy: "Can user X SELECT row Y?"
      │   → YES: data returned
      │   → NO: empty result (not an error, just no data)
      │
      └── service_role key bypasses RLS entirely
          → NEVER in the frontend
          → Only in trusted server contexts (migrations, scripts run by admin)
```

**The contract:** As long as RLS is correctly written and the `service_role` key never reaches the browser, a malicious user cannot access data they're not supposed to see — even if they open DevTools and try to craft their own Supabase queries.

---

## Secret classification: what's public vs. private

Not all "secrets" are equally sensitive. Here's the full breakdown:

| Credential | Location | Security Level | Why |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Frontend JS bundle (public) | 🟢 Safe to expose | It's just a URL — like a street address. No harm in knowing it. |
| `VITE_SUPABASE_ANON_KEY` | Frontend JS bundle (public) | 🟡 Designed to be public | The *anon* key is the public key. It grants only what RLS permits. Supabase expects it to be public. |
| `OPENROUTER_API_KEY` | Vercel server env (Edge Function only) | 🟢 Stays server-side | Used by the `/api/chat` Edge Function. Never shipped to the browser. Set this in production. |
| `VITE_OPENROUTER_API_KEY` | Local dev only (optional) | 🟡 Dev convenience | Lets `npm run dev` call OpenRouter directly when no Edge Function is running. Gated behind `import.meta.env.DEV`, so it is stripped from production builds. Do **not** set it in Vercel. |
| Supabase `service_role` key | **Never in frontend** | 🔴 Extremely sensitive | Bypasses RLS entirely. Treat like a database root password. |
| Supabase database password | **Never in frontend** | 🔴 Extremely sensitive | Direct PostgreSQL access. Never expose. |
| GitHub Actions secrets | GitHub Settings → Secrets | 🔴 CI-only | Used by workflows, never in application code. |

### The anon key is not a secret

A common misconception: "but the anon key is in my `.env.local`, shouldn't I protect it?"

The anon key is explicitly designed to be shipped in frontend code. Supabase's own documentation confirms this. What protects your data is **not** keeping the anon key secret — it's writing correct RLS policies. If your RLS policies are correct, someone using your anon key can only read/write what you've allowed.

The `service_role` key is the actual secret. It must never appear in `src/`, `.env.example`, commit history, or any file tracked by git.

---

## Row-Level Security (RLS): the authorization layer

RLS is a PostgreSQL feature where you write SQL rules that filter every query. Think of it as an invisible `WHERE` clause automatically added to every `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.

### How to read an RLS policy

In the Supabase dashboard → Authentication → Policies, you'll see entries like:

```sql
-- Policy name: "Users can read their own data"
-- Table: users
-- Operation: SELECT
-- Using expression:
auth.uid() = id
```

This means: "when selecting from the `users` table, only return rows where the row's `id` column equals the logged-in user's ID."

### Our RLS pattern

Every table in the DMP CMS uses the **same one policy** — not separate per-operation
policies, and no role distinction:

```sql
CREATE POLICY "auth_all" ON public.TABLE_NAME
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

**The key principle:** Any user who is not logged in cannot read, write, or modify any
data — RLS enforces this at the database layer regardless of what the frontend does.
But among users who *are* logged in, there is currently **no** distinction: any
authenticated session gets full read/write access to every table. This is a
deliberate choice for a closed, staff-only tool (see the migration header on
`20260506002815_enable_rls_all_business_tables.sql` and `RUNBOOK.md`'s "RLS Policy
Reference"), not a partial implementation of role-based access — `User.role` exists
as a client-side TypeScript field, but nothing in the database reads it. See
[RBAC](#future-security-improvements) below.

**One exception:** `burials` also has `anon_memorial_read`, allowing anonymous
`SELECT` on rows where `memorial_published = true` — this is what powers the public
`/memorial/:id` pages. See [Current gaps worth noting](#current-gaps-worth-noting)
for a real limitation of this specific policy.

### What happens when RLS blocks a query

RLS doesn't throw a 403 error. It returns an empty result set. So if a logged-out user tries to `SELECT * FROM burials`, they get `[]` (no rows), not an error. This is by design — it prevents data enumeration.

### Checking RLS is enabled

In the Supabase dashboard → Table Editor → select a table → click the lock icon. It should say "RLS enabled." If it says "RLS disabled," that table is publicly readable by anyone with the anon key — fix this immediately.

```sql
-- You can also verify in the SQL editor:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- rowsecurity = true means RLS is on
```

---

## Authentication: how logins work

Authentication is handled entirely by Supabase Auth. Here's what happens when a user logs in:

```
User types email + password → clicks Login
      │
      ▼
src/lib/auth.tsx:86 → supabase.auth.signInWithPassword({ email, password })
      │
      ▼
Supabase verifies credentials against its auth.users table
      │
      ├── Wrong password → throws AuthApiError("Invalid login credentials")
      │   → Login.tsx shows error message
      │
      └── Correct → returns { session: { access_token: "eyJ...", user: {...} } }
                │
                ▼
          JWT stored in browser localStorage
          (supabase-auth-token key, managed by @supabase/supabase-js)
                │
                ▼
          AuthProvider.onAuthStateChange fires
          → sets user + session state
          → React Router redirects to /dashboard
```

### JWT structure

The access token is a JWT (JSON Web Token). Supabase signs it with a secret only Supabase knows. When the browser sends a request to Supabase, it includes this token as a `Bearer` header. Supabase verifies the signature, extracts `auth.uid()` (the user's ID), and passes it to every RLS policy.

**You never handle the JWT manually.** `@supabase/supabase-js` does all of this automatically.

### Session persistence

Supabase stores the session in `localStorage`. On page reload, `supabase.auth.getSession()` (called at `src/lib/auth.tsx:53`) retrieves it. If the token is expired, Supabase automatically refreshes it using the stored refresh token. If the refresh token is also expired, the user must log in again.

### Password reset flow

```ts
// src/lib/auth.tsx:111
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
})
```

Supabase sends an email with a link. Clicking the link sets a short-lived token in the URL. The `/reset-password` page (if implemented) calls `supabase.auth.updateUser({ password: newPassword })`.

---

## HTTP security headers

Every response from Vercel includes these headers, configured in `vercel.json:14-44`:

### `X-Content-Type-Options: nosniff`

**Attack prevented:** MIME-type sniffing.

**What that means:** Old browsers would look at file contents and guess the file type, ignoring the `Content-Type` header. An attacker could upload an image file that actually contains JavaScript, and the browser might execute it. `nosniff` tells the browser: "trust the Content-Type header, don't guess."

### `X-Frame-Options: DENY`

**Attack prevented:** Clickjacking.

**What that means:** Clickjacking is when an attacker embeds your site in a hidden `<iframe>` on their page, then tricks the user into clicking buttons they can't see. For example, an "invisible" button on your DMP CMS overlaid by a "Win a prize!" button on the attacker's site. `DENY` prevents the site from being loaded in any iframe anywhere.

### `X-XSS-Protection: 1; mode=block`

**Attack prevented:** Reflected XSS in older browsers.

**What that means:** This is a legacy header for Internet Explorer and older Chrome/Firefox. It enables the browser's built-in XSS filter. Modern browsers have largely deprecated this in favor of Content Security Policy, but it doesn't hurt to have it for any older clients.

### `Referrer-Policy: strict-origin-when-cross-origin`

**Attack prevented:** Leaking sensitive URL parameters to third parties.

**What that means:** When a user on your site clicks a link to an external site, the browser normally sends a `Referer` header telling the external site what URL the user came from. If your URL contained a sensitive token (e.g., `/reset-password?token=abc123`), the external site could see it. `strict-origin-when-cross-origin` sends only the domain (not the full path) when navigating cross-origin.

### `Strict-Transport-Security` and `Permissions-Policy`

Also set in `vercel.json`:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — forces
  HTTPS for the next 2 years on this domain and its subdomains, even for a user who
  types `http://` explicitly.
- `Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()` —
  allows the Geolocation API only for this origin (used by the cemetery map's GPS
  "Use my location" capture), and explicitly blocks camera/microphone/payment APIs,
  none of which the app uses.

### Missing: Content-Security-Policy (CSP)

The current config does not include a CSP header. CSP is the most powerful XSS protection available (it tells the browser exactly which domains can load scripts, styles, images, etc.). Adding CSP is listed in the roadmap — it requires careful tuning for Vite + Supabase + the map tile hosts (OpenFreeMap, ESRI) + Google Fonts + OpenRouter, and a wrong policy fails silently (it just breaks the feature whose request it blocks) rather than with a build error, so it needs to be verified against a live/preview deploy rather than added blind.

---

## Secrets in code: what never to do

### The golden rules

1. **Never commit `.env.local`** — it's gitignored for a reason
2. **Never paste an API key into source code** — git history is forever
3. **Never use the `service_role` key in frontend code** — it bypasses all RLS
4. **Never put secrets in comments** — comments are code and go into git

### What "git history is forever" actually means

```bash
# You commit a file with a key:
git add src/lib/api.ts    # contains const API_KEY = "sk-..."
git commit -m "oops"

# You realize and delete the key
# ... edit file, remove key ...
git commit -m "remove key"

# THE KEY IS STILL IN GIT HISTORY
git log --all -- src/lib/api.ts     # shows both commits
git show <old-commit-hash>:src/lib/api.ts   # shows the key
```

Even if you delete the key from the current code, anyone who can see your git repository can recover it. **Rotate the key immediately if this happens.** See [Key rotation procedures](#key-rotation-procedures) below.

### How to check if you accidentally committed secrets

```bash
# Check if .env.local is tracked:
git ls-files | grep .env.local
# Should return nothing. If it shows a file, run:
# git rm --cached .env.local

# Search history for common secret patterns:
git log --all -p | grep -E "(sk-or-v1|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9)" | head -5
```

GitHub also has automatic secret scanning — if you push a known key format to a public repo, it alerts you and may automatically revoke the key (for supported providers).

---

## OWASP Top 10 and how we address each

The OWASP Top 10 is the industry standard list of the most critical web security risks. Here's how DMP CMS addresses each:

| # | Risk | How we address it |
|---|---|---|
| A01 | **Broken Access Control** | RLS on every Supabase table enforces authorization at the DB layer. The frontend cannot bypass it. |
| A02 | **Cryptographic Failures** | Supabase handles all credential storage (bcrypt hashing). We never touch raw passwords. HTTPS enforced by Vercel (no plain HTTP). |
| A03 | **Injection** | We use `@supabase/supabase-js` which uses parameterized queries internally — no raw SQL concatenation in the frontend. |
| A04 | **Insecure Design** | Direct-to-Supabase architecture means no custom backend logic that could have design flaws. Data model uses UUIDs (not sequential IDs). |
| A05 | **Security Misconfiguration** | Security headers set in `vercel.json`. RLS enabled on all tables. Env vars managed via Vercel (not hardcoded). |
| A06 | **Vulnerable Components** | Dependabot opens PRs weekly for outdated dependencies. `security-scan.yml` runs `npm audit` on every push. |
| A07 | **Authentication Failures** | Supabase Auth handles session management, password hashing, token refresh, and brute-force protection. We don't roll our own auth. |
| A08 | **Data Integrity Failures** | Database constraints + Supabase type system enforces data shape. React Query cache is invalidated on mutations (no stale data bugs). |
| A09 | **Logging Failures** | Supabase logs all API calls (Supabase → Logs → API). Vercel logs HTTP requests. No PII is logged in application code. |
| A10 | **SSRF** | Not applicable — this is a frontend-only SPA. There is no server that makes outbound requests on behalf of users. |

### Current gaps worth noting

- **No CSP header** — A CSP would provide defense-in-depth against XSS. Currently absent (HSTS and Permissions-Policy have been added; CSP is the one still missing).
- **OpenRouter key** — Now proxied server-side via the `/api/chat` Edge Function (`OPENROUTER_API_KEY`); the key is no longer in the frontend bundle.
- **`/api/chat` has no authentication or rate limiting** — the handler checks only the HTTP method; it never verifies a Supabase session, so anyone who can reach the deployed URL can call it and consume the OpenRouter budget, whether or not they're a logged-in DMP staff member. A basic request-size guard (message count and per-message length caps) rejects obviously-abusive payloads, but that's a resource-exhaustion mitigation, not access control.
- **`anon_memorial_read` exposes more columns than the app intends** — the RLS policy on `burials` filters by row (`memorial_published = true`) but not by column. A direct PostgREST call with the anon key can read `contact_name`/`contact_phone`/`contact_email`/`permit_number`/`notes` on any published burial, not just the name/dates the memorial page renders. See [docs/06-supabase.md](06-supabase.md#row-level-security-rls) for the full explanation and the fix this needs (a column-restricted view or `SECURITY DEFINER` function).
- **No rate limiting on login** — Supabase has some built-in protection, but adding `fail2ban`-style IP blocking for repeated failed logins is not configured.
- **No audit log** — Who edited a burial record when? Currently no audit trail. This matters for a funeral home where data changes may have legal implications.

---

## Key rotation procedures

Key rotation = generating a new key and replacing the old one. Do this whenever you suspect a key was exposed, or as periodic hygiene.

### Rotate the OpenRouter API key

1. Go to [openrouter.ai](https://openrouter.ai) → sign in → Keys page.
2. Click **"Create Key"** to generate a new key.
3. Copy the new key.
4. Update Vercel: Vercel → dmpgrants → Settings → Environment Variables → `OPENROUTER_API_KEY` → Edit → paste new value → Save.
5. Trigger a redeploy (Vercel → Deployments → latest → three-dot → Redeploy).
6. Update your local `.env.local` (`VITE_OPENROUTER_API_KEY` for dev-direct, optional) with the new key.
7. On the OpenRouter Keys page, **delete the old key**.
8. Verify the AI assistant works in the live app.

**Time required:** ~5 minutes.

### Rotate the Supabase anon key

> ⚠️ Rotating the anon key will break the live app until you update Vercel env vars and redeploy. Plan for ~5 minutes of downtime or do this during off-hours.

1. Go to Supabase → select your project → Settings → API.
2. Under "Project API keys", click the **refresh icon** next to the anon key.
3. Confirm the rotation. Supabase generates a new anon key immediately. The old key stops working.
4. Copy the new anon key.
5. Update Vercel: Settings → Environment Variables → `VITE_SUPABASE_ANON_KEY` → Edit → paste → Save.
6. Trigger a redeploy.
7. Update your local `.env.local`.
8. Verify the app loads and login works.

**Time required:** ~5-10 minutes including downtime.

### Rotate the Supabase JWT secret

> ⚠️ This logs out ALL users immediately. Every active session becomes invalid.

This is a more extreme measure (needed if you suspect the JWT secret was compromised). In Supabase → Settings → API → JWT Secret → click "Generate new secret". All users must log in again after this.

### What to do if a secret was committed to git

1. **Rotate the key immediately** (see above). Treat the old key as compromised from the moment of the commit.
2. Remove the secret from the current code.
3. Clear git history using `git filter-repo` or BFG Repo Cleaner (beyond the scope of this doc — these tools rewrite history, which is destructive).
4. If the repo is or was public, assume the secret was scraped by automated bots within minutes of the commit.

---

## Demo mode and security

Demo mode (`src/lib/demo-data.ts`) lets users explore the app without a real login. It uses locally generated mock data — **it never reads from or writes to Supabase**.

```ts
// src/lib/auth.tsx:72
const isAuthenticated = user !== null || isDemo
```

When `isDemo` is true, `isAuthenticated` is true — the user sees all pages. But every data hook that calls Supabase (`useData.ts`, etc.) returns the mock data from `demo-data.ts` instead of making real requests.

**Security implications:**
- Demo mode cannot be used to access real burial records. Real data requires a valid Supabase JWT.
- Demo mode state lives only in `localStorage` — it's per-browser and not shared.
- A malicious user enabling demo mode on their own browser doesn't gain any privilege in Supabase.
- There's no server-side knowledge of demo mode at all.

**What demo mode is NOT for:**
- Don't use demo mode in production if you need real data. It shows fake data.
- Don't confuse `isDemo` with "admin mode" — demo users have no special Supabase privileges.

---

## Future security improvements

Listed in priority order:

1. **Content Security Policy (CSP)** — Whitelist `*.supabase.co`, `openrouter.ai`, the map tile hosts, and Google Fonts as script/style/fetch destinations. The single most impactful remaining browser-side mitigation; still not implemented (see [Missing: CSP](#missing-content-security-policy-csp) above for why it wasn't added blind alongside the other headers).

2. ~~**Server-side AI proxy**~~ ✅ **Done** — OpenRouter calls now route through the
   `/api/chat` Vercel Edge Function (`api/chat.ts`), with the key in the server-only
   `OPENROUTER_API_KEY` env var instead of the JS bundle.

3. ~~**HSTS / Permissions-Policy headers**~~ ✅ **Done** — added to `vercel.json`
   alongside the pre-existing `X-Content-Type-Options`/`X-Frame-Options`/etc.

4. **Authenticate (or at least rate-limit) `/api/chat`** — it currently has no session
   check at all; a request-size guard was added as a stopgap against trivial abuse,
   but not access control. Verifying the caller's Supabase JWT server-side in the
   Edge Function would close this properly.

5. **Restrict `anon_memorial_read` to safe columns** — currently row-filtered but not
   column-filtered; see [Current gaps worth noting](#current-gaps-worth-noting) above.

6. **Audit log table** — Add a `change_log` table in Supabase with triggers that record `(user_id, table_name, row_id, operation, old_values, new_values, timestamp)` for every INSERT/UPDATE/DELETE. Critical for a legal/compliance context.

7. **Role-based access control (RBAC)** — The current RLS allows any authenticated user to edit any record. Adding a `role` column to the `users` table and writing role-aware RLS policies would let admins have more permissions than staff.

8. **IP allow-listing** — For maximum security, Supabase supports IP restrictions on the database connection. Pair this with Vercel Edge Functions as a proxy layer.

9. **Azure Key Vault** — For enterprise deployments, move all secrets to Azure Key Vault and use managed identity instead of API keys in env vars.

---

← [08 Environment Variables](08-environment.md) | Next: [10 Troubleshooting](10-troubleshooting.md) →
