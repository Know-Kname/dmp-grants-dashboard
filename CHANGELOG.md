# Changelog

All notable changes to the DMP Cemetery Management System are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed
- **Grant creation failed 100% of the time.** `useCreateGrant` wrote a `created_by`
  column that did not exist on `grants`. A migration adds it. Verified against the
  live schema, which was also the open question left in #74.
- **Creating any record while signed out or in demo mode failed.** `uid()` returned
  the string `'unknown'` for a `uuid` column, which Postgres rejected outright. It
  now returns `null` and the column is simply omitted, affecting work orders and
  deposits as well as grants.
- **Receivables and payables could never be created.** `accounts_receivable.status`
  and `accounts_payable.status` are `NOT NULL` with no default, but both create
  hooks omitted `status` and never supplied it. Both now open at `pending`.
- **Dates displayed and prefilled a day off.** `formatDate` and `formatDateForInput`
  each had a mirror-image timezone bug; both now route through one local-date parser.
- **AI replies silently dropped tokens** whose SSE frame straddled a network chunk
  boundary.
- **Dark mode**: toast icon chips rendered with no background (the referenced `950`
  shades were never declared in the Tailwind config), and the `ErrorBoundary` crash
  screen ignored the theme entirely.
- **Work order creation failed 100% of the time** — the same class of bug as grants:
  `work_orders.status` is `NOT NULL` with no database default, and the create form has
  no status field. `useCreateWorkOrder` now omits `status` from its input and opens
  every work order at `pending`.
- **Two more schemas didn't match their own forms**, so wiring them up unchanged would
  have rejected valid input: `workOrderFormSchema.assignedTo` was declared as a `uuid`
  for what is actually a free-text staff name field; `burialFormSchema` required
  `plotLocation` (a derived field the form never collects — it's built from
  section/lot/grave at submit) and had no `memorialPublished` (a real field the form
  does have).
- **`contractFormSchema` didn't describe the form it validates** — it required
  `paymentPlan` and `items`, neither of which is a form input (the plan renders
  read-only; line items are held in separate state and merged at submit), and it
  omitted `status`, a real field. Now describes the six fields the form actually has.
- **The "Deploy Supabase Migrations" workflow failed on every run in its history** —
  `supabase/setup-cli` was pinned to a commit SHA that doesn't correspond to any real
  commit in that repo. Re-pinned to the `v1` tag; `grants.created_by` (above) was
  applied directly via the Supabase MCP as a result, then reconciled into the migration
  history the same way three earlier MCP-applied migrations already were.
- Dashboard's "100 Years / 1925 – 2025" milestone banner was a hardcoded literal that
  had already gone stale; now computed from `COMPANY.established`.
- `CemeteryMap`'s "no available graves" case used a blocking `alert()` instead of the
  toast system every other user-facing message in the app goes through.

### Added
- **Generated Supabase schema types** (`src/types/database.ts`) and a typed client,
  so writing a nonexistent column is now a compile error rather than a runtime 400.
- **Working Zod form validation.** `schemas.ts` and `useForm.ts` existed but had zero
  importers; two defects that made `useForm` unusable are fixed and Grants is wired
  up as the reference conversion.
- **Shared page components** — `PageError`, `StatCard`, `TABLE_HEAD_CLASS`.
- Tests for the date-formatting edge cases and both `useForm` defects. Test runs pin
  `TZ` to `America/Detroit` so the timezone cases are actually exercised.
- **Server-side AI proxy** — `/api/chat` Vercel Edge Function holds the OpenRouter
  key in a server-only `OPENROUTER_API_KEY` env var. The key is no longer shipped
  in the browser bundle; the dev-direct fallback is dead-code-eliminated from
  production builds.
- **Contract line items now persist** — `useCreateContract` / `useUpdateContract`
  insert and sync `contract_items` rows (previously the nested `items` were dropped).
- **Form validation now covers every CRUD page except one.** Customers, Inventory,
  Work Orders, Burials, Vendors, Contracts, and Financial's three create forms are all
  converted to the `useForm` + Zod pattern (previously only Grants was). Financial's
  two payment-recording forms stay on plain `useState` by design — they capture a
  single amount against an existing invoice, not a new record. `Cemeteries.tsx`'s four
  forms are the one remaining gap, and are documented as such in `CLAUDE.md` rather
  than left silently inconsistent.
- **`vendorFormSchema`** — Vendors had no validation schema at all before this.
- Six tests for `useForm`, covering the two defects fixed alongside it: field
  validation against a `.refine()`d schema silently no-op'ing (`ZodEffects` has no
  `.shape`), and form values that are a coerced string on the way in but a number on
  the way out.
- Toast feedback on create/update/delete for Burials, Vendors, Work Orders, and
  Contracts, matching the pattern already used on Customers/Inventory/Grants/Financial.
- Basic request-size validation on `/api/chat` (message count and per-message length
  caps) — a partial mitigation for the endpoint having no authentication at all; see
  `docs/09-security.md` for the full gap.
- `Strict-Transport-Security` and a scoped `Permissions-Policy` response header
  (`geolocation=(self)` for the cemetery map's GPS capture; camera/microphone/payment
  blocked, since nothing in the app uses them).

### Changed
- **TypeScript strict mode enabled** (`strict: true`). The Supabase result helper
  now throws on a null/undefined payload instead of masking it with `!`.
- **Case transformers guard against circular references** via a `WeakSet`, so a
  cyclic object no longer overflows the stack.
- `tsconfig.json`: `noUnusedLocals` and `noUnusedParameters` turned on.
- `.eslintrc.cjs`: `no-explicit-any` and `ban-ts-comment` raised from `off` to
  `error`, matching what `CLAUDE.md` already claimed as policy.
