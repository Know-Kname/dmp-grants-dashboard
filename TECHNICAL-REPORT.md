# DMP Grants — Technical Report
## Auth, Login, TypeScript & Schema Fixes
**Report Date:** 2026-02-25  
**Branch:** `fix/auth-login-ts-errors`  
**Author:** Christian Wright Hughes  
**Severity Legend:** 🔴 Build-breaking · 🟠 Runtime crash · 🟡 Type-safety gap · 🟢 Architecture improvement

---

## 1. Executive Summary

The `dmpgrants` frontend had **four hard build/runtime failures** and **three architectural drift issues** that together prevented a successful `npm run build` and caused the login flow to crash silently in production. This report documents every issue, its root cause, the exact fix applied, and the residual risk.

---

## 2. Login System — Issue Analysis

### 2.1 🔴 `isAuthenticated` Not Exported From `useAuth()`

**File:** `src/App.tsx` + `src/lib/auth.tsx`  
**Error:**
```
Property 'isAuthenticated' does not exist on type 'AuthContextType'
Property 'login' does not exist on type 'AuthContextType'
```

**Root Cause:**  
`auth.tsx` was refactored to wrap Supabase session management but `AuthContextType` was never updated. It exported `{ user, session, isLoading, signIn, signUp, signOut, resetPassword }`. Meanwhile:
- `App.tsx → ProtectedRoute` destructured `{ isAuthenticated, isLoading }` — `isAuthenticated` did not exist.
- `Login.tsx` called `const { login } = useAuth()` — `login` did not exist (the method is `signIn`).

This is a **100% guaranteed TypeScript compile failure** and a **runtime crash** even if tsc was skipped.

**Fix Applied:**  
- Added `isAuthenticated: boolean` to `AuthContextType`, computed as `!!session`.
- Added `login` as an alias for `signIn` on the context value, preserving backward compatibility with `Login.tsx` without a rename sweep.
- `ProtectedRoute` in `App.tsx` now correctly reads `isAuthenticated` from the stable contract.

**Residual Risk:** None. `isAuthenticated` is now derived from `session` (the Supabase source of truth) and cannot get out of sync.

---

### 2.2 🟠 `getErrorMessage` Signature Mismatch

**Files:** `src/lib/errors.ts` vs `src/pages/Login.tsx`  

**Issue:**  
`errors.ts` exports:
```ts
export const getErrorMessage = (error: unknown, fallback = 'Something went wrong') => { ... }
```
But `api.ts` also exports a **different** `getErrorMessage`:
```ts
export function getErrorMessage(error: unknown): string { ... }
```
`Login.tsx` imports `getErrorMessage` from `'../lib/errors'` — correct. But `query.tsx` imports `isApiError` and `isNetworkError` from `'./api'` — these exist on `api.ts`. The duplicate function name between `errors.ts` and `api.ts` is a **naming collision waiting to cause a mis-import** as the codebase grows.

**Fix Recommended (not yet applied — low risk for current build):**  
Delete `getErrorMessage` from `api.ts` entirely. Keep it only in `errors.ts`. Any module that needs it imports from `errors.ts`.

---

### 2.3 🟠 Supabase Env Var Hard Throw Crashes Login Screen

**File:** `src/lib/supabase.ts`  

**Issue:**  
The original file threw `new Error("Missing Supabase environment variables")` at module load time if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` were absent. In Vercel preview deployments, or when running locally without a `.env.local`, this caused a **white screen of death** before the login page could even render.

Demo mode (`enableDemoMode()`) is triggered by a button click on the Login page — but the page never rendered because the Supabase module blew up on import.

**Fix Applied:**  
- Replaced hard throw with `console.warn` + fallback placeholder credentials.
- Created `isDemoOnlyBuild` export so other modules can gate live-data calls behind a guard.
- The Supabase client is created regardless (with placeholder values), meaning imports don't fail. Real calls in live mode will produce 401/network errors which are handled by the error boundary.

---

### 2.4 🟡 Demo Credentials Hardcoded In Login UI

**File:** `src/pages/Login.tsx`  

**Issue:**  
The login page renders:
```
Demo credentials: admin@dmp.com / admin123
```
in plain text. This is fine for dev but must be removed before any customer-facing production deployment.

**Fix Recommended:** Gate behind `import.meta.env.DEV` check:
```tsx
{import.meta.env.DEV && (
  <p className="text-xs ...">Demo: admin@dmp.com / admin123</p>
)}
```

---

## 3. TypeScript Compilation Failures

### 3.1 🔴 `@tanstack/react-query` Missing From `package.json`

**File:** `src/lib/query.tsx`  
**Error:**
```
Cannot find module '@tanstack/react-query' or its corresponding type declarations
```

**Root Cause:**  
`query.tsx` imports from `@tanstack/react-query` but the package was never added to `dependencies` in `package.json`. It may have existed locally via transitive hoisting but is **not deterministic** across installs (Vercel CI, fresh clones).

**Fix Applied:**  
Added `"@tanstack/react-query": "^5.17.0"` to `dependencies` in `package.json`. v5 is the current stable release compatible with React 18 + TS 5.

**Note:** TanStack Query v5 renamed `cacheTime` → `gcTime` (already correct in your `query.tsx`). No migration needed.

---

### 3.2 🔴 `Date` vs `string` — Domain Type vs Demo Data vs Supabase Row

**Files:** `src/types/index.ts`, `src/lib/demo-data.ts`, `src/lib/supabase.ts`  

**Issue:**  
Three data layers disagreed on timestamp representation:

| Layer | Timestamp Type |
|---|---|
| `src/types/index.ts` (domain interfaces) | `Date` object |
| `src/lib/demo-data.ts` (mock data) | `string` (ISO 8601 via `.toISOString()`) |
| `src/lib/supabase.ts` (DB row types) | `string` (ISO 8601) |
| `src/lib/schemas.ts` (Zod validators) | `string` (via `dateStringSchema`) |

This triangle means any assignment from demo data or Supabase to a typed domain object would produce: `Type 'string' is not assignable to type 'Date'`.

**Fix Applied:**  
Updated `src/types/index.ts` to use `string` (ISO 8601) for all date/timestamp fields. Added `// ISO 8601` comments for every date field. No other files needed changes — they were already using strings.

