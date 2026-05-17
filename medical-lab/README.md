# LabCore LIMS

A general-purpose Medical Laboratory Information Management System (LIMS) demo built with React 18, TypeScript, Vite, Tailwind CSS, TanStack React Query, and Recharts.

## Features

- **13 modules**: Dashboard, Patients, Referring Providers, Test Catalog, Orders, Specimens, Results, Instruments, Reagents, Staff, Billing (Invoices + Claims), Quality Control, Login
- **Demo mode**: fully functional with no backend — all data stored in localStorage (`lc-mock-db`)
- **Supabase-ready**: wire up `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` and every hook switches to live Postgres automatically
- **Dark / light / system theme** toggle in the top bar
- **Responsive**: sidebar collapses on mobile with a bottom nav bar

## Quick start (demo mode)

```bash
cd medical-lab
npm install
npm run dev          # → http://localhost:5173
```

Click **Explore Demo** on the login screen. No credentials required.

## Environment variables (live backend)

Copy `.env.example` → `.env.local` and fill in your Supabase project values:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

When both variables are present at build time, the app routes all data calls to Supabase instead of localStorage. Run the four migration files in `supabase/migrations/` against your project before going live.

## Database migrations

Apply in order via the Supabase dashboard SQL editor or the Supabase CLI:

| File | Contents |
|------|----------|
| `20260517000100_core_entities.sql` | patients, providers, staff |
| `20260517000200_orders_specimens_results.sql` | test_catalog, orders, order_items, specimens, test_results |
| `20260517000300_lab_operations.sql` | instruments, reagents, invoices, insurance_claims, qc_runs |
| `20260517000400_enable_rls.sql` | Row-Level Security + dashboard indexes |

## Scripts

```bash
npm run dev          # Vite dev server → :5173
npm run build        # Production build → dist/
npm run typecheck    # TypeScript check (no emit)
npm run lint         # ESLint (zero warnings policy)
npm run preview      # Preview production build locally
```

## Deploy (Vercel)

Create a **new Vercel project** with **Root Directory** set to `medical-lab/`. Add your Supabase environment variables in the Vercel project settings. The cemetery app at the repo root gets its own separate Vercel project unchanged.

## Tech stack

- **React 18** + **TypeScript 5** (strict mode)
- **Vite 4** (dev server + build)
- **Tailwind CSS 3** (utility classes + CSS variable token system)
- **TanStack React Query v5** (server-state management + cache invalidation)
- **Recharts 2** (dashboard charts)
- **Zod 3** (form schema validation)
- **Lucide React** (icons)
- **React Router DOM 6** (client-side routing)
- **Supabase JS v2** (Postgres auth + data — optional, dormant in demo mode)

## Notes

This is a generic demo template. Real HIPAA/HITECH compliance (encryption-at-rest, BAAs, audit logging, access controls beyond RLS) is **out of scope** and must be added before handling actual PHI in production.
