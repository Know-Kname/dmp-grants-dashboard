# Changelog

All notable changes to the DMP Cemetery Management System are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Server-side AI proxy** — `/api/chat` Vercel Edge Function holds the OpenRouter
  key in a server-only `OPENROUTER_API_KEY` env var. The key is no longer shipped
  in the browser bundle; the dev-direct fallback is dead-code-eliminated from
  production builds.
- **Contract line items now persist** — `useCreateContract` / `useUpdateContract`
  insert and sync `contract_items` rows (previously the nested `items` were dropped).

### Changed
- **TypeScript strict mode enabled** (`strict: true`). The Supabase result helper
  now throws on a null/undefined payload instead of masking it with `!`.
- **Case transformers guard against circular references** via a `WeakSet`, so a
  cyclic object no longer overflows the stack.

### Removed
- Stale `vitest.config.server.ts` and the dead Vite dev proxy to the removed
  Express backend (`/api → localhost:3000`).

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

[Unreleased]: https://github.com/Know-Kname/dmpgrants/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Know-Kname/dmpgrants/compare/v1.3.0...v2.0.0
[1.3.0]: https://github.com/Know-Kname/dmpgrants/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Know-Kname/dmpgrants/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Know-Kname/dmpgrants/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Know-Kname/dmpgrants/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/Know-Kname/dmpgrants/releases/tag/v0.1.0
