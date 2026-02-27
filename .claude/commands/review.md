Review staged changes or a specific commit for quality issues.

Usage: `/review` or `/review HEAD~3` or `/review abc1234`
- With no arguments: reviews staged changes (`git diff --cached`), falls back to last commit
- With `$ARGUMENTS`: reviews that specific commit SHA or range

Rules applied in this review:
@.claude/rules/typescript.md
@.claude/rules/react.md
@.claude/rules/security.md

Steps:
1. Get the diff:
   - If `$ARGUMENTS` is provided: `git diff $ARGUMENTS`
   - If staged changes exist: `git diff --cached`
   - Otherwise: `git diff HEAD~1`
2. Review against the checklist below and report findings

**TypeScript**
- [ ] No `any` types — use proper types or Zod schemas
- [ ] No unchecked type assertions (`as Foo` without guard)
- [ ] All async functions have explicit error handling

**React**
- [ ] Hooks called only at top level (no hooks in conditions/loops)
- [ ] `useEffect` deps array is complete and correct
- [ ] No direct DOM manipulation — use React state/refs
- [ ] List keys are stable unique IDs (never array index)

**Security**
- [ ] No secrets or API keys in source code
- [ ] All user input validated with Zod before use
- [ ] No `dangerouslySetInnerHTML` without DOMPurify sanitization
- [ ] SQL queries use parameterized inputs (no string interpolation)
- [ ] New Supabase tables have RLS policies

**Performance**
- [ ] Heavy computations wrapped in `useMemo`
- [ ] Callbacks passed as props wrapped in `useCallback`

**Style**
- [ ] Tailwind classes in logical order (layout → sizing → spacing → text → color)
- [ ] No inline styles unless computing dynamic values

Report format: **PASS** / **WARN** / **FAIL** per category with specific file:line references.
