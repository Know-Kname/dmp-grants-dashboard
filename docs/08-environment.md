# 08 — Environment Variables

> **TL;DR:** The app uses exactly 3 environment variables — all prefixed `VITE_`. Set them in `.env.local` for local dev and in Vercel → Settings → Environment Variables for production. Never commit `.env.local`.

---

## Table of Contents
- [What environment variables are](#what-environment-variables-are)
- [The three variables](#the-three-variables)
- [Where to set them](#where-to-set-them)
- [Variable scoping (local vs. production vs. preview)](#variable-scoping-local-vs-production-vs-preview)
- [The VITE_ prefix rule](#the-vite_-prefix-rule)
- [How variables flow into the build](#how-variables-flow-into-the-build)
- [Adding a new variable](#adding-a-new-variable)
- [Troubleshooting env var issues](#troubleshooting-env-var-issues)

---

## What environment variables are

Environment variables are key-value pairs that configure the app at startup, without being hardcoded in the source code. They let you:
- Use different databases in development vs. production (local test DB vs. live DB)
- Keep secrets (API keys) out of the git repository
- Change configuration without redeploying code

> **Why not just put them in the code?** If you hardcode `const supabaseKey = "eyJ..."` in `supabase.ts` and push to GitHub, **that key is now public forever** — even if you delete the file later (git history preserves it). Environment variables keep secrets out of code.

---

## The three variables

### `VITE_SUPABASE_URL`

**What it is:** The URL of your Supabase project's REST API.

**Format:** `https://[PROJECT-REF].supabase.co` (where PROJECT-REF is a random 20-character string)

**Used in:** `src/lib/supabase.ts:3`

**How to find it:**
1. Log in to [supabase.com](https://supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy **Project URL**

**Example value:** `https://mgpwjnxtqcnoyjgebytg.supabase.co`

**Security classification:** 🟢 Safe to expose — it's just a URL, not a credential.

---

### `VITE_SUPABASE_ANON_KEY`

**What it is:** The public API key for the Supabase project. Passed in every request as a Bearer token.

**Format:** A long JWT string starting with `eyJ...`

**Used in:** `src/lib/supabase.ts:4`

**How to find it:**
1. Log in to [supabase.com](https://supabase.com)
2. Select your project
3. Go to Settings → API
4. Under "Project API keys", copy the **anon / public** key (NOT the service_role key)

**Security classification:** 🟡 This is designed to be public (it's called the *public* anon key). But it grants access according to RLS policies, so keep RLS correctly configured. Do NOT confuse this with the `service_role` key — that one bypasses RLS and must never go into frontend code.

---

### `VITE_OPENROUTER_API_KEY`

**What it is:** API key for the OpenRouter service, which routes requests to AI models (we use Gemini 2.5 Pro).

**Format:** `sk-or-v1-` followed by a long hex string

**Used in:** `src/lib/gemini.ts:1`

**How to find it / get one:**
1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign in → go to Keys page
3. Create or copy your key

**Security classification:** 🔴 This is a secret key. If exposed, others can use your API quota. Treat it like a password. In practice, since it's embedded in the frontend JS bundle, a determined person could extract it from devtools — but this requires actual effort and the usage is logged. For a private internal app, this level of exposure is acceptable.

**What happens if it's missing:** The AI assistant floating button still appears, but clicking it shows an error. The rest of the app works fine.

---

## Where to set them

### Local development: `.env.local`

Create this file in the project root (it's already gitignored):

```bash
cp .env.example .env.local
```

Then edit `.env.local`:
```
VITE_SUPABASE_URL=https://mgpwjnxtqcnoyjgebytg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_OPENROUTER_API_KEY=sk-or-v1-...
```

Save the file, then `npm run dev`. Vite reads it automatically.

**Never commit `.env.local`.** It's in `.gitignore`. The `git status` command should never show it in unstaged changes. If it does, add it: `echo ".env.local" >> .gitignore`.

### Production / Preview: Vercel dashboard

1. Go to [vercel.com](https://vercel.com) → dmpgrants → **Settings → Environment Variables**
2. For each variable:
   - Click **"Add New"**
   - **Name:** `VITE_SUPABASE_URL` (etc.)
   - **Value:** paste the actual value
   - **Environment:** Check all three boxes (Production, Preview, Development)
   - Click **"Save"**
3. After adding or changing a variable, **trigger a redeploy** (Vercel → Deployments → latest → three-dot menu → Redeploy)

> **Why redeploy?** Vite bakes the variable values into the compiled JS at build time. Changing a variable doesn't automatically rebuild — you must trigger a new build.

---

## Variable scoping (local vs. production vs. preview)

| Scope | File / Location | When it's used |
|---|---|---|
| **Local** | `.env.local` | `npm run dev` on your machine |
| **Production** | Vercel → Env Vars (Production scope) | Deploys from the `main` branch |
| **Preview** | Vercel → Env Vars (Preview scope) | Deploys from any other branch |
| **Development** | Vercel → Env Vars (Development scope) | `vercel dev` command (rarely used) |

In most cases, set all three Vercel scopes to the same values (all pointing to the same Supabase project). The exception would be if you create a separate test/staging Supabase project — in that case, you'd set Preview scope to point to the test project.

**Vite's priority order** for local development (highest to lowest):
1. `.env.local` ← what you want for local dev
2. `.env.development.local`
3. `.env.development`
4. `.env`
5. `.env.example` ← just a template, never actually used by Vite

---

## The VITE_ prefix rule

Vite **only** exposes variables that start with `VITE_` to the compiled JavaScript that runs in the browser. Variables without this prefix are available during the build process but not in the browser.

**Why this exists:** It's a safety guardrail. Without the prefix filter, someone could accidentally expose backend secrets (like database passwords) in the frontend bundle.

```ts
// This works — VITE_ prefix
const url = import.meta.env.VITE_SUPABASE_URL;

// This does NOT work — returns undefined in the browser
const secret = import.meta.env.DATABASE_PASSWORD;
```

If you ever add a new variable that the browser needs to see, it **must** start with `VITE_`.

---

## How variables flow into the build

At build time, Vite performs **static replacement**:

```ts
// Source code:
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// After Vite builds (simplified):
const supabaseUrl = "https://mgpwjnxtqcnoyjgebytg.supabase.co";
```

The string is literally inlined into the JavaScript bundle. This means:
- ✅ Fast — no runtime lookup
- ✅ Works without any server
- ⚠️ The value is visible in the compiled JS (browser devtools → Sources → `index-xxx.js`)
- ⚠️ Changing the value requires a new build

---

## Adding a new variable

If you add a new integration that needs a secret:

1. **Pick a name:** `VITE_MY_SERVICE_KEY`

2. **Add it to `.env.example`** (without the real value):
   ```
   # My Service API key — get one at https://myservice.com/keys
   VITE_MY_SERVICE_KEY=your-key-here
   ```

3. **Add it to `.env.local`** (with the real value, never committed)

4. **Add it to Vercel** (Settings → Environment Variables)

5. **Use it in code:**
   ```ts
   const key = import.meta.env.VITE_MY_SERVICE_KEY as string;
   ```

6. **Update this doc** (docs/08-environment.md) with the new entry.

---

## Troubleshooting env var issues

**"Missing Supabase environment variables" error on startup**
- `.env.local` doesn't exist or is missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- Run: `cp .env.example .env.local` then fill in the values

**Var works locally but not in production**
- The var isn't set in Vercel (only in `.env.local`)
- Go to Vercel → Settings → Environment Variables and add it
- Trigger a redeploy

**Changed a Vercel env var but the app still uses the old value**
- Variables are baked in at build time. You must trigger a new build/deploy.
- Vercel → Deployments → latest → three-dot menu → Redeploy

**`import.meta.env.VITE_MY_KEY` returns `undefined`**
- The variable name doesn't start with `VITE_`
- OR it's not in the correct `.env.*` file for your environment
- Run `console.log(import.meta.env)` in the browser to see all available vars

**Accidentally committed `.env.local`**
1. Delete it from git tracking: `git rm --cached .env.local`
2. Add to `.gitignore` if not already there
3. Commit: `git commit -m "chore: remove .env.local from tracking"`
4. **Rotate any exposed keys immediately** — treat them as compromised

---

← [07 Deployment Pipeline](07-deployment.md) | Next: [09 Security](09-security.md) →
