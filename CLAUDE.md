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

## Compact Instructions
When context compaction occurs, preserve:
- Active git branch and last 3 commit messages
- In-progress and pending todos
- Files being actively edited or investigated
- Any open errors, test failures, or unresolved blockers
- The exact user request currently in progress

Compact proactively at ~70% context (don't wait for auto-compact at 95% — it fires too late and degrades output quality). Use `/compact focus on <task>` to guide the summary.

See project rules: @.claude/rules/typescript.md | @.claude/rules/react.md | @.claude/rules/security.md
