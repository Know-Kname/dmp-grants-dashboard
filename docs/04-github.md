# 04 — GitHub Guide

> **TL;DR:** Push to `main` triggers CI (lint + type-check + build + tests) and then Vercel auto-deploys. For big changes, open a feature branch and create a PR. Secrets live in GitHub → Settings → Secrets and variables → Actions.

---

## Table of Contents
- [What GitHub does for this project](#what-github-does-for-this-project)
- [Understanding the repository](#understanding-the-repository)
- [Branches and when to use them](#branches-and-when-to-use-them)
- [Making a pull request (PR)](#making-a-pull-request-pr)
- [CI / Automated checks](#ci--automated-checks)
- [Secrets management](#secrets-management)
- [Dependabot (automatic dependency updates)](#dependabot-automatic-dependency-updates)
- [Issue and PR templates](#issue-and-pr-templates)
- [Stale bot](#stale-bot)
- [Security scanning](#security-scanning)
- [GitHub vocabulary glossary](#github-vocabulary-glossary)

---

## What GitHub does for this project

GitHub serves two roles:

1. **Source of truth** — The repository is where all code lives. Every change is tracked with a commit. If something breaks, you can look at the history and revert.

2. **CI/CD trigger** — When you push to `main`, GitHub Actions runs automated checks (lint, type-check, build, tests) and then Vercel detects the push and deploys the new version.

Think of it as: **GitHub holds the code → Vercel turns the code into a live website.**

---

## Understanding the repository

**Repository URL:** `https://github.com/Know-Kname/dmpgrants`

Key folders you'll interact with on GitHub:

- **Code tab** — Browse all files. The `src/` folder is the app, `docs/` is this documentation.
- **Actions tab** — See CI run results. Green checkmark = all good. Red X = something failed.
- **Settings → Secrets** — Where deployment secrets (Vercel token, etc.) are stored.
- **Pull requests tab** — Proposed changes waiting for review.
- **Issues tab** — Bug reports and feature requests.

---

## Branches and when to use them

### Main branch (`main`)

This is the **production branch**. Every commit here:
1. Triggers GitHub Actions CI (automated checks)
2. Triggers a Vercel production deployment

**Rule:** Only push code to `main` that you're confident works. The live site is serving real users.

### Feature branches

For changes that take more than one commit, or changes you're not sure about:

```bash
# Create a feature branch
git checkout -b feat/add-burial-export

# Work on your changes, commit as you go
git add src/pages/Burials.tsx
git commit -m "feat(burials): add CSV export button"

# Push the branch to GitHub
git push origin feat/add-burial-export

# Create a PR on GitHub (opens the PR creation page)
gh pr create
# OR open github.com and click "Compare & pull request" on the branch
```

**Branch naming conventions:**
- `feat/<description>` — new feature
- `fix/<description>` — bug fix
- `docs/<description>` — documentation changes
- `chore/<description>` — maintenance, dependency updates

---

## Making a pull request (PR)

A Pull Request (PR) is a formal proposal to merge one branch into another. Even for a solo project, PRs are useful because they:
- Give you a diff view of exactly what's changing
- Trigger CI checks before the code hits `main`
- Create a record in the git history of why a change was made

### How to open a PR

1. Push your feature branch to GitHub (see above).
2. Go to `https://github.com/Know-Kname/dmpgrants`.
3. You'll see a yellow banner: **"Compare & pull request"** — click it.
4. Fill in the PR template (see below).
5. Click **"Create pull request"**.

### The PR template

The repo includes a PR template that prompts you to answer:

```markdown
## Summary
What does this PR do and why?

## Testing
How was this tested?

## Checklist
- [ ] npm run build succeeds
- [ ] npm run lint passes
- [ ] Tests pass (npm run test:run)
- [ ] No secrets/credentials added to code
```

**Fill this out.** Even if you're the only reviewer, it forces you to think through the change and creates a useful record.

### Merging the PR

Once CI passes (green checkmarks), click **"Merge pull request"** → **"Confirm merge"**. Vercel will automatically deploy the merge commit.

After merging, delete the feature branch (GitHub offers a button for this — keep things tidy).

---

## CI / Automated checks

Three workflows run automatically. Find them under the **Actions** tab.

### `ci-typescript.yml` — Main CI pipeline

Triggers on: every push to `main`, every PR to `main`.

Runs on **Node.js 20 and 22** (both versions, in parallel):
1. `npm ci` — fresh install of dependencies
2. `npm run lint` — ESLint check (zero warnings)
3. `tsc --noEmit` — TypeScript type-check
4. `npm run build` — full production build
5. `npm test` — Vitest test suite

**What each step means:**
- **Lint:** Catches code style issues, unused variables, invalid hook usage.
- **Type check:** Ensures TypeScript types are all correct. A type error here means runtime crashes are likely.
- **Build:** Proves the app can actually be compiled to production. If this fails, Vercel won't be able to deploy either.
- **Test:** Runs all Vitest tests. A failure means something that worked before now doesn't.

### `pr-checks.yml` — PR size warning

Triggers on: every PR opened or updated.

Automatically adds a comment if a PR changes more than 500 lines, reminding you to consider splitting large changes into smaller PRs. This is just a warning — it doesn't block merging.

### `security-scan.yml` — Security scanning

Triggers on: schedule (weekly) + every push to `main`.

Runs `npm audit` to check for known vulnerabilities in dependencies. If a high-severity vulnerability is found, it creates a GitHub Security alert. **Don't ignore these** — update the affected dependency.

### `stale-bot.yml` — Stale issue/PR cleanup

Automatically marks issues and PRs as stale after 30 days of no activity, then closes them after another 7 days. Keeps the issues list clean.

---

## Secrets management

GitHub Secrets are encrypted environment variables accessible to CI workflows. They're **not** the same as the app's runtime env vars (those live in Vercel — see [docs/05-vercel.md](05-vercel.md)).

**Where to manage them:**
`https://github.com/Know-Kname/dmpgrants/settings/secrets/actions`

**Currently stored secrets:**

| Secret | Used by | Purpose |
|---|---|---|
| `VERCEL_TOKEN` | Vercel integration | Allows Vercel to authenticate to GitHub |
| `VERCEL_ORG_ID` | Vercel integration | Identifies the Vercel account |
| `VERCEL_PROJECT_ID` | Vercel integration | Identifies the specific Vercel project |

> 🔑 **GitHub Secrets vs. app env vars:**
> - **GitHub Secrets** → used inside `.github/workflows/*.yml` files (CI scripts)
> - **Vercel env vars** → used in the running app (frontend JavaScript)
> - **`.env.local`** → used in local development only

**Never put secrets in code files.** Even in a private repo. Rotate any key that was accidentally committed.

**How to add a new secret:**
1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name it in `SCREAMING_SNAKE_CASE` (e.g. `MY_NEW_SECRET`)
4. Paste the value, click "Add secret"
5. Reference it in a workflow with `${{ secrets.MY_NEW_SECRET }}`

---

## Dependabot (automatic dependency updates)

Dependabot scans your `package.json` weekly and opens automated PRs when newer versions of dependencies are available.

**Configuration** (`.github/dependabot.yml`):
- Checks `npm` packages weekly
- Checks GitHub Actions versions weekly
- Opens maximum 5 PRs at once
- Labels PRs with `dependencies`

**What to do when Dependabot opens a PR:**
1. Look at the CI checks — do they pass?
2. Check the diff — is this a patch/minor/major update?
   - **Patch** (1.2.3 → 1.2.4): Almost always safe to merge.
   - **Minor** (1.2.3 → 1.3.0): Usually safe; check the changelog for breaking changes.
   - **Major** (1.2.3 → 2.0.0): Read the migration guide before merging.
3. If CI passes and it's a minor/patch update: merge it.
4. If CI fails: the update may have introduced a breaking change. Read the error and decide.

---

## Issue and PR templates

Pre-filled templates appear whenever someone opens a new issue or PR.

**Bug report** (`.github/ISSUE_TEMPLATE/bug_report.md`):
Prompts for: description, reproduction steps, expected vs. actual behavior, screenshots, environment.

**Feature request** (`.github/ISSUE_TEMPLATE/feature_request.md`):
Prompts for: problem description, proposed solution, alternatives considered.

**PR template** (`.github/PULL_REQUEST_TEMPLATE.md`):
Prompts for: summary, testing, checklist.

These exist so that issues contain enough context to act on without back-and-forth. Fill them out even if you're the only person on the project.

---

## Stale bot

Configured in `.github/workflows/stale-bot.yml`:
- Issues with no activity for **30 days** are labeled `stale` and get a comment.
- If no activity for **7 more days** after that, the issue is closed automatically.
- PRs follow the same timeline.
- Issues labeled `pinned` or `security` are exempt.

This keeps the issue backlog clean and means closed issues were either resolved or went stale with no further input.

---

## Security scanning

The `security-scan.yml` workflow runs `npm audit --audit-level=high` weekly (and on every `main` push). This checks whether any of the project's npm dependencies have known CVEs (Common Vulnerabilities and Exposures) at high or critical severity.

If the scan finds something:
1. A failed workflow run appears in the Actions tab
2. A Security alert appears in the Security tab
3. Dependabot will likely also open a PR to fix it

**How to fix:** Usually `npm audit fix` resolves it, or Dependabot's PR does. For complex issues, `npm audit` gives you the specific package and CVE to research.

---

## GitHub vocabulary glossary

| Term | Definition |
|---|---|
| **Repository (repo)** | The folder that holds all your code + git history |
| **Commit** | A snapshot of the code at a point in time, with a message explaining the change |
| **Branch** | An independent line of development; branches diverge from main and can be merged back |
| **Pull Request (PR)** | A request to merge one branch into another; includes a review interface and CI checks |
| **Merge** | Combining a branch's commits into another branch |
| **Push** | Uploading your local commits to GitHub |
| **Pull** | Downloading commits from GitHub to your local machine |
| **Fork** | A copy of a repo under your own account |
| **Actions / CI** | Automated scripts that run on GitHub's servers when code is pushed |
| **Workflow** | A YAML file in `.github/workflows/` that defines when/what CI runs |
| **Secrets** | Encrypted environment variables accessible only to CI workflows |
| **Dependabot** | GitHub's bot that automatically opens PRs for outdated dependencies |
| **Stale** | An issue or PR with no recent activity |
| **CVE** | Common Vulnerabilities and Exposures — a published security vulnerability |

---

← [03 Development](03-development.md) | Next: [05 Vercel](05-vercel.md) →
