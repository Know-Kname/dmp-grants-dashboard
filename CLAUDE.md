# Detroit Memorial Park — Dev Reference

## Stack
- Frontend: React 18 + TypeScript + Vite, Tailwind CSS, Zod, Recharts, Lucide
- Auth/DB: Supabase (PostgreSQL)
- Testing: Vitest
- Lint: ESLint (TypeScript strict)

## Commands
```bash
npm run dev      # dev server
npm run build    # tsc + vite build
npm run lint     # ESLint (max-warnings 0)
npm run test     # vitest
```

## Architecture
```
src/
  components/   # reusable UI
  pages/        # route-level views
  lib/          # utilities, supabase client
  hooks/        # custom React hooks
  types/        # TS type definitions
  config/       # app config
server/
  routes/       # Express API endpoints
  db/           # DB queries
  middleware/   # auth, validation
  utils/        # helpers
```

## Code Rules
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- Branches: `claude/<description>-<id>`
- No `any` types — use Zod for runtime validation
- Components: functional only, no class components
- Always push to current branch with `git push -u origin <branch>`

## Modules
Cemetery mgmt: Work Orders, Inventory, Financials (AR/AP/invoices), Burials, Contracts, Grants/Benefits
