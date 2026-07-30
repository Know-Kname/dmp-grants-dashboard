# 01 — Getting Started

> **TL;DR:** `git clone` → `npm install` → copy `.env.example` to `.env.local` → fill in two Supabase values → `npm run dev`. The two Supabase values are not optional — without them the app renders a "Configuration required" screen instead of booting.

---

## Table of Contents
- [What you'll need](#what-youll-need)
- [Step 1 — Get the code](#step-1--get-the-code)
- [Step 2 — Install dependencies](#step-2--install-dependencies)
- [Step 3 — Set up environment variables](#step-3--set-up-environment-variables)
- [Step 4 — Start the dev server](#step-4--start-the-dev-server)
- [Signing in](#signing-in)
- [Forgot your password?](#forgot-your-password)
- [Folder map](#folder-map)
- [What each npm script does](#what-each-npm-script-does)
- [Troubleshooting first-run issues](#troubleshooting-first-run-issues)

---

## What you'll need

| Tool | Minimum version | How to check | How to get it |
|---|---|---|---|
| **Node.js** | 20.x | `node --version` | [nodejs.org](https://nodejs.org) — also pinned in `.nvmrc` |
| **npm** | 9.x | `npm --version` | Comes with Node.js |
| **Git** | any recent | `git --version` | [git-scm.com](https://git-scm.com) |
| **A code editor** | — | — | [VS Code](https://code.visualstudio.com) recommended |

> **What is Node.js?** It's a JavaScript runtime that lets you run build tools (like Vite) and install packages (libraries). You don't need to write Node.js code — it's just infrastructure.

---

## Step 1 — Get the code

Open a terminal and run:

```bash
git clone https://github.com/Know-Kname/dmp-grants-dashboard.git
cd dmp-grants-dashboard
```

> **What is this doing?** `git clone` downloads a complete copy of the project from GitHub to your machine. `cd dmp-grants-dashboard` moves you into the project folder.

You should now see a `dmp-grants-dashboard/` folder. You can open it in VS Code with:

```bash
code .
```

---

## Step 2 — Install dependencies

```bash
npm install
```

This reads `package.json` (the project's list of required libraries) and downloads them all into a `node_modules/` folder. It takes 30–60 seconds.

> ⚠️ **Common mistake:** If you see `npm: command not found`, Node.js isn't installed (or isn't on your PATH). Install Node.js first.

---

## Step 3 — Set up environment variables

Environment variables are settings that the app reads at startup — things like your database URL and API keys. They live in a file called `.env.local` which is **never committed to git** (it's in `.gitignore`).

```bash
cp .env.example .env.local
```

Now open `.env.local` in your editor. It looks like this:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_OPENROUTER_API_KEY=sk-or-v1-...   # optional
```

**Fill in the two Supabase values:**

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click your project (it's called `dmpgrants` or similar).
3. In the left sidebar, click **Settings → API**.
4. Copy **Project URL** → paste as `VITE_SUPABASE_URL`.
5. Copy **anon public** key → paste as `VITE_SUPABASE_ANON_KEY`.

> 🔑 **The anon key is safe to put in frontend code.** It's designed to be public. The Supabase Row-Level Security policies are what actually control data access. See [docs/09-security.md](09-security.md) for more.

> **What is `VITE_` prefix?** Vite (the build tool) only exposes variables with `VITE_` prefix to the browser. Variables without it are kept server-side only. Since this is a pure frontend app, all our variables use `VITE_`.

---

## Step 4 — Start the dev server

```bash
npm run dev
```

You should see output like:

```
  VITE v4.x  ready in 300ms
  ➜  Local:   http://localhost:5173/
```

Open [http://localhost:5173](http://localhost:5173) in your browser. You should see the DMP login page.

> ⚠️ **Port in use?** If 5173 is taken, Vite will try 5174, 5175, etc. It'll tell you which port it's using.

> ⚠️ **"Configuration required" full-page message instead of the app?** One or both
> Supabase variables are missing or malformed. The screen names each offending
> variable — fix `.env.local` (or the Vercel env vars in production) and reload.
> See [docs/08-environment.md](08-environment.md).

---

## Signing in

There is **no self-service sign-up**. Accounts are provisioned by a Supabase project
admin (Authentication → Users → "Add user" — see [docs/06-supabase.md](06-supabase.md)).
Ask an admin to create yours.

Once you have an account, you can sign in two ways:

- **Email + password** on the login form.
- **Continue with Google**, if Google OAuth is configured for the project. Google
  returns the browser to `/auth/callback`, which finishes the session exchange and
  then redirects you into the app.

---

## Forgot your password?

The reset flow is self-service — no admin needed:

1. On the login page, click **Forgot password?** (or go straight to `/forgot-password`).
2. Enter your work email and submit. Supabase emails you a recovery link.
3. Click the link in the email. It opens `/reset-password` with a short-lived
   recovery session attached.
4. Enter a new password — **minimum 12 characters** — and confirm it. You're signed
   in and redirected into the app.

If the link has already been used or has expired, `/reset-password` shows an
"expired link" screen with a link back to `/forgot-password` to request a fresh one.

> All three pages (`/forgot-password`, `/reset-password`, `/auth/callback`) are
> public routes — they have to be reachable while you're logged out.

---

## Folder map

After setup, here's the most important files and folders to know:

```
dmp-grants-dashboard/
│
├── src/                        ← All application source code
│   ├── pages/                  ← Each page is one file, one per route
│   │   ├── Dashboard.tsx       ← Charts + KPI cards overview
│   │   ├── Burials.tsx         ← Burial records + public memorial QR codes
│   │   ├── WorkOrders.tsx      ← Maintenance task tracking
│   │   ├── Inventory.tsx       ← Stock management
│   │   ├── Financial.tsx       ← AR, AP, and deposits (3 tabs)
│   │   ├── Contracts.tsx       ← Pre-need/at-need contract lifecycle
│   │   ├── Customers.tsx       ← Customer/family database
│   │   ├── Vendors.tsx         ← Supplier records
│   │   ├── Cemeteries.tsx      ← Cemetery → Section → Lot → Grave + interactive map
│   │   ├── Grants.tsx          ← Grant/benefit opportunities (this repo's namesake)
│   │   ├── MemorialPage.tsx    ← Public, unauthenticated `/memorial/:id` page
│   │   ├── Login.tsx           ← Email/password + Google sign-in
│   │   ├── ForgotPassword.tsx  ← Public `/forgot-password` — request a reset email
│   │   ├── ResetPassword.tsx   ← Public `/reset-password` — set a new password
│   │   └── AuthCallback.tsx    ← Public `/auth/callback` — OAuth return handler
│   │
│   ├── components/
│   │   ├── Layout.tsx          ← Sidebar + topbar + mobile nav (DMP branding)
│   │   ├── AuthLayout.tsx      ← Shared shell for the 4 auth pages
│   │                             (AuthLayout, AuthField, AuthButton)
│   │   ├── AIAssistant.tsx     ← Floating Gemini chat panel
│   │   ├── ui.tsx              ← All shared UI components (Button, Card, Modal, etc.)
│   │   ├── CemeteryMap.tsx     ← Interactive plot map (MapLibre GL)
│   │   ├── LocationsMap.tsx    ← Dashboard's 3-site locations map
│   │   ├── Pagination.tsx      ← Pagination controls (built, not wired to a page yet)
│   │   └── ErrorBoundary.tsx   ← Catches JS errors, shows friendly message
│   │
│   ├── hooks/
│   │   ├── useData.ts          ← Every React Query hook for every module
│   │   └── useForm.ts          ← Zod-validated controlled-form hook
│   │
│   ├── lib/
│   │   ├── auth.tsx            ← Login/logout/password reset (AuthProvider)
│   │   ├── api.ts              ← ApiRequestError type (no HTTP client — see 02)
│   │   ├── env.ts              ← Validates required env vars at startup
│   │   ├── supabase.ts         ← Typed Supabase JS client
│   │   ├── query.tsx           ← React Query config + all cache keys
│   │   ├── schemas.ts          ← Zod validation schemas for every form
│   │   ├── gemini.ts           ← AI assistant client (calls `/api/chat`)
│   │   ├── mapStyles.ts        ← Shared MapLibre satellite tile style
│   │   ├── theme.tsx           ← Light/dark/system theme provider
│   │   ├── toast.tsx           ← Toast notifications
│   │   ├── utils.ts            ← formatCurrency, formatDate, case transforms, cn()
│   │   └── errors.ts           ← getErrorMessage, getErrorDetails
│   │
│   ├── config/
│   │   ├── company.ts          ← DMP name, 3 locations, phones (source of truth)
│   │   └── brand.ts            ← DMP forest-green/gold brand hex constants
│   │
│   ├── types/
│   │   ├── index.ts            ← Hand-written camelCase domain types
│   │   └── database.ts         ← GENERATED snake_case Supabase schema types
│   │
│   └── styles/
│       └── index.css           ← Tailwind imports + all CSS design tokens
│
├── api/
│   └── chat.ts                 ← Vercel Edge Function: server-side OpenRouter proxy
├── supabase/
│   ├── migrations/              ← Versioned schema migrations
│   └── config.toml
├── public/                     ← Static files (logo, photos) — served as-is
├── docs/                       ← 📚 This documentation
├── .github/                    ← GitHub Actions CI, PR/issue templates, Dependabot
├── vercel.json                 ← Vercel deploy config
├── .env.example                ← Template for .env.local (safe to commit)
├── .env.local                  ← YOUR secrets (gitignored, never commit)
├── package.json                ← Dependencies + npm scripts
├── tailwind.config.js          ← Tailwind config
├── vite.config.ts              ← Vite build config
└── tsconfig.json               ← TypeScript config
```

---

## What each npm script does

| Script | Command | What it does |
|---|---|---|
| `npm run dev` | `vite` | Starts the local development server with hot-reload. Changes to files appear instantly in the browser. |
| `npm run build` | `tsc && vite build` | First type-checks TypeScript, then builds an optimized production bundle into `dist/`. |
| `npm run typecheck` | `tsc --noEmit` | Checks TypeScript types only — faster than a full build. Good for catching errors quickly. |
| `npm run lint` | `eslint .` | Checks for code quality issues. Zero warnings allowed. Run this before every commit. |
| `npm run preview` | `vite preview` | Serves the `dist/` folder locally so you can test the production build before deploying. |
| `npm test` | `vitest` | Runs tests in watch mode — re-runs affected tests as you change files. |
| `npm run test:run` | `vitest run` | Runs all tests once and exits. Used in CI. |

---

## Troubleshooting first-run issues

**`npm install` fails with `ERESOLVE` or peer dependency error**
```bash
npm install --legacy-peer-deps
```

**"Configuration required" screen instead of the app**
- `src/lib/env.ts` found a missing or malformed Supabase variable and `main.tsx`
  rendered `ConfigError` rather than mounting the app. The screen lists each
  offending variable by name.
- Fix the named variables in `.env.local` and reload.

**White screen after `npm run dev`**
- Open your browser's developer tools (F12) → Console tab.
- Look for red error messages.
- Note that a *missing env var* no longer produces a white screen — it produces the
  "Configuration required" screen above.

**"Invalid API key" or "relation does not exist" errors**
- Your Supabase URL or anon key is wrong. Re-check Steps 3–5 above.
- Make sure you're copying the **anon** key, not the **service_role** key.

**App loads but all pages show empty data / "Failed to load"**
- The Supabase tables may not have data yet, or RLS is blocking the request.
- Confirm you are actually signed in — every RLS policy is `TO authenticated`, so a
  session that has silently expired reads as an empty database rather than an error.
- See [docs/10-troubleshooting.md](10-troubleshooting.md) for more.

---

Next: [02 — Architecture](02-architecture.md) →
