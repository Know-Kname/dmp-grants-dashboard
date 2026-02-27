Run a smart conventional commit and push to the current branch.

Steps:
1. Run `git status` and `git diff` to see all changes
2. Run `git log --oneline -5` to check recent commit style
3. Stage all modified/new files with `git add -A` (skip .env files)
4. Write a Conventional Commit message:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `refactor:` for code restructuring without behavior change
   - `chore:` for tooling, deps, config
   - `docs:` for documentation only
   - Keep subject line under 72 chars, use imperative mood ("add" not "added")
   - Add body if change is non-obvious
5. Commit with `git commit -m "..."`
6. Push with `git push -u origin $(git branch --show-current)`
7. Report the pushed commit hash and URL

Do NOT commit: .env, .env.*, secrets, credentials, or package-lock.json changes unless explicitly asked.
