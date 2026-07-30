# 02 — Architecture

> **TL;DR:** React SPA. User navigates → React Router picks the page → React Query fetches data from Supabase → component renders. Auth is Supabase email/password with a local demo-mode bypass. No Express backend. All security lives in Supabase Row-Level Security policies.

---

## Table of Contents
- [High-level picture](#high-level-picture)
- [Data flow walkthrough](#data-flow-walkthrough)
- [Routing](#routing)
- [Authentication and authorization](#authentication-and-authorization)
- [State management](#state-management)
- [The component library (ui.tsx)](#the-component-library-uitsx)
- [Key library files](#key-library-files)
- [TypeScript types](#typescript-types)
- [Testing](#testing)
- [What "SPA" means and why it matters](#what-spa-means-and-why-it-matters)

---

## High-level picture

```
Browser
  │
  ├── React Router         (decides which page to show based on URL)
  │     └── Layout.tsx     (persistent sidebar + topbar + mobile nav)
  │           └── <page>   (Dashboard, Burials, Inventory…)
  │
  ├── React Query          (fetches and caches data from Supabase)
  │     └── useData.ts     (all query/mutation hooks for every module)
  │
  ├── Supabase JS client   (authenticated requests to Supabase cloud)
  │     └── supabase.ts
  │
  └── AuthProvider         (login state, session, demo mode)
        └── auth.tsx
```

No server of our own. No API layer. The browser talks directly to Supabase.

---

## Data flow walkthrough

Follow what happens when a user opens the Burials page and creates a new burial record:

```
1. User clicks "Burials" in the sidebar
   → React Router updates the URL to /burials
   → <Burials /> component mounts

2. useBurials() hook (in hooks/useData.ts) triggers
   → React Query checks its cache
   → Cache miss → calls Supabase JS client
   → Supabase client sends authenticated GET to:
     https://[project].supabase.co/rest/v1/burials
   → Supabase checks RLS policy: "is this user allowed to SELECT?"
   → Returns rows as JSON

3. React Query stores the result in its cache (stale for 5 minutes)
   → Component re-renders with data
   → Table appears on screen

4. User fills in the New Burial form and clicks "Create"
   → useCreateBurial() mutation fires
   → Calls Supabase client with a POST/INSERT
   → Supabase checks RLS policy: "is this user allowed to INSERT?"
   → Row is created in the database

5. On success, React Query invalidates the 'burials' query key
   → Triggers an automatic refetch
   → Table updates with the new record
   → Toast notification appears: "Burial record created"
```

There is no wrapper client — `src/hooks/useData.ts` hooks call `supabase.from(...)`
directly. What a hypothetical `api.ts` client would do is split across a few small,
focused modules instead:
- `src/lib/utils.ts` — `toSnakeCaseKeys`/`toCamelCaseKeys` convert between the
  camelCase TypeScript types and snake_case DB columns, recursively
- `src/lib/api.ts` — just the `ApiRequestError` type and an `isApiError` guard,
  consumed by the retry policy in `query.tsx` and the message helpers in `errors.ts`
- A small `sb()` helper inside `useData.ts` unwraps Supabase's `{ data, error }`
  shape, throwing on either an error or a null/undefined payload

---

## Routing

All routes are defined in `src/App.tsx`. The app uses **React Router DOM v6** with nested routes.

```
/login                    → Login page (public, no auth required)
/memorial/:id             → Public memorial page (public, no auth required —
                             reached via a QR code printed from a published
                             burial record; see MemorialPage.tsx)
/                         → Protected by ProtectedRoute wrapper
  /                       → Dashboard (default)
  /work-orders            → Work Orders
  /inventory              → Inventory
  /financial              → Financial (AR/AP/Deposits with tabs)
  /burials                → Burial records
  /contracts              → Contracts
  /grants                 → Grants
  /customers              → Customers
  /vendors                → Vendors
  /cemeteries             → Cemetery → Section → Lot → Grave hierarchy + map
```

Every route above except `Dashboard` and `Login` is `React.lazy()`-loaded — its chunk
only downloads the first time a user navigates there.

**How protection works:**

```tsx
// src/App.tsx (simplified)
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  return isAuthenticated ? children : <Navigate to="/login" />;
}
```

`isAuthenticated` is `true` when either:
- A live Supabase session exists (real user is logged in), OR
- `localStorage.getItem('dmp-demo-mode') === 'true'` (demo mode is active)

---

## Authentication and authorization

### Login flow

```
User enters email + password
  → auth.tsx calls supabase.auth.signInWithPassword()
  → Supabase verifies credentials
  → Returns a JWT session token
  → AuthProvider stores session in state
  → isAuthenticated becomes true
  → React Router allows access to protected routes
```

### Demo mode flow

```
User clicks "Preview Demo"
  → Login.tsx calls enableDemoMode() (lib/demo-data.ts)
  → Sets localStorage.setItem('dmp-demo-mode', 'true')
  → Dispatches window CustomEvent 'dmp-demo-change'
  → AuthProvider listener catches the event
  → isDemoActive state updates to true
  → isAuthenticated becomes true
  → No Supabase call made
```

The `CustomEvent` is the key design choice here. Because `AuthProvider` is a React component, we can't call `setState` from outside it. The custom event acts as a signal that triggers the state update.

### Demo mode data

Demo mode only changes what `isAuthenticated` resolves to — it does **not** change
what the data hooks do. Every hook in `useData.ts` calls Supabase exactly as it would
for a real session. `src/lib/demo-data.ts` contains a single fake `DEMO_USER` identity
and the enable/disable toggle, not a mock dataset — an earlier set of `DEMO_*` sample
datasets existed and was removed as dead code, since nothing ever branched on demo
mode to read them. In practice, demo mode without real Supabase credentials configured
shows empty lists or failed-to-load states on every page, not sample data.

### Authorization (who can do what)

Authorization is entirely enforced by **Supabase Row-Level Security (RLS) policies** on the database. The frontend doesn't implement role-based access control — if the database allows an operation, it succeeds; if not, it fails with a permission error.

See [docs/06-supabase.md](06-supabase.md) for RLS details.

---

## State management

There are three kinds of state in this app, each handled differently:

### 1. Server state (data from Supabase)

**Tool:** TanStack React Query v5

React Query handles all async data: fetching, caching, background refetching, and mutations. Every data operation in the app (listing burials, creating a work order, updating a contract) goes through a hook defined in `src/hooks/useData.ts`.

Key configuration (`src/lib/query.tsx`):
- `staleTime: 5 * 60 * 1000` — Data is considered fresh for 5 minutes before a background refetch is triggered.
- `gcTime: 30 * 60 * 1000` — Unused cached data is garbage-collected after 30 minutes.
- Retry logic: No retry on 400/401/404 (client errors). 2 retries with exponential backoff for network errors.

### 2. Global client state

**Tool:** React Context + custom hooks

Three providers wrap the entire app (`src/App.tsx`):
- `AuthProvider` (`src/lib/auth.tsx`) — session, user, isAuthenticated, login, logout
- `ThemeProvider` (`src/lib/theme.tsx`) — light/dark/system preference, persisted in localStorage
- `ToastProvider` (`src/lib/toast.tsx`) — toast notification queue and display

Consume with: `useAuth()`, `useTheme()`, `useToast()`.

### 3. Local UI state

**Tool:** `useState` / `useRef`

Form inputs, modal open/close, filter terms, dropdown open states — all managed locally in the component that owns them. No state is lifted unless at least two separate components need it.

---

## The component library (ui.tsx)

All shared UI components live in a single file: `src/components/ui.tsx`. This is intentional — it makes it easy to find and modify any component without navigating a deep folder tree.

Components available:

| Component | What it renders |
|---|---|
| `<Button>` | Styled button with variants (primary, secondary, ghost, outline, danger), loading state, icon prop |
| `<Card>` / `<CardHeader>` / `<CardBody>` | Rounded white/dark surface with optional border and hover state |
| `<Input>` | Text input with label, icon, error display, helper text |
| `<Select>` | Dropdown select with label |
| `<Textarea>` | Multi-line text input |
| `<Modal>` | Centered dialog with title, content slot, footer slot, and close button |
| `<Badge>` | Colored pill label (variants: primary, success, warning, danger, info, secondary, outline) |
| `<PageError>` | The standard error banner at the top of every CRUD page — pass it a raw thrown error; renders nothing if falsy |
| `<StatCard>` | Metric tile: label, value, tinted icon chip |
| `<EmptyState>` | "No data" placeholder with icon, heading, description, optional action button |
| `<LoadingSpinner>` | Animated spinner (used during data loads) |
| `<Avatar>` | Circle with initials fallback |
| `<Pagination>` | Page-number controls — built and exported, but not currently imported by any page |

There is no `<Alert>`, `<Tooltip>`, `<Divider>`, or `<Skeleton>` component. All four
were removed as unused dead code (see CHANGELOG.md) — pages use `<PageError>` for
errors, and no page currently needs the other three.

---

## Key library files

### `src/lib/api.ts`
Not a fetch wrapper — there is no HTTP client in this app. Exports only the
`ApiError`/`ApiRequestError` type hierarchy (message, status code, error code,
details, request ID) and an `isApiError` type guard, consumed by `query.tsx`'s retry
policy and `errors.ts`'s message helpers. Request/response key transformation lives
in `utils.ts` instead.

### `src/lib/auth.tsx`
The `AuthProvider` component + `useAuth` hook. Manages:
- Supabase session subscription (`onAuthStateChange`)
- Demo mode state (reactive via CustomEvent)
- `currentUser` shape: `{ id, email, name, role }` normalized from Supabase user metadata
- Exposes: `login`, `logout`, `isAuthenticated`, `isDemo`, `currentUser`

### `src/lib/supabase.ts`
Creates and exports the Supabase JS client using the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars. This is the single Supabase client instance used throughout the app.

### `src/lib/query.tsx`
- `QueryProvider` — wraps the app with React Query's `QueryClientProvider`
- `queryKeys` — centralized object of all cache keys (e.g., `queryKeys.burials`, `queryKeys.workOrders`) used to invalidate specific caches after mutations
- `queryClient` — the configured `QueryClient` instance

### `src/lib/utils.ts`
Pure utility functions:
- `formatCurrency(n)` → `"$1,234.56"`
- `formatDate(d)` → `"Jan 1, 2024"`
- `formatDateForInput(d)` → `"2024-01-01"` (for `<input type="date">`)
- `formatStatus(s)` → `"in_progress"` → `"In Progress"`
- `cn(...classes)` → Conditional class joining (like clsx)
- `toSnakeCase` / `toCamelCase` — used by `api.ts` for key transformation

### `src/lib/gemini.ts`
Client for the AI assistant. Two exported functions:
- `sendMessage(messages)` — non-streaming, returns full response string
- `streamMessage(messages)` — async generator, yields text chunks as they arrive

Both POST to `/api/chat` by default — a Vercel Edge Function (`api/chat.ts`) that
holds the OpenRouter key server-side and streams the upstream response straight back.
A dev-only fallback calls OpenRouter directly from the browser when
`import.meta.env.DEV` is true and `VITE_OPENROUTER_API_KEY` is set; Vite hardcodes
`DEV` to `false` in production builds, so that branch (and the key it would need) is
dead-code-eliminated from what ships. See [docs/09-security.md](09-security.md).

### `src/lib/schemas.ts` + `src/hooks/useForm.ts`
Zod schemas for every form (`workOrderFormSchema`, `grantFormSchema`, etc.), paired
with a generic `useForm` hook whose live-state type is derived from the schema
(`z.input<typeof xFormSchema>`) so the two can't drift. This is the standard form
pattern for every CRUD page except `Cemeteries.tsx` (not yet converted — a real gap,
tracked in `CLAUDE.md`) and Financial's two payment-recording forms (intentionally
plain `useState`, since they capture a single amount against an existing invoice
rather than creating a record).

### `src/lib/theme.tsx`
`ThemeProvider` + `useTheme()`. Tracks `'light' | 'dark' | 'system'`, persisted in
`localStorage`, toggling the `dark` class on `<html>` that `tailwind.config.js`'s
`darkMode: 'class'` and the CSS variables in `index.css` key off of. The DMP brand
green/gold live outside this system entirely (see [docs/11-design-system.md](11-design-system.md))
so they don't change with the toggle.

### `src/lib/errors.ts`
Three helpers for extracting info from any error type:
- `getErrorMessage(err, fallback?)` — returns a user-friendly string
- `getErrorDetails(err)` — returns an array of detail strings (field-level errors)
- `getErrorRequestId(err)` — returns the Supabase request ID if present

---

## TypeScript types

All data model types are in `src/types/index.ts`. One type per database table:

```
User, WorkOrder, Grant, Burial, Customer, InventoryItem,
Contract, ContractItem, PaymentPlan, Deposit, AccountsReceivable, AccountsPayable,
Vendor, PaymentScheduleEntry, Cemetery, Section, Lot, Grave
```

All types use camelCase (matching the JS convention), even though the database uses
snake_case. `src/types/database.ts` is the other half of the boundary — GENERATED
snake_case types matching the live schema exactly (regenerate via the Supabase MCP
`generate_typescript_types` tool, or `supabase gen types typescript --linked`; never
hand-edit it). The `toCamelCaseKeys`/`toSnakeCaseKeys` transforms in `lib/utils.ts`
convert between the two at every read/write.

---

## Testing

**Framework:** Vitest + React Testing Library

Test files live alongside source files or in `src/tests/`:
- `src/tests/setup.ts` — configures jest-dom matchers and JSDOM polyfills
- `src/lib/errors.test.ts` — unit tests for error helper functions
- `src/lib/utils.test.ts` — unit tests for formatting/case-transform utilities
- `src/hooks/useForm.test.ts` — form validation + Zod coercion behavior
- `src/components/ErrorBoundary.test.tsx` — component tests
- `src/pages/Login.test.tsx` — login form behavior

Coverage is intentionally narrow, not exhaustive — these are regression tests for
specific defects that were found and fixed (each test's comments say which), not a
full suite. `useData.ts` (every data hook) and 11 of 12 pages currently have no tests.

Run with `npm test` (watch mode) or `npm run test:run` (once, for CI).

---

## What "SPA" means and why it matters

**SPA = Single Page Application.** The browser downloads the app once (HTML + JS + CSS), and from then on, navigation happens entirely in JavaScript without full page reloads.

Practical implications:
- **Fast navigation** — switching between Burials and Inventory is instant.
- **`vercel.json` needs a rewrite rule** — because the server doesn't have pages at `/burials`. The rewrite `"source": "/(.*)" → "destination": "/index.html"` makes Vercel serve `index.html` for all paths, then React Router takes over.
- **No backend required** — we call Supabase's API directly from the browser using their JS library.

---

← [01 Getting Started](01-getting-started.md) | Next: [03 Development](03-development.md) →
