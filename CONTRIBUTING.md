# Contributing to DMP Cemetery Management System

## Development Setup

```bash
git clone https://github.com/Know-Kname/dmp-grants-dashboard.git
cd dmp-grants-dashboard
npm install
cp .env.example .env.local   # fill in real values from Supabase Dashboard
npm run dev                  # → http://localhost:5173
```

## Branch Naming

**For work tracked in Linear (preferred):** use the branch name Linear generates.
Click the Git branch icon on any issue to copy it — the format is:

```
chichi/dmp-12-add-document-upload     ← Linear: team/issue-id-slug
chichi/dmp-78-production-monitoring
```

**For untracked work** (quick fixes, experiments not worth a Linear issue):

```
feat/short-description       ← new features
fix/short-description        ← bug fixes
chore/short-description      ← maintenance (deps, config)
docs/short-description       ← documentation only
```

All branches merge to `main` via PR. The CI checks (`lint`, `typecheck`, `build`)
must pass before merging.

## Commit Format (enforced by commitlint)

```
type(scope): short description (max 72 chars)

Optional body explaining WHY, not what. Include migration notes, breaking
changes, env var changes here.

https://claude.ai/code/session_XXXX  ← always include session URL
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

**Scopes (optional):** `auth`, `burials`, `cemeteries`, `map`, `financial`, `supabase`, `ui`, `api`

**Breaking change:** append `!` to type or add `BREAKING CHANGE:` footer → triggers MAJOR version bump.

## Version Bump Rules

| Change | Bump | Example |
|---|---|---|
| New page or major feature | MINOR (`1.x.0`) | Adding document upload module |
| Bug fix or visual polish | PATCH (`1.0.x`) | Fixing date format on certificates |
| New Supabase tables / breaking hooks | MAJOR (`x.0.0`) | Adding new auth model |

## Pre-Push Checklist

```
[ ] npm run typecheck  → zero TypeScript errors
[ ] npm run lint       → zero ESLint warnings (--max-warnings 0)
[ ] npm run build      → clean Vite build
[ ] Bump version in package.json
[ ] Bump version in src/config/company.ts → system.version
[ ] Add entry to CHANGELOG.md under [Unreleased]
[ ] Document any new env vars in .env.example
[ ] Document any new Supabase migrations with standard header
```

## Supabase Migrations

Every migration file must begin with the standard header:

```sql
-- ═══════════════════════════════════════════════════════════════════
-- Migration: [filename].sql
-- Description: [one-line summary]
-- Author: [Name]
-- Date: [YYYY-MM-DD]
-- App Version: [vX.Y.Z]
-- Rollback SQL: [explicit rollback SQL]
-- Dependencies: [list or "None"]
-- ═══════════════════════════════════════════════════════════════════
```

Create new migration: `supabase migration new description_here`

Apply to production: push to `main` — `supabase-migrations.yml` auto-deploys.

## Architecture Notes

- **No Express backend.** All data access is via Supabase JS client directly.
- **snake_case ↔ camelCase.** `src/lib/api.ts` transforms all keys automatically.
- **Server state:** React Query (TanStack v5). Local state: `useState`/`useReducer`.
- **Auth:** `src/lib/auth.tsx` — Supabase Auth + demo mode via localStorage + CustomEvent.
- **Brand colors** (`#1a3d2b` forest green, `#c49a2c` gold) are hardcoded in sidebar/login
  and are intentional — not CSS variables — so they don't change with the theme.

See `docs/` for full platform guides and architecture deep-dives.
