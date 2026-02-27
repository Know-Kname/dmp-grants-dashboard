Review the current staged changes or recent commit for quality issues.

Steps:
1. Run `git diff --cached` (staged) or `git diff HEAD~1` (last commit) to get changes
2. Review against this checklist and report findings:

**TypeScript**
- [ ] No `any` types — use proper types or Zod schemas
- [ ] No unchecked type assertions (`as Foo` without guard)
- [ ] All async functions have proper error handling

**React**
- [ ] Hooks called only at top level (no hooks in conditions/loops)
- [ ] `useEffect` deps array is correct (no missing deps)
- [ ] No direct DOM manipulation — use React state/refs
- [ ] Keys on list items are stable (not array index)

**Security**
- [ ] No secrets or API keys in source code
- [ ] User input validated with Zod before use
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] SQL queries use parameterized inputs (no string interpolation)

**Performance**
- [ ] Heavy computations wrapped in `useMemo`
- [ ] Stable callbacks wrapped in `useCallback` where passed as props

**Style**
- [ ] Tailwind classes in logical order (layout → box → text → color)
- [ ] No inline styles unless dynamic values required

Report as: PASS / WARN / FAIL per category with specific line references.