- Extracted the duplicated ESRI satellite map style out of `CemeteryMap.tsx` and
  `LocationsMap.tsx` into a shared `src/lib/mapStyles.ts`.
- Full documentation pass across README/CONTRIBUTING/RUNBOOK/`docs/`: fixed the GitHub
  remote URL (the repo was renamed from `dmpgrants` to `dmp-grants-dashboard` without
  updating any doc that referenced it), corrected several pages describing RLS
  policies, environment variables, and CI workflows that no longer matched the shipped
  code, removed two claims of a mock-data "demo tour" that demo mode has never
  provided, and removed two real user credentials that had been committed to `docs/`
  in plaintext.

### Removed
- Roughly 1,000 lines of dead code, each verified unreferenced first: 9 unused
  data hooks, 6 unused `DEMO_*` datasets, the `NetworkError`/`TimeoutError`
  hierarchy (never constructed, so its retry branch could never run), the unused
  `Alert`/`Divider`/`Skeleton`/`Tooltip` components, and a duplicate brand-colour
  block in `index.css` with no consumers.
- Duplicated constants: `AIAssistant` re-declared the brand hexes, and `gemini.ts`
  restated all three cemetery addresses instead of reading `config/company.ts`.
- Stale `vitest.config.server.ts` and the dead Vite dev proxy to the removed
  Express backend (`/api → localhost:3000`).
- Unused dependencies `gsap` and `@tailwindcss/typography` — zero imports of either
  anywhere in `src/`, and the Tailwind plugin was never registered in
  `tailwind.config.js` (`plugins: []`).

---

## [2.0.0] — 2026-05-04

### Added
- **Vendors module** — full CRUD for vendor records linked to AP/AR ledgers
- **Cemeteries module** — 4-level hierarchy: Cemetery → Section → Lot → Grave
- **Cemetery Map** — MapLibre GL JS v5 interactive map with satellite/street toggle,
  grave status markers, GPS drop-pin, find-nearest-available plot, search
- **Dashboard Locations Map** — 3 DMP site cards with ESRI World Imagery satellite tiles
- **Memorial Pages** — public `/memorial/:id` route for family QR code access,
  museum-quality design with Fraunces typography
- **Payment Schedule** — contract installment tracking with scheduled status, paid date, notes
- **Google OAuth** — `signInWithOAuth` via Supabase Auth (Google provider)
- **pg_cron jobs** — nightly overdue sweeps for accounts_receivable, accounts_payable,
  payment_schedule (3 jobs scheduled at 01:00 UTC)

### Changed
- **Login page** — museum-monograph redesign with Green-Wood lodestar aesthetic,
  Fraunces display serif, real DMP photography, split-panel layout
- **Typography** — Fraunces + Source Serif 4 replace Inter as display fonts
- **Sidebar branding** — real DMP logo and grounds photography integrated
- **Favicon/manifest** — corrected to DMP forest green (`#1a3d2b`), removed broken refs

### Database
- New tables: `cemeteries`, `sections`, `lots`, `graves`, `payment_schedule`
- New columns: `burials.grave_id`, `burials.memorial_published`,
  `contract_items.inventory_id`, `contract_items.quantity`
- RLS enabled on all 19 public tables (12 previously unprotected tables secured)

---

## [1.3.0] — 2026-04-29

### Added
- **DMP branding** — dark forest-green sidebar (`#1a3d2b`), DMP gold accents (`#c49a2c`)
- **AI Assistant** — Gemini 2.5 Pro via OpenRouter streaming chat, cemetery-specific system prompt
- **Real photography** — 9 DMP grounds and facility photos integrated throughout
- **Toast system** — success/error/warning/info notifications

### Changed
- Navigation sidebar redesigned with DMP brand identity
- Login page updated with DMP photography and branding

---

## [1.2.0] — 2026-04-29

### Added
- **Dashboard charts** — Recharts: area chart (revenue trend), bar chart (work orders),
  donut chart (burial status), bar chart (contract types)
- **KPI strip** — 4 stat cards with trend indicators (revenue, burials, work orders, contracts)
- **Mobile navigation** — "More" drawer for overflow nav items on small screens

### Changed
- Dashboard rebuilt from static cards to live data-driven charts

---

## [1.1.0] — 2026-04-29

### Added
- **Customers page** — family record management with search and CRUD
- **Inventory page** — cemetery property/plot inventory
- **Burials page** — burial record management (create, read, update)
- **Contracts page** — pre-need and at-need contract management
- **Financial page** — revenue tracking, AR/AP ledgers, charts
- **Work Orders page** — maintenance and service order tracking with status workflow

---

## [1.0.0] — 2026-02-09

### Changed
- Auth migrated from custom JWT to **Supabase Auth** (email/password)
- Removed Express backend (`server/`) — frontend calls Supabase directly
- GitHub Actions CI/CD pipeline added (typecheck, lint, build)
- Vercel deployment configured

---

## [0.1.0] — 2025-11-14

### Added
- Initial React + TypeScript + Vite scaffold
- Tailwind CSS design system with CSS variable tokens
- React Router DOM v6 routing
- Supabase client initialization
- Demo mode with mock data
- Basic Dashboard, Grants, Login pages

[Unreleased]: https://github.com/Know-Kname/dmp-grants-dashboard/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Know-Kname/dmp-grants-dashboard/compare/v1.3.0...v2.0.0
[1.3.0]: https://github.com/Know-Kname/dmp-grants-dashboard/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Know-Kname/dmp-grants-dashboard/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Know-Kname/dmp-grants-dashboard/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Know-Kname/dmp-grants-dashboard/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/Know-Kname/dmp-grants-dashboard/releases/tag/v0.1.0
