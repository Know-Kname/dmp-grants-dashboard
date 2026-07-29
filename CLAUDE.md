# CLAUDE.md — Project Memory for Claude Code

This file is read automatically by Claude Code at the start of every session.
It gives the AI immediate project context so it can assist without re-exploring.

---

## What This Project Is

**Detroit Memorial Park CMS** — a React/TypeScript SPA that manages cemetery
operations for Detroit Memorial Park Association (3 Michigan locations, est. 1925).
Staff use it to track burials, work orders, inventory, financial records, contracts,
customers, and grants. Deployed on Vercel, database on Supabase.

---

## Tech Stack (one-liner)

React 18 + TypeScript 5 + Vite 4 + Tailwind CSS 3 + TanStack React Query v5 +
Supabase (auth + PostgreSQL) + React Router DOM v6 + Recharts + Lucide icons.
AI assistant via OpenRouter (Gemini 2.5 Pro). Deployed on Vercel.

---

## Finding Things Quickly

```
src/
  pages/         One file per route (Dashboard, Burials, Inventory, Financial,
                 Contracts, Customers, Grants, WorkOrders, Login)
  components/    Layout.tsx  ← nav/sidebar/topbar
                 AIAssistant.tsx  ← floating Gemini chat
                 ui.tsx  ← entire component library (Button, Card, Modal…)
                 ErrorBoundary.tsx
  hooks/
    useData.ts   ALL React Query hooks for every module
  lib/
    api.ts       Error type hierarchy (ApiRequestError, NetworkError, TimeoutError)
    auth.tsx     AuthProvider + useAuth hook (Supabase + demo mode)
    supabase.ts  Supabase client init
    gemini.ts    OpenRouter streaming client
    query.tsx    QueryClient config + all queryKeys
    toast.tsx    Toast notification system
    errors.ts    getErrorMessage / getErrorDetails / getErrorRequestId
    utils.ts     formatCurrency, formatDate, formatDateForInput, cn()
    demo-data.ts Mock data + enableDemoMode / disableDemoMode
  config/
    company.ts   DMP name, 3 locations, phones, tagline (source of truth)
  types/
    index.ts     Hand-written camelCase domain types (what components speak)
    database.ts  GENERATED snake_case schema types (what Postgres stores).
                 Regenerate via the Supabase MCP `generate_typescript_types`
                 tool, or `supabase gen types typescript --linked`.
                 The case transformers in lib/utils.ts are the boundary
                 between the two — do not hand-edit database.ts.
  styles/
    index.css    Tailwind base + all CSS design tokens (HSL variables)
```

---

## Commands Claude Commonly Runs

```bash
npm run dev          # Start dev server → localhost:5173
npm run build        # tsc + vite build (fails on TS errors)
npm run typecheck    # Type-check only, faster than full build
npm run lint         # ESLint — must exit 0 (zero warnings policy)
npm test             # Vitest watch mode
npm run test:run     # Vitest single run
git push -u origin main   # Push → triggers Vercel auto-deploy
```

---

## Conventions

- **Branch strategy:** develop on `main` (small team, no branching ceremony).
  Use feature branches for large changes, PR → merge.
- **Commits:** conventional-style — `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
  Append the Claude session URL to the commit body.
- **TypeScript:** strict mode. No `@ts-ignore`. Use `unknown` not `any` where possible.
- **ESLint:** `--max-warnings 0`. Fix all lint errors before committing.
- **Components:** functional, hooks-based. No class components.
- **State:** React Query for server state. `useState`/`useReducer` for local UI state.
  No Redux, no Zustand.
- **Styling:** Tailwind utility classes + CSS variable tokens. No inline `style={}` except
  for the dark-green sidebar brand colors (`#1a3d2b`, `#c49a2c`).
- **Forms:** controlled inputs driven by `useForm` (`src/hooks/useForm.ts`) with Zod
  schemas from `src/lib/schemas.ts`. Bind fields with `form.getFieldProps(name)` and
  pass `getFieldError(...)` into the `error` prop on `Input`/`Select`/`Textarea`.
  **Grants is the reference implementation.** The other CRUD pages still use raw
  `useState` and do not validate yet — convert them to this pattern when touched.
- **Error handling:** surface via `getErrorMessage(err)` from `src/lib/errors.ts`.
  Show errors with the `<Alert>` component from `ui.tsx`.

---

## DMP Brand Colors (used in fixed elements)

```
DMP Forest Green: #1a3d2b   ← sidebar background, login left panel
DMP Gold:         #c49a2c   ← active nav, accents, highlights
```
These stay fixed regardless of the user's light/dark preference, because the
sidebar and login hero should always read as dark.

There are exactly two definitions, and both are intentional:
- `BRAND` in `src/config/brand.ts` — import this from `.tsx`.
- `--brand-green` / `--brand-gold` in `src/styles/index.css` — use these from CSS.

Do not add a third. A duplicate `--forest-hex`/`--gold-hex` block existed for a
while with no consumers at all; it has been removed.

---

## Do Not Touch

- `.env.local` — local secrets, never commit
- `public/dmp-*.{png,jpg}` — downloaded brand assets, do not delete
- `dist/` — build output, gitignored, regenerated by `npm run build`
- `package-lock.json` — only update via `npm install`, never edit manually

---

## Key Architectural Decisions

1. **No Express backend.** The original `server/` folder was deleted. The frontend
   calls Supabase directly using `@supabase/supabase-js`.
2. **Demo mode bypass.** `enableDemoMode()` (in `lib/demo-data.ts`) sets localStorage
   and dispatches a `dmp-demo-change` CustomEvent. `AuthProvider` listens for this
   event and updates `isDemoActive` state reactively.
3. **snake_case ↔ camelCase.** The Supabase DB uses snake_case columns.
   Each hook in `src/hooks/useData.ts` calls `toSnakeCaseKeys` on insert/update
   payloads and `toCamelCaseKeys` on the result, so TypeScript types always use
   camelCase. The transformers live in `src/lib/utils.ts` and recurse into nested
   objects/arrays (relevant for `payment_plan` JSONB and joined `contract_items`).
4. **Query invalidation pattern.** After every mutation, the relevant queryKey is
   invalidated, triggering an automatic refetch. See `src/hooks/useData.ts`.

---

## Full Documentation

See `/docs/` for platform guides (GitHub, Vercel, Supabase), architecture deep-dives,
and troubleshooting. Start at `docs/README.md`.
