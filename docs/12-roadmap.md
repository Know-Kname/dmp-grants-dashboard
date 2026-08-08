# 12 — Roadmap

> **TL;DR:** The app is in active use and stable. The most impactful near-term improvements are an audit log, role-based access control, report exports, and a content security policy. Longer-term, offline support and Azure Key Vault integration would make the app enterprise-grade.

---

## Table of Contents
- [Current state](#current-state)
- [Known limitations](#known-limitations)
- [Near-term improvements (high value, low effort)](#near-term-improvements-high-value-low-effort)
- [Medium-term features (significant effort, significant value)](#medium-term-features-significant-effort-significant-value)
- [Long-term / architectural improvements](#long-term--architectural-improvements)
- [Performance notes](#performance-notes)
- [Security roadmap](#security-roadmap)
- [Ideas that were considered and rejected](#ideas-that-were-considered-and-rejected)

---

## Current state

The DMP CMS is a working application managing data for three Detroit Memorial Park cemetery locations:

- **DMP East** — Detroit (main campus)
- **DMP West** — Detroit
- **Gracelawn** — Beverly Hills, MI

**Working modules:**
- ✅ Dashboard — overview stats, location cards, recent activity, locations map
- ✅ Burials — burial record management + public QR-code memorial pages
- ✅ Work Orders — maintenance/service order tracking
- ✅ Contracts — pre-need/at-need contracts, line items, payment schedules
- ✅ Customers — family/customer record management
- ✅ Vendors — supplier records linked to Accounts Payable
- ✅ Inventory — cemetery property/plot inventory
- ✅ Financial — AR/AP/deposits across 3 tabs, revenue charts
- ✅ Grants — grant/benefit opportunity tracking (this repo's namesake)
- ✅ Cemeteries — Cemetery → Section → Lot → Grave hierarchy + interactive plot map
- ✅ AI Assistant — Gemini 2.5 Pro via OpenRouter, proxied server-side through `/api/chat`
- ✅ Authentication — Supabase Auth (email/password + Google OAuth, JWT, session persistence)
- ✅ Password reset — self-service `/forgot-password` → emailed link → `/reset-password` (12-char minimum)
- ✅ Dark/Light/System Mode — full theme toggle
- ✅ Responsive Layout — iPad-primary, works on mobile and desktop
- ✅ Form validation — Zod + `useForm` on every CRUD page except `Cemeteries.tsx`
- ✅ CI/CD — 8 GitHub Actions workflows + Vercel automatic deployments

---

## Known limitations

### 1. No audit log

When a burial record is edited, no one knows who changed what and when. For a funeral home — where data accuracy has legal and emotional weight — this is a meaningful gap.

**Impact:** Medium-high. Data changes happen frequently. No recovery path if something is changed incorrectly.

**Fix:** Add a `change_log` table in Supabase with a PostgreSQL trigger on every table that matters:
```sql
CREATE TABLE change_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  operation TEXT NOT NULL,   -- INSERT, UPDATE, DELETE
  user_id UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  old_values JSONB,
  new_values JSONB
);

CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO change_log (table_name, row_id, operation, old_values, new_values)
  VALUES (TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP, row_to_json(OLD), row_to_json(NEW));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply to every table that needs an audit trail:
CREATE TRIGGER burials_audit AFTER INSERT OR UPDATE OR DELETE ON burials
  FOR EACH ROW EXECUTE FUNCTION log_changes();
```

### 2. No role-based access control (RBAC)

All authenticated users share the same database-level permissions — the single
`auth_all` RLS policy present on every table (see `RUNBOOK.md`'s "RLS Policy
Reference" and [docs/06-supabase.md](06-supabase.md)) grants full read/write to any
authenticated session. **This is a deliberate choice, not an oversight** — the
migration that added it explicitly frames DMP CMS as a closed, staff-only tool where
every authenticated session is assumed to be a credentialed employee, with per-role
restriction meant to layer on top of `auth_all` later if the trust model changes.
It's listed here because that trade-off is worth revisiting as the team grows: a
front-desk staff member can currently delete a burial record, and a temporary
contractor can view all financial data, with nothing at the database layer
distinguishing them.

**Impact:** Medium. Fine for a small single-location team; becomes a real gap as headcount or location count grows.

**Fix:** `src/types/index.ts`'s `User.role` already exists client-side (from Supabase
`user_metadata`) with no database enforcement behind it yet. Layer a more restrictive
policy for specific operations on top of `auth_all` — don't replace it, per
`RUNBOOK.md`'s documented migration path:
```sql
-- Only admins can delete
CREATE POLICY "admin_delete" ON burials
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
```

On the frontend, the `useAuth()` hook returns `currentUser.role` — gate UI elements with this:
```tsx
const { currentUser } = useAuth()
{currentUser?.role === 'admin' && <Button variant="destructive">Delete</Button>}
```

### 3. ~~OpenRouter key exposed in frontend bundle~~ ✅ Done

Resolved: `api/chat.ts` (a Vercel Edge Function) proxies OpenRouter server-side, and
the key lives in the server-only `OPENROUTER_API_KEY` env var — never shipped to the
browser. See [docs/09-security.md](09-security.md). (The dev-only
`VITE_OPENROUTER_API_KEY` fallback still exists for local `npm run dev` without
`vercel dev`, but it's dead-code-eliminated from production builds.)

### 4. No offline support

If the internet is unavailable (bad Wi-Fi, network outages at the cemetery), the app stops working. For a business that operates continuously, this is a potential issue.

**Fix:** Service worker with IndexedDB offline storage. React Query supports offline-first patterns with background sync. Complex to implement correctly.

### 5. No bulk print/export functionality

A narrow print capability already exists: Burials' memorial-QR modal and the public
`/memorial/:id` page both support `window.print()` with `@media print` CSS rules
(`src/styles/index.css`) for printing a single QR code or memorial as a marker insert.
What's still missing is anything at the *list* level — staff can't export a table
(Burials, Work Orders, Customers, etc.) to CSV, or print a formatted burial
certificate or financial report.

**Fix:** A CSV export button per list page (the data's already sitting in React
Query's cache — no extra Supabase query needed) and a dedicated print stylesheet per
record-detail view would cover most real requests. `@react-pdf/renderer` is only
worth it for a specific formatted document (e.g. a burial certificate); plain
`window.print()` + `@media print` is enough for "print this table."

### 6. ~~Large JavaScript bundle~~ ⚠️ Partially done

Page-level code splitting is done: every route except `Dashboard`/`Login` is
`React.lazy()`-loaded (`src/App.tsx`), and `vite.config.ts` further splits
`recharts`, `@supabase/supabase-js`, and the React core into their own vendor chunks.

**What's still large:** `npm run build` warns about one chunk over the 500KB
threshold — `maplibre-gl`, roughly 1MB pre-gzip (285KB gzipped), shared by
`CemeteryMap` and `LocationsMap`. It's already lazy-loaded (only downloads when a
user opens Cemeteries or the Dashboard's map card), so this matters far less than an
unsplit bundle would, but a lighter map library or a load-on-interaction pattern
would still help first paint on those two specific views.

### 7. Data-integrity gaps found in the most recent schema review

Two issues worth tracking, neither fixed in this pass since both touch live
production DDL rather than application code (full detail in
[docs/06-supabase.md](06-supabase.md)):
- **`updated_at` is never refreshed on UPDATE**, for any table, except the 3 pg_cron
  overdue-sweep jobs — and only for that one status transition. Every other edit made
  through the app (recording a payment, editing a work order) leaves `updated_at`
  sitting at its `created_at` value. Needs a `BEFORE UPDATE` trigger.
- **11 of 16 tables have no `CREATE TABLE` statement anywhere in `supabase/migrations/`**
  — only `cemeteries`/`sections`/`lots`/`graves`/`payment_schedule` have full DDL
  history in this repo; the rest (customers, contracts, the financial tables, etc.)
  predate the migrations folder. The live schema currently can't be rebuilt from this
  repo alone; a `supabase db pull` capturing the missing base tables as a migration
  would close the gap.

---

## Near-term improvements (high value, low effort)

### Wire up the existing Pagination component

`src/components/Pagination.tsx` — the `<Pagination>` component and its `usePagination`
hook — is fully built (page-size selector, first/prev/numbered/next/last controls,
already styled to match the rest of the UI) but isn't imported by any page today.
Every list page currently renders its entire result set with no paging, which is a
real scaling concern given DMP's multi-decade operating history. Wiring it into the
highest-traffic pages (Burials, Customers) is close to free, since the component
already exists and just needs a query call site.

### Export to CSV/Excel

Almost every table page (Burials, Work Orders, Customers, etc.) could add a simple CSV download button. The data is already loaded in React Query's cache — no additional Supabase query needed.

```ts
function exportToCSV(data: Record<string, unknown>[], filename: string) {
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(row => Object.values(row).join(','))
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  // ... trigger download
}
```

### Search across all records

Currently each page has its own filter. A global search bar in the topbar that searches across burials + customers + work orders would save significant time.

Implementation: Supabase's full-text search (`to_tsvector` + `to_tsquery`) or simple ILIKE queries across key fields.

### Keyboard shortcuts

Power users would benefit from keyboard shortcuts: `N` for "New [record]", `Ctrl+S` to save, `Esc` to close modal, `/` to focus search. The browser doesn't need any framework support — just `useEffect` + `window.addEventListener('keydown', ...)`.

### Better date pickers

The current date inputs use the browser's native `<input type="date">`, which has inconsistent UI across browsers. A custom date picker component would improve the experience, especially for date-of-death entries which appear frequently.

### Email notifications

When a work order status changes to "Completed", automatically email the relevant family. Supabase has a built-in email service and can trigger serverless functions on database changes.

---

## Medium-term features (significant effort, significant value)

### ~~Cemetery map integration~~ ✅ Done

Shipped in v2.0.0: `src/components/CemeteryMap.tsx` (MapLibre GL, not Leaflet as
originally sketched here) renders an interactive plot map with satellite/street
toggle, color-coded grave-status markers, GPS drop-pin capture, "find nearest
available" plot, and grave-number search — reached via `/cemeteries`. A second,
separate map (`LocationsMap.tsx`) shows the 3 DMP sites on the Dashboard. What's
*not* built: a map-marker click doesn't open a burial-assignment form directly — the
Cemeteries page's grave detail is a separate drill-down from the map, not a popup
form. That specific connection is the one piece of the original vision left.

### Document management

Funeral homes generate a lot of documents: death certificates, burial permits, pre-need contracts, maintenance records. Currently there's no way to attach documents to records.

Implementation: Supabase Storage (file storage service, included with Supabase) + a file upload component. Associate documents with records via a `documents` table with a `record_id` foreign key.

### Customer portal

A separate, minimal web interface where families can:
- View burial records for their family members
- Access documents (contracts, maps, receipts)
- Submit service requests

This would be a separate React app (or a new route group in the same app) with different RLS policies — families can only see their own records.

### Reporting dashboard

The Financial page has basic charts. A more comprehensive reporting module would include:
- Month-over-month burial volume trends
- Work order completion rates
- Revenue per location
- Grant utilization summary
- Exportable as PDF

### Mobile app (React Native)

The web app is responsive and works on mobile, but a native app would allow:
- Push notifications for work orders
- Camera integration for grave photo documentation
- Offline-first operation with background sync

React Native with Expo + the same Supabase backend would share most of the data access logic.

---

## Long-term / architectural improvements

### ~~Server-side AI proxy~~ ✅ Done

Shipped as `api/chat.ts` — the real route is `/api/chat`, not `/api/ai-chat` as
originally sketched here. The browser calls `/api/chat`; the Edge Function calls
OpenRouter with the secret `OPENROUTER_API_KEY`, which is never shipped to the
browser. What the original sketch didn't anticipate: the shipped version also has no
caller authentication at all (not just "the key is hidden" — literally anyone who can
reach the URL can call it) and now does basic request-size validation as a stopgap.
See [docs/09-security.md](09-security.md#future-security-improvements) for that
follow-up item.

### Azure Key Vault

For enterprise deployments or when regulatory compliance is required, replace environment variables with Azure Key Vault:

1. Secrets are stored in Key Vault, not in Vercel or `.env` files
2. The app authenticates to Key Vault using Azure Managed Identity (no password needed)
3. Key rotation happens in Key Vault without any code or deployment changes
4. Full audit log of who accessed what secret and when

This requires adding an Azure subscription and a small backend (since Key Vault can't be accessed directly from the browser without leaking credentials).

### Real-time collaboration

If multiple staff members use the app simultaneously, they currently have no awareness of each other's activity. Supabase has a built-in real-time engine (WebSocket subscriptions) that can push database changes to all connected clients:

```ts
const subscription = supabase
  .channel('burials-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'burials' }, (payload) => {
    queryClient.invalidateQueries({ queryKey: ['burials'] })
  })
  .subscribe()
```

This would make the app collaborative — a change saved by one staff member appears on another's screen within seconds.

### Staging environment

Currently there's no separate staging database. Testing changes that involve schema migrations requires doing them on the production database. 

Setup:
1. Create a second Supabase project for staging
2. Create a `staging` branch in the repo
3. Configure Vercel Preview deployments to use the staging Supabase project
4. All database migrations are tested on staging before running on production

---

## Performance notes

### Current chunk size warning

`npm run build` still shows a chunk-size warning, but the picture has changed since
this was written: `vite.config.ts` already splits `recharts` and
`@supabase/supabase-js` into their own vendor chunks, and every page except
Dashboard/Login is lazy-loaded (see [Known limitations #6](#known-limitations) above).
The chunk actually over the 500KB threshold today is `maplibre-gl` (~1MB pre-gzip),
shared by `CemeteryMap` and `LocationsMap`.

**To check current bundle size:**
```bash
npm run build
# Look for lines like:
# dist/assets/index-abc123.js   487.23 kB │ gzip: 148.43 kB
```

**To analyze what's in the bundle:**
```bash
# Vite 8 bundles with Rolldown, not Rollup, so the long-standing
# rollup-plugin-visualizer advice no longer applies here.
npx vite build --mode production
# Rolldown can emit its own report instead:
#   build: { rolldownOptions: { output: { legalComments: 'none' } } }
# or set `build.sourcemap: true` and inspect the map.
```

The four named vendor chunks are configured in `vite.config.ts` under
`build.rolldownOptions.output.codeSplitting`, and `e2e/bundle.spec.ts` asserts
they survive — including that zod stays out of the entry chunk.

### ~~React Query cache settings~~ ✅ Already tuned

This section originally suggested raising `staleTime` from React Query's `0` default.
`src/lib/query.tsx` already sets `staleTime: 5 * 60 * 1000` (5 minutes) and
`gcTime: 30 * 60 * 1000` (30 minutes), plus a retry policy that skips retrying
auth/validation/not-found errors. Nothing further needed here.

---

## Security roadmap

The maintained, current-priority version of this list lives in
[docs/09-security.md](09-security.md#future-security-improvements) — kept in one
place rather than duplicated here, since an independently-drifting second copy is
exactly how "server-side AI proxy" sat in this list for a full release cycle after it
had already shipped. As of this doc's last update, the two highest-value remaining
items are **CSP** and **authenticating (or rate-limiting) `/api/chat`**; **audit log**
and **RBAC** are the two highest-value non-header items.

---

## Ideas that were considered and rejected

### Express backend

The repo previously had a full Express server (`server/`) from an earlier architecture. It was deleted because the Supabase + RLS model makes a custom backend redundant for this use case. Adding it back would add complexity, hosting cost, and another thing to maintain, with no benefit over the current direct-to-Supabase approach.

### MongoDB / Firebase

Considered during the early architecture phase. Supabase was chosen because:
- PostgreSQL is better for relational data (burial records link to customers, contracts link to burials, etc.)
- RLS provides proper row-level authorization that MongoDB/Firebase don't match
- Real SQL lets you write complex queries and reports
- Supabase Auth is simpler than Firebase Auth for a small team

### Electron desktop app

Cemetery offices use specific desktop machines. A desktop app would allow offline-first operation. Rejected because:
- Web apps are simpler to update (no installer distribution)
- iPad compatibility is more useful than desktop-native features
- Electron adds significant complexity and a security surface area

### Custom design component library (Radix, shadcn/ui)

Could replace the hand-rolled `ui.tsx` components. Rejected because:
- The current components are simple enough to maintain directly
- Adding a dependency for components adds upgrade burden
- The DMP branding requirements are specific enough that a generic library would need heavy customization anyway

---

← [11 Design System](11-design-system.md)
