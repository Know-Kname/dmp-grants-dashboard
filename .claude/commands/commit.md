Run a smart conventional commit and push to the current branch.

Usage: `/commit` or `/commit feat: add grants filter`
- With no arguments: auto-generates a Conventional Commit message from the diff
- With `$ARGUMENTS`: uses the supplied text as the commit message verbatim

Steps:
1. Run `git status` and `git diff` to see all changes
2. Run `git log --oneline -5` to check recent commit style
3. Stage all modified/new files with `git add -A` (skip .env files)
4. Determine commit message:
   - If `$ARGUMENTS` is provided, use it as-is (skip to step 5)
   - Otherwise auto-generate a Conventional Commit:
     - `feat:` new feature · `fix:` bug fix · `refactor:` restructure
     - `chore:` tooling/deps · `docs:` documentation only
     - Subject ≤72 chars, imperative mood ("add" not "added")
     - Add body paragraph if the change is non-obvious
5. Commit with `git commit -m "..."`
6. Push with `git push -u origin $(git branch --show-current)`
7. Report the pushed commit hash and short URL

Do NOT commit: .env, .env.*, secrets, credentials, or package-lock.json changes unless explicitly asked.