**Usage guidance:** To render human-readable dates in components, use `date-fns` (already in deps):
```ts
import { parseISO, format } from 'date-fns';
const label = format(parseISO(burial.burialDate), 'MMMM d, yyyy');
```

---

### 3.3 🟡 `tsconfig.json` — Strict Mode Disabled

**File:** `tsconfig.json`  

**Issue:**  
`strict: false` means the compiler silently allows `null`/`undefined` dereferences, implicit `any`, loose function signatures, and other bugs that only appear at runtime. For a codebase that handles financial records and burial data, this is unacceptable long-term.

**Fix Applied:**  
- `tsconfig.json` remains non-strict for fast dev iteration.
- Added `tsconfig.strict.json` that extends the base and enables all strict flags.
- Added `"build:strict": "tsc --project tsconfig.strict.json && vite build"` script to `package.json`.

**Roadmap:** Once all current TS errors are resolved under strict mode, promote `tsconfig.strict.json` settings into the base config and retire the two-tier approach.

---

### 3.4 🟡 Supabase DB Types Missing `completed_date` Column

**File:** `src/lib/supabase.ts`  

**Issue:**  
The `work_orders` row definition had no `completed_date` column, but the domain type `WorkOrder` has `completedDate?: string`. Any query that returns or inserts `completed_date` would not be type-checked.

**Fix Applied:** Added `completed_date: string | null` to `work_orders.Row`, `Insert`, and `Update` in the Supabase type definitions.

---

## 4. Architecture Recommendations

### 4.1 Single Source of Truth for Types

Currently, types are maintained in 3 parallel systems: domain interfaces (`types/index.ts`), Zod schemas (`schemas.ts`), and Supabase row types (`supabase.ts`). These will drift again without tooling enforcement.

**Recommended approach:**
- **Short term:** Use `z.infer<typeof schema>` as the authoritative form type instead of manually writing `FormData` interfaces.
- **Long term:** Use `supabase gen types typescript` CLI to auto-generate Supabase types, then use those as the DB layer. Map to domain types via explicit mappers.

### 4.2 Auth Token Storage

`api.ts` reads `localStorage.getItem('token')` for auth headers. Supabase manages its own session in `localStorage` under different keys. There are **two separate auth storage mechanisms** in this app right now — the legacy REST `api.ts` system and the Supabase session. Until you build a backend API layer (vs. using Supabase client directly), `api.ts` should be considered unused scaffolding and its localStorage token management should be removed to avoid confusion.

### 4.3 `AbortSignal.any` Compatibility

`api.ts` uses `AbortSignal.any()` which is available in Node 20+ and modern browsers but **not Safari < 17.4**. Given DMP's likely user base (funeral home staff on mixed devices), this is a risk.

**Fix:** Replace with a manual combined AbortController pattern for broader compatibility.

---

## 5. Fix Sequencing (Prioritized PR Plan)

| Priority | Fix | File(s) | Status |
|---|---|---|---|
| P0 | Auth contract: add `isAuthenticated` + `login` alias | `auth.tsx`, `App.tsx` | ✅ Applied |
| P0 | Add `@tanstack/react-query` to deps | `package.json` | ✅ Applied |
| P0 | Convert domain types to ISO strings | `types/index.ts` | ✅ Applied |
| P0 | Supabase soft-fail on missing env vars | `supabase.ts` | ✅ Applied |
| P1 | Add `completed_date` to Supabase types | `supabase.ts` | ✅ Applied |
| P1 | Add strict tsconfig gate | `tsconfig.strict.json` | ✅ Applied |
| P2 | Remove `getErrorMessage` duplicate from `api.ts` | `api.ts` | ⬜ Pending |
| P2 | Gate demo credentials behind `import.meta.env.DEV` | `Login.tsx` | ⬜ Pending |
| P2 | Fix `AbortSignal.any()` compatibility | `api.ts` | ⬜ Pending |
| P3 | Normalize `''` → `null` in Zod schemas for persistence | `schemas.ts` | ⬜ Pending |
| P3 | Unify auth: remove legacy localStorage token from `api.ts` | `api.ts` | ⬜ Pending |
| P4 | Generate Supabase types from CLI | `supabase.ts` | ⬜ Future |
