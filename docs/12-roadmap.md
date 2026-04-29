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
- ✅ Dashboard — overview stats, location cards, recent activity
- ✅ Burials — burial record management (create, read, update)
- ✅ Work Orders — maintenance/service order tracking
- ✅ Contracts — pre-need and at-need contract management
- ✅ Customers — family/customer record management
- ✅ Inventory — cemetery property/plot inventory
- ✅ Financial — revenue tracking, reports, charts
- ✅ Grants — grant application tracking
- ✅ AI Assistant — Gemini 2.5 Pro chat (via OpenRouter), cemetery-specific context
- ✅ Authentication — Supabase Auth (email/password, JWT, session persistence)
- ✅ Demo Mode — mock data walkthrough without real credentials
- ✅ Dark/Light Mode — full theme toggle
- ✅ Responsive Layout — iPad-primary, works on mobile and desktop
- ✅ CI/CD — GitHub Actions + Vercel automatic deployments

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

All authenticated users have the same permissions. A front-desk staff member can delete a burial record. A temporary contractor can view all financial data.

**Impact:** Medium. Currently a single-location team, but as the organization grows this becomes a problem.

**Fix:** Add a `role` column to the `users` table (`admin`, `manager`, `staff`, `read_only`) and write role-aware RLS policies:
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

### 3. OpenRouter key exposed in frontend bundle

The AI assistant API key (`VITE_OPENROUTER_API_KEY`) is baked into the compiled JavaScript. Anyone can extract it from browser DevTools. For an internal-only tool, the risk is low (but not zero).

**Fix:** Create a Vercel Edge Function that proxies the OpenRouter request server-side. The key lives in a server-side env var (not `VITE_`-prefixed). See [Long-term improvements](#long-term--architectural-improvements).

### 4. No offline support

If the internet is unavailable (bad Wi-Fi, network outages at the cemetery), the app stops working. For a business that operates continuously, this is a potential issue.

**Fix:** Service worker with IndexedDB offline storage. React Query supports offline-first patterns with background sync. Complex to implement correctly.

### 5. No print/export functionality

Staff often need to print burial certificates, work order summaries, or financial reports. Currently there is no "print" or "export to PDF/CSV" feature.

**Fix:** Add a print-friendly CSS stylesheet (`@media print`) and a PDF generation step using the browser's `window.print()` or a library like `@react-pdf/renderer`.

### 6. Large JavaScript bundle

The initial JS bundle is around 400–600KB (before gzip). This is within acceptable range but could be improved with code splitting.

**Fix:** Use React.lazy() + Suspense for page-level code splitting:
```tsx
const Burials = lazy(() => import('./pages/Burials'))
const Financial = lazy(() => import('./pages/Financial'))
```
Each page would only load when navigated to, reducing initial load time significantly. Recharts is a large dependency that only Financial needs — keeping it in a lazy-loaded chunk would help.

---

## Near-term improvements (high value, low effort)

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

### Cemetery map integration

The three DMP cemetery maps are available as PDFs (from the DMP website). A proper implementation would:
1. Convert PDF maps to SVG or PNG tile layers
2. Render them as an interactive canvas (using Leaflet.js or similar)
3. Link plot numbers in the map to burial records
4. Allow clicking a plot to view or assign a record

This would be the most visually impressive feature and directly useful for staff guiding families.

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

### Server-side AI proxy (Vercel Edge Function)

Move the OpenRouter API call to a Vercel Edge Function:

```ts
// api/ai-chat.ts (Vercel Edge Function)
export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  const { messages } = await req.json()
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,  // server-side, not VITE_
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'google/gemini-2.5-pro', messages, stream: true }),
  })
  return response  // stream back to browser
}
```

The browser calls `/api/ai-chat`, the Edge Function calls OpenRouter with the secret key. The key is never in the browser bundle. 

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

Running `npm run build` shows a warning about chunk size. The main offenders are:
- `recharts` — only used on the Financial page, but included in the main bundle
- `@supabase/supabase-js` — necessary, but large

**To check current bundle size:**
```bash
npm run build
# Look for lines like:
# dist/assets/index-abc123.js   487.23 kB │ gzip: 148.43 kB
```

**To analyze what's in the bundle:**
```bash
npm install --save-dev rollup-plugin-visualizer
# Add to vite.config.ts plugins:
# visualizer({ open: true })
# Then run: npm run build
# A browser window opens showing the bundle treemap
```

### React Query cache settings

Current default: `staleTime: 0` (data is always considered stale). For a business app where data doesn't change every second, increasing staleTime reduces Supabase reads:

```ts
// In src/lib/query.tsx, when creating the QueryClient:
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes — don't refetch if data is fresh
      gcTime: 10 * 60 * 1000,    // 10 minutes — keep unused data in cache
    }
  }
})
```

This would significantly reduce Supabase API calls on pages the user navigates back to frequently.

---

## Security roadmap

In priority order (see [docs/09-security.md](09-security.md) for full details):

1. **Content Security Policy header** — Add to `vercel.json`. Most impactful browser-side security improvement. Requires testing to avoid breaking Supabase/OpenRouter connections.

2. **Audit log** — Add `change_log` table with PostgreSQL triggers. Especially important for burial records.

3. **RBAC** — Role column in users table + role-aware RLS policies.

4. **Server-side AI proxy** — Move OpenRouter key out of frontend bundle.

5. **IP restrictions** — Allow-list known office IP addresses in Supabase.

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
