# 07 — Deployment Pipeline

> **TL;DR:** `git push origin main` → GitHub CI runs (lint, typecheck, build, tests) → Vercel detects the push → builds and deploys in ~60 seconds → live site is updated. Preview deploys happen on every branch automatically. Rollback is one click.

---

## Table of Contents
- [The complete pipeline diagram](#the-complete-pipeline-diagram)
- [Production deploy (step-by-step)](#production-deploy-step-by-step)
- [Preview deploy (feature branches)](#preview-deploy-feature-branches)
- [When CI fails — what to do](#when-ci-fails--what-to-do)
- [When Vercel build fails](#when-vercel-build-fails)
- [Monitoring a live deployment](#monitoring-a-live-deployment)
- [Rollback procedure](#rollback-procedure)
- [Environment promotion](#environment-promotion)
- [Deployment checklist](#deployment-checklist)

---

## The complete pipeline diagram

```
Your Machine
    │
    ├── Edit code in src/
    ├── npm run build       (verify locally — optional but recommended)
    ├── npm run lint        (must pass before pushing)
    └── git push origin main
              │
              ▼
         GitHub.com
              │
        (webhook fires)
         ┌───┴───────────────────────────────────────────┐
         │          GitHub Actions CI                     │
         │  ┌──────────────────────────────────────────┐ │
         │  │  ci-typescript.yml                        │ │
         │  │  Single job, Node 22                      │ │
         │  │                                           │ │
         │  │  1. npm ci (fresh install)                │ │
         │  │  2. npm run lint       ← fails = blocked  │ │
         │  │  3. tsc --noEmit       ← fails = blocked  │ │
         │  │  4. npm run build      ← fails = blocked  │ │
         │  │  5. npm run test:run   ← fails = blocked  │ │
         │  └──────────────────────────────────────────┘ │
         └───────────────────────────────────────────────┘
              │
        (also fires)
              ▼
         Vercel.com
              │
         ┌───┴──────────────────────────────────────────┐
         │  Vercel Build Pipeline                        │
         │                                               │
         │  1. npm install                               │
         │  2. npm run build  (tsc + vite)               │
         │     → dist/ folder generated                  │
         │  3. dist/ uploaded to Vercel edge network     │
         │  4. Production URL → points to new build      │
         └──────────────────────────────────────────────┘
              │
              ▼
    🌐 Live site updated (~60 seconds from push)
```

**Note:** GitHub CI and Vercel build run in **parallel** (they both start when you push). CI doesn't gate Vercel — if CI fails but the build succeeded, Vercel still deploys. This is why you should run `npm run lint && npm run build` locally before pushing.

---

## Production deploy (step-by-step)

### 1. Verify locally before pushing

```bash
npm run lint          # Must exit 0 — no errors/warnings
npm run typecheck     # Must exit 0 — no type errors
npm run test:run      # All tests must pass
npm run build         # Optional: verify the production bundle compiles
```

### 2. Commit your changes

```bash
git add <specific files>     # Be explicit — avoid git add -A (might include .env.local)
git status                   # Review what you're committing
git commit -m "feat: add export to burials page"
```

### 3. Push to main

```bash
git push origin main
```

You'll see output like:
```
Enumerating objects: 5, done.
Counting objects: 100% (5/5), done.
Compressing objects: 100% (3/3), done.
Writing objects: 100% (3/3), 1.23 KiB | 1.23 MiB/s, done.
remote: Bypassed rule violations for refs/heads/main:
remote: - Changes must be made through a pull request.
To github.com:Know-Kname/dmp-grants-dashboard
   abc1234..def5678  main -> main
```

### 4. Watch the deploy

- **GitHub Actions:** `github.com/Know-Kname/dmp-grants-dashboard/actions` — should show a running workflow
- **Vercel:** `vercel.com` → dmpgrants → Deployments — should show "Building"

### 5. Verify the live site

After ~60 seconds, open the production URL and spot-check the feature you changed. If it looks right, you're done.

---

## Preview deploy (feature branches)

When working on a larger feature, use a feature branch so you can share a preview URL before it goes to production.

```bash
# Create a new branch
git checkout -b feat/add-reports-page

# Work and commit normally
git add src/pages/Reports.tsx
git commit -m "feat: add reports page skeleton"

# Push the branch — this triggers a Vercel preview deploy
git push origin feat/add-reports-page
```

**What happens:**
1. Vercel detects the new branch push
2. Builds the branch code
3. Creates a unique URL: `dmpgrants-git-feat-add-reports-page-[hash].vercel.app`
4. If there's an open PR for this branch, Vercel posts the URL as a PR comment

**Preview deploys use the same env vars as production** (by default). They're full, functional builds — not a "lite" mode.

When you're satisfied with the preview:
1. Open a PR on GitHub (or merge directly if it's a small change)
2. After merging to `main`, the production deploy fires automatically

---

## When CI fails — what to do

Go to `github.com/Know-Kname/dmp-grants-dashboard/actions`, click the failed run, click the job that failed.

**Lint failure:**
```
error  'someVar' is defined but never used  @typescript-eslint/no-unused-vars
```
→ Remove the unused variable (or prefix with `_` if intentionally unused).

**Type check failure:**
```
error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
```
→ Fix the type: add a null check (`if (!value) return;`) or use the nullish coalescing operator (`value ?? 'default'`).

**Build failure:**
```
[vite] error: Failed to resolve entry for package 'some-package'
```
→ A package isn't installed. Run `npm install some-package`, commit `package.json` and `package-lock.json`.

**Test failure:**
```
AssertionError: expected 'Jan 1, 2024' to equal 'January 1, 2024'
```
→ The test expectation doesn't match the implementation. Either update the test (if the implementation is correct) or fix the implementation.

---

## When Vercel build fails

Go to Vercel → dmpgrants → Deployments → failed deploy → View Build Logs.

**The important part is the FIRST error.** Scroll up from the bottom to find it — Vercel shows output in order, and later errors are often cascading from the first.

Common Vercel-specific failures:

| Error | Cause | Fix |
|---|---|---|
| `Missing Supabase environment variables` | `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` not set in Vercel | Add them in Settings → Environment Variables, then redeploy |
| `Cannot find module` | A package in `imports` isn't in `package.json` | `npm install <package>`, commit `package-lock.json` |
| `tsc: error TS...` | TypeScript errors that passed locally but fail in Vercel's strict build | Run `npm run typecheck` locally — if it passes locally but fails in CI, check TypeScript version mismatch |
| `npm run build exited with 1` | Generic build failure — look for the actual error earlier in the log | |

---

## Monitoring a live deployment

After deploying, check that everything works:

1. **Visit the live URL** and navigate to the changed pages.
2. **Open browser devtools** (F12) → Console tab. Any red errors?
3. **Try a real user action** (create a burial, edit a work order) if the change touched data flow.
4. **Check Vercel logs:** Vercel dashboard → Logs tab → Functions log (shows any serverless function errors, though we don't use them currently).
5. **Check Supabase logs:** Supabase dashboard → Logs → API logs. Shows all requests and any errors from RLS or bad SQL.

---

## Rollback procedure

If something breaks in production and you need to revert immediately:

### Option 1: Vercel instant rollback (fastest — 30 seconds)

1. Go to Vercel → dmpgrants → Deployments.
2. Find the last deployment that was working (one before the broken one).
3. Click the three-dot menu (⋯) on it.
4. Click **"Promote to Production"**.
5. Confirm. Done — the production URL now serves the old build.

No code changes needed. Users see the working version within seconds.

### Option 2: Git revert (clean history)

```bash
git revert HEAD             # Creates a new commit that undoes the last commit
git push origin main        # Triggers a new Vercel deploy
```

Use this when you want the git history to accurately reflect that a commit was reverted.

### Option 3: git reset + force push (last resort)

```bash
git reset --hard HEAD~1     # Discard last commit entirely
git push --force origin main
```

⚠️ **Force push rewrites history.** Only do this if you're sure no one else has pulled the broken commit. Prefer Options 1 or 2.

---

## Environment promotion

Our setup has one environment per branch:

| Branch | Environment | URL pattern |
|---|---|---|
| `main` | Production | `dmpgrants-*.vercel.app` (set custom domain here) |
| any other branch | Preview | `dmpgrants-git-<branch-name>-*.vercel.app` |

There's no separate "staging" environment. If you want one:
1. Create a `staging` branch
2. In Vercel Settings → Git, mark `staging` as a "Production Branch alternative"
3. Point it to a test Supabase project (create one in Supabase dashboard)
4. Set different env vars for the staging deployment

---

## Deployment checklist

Use this before any significant release:

```
Pre-deploy:
  □ npm run lint — zero errors/warnings
  □ npm run typecheck — zero errors
  □ npm run test:run — all passing
  □ npm run build — completes without error
  □ Test the feature in the preview deploy URL
  □ No .env.local or API keys in the commit

Post-deploy:
  □ Visit the live URL
  □ Check browser console — no red errors
  □ Test the changed functionality with real data
  □ Check GitHub Actions — CI passing
  □ Check Vercel Deployments — green status
```

---

← [06 Supabase](06-supabase.md) | Next: [08 Environment Variables](08-environment.md) →
