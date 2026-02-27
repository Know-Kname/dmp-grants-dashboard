Manage git stash — save work-in-progress or restore it.

Usage:
- `/stash` — stash all current changes with an auto-generated description
- `/stash "WIP: halfway through grants filter"` — stash with a specific message
- `/stash pop` — restore the most recent stash
- `/stash list` — show all stashes with their descriptions

Steps:
1. Determine mode from `$ARGUMENTS`:
   - `pop` → restore most recent stash (step 4)
   - `list` → show stash list (step 5)
   - anything else (or empty) → create a new stash (step 2)

2. To stash current changes:
   a. Run `git status` to check for changes
   b. If no changes: report "Nothing to stash." and stop
   c. Determine message:
      - If `$ARGUMENTS` is non-empty (and not pop/list): use it as the stash message
      - Otherwise: generate a short description from `git diff --stat` (e.g. "WIP: editing grants filter + 2 other files")
   d. Run `git stash push -u -m "<message>"` (the `-u` flag includes new untracked files)
   e. Report: stash ref (stash@{0}), message, files stashed

3. After stashing: remind that `/stash pop` restores it, and `git stash list` shows all.

4. To pop (restore) the most recent stash:
   a. Run `git stash list` — if empty, report "No stashes found." and stop
   b. Show what will be restored (top stash message)
   c. Run `git stash pop`
   d. Report: files restored, any conflicts to resolve

5. To list stashes:
   a. Run `git stash list --pretty=format:"%gd %s (%cr)"`
   b. Show the output in a clean list
   c. Mention that `/stash pop` restores the most recent one
