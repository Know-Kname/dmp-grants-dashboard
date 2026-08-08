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

React 18 + TypeScript 5 + Vite 8 (Rolldown) + Tailwind CSS 3 + TanStack React Query v5 +
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
    api.ts       Error type hierarchy (ApiRequestError)
    auth.tsx     AuthProvider + useAuth hook (Supabase email/password + Google).
                 No signUp — accounts are admin-provisioned, invite-only.
    authStorage.ts  Derives the Supabase storage key and clears it directly.
                 Needed because signOut() is not network-independent — see the
                 file header before touching sign-out.
    recovery.ts  Module-scope snapshot of recovery credentials in the URL, plus
                 the PASSWORD_RECOVERY latch. Imported by supabase.ts BEFORE
                 createClient — that ordering is load-bearing, do not reorder.
    supabase.ts  Supabase client init (PKCE flow)
    permissions.ts  AppRole + can(role, action). A MIRROR of the RLS policies so
                 the UI can hide impossible actions — NOT the security boundary.
                 Change it in the same commit as any policy change.
    profiles.ts  Row/domain types for public.profiles + the one widened client
                 accessor. Delete once database.ts is regenerated with profiles.
    writeResult.ts  affectedRows()/WriteBlockedError. A refused UPDATE/DELETE
                 returns 200 + zero rows, NOT an error — every mutation in
                 useData.ts must `.select()` and go through this, or a blocked
                 write looks exactly like a successful one.
    env.ts       Validates VITE_SUPABASE_* at runtime; main.tsx renders a
                 ConfigError screen instead of the app when they're missing.
                 Deliberately no zod — this module is in the entry chunk.
    gemini.ts    OpenRouter streaming client
    query.tsx    QueryClient config + all queryKeys
    toast.tsx    Toast notification system
    errors.ts    getErrorMessage / getErrorDetails / getErrorRequestId
    utils.ts     formatCurrency, formatDate, formatDateForInput, cn()
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
  Derive the form's state type from the schema (`z.input<typeof xFormSchema>`)
  rather than hand-declaring it, so the two cannot drift.
  Every CRUD page follows this except two documented gaps: the two payment-recording
  forms in `Financial.tsx`, which capture a single amount against an existing invoice
  and stay on plain `useState` (intentional — no schema would add a check); and
  `Cemeteries.tsx`'s four forms (Cemetery/Section/Lot/Grave), which still use plain
  `useState` with inline `parseInt`/`parseFloat` coercion and have no schemas in
  `schemas.ts` yet (not yet converted — a real gap, not a deliberate exception).
  **Grants is the clearest example of the converted pattern.**
- **Motion:** all animation goes through `src/lib/motion.tsx` — the only file allowed
  to import `framer-motion` (LazyMotion strict mode throws otherwise). Import `m`,
  `AnimatePresence`, `EASE_LUX`, and the shared variants from there. Respect reduced
  motion: Framer is covered by `MotionConfig reducedMotion="user"`; CSS animations by
  the `prefers-reduced-motion` block in `index.css`. Destructive actions use
  `ConfirmDialog` from `ui.tsx`, never `window.confirm()`. List pages use `DataTable`
  (`src/components/DataTable.tsx`) for sortable/paginated/CSV-exportable tables and
  the `Skeleton*` components for loading states.
- **Error handling:** surface via `getErrorMessage(err)` from `src/lib/errors.ts`.
  Show errors with the `<PageError>` component from `ui.tsx` (renders nothing when
  passed a falsy error, so a page can pass a combined query/mutation error straight
  through without guarding).

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
2. **No demo mode, no self-signup.** Demo mode was removed: it set `isAuthenticated`
   with no session — an auth bypass reachable from the production login page — and
   never worked anyway, since RLS is `TO authenticated` so its anon queries returned
   nothing. Accounts are admin-provisioned; staff self-serve password resets at
   `/forgot-password` → `/reset-password`. `/auth/callback` handles the OAuth code
   exchange.
   **A session is never proof of anything on these routes.** `updateUser({password})`
   changes the *current* session's password with no challenge, and auth-js keeps a
   pre-existing session when a URL login fails — so "is there a session?" reads a
   failed exchange as success. `/reset-password` requires recovery credentials in
   the URL *and* a `PASSWORD_RECOVERY` event this page load; `/auth/callback`
   requires the user identity to have *changed*. Do not relax either to a session
   check. See `docs/09-security.md`.
3. **snake_case ↔ camelCase.** The Supabase DB uses snake_case columns.
   Each hook in `src/hooks/useData.ts` calls `toSnakeCaseKeys` on insert/update
   payloads and `toCamelCaseKeys` on the result, so TypeScript types always use
   camelCase. The transformers live in `src/lib/utils.ts` and recurse into nested
   objects/arrays (relevant for `payment_plan` JSONB and joined `contract_items`).
4. **Query invalidation pattern.** After every mutation, the relevant queryKey is
   invalidated, triggering an automatic refetch. See `src/hooks/useData.ts`.
5. **Vendor chunks are configured, and asserted.** Vite 8 bundles with Rolldown,
   which dropped Rollup's object form of `manualChunks`. Four vendor chunks
   (`react`, `recharts`, `supabase`, `zod`) are carved out in `vite.config.ts`
   under `build.rolldownOptions.output.codeSplitting`, matching module paths by
   **regular expression** — a form that fails *silently* when the pattern is
   wrong, where the old one errored on a typo. `e2e/bundle.spec.ts` is what
   makes it loud; it asserts each chunk still exists and that zod stays out of
   the entry chunk. Run the e2e suite after touching that config, not just the
   build. Groups are ordered, first match wins, and `react` is deliberately
   last.

---

## Full Documentation

See `/docs/` for platform guides (GitHub, Vercel, Supabase), architecture deep-dives,
and troubleshooting. Start at `docs/README.md`.
