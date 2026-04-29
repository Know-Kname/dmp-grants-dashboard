# 01 — Getting Started

> **TL;DR:** `git clone` → `npm install` → copy `.env.example` to `.env.local` → fill in two Supabase values → `npm run dev`. Or just click "Preview Demo" to skip the setup entirely.

---

## Table of Contents
- [What you'll need](#what-youll-need)
- [Step 1 — Get the code](#step-1--get-the-code)
- [Step 2 — Install dependencies](#step-2--install-dependencies)
- [Step 3 — Set up environment variables](#step-3--set-up-environment-variables)
- [Step 4 — Start the dev server](#step-4--start-the-dev-server)
- [Demo mode (no setup required)](#demo-mode-no-setup-required)
- [Folder map](#folder-map)
- [What each npm script does](#what-each-npm-script-does)
- [Troubleshooting first-run issues](#troubleshooting-first-run-issues)

---

## What you'll need

| Tool | Minimum version | How to check | How to get it |
|---|---|---|---|
| **Node.js** | 18.x | `node --version` | [nodejs.org](https://nodejs.org) — download the LTS version |
| **npm** | 9.x | `npm --version` | Comes with Node.js |
| **Git** | any recent | `git --version` | [git-scm.com](https://git-scm.com) |
| **A code editor** | — | — | [VS Code](https://code.visualstudio.com) recommended |

> **What is Node.js?** It's a JavaScript runtime that lets you run build tools (like Vite) and install packages (libraries). You don't need to write Node.js code — it's just infrastructure.

---

## Step 1 — Get the code

Open a terminal and run:

```bash
git clone https://github.com/Know-Kname/dmpgrants.git
cd dmpgrants
```

> **What is this doing?** `git clone` downloads a complete copy of the project from GitHub to your machine. `cd dmpgrants` moves you into the project folder.

You should now see a `dmpgrants/` folder. You can open it in VS Code with:

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

**Sign in with:**
- Email: `chughes@detroitmemorialpark.com`
- Password: `DMP2025!`

Or click **Preview Demo** (no credentials needed — see next section).

> ⚠️ **Port in use?** If 5173 is taken, Vite will try 5174, 5175, etc. It'll tell you which port it's using.

---

## Demo mode (no setup required)

If you don't have Supabase credentials, or just want to explore, click **Preview Demo** on the login page. You'll get:

- A full app experience with **realistic mock data**
- All 8 pages working (Dashboard, Burials, Work Orders, Inventory, etc.)
- The AI assistant (if you have an OpenRouter key) or graceful degradation without
- A yellow "Preview Mode" banner at the top to remind you it's not real data

**How it works:** Demo mode sets a flag in your browser's `localStorage` and bypasses Supabase auth entirely. All data comes from `src/lib/demo-data.ts`. Click "Exit Preview" to return to the login page.

---

## Folder map

After setup, here's the most important files and folders to know:

```
dmpgrants/
│
├── src/                        ← All application source code
│   ├── pages/                  ← Each page is one file
│   │   ├── Dashboard.tsx       ← Charts + KPI cards overview
│   │   ├── Burials.tsx         ← Burial records management
│   │   ├── WorkOrders.tsx      ← Maintenance task tracking
│   │   ├── Inventory.tsx       ← Stock management
│   │   ├── Financial.tsx       ← AR, AP, and deposits
│   │   ├── Contracts.tsx       ← Contract lifecycle
│   │   ├── Customers.tsx       ← Customer/family database
│   │   ├── Grants.tsx          ← Grant opportunities
│   │   └── Login.tsx           ← Login + demo mode entry
│   │
│   ├── components/
│   │   ├── Layout.tsx          ← Dark-green sidebar + topbar + mobile nav
│   │   ├── AIAssistant.tsx     ← Floating Gemini chat panel
│   │   ├── ui.tsx              ← All shared UI components (Button, Card, etc.)
│   │   └── ErrorBoundary.tsx   ← Catches JS errors, shows friendly message
│   │
│   ├── hooks/
│   │   └── useData.ts          ← Every React Query hook for every module
│   │
│   ├── lib/
│   │   ├── auth.tsx            ← Login/logout/demo state (AuthProvider)
│   │   ├── api.ts              ← Fetch client (handles snake_case↔camelCase)
│   │   ├── supabase.ts         ← Supabase JS client
│   │   ├── query.tsx           ← React Query config + all cache keys
│   │   ├── gemini.ts           ← AI assistant (OpenRouter streaming)
│   │   ├── toast.tsx           ← Toast notifications
│   │   ├── utils.ts            ← formatCurrency, formatDate, cn(), etc.
│   │   ├── errors.ts           ← getErrorMessage, getErrorDetails
│   │   └── demo-data.ts        ← Mock data + demo mode toggle
│   │
│   ├── config/
│   │   └── company.ts          ← DMP name, 3 locations, phones (source of truth)
│   │
│   ├── types/
│   │   └── index.ts            ← TypeScript types for every data model
│   │
│   └── styles/
│       └── index.css           ← Tailwind imports + all CSS design tokens
│
├── public/                     ← Static files (logo, photos) — served as-is
├── docs/                       ← 📚 This documentation
├── .github/                    ← GitHub Actions CI, PR templates
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

**White screen after `npm run dev`**
- Open your browser's developer tools (F12) → Console tab.
- Look for red error messages. The most common cause is missing env vars.
- Make sure `.env.local` exists and has `VITE_SUPABASE_URL` set.

**"Invalid API key" or "relation does not exist" errors**
- Your Supabase URL or anon key is wrong. Re-check Steps 3–5 above.
- Make sure you're copying the **anon** key, not the **service_role** key.

**App loads but all pages show empty data / "Failed to load"**
- The Supabase tables may not have data yet, or RLS is blocking the request.
- Click "Preview Demo" to verify the app itself works — if demo mode works but real data doesn't, it's a Supabase configuration issue.
- See [docs/10-troubleshooting.md](10-troubleshooting.md) for more.

---

Next: [02 — Architecture](02-architecture.md) →
