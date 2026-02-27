Run ESLint + TypeScript type-check and fix all errors in one pass.

Usage: `/fix` or `/fix src/lib/grants.ts`
- With no arguments: fixes lint and type errors across the entire project
- With `$ARGUMENTS`: targets a specific file or directory only

Steps:
1. Run lint:
   - With target: `npm run lint -- $ARGUMENTS 2>&1`
   - Without target: `npm run lint 2>&1`
   - Capture all errors and warnings
2. Run type-check: `npx tsc --noEmit 2>&1`
   - Capture all TypeScript errors
3. If no errors from either: report "All clean. No lint or type errors." and stop.
4. If errors exist:
   a. Read each file that has errors
   b. Fix ALL errors in a single editing pass — do not fix one at a time
   c. Prioritize: TypeScript errors > ESLint errors > warnings
   d. Never suppress errors with `// @ts-ignore`, `// eslint-disable`, or `any` casts — fix the root cause
5. Re-run both checks to verify zero errors:
   - `npm run lint 2>&1` (or with target if $ARGUMENTS was given)
   - `npx tsc --noEmit 2>&1`
6. If errors remain after first fix pass, attempt one more fix round, then ask for help if still failing
7. Report: files changed, error count before → 0

Do not change test files or add workarounds. Fix the actual implementation.
