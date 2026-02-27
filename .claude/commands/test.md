Run the test suite and fix any failures.

Usage: `/test` or `/test src/lib/grants.test.ts`
- With no arguments: runs the full test suite
- With `$ARGUMENTS`: runs only that specific file or pattern (e.g., `/test grants`)

Steps:
1. Run `npm run test -- --run $ARGUMENTS` to execute tests once (non-watch mode)
   - If `$ARGUMENTS` is empty, omit it to run all tests
2. If tests pass: report summary and exit
3. If tests fail:
   a. Read each failing test file and the source file it tests
   b. Identify the root cause (implementation bug vs outdated test)
   c. Fix the implementation (prefer fixing source over changing tests)
   d. Re-run `npm run test -- --run $ARGUMENTS` to verify
   e. Repeat up to 3 fix attempts, then ask for help
4. After all tests pass, report: test count, pass/fail, files changed

Also run `npm run lint` after fixes to ensure no lint regressions.
