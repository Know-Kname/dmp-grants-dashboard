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

The `api.ts` file wraps the raw Supabase calls and handles:
- Converting camelCase TypeScript types → snake_case DB columns (and back)
- Extracting the Supabase error and turning it into a standard `Error` object
- 401 handling (redirect to login)

---

## Routing

All routes are defined in `src/App.tsx`. The app uses **React Router DOM v6** with nested routes.

```
/login                    → Login page (public, no auth required)
/                         → Protected by ProtectedRoute wrapper
  /                       → Dashboard (default)
  /work-orders            → Work Orders
  /inventory              → Inventory
  /financial              → Financial (AR/AP/Deposits with tabs)
  /burials                → Burial records
  /contracts              → Contracts
  /grants                 → Grants
  /customers              → Customers
```

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

When in demo mode, the data hooks in `useData.ts` **do not** call Supabase. Instead they return the mock data from `src/lib/demo-data.ts`. This contains realistic sample burials, work orders, contracts, etc.

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
| `<Badge>` | Colored pill label (variants: success, warning, danger, info, secondary) |
| `<Alert>` | Error/info banner with title, message, optional detail list, dismiss button |
| `<EmptyState>` | "No data" placeholder with icon, heading, description, optional action button |
| `<LoadingSpinner>` | Animated spinner (used during data loads) |
| `<Avatar>` | Circle with initials fallback |
| `<Pagination>` | Page-number controls |

---

## Key library files

### `src/lib/api.ts`
Low-level fetch wrapper. All requests go through this. It:
- Prepends the Supabase base URL
- Attaches the auth header from the current session
- Transforms request body keys from camelCase to snake_case before sending
- Transforms response keys from snake_case to camelCase after receiving
- Throws a structured `ApiError` with status, message, and request ID

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
OpenRouter API client for the AI assistant. Two exported functions:
- `sendMessage(messages)` — non-streaming, returns full response string
- `streamMessage(messages)` — async generator, yields text chunks as they arrive

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
Contract, ContractItem, Deposit, AccountsReceivable, AccountsPayable, Vendor
```

All types use camelCase (matching the JS convention), even though the database uses snake_case. The `api.ts` transformation layer handles the conversion.

---

## Testing

**Framework:** Vitest + React Testing Library

Test files live alongside source files or in `src/tests/`:
- `src/tests/setup.ts` — configures jest-dom matchers and JSDOM polyfills
- `src/lib/errors.test.ts` — unit tests for error helper functions
- `src/lib/utils.test.ts` — unit tests for formatting utilities
- `src/components/ErrorBoundary.test.tsx` — component tests
- `src/pages/Login.test.tsx` — login form behavior

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
