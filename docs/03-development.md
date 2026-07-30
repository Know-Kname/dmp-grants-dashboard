# 03 — Development

> **TL;DR:** Edit files in `src/`. `npm run dev` hot-reloads. Always run `npm run lint` before committing. Use conventional commit messages (`feat:`, `fix:`, `docs:`). Add data hooks in `useData.ts`, add new pages in `src/pages/`, wire them in `App.tsx`.

---

## Table of Contents
- [Daily workflow](#daily-workflow)
- [Adding a new page](#adding-a-new-page)
- [Adding a new data operation](#adding-a-new-data-operation)
- [Code conventions](#code-conventions)
- [Tailwind and styling conventions](#tailwind-and-styling-conventions)
- [Commit conventions](#commit-conventions)
- [Linting](#linting)
- [Testing](#testing)
- [VS Code recommended setup](#vs-code-recommended-setup)

---

## Daily workflow

```bash
# Start your session
npm run dev

# Make changes to files in src/
# The browser hot-reloads automatically — no manual refresh needed

# Before committing, always check:
npm run typecheck   # No TypeScript errors?
npm run lint        # No lint warnings?
npm run test:run    # All tests passing?

# Then commit
git add <files>
git commit -m "feat: add export button to Burials page"
git push origin main  # Triggers a Vercel auto-deploy
```

---

## Adding a new page

1. **Create the page file** in `src/pages/YourPage.tsx`:

```tsx
// src/pages/Reports.tsx
export default function Reports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Generate and export cemetery reports</p>
      </div>
      {/* your content here */}
    </div>
  );
}
```

2. **Register the route** in `src/App.tsx`:

```tsx
import Reports from './pages/Reports';           // add import

// Inside <Routes>:
<Route path="reports" element={<Reports />} />  // add route
```

3. **Add to navigation** in `src/components/Layout.tsx`:

```tsx
const navItems = [
  // ... existing items ...
  { icon: BarChart2, label: 'Reports', path: '/reports', description: 'Generate reports' },
];
```

4. Import the icon from `lucide-react` at the top of `Layout.tsx`.

That's it — the new page is live.

---

## Adding a new data operation

All data fetching and mutations go through `src/hooks/useData.ts`. It uses TanStack React Query v5.

**Reading data (query):**

```ts
// In useData.ts — add a new query. Calls Supabase directly; no Express layer.
export function useReports() {
  return useQuery({
    queryKey: queryKeys.reports.list(),   // add `reports` to queryKeys in src/lib/query.tsx
    queryFn: async () => {
      const rows = await sb(
        supabase.from('reports').select('*').order('created_at', { ascending: false })
      );
      return (rows as Record<string, unknown>[]).map(r => toCamelCaseKeys(r) as unknown as Report);
    },
  });
}
```

**Writing data (mutation):**

```ts
// In useData.ts — add a mutation. toSnakeCaseKeys converts on the way in,
// toCamelCaseKeys on the way out.
export function useCreateReport(callbacks?: MutationCallbacks<Report>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>) => {
      const row = await sb(
        supabase.from('reports')
          .insert(toSnakeCaseKeys(data as Record<string, unknown>))
          .select().single()
      );
      return toCamelCaseKeys(row as Record<string, unknown>) as unknown as Report;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: Error) => callbacks?.onError?.(error),
  });
}
```

**Using in a component:**

```tsx
// In src/pages/Reports.tsx:
import { useReports, useCreateReport } from '../hooks/useData';

function Reports() {
  const { data: reports = [], isLoading, error } = useReports();
  const createReport = useCreateReport({
    onSuccess: () => toast.success('Report created'),
  });
  // ...
}
```

---

## Form validation (Zod + useForm)

Every CRUD page's create/edit form follows the same pattern — this is the standard
convention, not optional. `src/pages/Grants.tsx` is the clearest full example to copy
from.

1. **Define a schema** in `src/lib/schemas.ts`:
   ```ts
   export const reportFormSchema = z.object({
     title: z.string().min(3, 'Title must be at least 3 characters'),
     type: z.enum(['summary', 'detail']),
   });
   ```

2. **Derive the form's live-state type from the schema** with `z.input`, not
   `z.infer`, and don't hand-declare it separately — that guarantees the two can't
   drift:
   ```ts
   type ReportFormData = z.input<typeof reportFormSchema>;
   ```
   `z.input` matters whenever a field coerces, e.g.
   `amount: z.union([z.string().transform(Number), z.number()])` — the *input* type is
   what an `<input>` gives you (a string), the *output* type (`z.infer`) is what
   `onSubmit` receives (a number). Collapsing both into one type makes `values` lie
   about what it actually holds.

3. **Wire the hook in the page component:**
   ```tsx
   const form = useForm({
     schema: reportFormSchema,
     initialValues: { title: '', type: 'summary' },
     onSubmit: (data) => {
       // data is the *parsed* output — already coerced and validated
       createReport.mutate(data);
     },
   });
   ```

4. **Bind each field** with `getFieldProps` + `getFieldError` (the latter only shows
   an error once the field has been touched):
   ```tsx
   <Input
     label="Title"
     {...form.getFieldProps('title')}
     error={getFieldError('title', form.errors, form.touched)}
     required
   />
   ```

**Documented exception:** Financial.tsx's two payment-recording forms (they capture a
single amount against an existing invoice, not a new record — a schema would add
ceremony without adding a real check) stay on plain `useState` by design.
**Undocumented gap:** `Cemeteries.tsx`'s four forms (Cemetery/Section/Lot/Grave) still
use plain `useState` with inline `parseInt`/`parseFloat` — no schema exists for them
yet. If you're touching that page, converting it to this pattern is the highest-value
follow-up; see `CLAUDE.md` for the gap being tracked explicitly rather than silently.

---

## Code conventions

### TypeScript

- **Strict mode is on.** No `any` unless absolutely necessary (and even then, add a comment explaining why).
- **Prefer interfaces** for object shapes that represent data models. Use `type` for unions and mapped types.
- **All component props** should have explicit types, not inferred.
- **Never use `@ts-ignore`** or `@ts-expect-error` without a comment.

### React

- **Functional components only.** No class components.
- **One component per file** for pages and large components. Utility components can be co-located in `ui.tsx`.
- **Custom hooks start with `use`** — e.g. `useWorkOrders`, `useToast`.
- **Event handlers start with `handle`** — e.g. `handleSubmit`, `handleDelete`.
- **Boolean state variables start with `is`, `has`, `should`** — e.g. `isLoading`, `hasError`, `showModal`.

### Imports

Ordering (enforced loosely by ESLint, strictly by habit):
1. React + framework imports
2. Third-party libraries
3. Internal `@/` or relative imports — lib, hooks, components, pages, types

### No magic numbers

```tsx
// ❌ Bad
setTimeout(fn, 4000);

// ✅ Good
const TOAST_DURATION_MS = 4000;
setTimeout(fn, TOAST_DURATION_MS);
```

---

## Tailwind and styling conventions

The project uses **Tailwind CSS 3** with a set of custom CSS variables (design tokens) defined in `src/styles/index.css`. Use the semantic token names, not raw colors.

```tsx
// ❌ Don't hardcode colors
<div className="bg-gray-900 text-gray-50">

// ✅ Use semantic tokens
<div className="bg-background text-foreground">
```

**Available semantic tokens:**

| Token | Light | Dark | Use for |
|---|---|---|---|
| `bg-background` | white | near-black | page background |
| `bg-card` | white | dark gray | card/panel background |
| `bg-accent` | gray-100 | gray-800 | hover states |
| `bg-background-subtle` | gray-50 | gray-900 | secondary backgrounds |
| `text-foreground` | gray-900 | gray-50 | primary text |
| `text-foreground-muted` | gray-500 | gray-400 | secondary/helper text |
| `border-border` | gray-200 | gray-700 | all borders |
| `text-primary` | blue | lighter blue | links, active states |
| `text-success` | green | green | positive values |
| `text-warning` | amber | amber | caution values |
| `text-danger` | red | red | errors, destructive |

**The sidebar exception:** The dark green sidebar (`#1a3d2b`) and gold accents (`#c49a2c`) are hardcoded as inline styles in `Layout.tsx` and `AIAssistant.tsx`. This is intentional — the sidebar should stay dark green regardless of the user's light/dark theme preference. Don't move these to CSS variables.

**The `cn()` utility:** For conditional classes, use `cn()` from `src/lib/utils.ts`:

```tsx
import { cn } from '../lib/utils';

<tr className={cn(
  'hover:bg-accent/50 transition',
  item.quantity <= item.reorderPoint && 'bg-warning-50 dark:bg-warning-950/20'
)}>
```

---

## Commit conventions

We use **Conventional Commits** format. This makes the git history scannable and enables future changelog generation.

**Format:**
```
<type>(<scope>): <short description>

<optional longer description>

<optional link, e.g. Claude session URL>
```

**Types:**

| Type | When to use | Example |
|---|---|---|
| `feat` | New feature or user-visible capability | `feat: add CSV export to burials page` |
| `fix` | Bug fix | `fix: demo login not working after page load` |
| `docs` | Documentation only | `docs: add Supabase RLS setup guide` |
| `style` | Formatting, no logic change | `style: format inventory table columns` |
| `refactor` | Code restructuring, no behavior change | `refactor: extract burials form into component` |
| `test` | Adding or fixing tests | `test: add useData query hook tests` |
| `chore` | Dependency updates, config changes | `chore: upgrade React Query to v5.20` |
| `perf` | Performance improvement | `perf: memoize dashboard chart data` |

**Scope** is optional but helpful: use the page or module name (`burials`, `auth`, `dashboard`, `layout`, `ui`).

---

## Linting

ESLint is configured in `.eslintrc.cjs`. The policy is **zero warnings** — the CI pipeline fails if any warnings exist.

```bash
npm run lint              # Check — shows all errors/warnings
npm run lint -- --fix     # Auto-fix what can be fixed automatically
```

Key rules enforced:
- `@typescript-eslint/no-unused-vars` — unused variables are errors (except `_prefixed` vars)
- `react-hooks/rules-of-hooks` — hooks must be called at the top level, never conditionally
- `react-hooks/exhaustive-deps` — currently **disabled entirely** (`'off'`) in
  `.eslintrc.cjs`, not just downgraded to a warning. This rule normally catches
  stale-closure bugs in `useEffect`/`useCallback` dependency arrays — double-check
  your own deps by hand, since lint won't catch a missing/wrong one right now.
- `no-useless-escape` — no unnecessary backslashes in regexes

**Before committing:** always run `npm run lint`. If it shows errors, fix them. Don't commit with lint errors.

---

## Testing

**Framework:** Vitest (same API as Jest) + React Testing Library

```bash
npm test           # Watch mode — runs related tests on every file save
npm run test:run   # Single run — use this in CI or to verify before pushing
```

### Writing a test

```tsx
// src/pages/Burials.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatDate } from '../lib/utils';

describe('formatDate', () => {
  it('formats ISO date strings to readable format', () => {
    expect(formatDate('2024-01-15')).toBe('Jan 15, 2024');
  });
  it('returns empty string for null/undefined', () => {
    expect(formatDate(null)).toBe('');
  });
});
```

### What to test

- **Always test:** utility functions in `lib/utils.ts` and `lib/errors.ts`
- **Good to test:** form validation logic, component rendering with different props
- **Skip:** Supabase API calls (use Vitest mocking for integration tests when needed)

---

## VS Code recommended setup

Install these extensions for the best experience:

1. **ESLint** (`dbaeumer.vscode-eslint`) — shows lint errors inline as you type
2. **Prettier** (`esbenp.prettier-vscode`) — auto-format on save
3. **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`) — autocomplete Tailwind classes
4. **TypeScript Vue Plugin** (or just the built-in TS support) — type checking in editor

Recommended `settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

← [02 Architecture](02-architecture.md) | Next: [04 GitHub](04-github.md) →
