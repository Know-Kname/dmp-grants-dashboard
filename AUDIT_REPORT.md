# Audit Report — DMP Cemetery Management System

**Audit Date:** 2026-05-06
**Auditor:** Claude (claude-opus-4-7) + Christian Hughes
**Stack:** React 18 · TypeScript 5 · Vite 4 · Supabase · Vercel · GitHub Actions

---

## Platform State at Audit Initiation

### GitHub

- Default branch: `main`
- Total branches: 31 | Stale (90+ days inactive): 29
- Latest Git tag on remote: NONE (scaffold-v1 exists locally only, never pushed)
- Branch protection on `main`: **No** — not configured
- GitHub Actions workflows: `ci-typescript.yml`, `dependabot-automerge.yml`, `pr-checks.yml`, `security-scan.yml`, `stale-bot.yml`
- SHA-pinned actions: **9 / 10** — `dependabot/fetch-metadata@v2` is unpinned (one fix needed)
- Open PRs: 19 (mix of stale AI-generated, abandoned, and Dependabot)
- Conventional Commits compliance (last 48 commits): **52%** — below 70% threshold
- `.env` files committed in history: **No** ✅

### Vercel

- Production branch: `main`
- Current production SHA: `cf2e9b21` (Apr 29, 2026) — **35+ commits BEHIND** feature branch
- April 2026 breach remediation: UNKNOWN — verify 2FA, activity log, team members
- Env var rotation post-breach: COMPLETE (user-managed via Azure Key Vault)
- Skew Protection: UNKNOWN — verify in Dashboard
- Env vars marked Sensitive: UNKNOWN — verify in Dashboard
- Framework: Vite/React SPA (not Next.js — CVE-2025-55184/55183 N/A)

### Supabase

- Project ref: `mgpwjnxtqcnoyjgebytg`
- Region: UNKNOWN — check Dashboard
- Local migration files: 4
  - `20260502_burial_memorial_published.sql`
  - `20260502_cemetery_hierarchy.sql`
  - `20260502_payment_schedule.sql`
  - `20260502_pg_cron_overdue.sql`
- Applied to remote: UNKNOWN — run `supabase migration list`
- Drift detected: UNKNOWN — run audit
- Tables without RLS: UNKNOWN — run audit SQL
- Auth Site URL: UNKNOWN — check Dashboard
- Google OAuth redirect URL configured: UNKNOWN — check Dashboard
- Edge Functions deployed: `send-payment-reminder` (UNKNOWN — verify in Dashboard)

### Linear

- Workspace: Not yet set up — Phase 9 scheduled
- GitHub integration: Not yet connected
- Active cycle: None

---

## Critical Findings (P0 — Fix Immediately)

| ID | Platform | Finding | Risk | Status |
|----|----------|---------|------|--------|
| P0-01 | GitHub/Vercel | `main` is 35+ commits behind `claude/finish-site-audit-2ICL3` — production missing Cemeteries, Maps, Memorial Pages, Google OAuth | Production running outdated code | ⬜ Fix: Phase 2 |
| P0-02 | Vercel | April 2026 breach — 2FA/passkey status unknown | Unauthorized access risk | ⬜ Fix: Phase 1 |
| P0-03 | Supabase | 4 migrations unconfirmed applied to production | Schema mismatch, app errors | ⬜ Fix: Phase 5 |

## High Priority (P1)

| ID | Platform | Finding | Risk | Status |
|----|----------|---------|------|--------|
| P1-01 | GitHub | 0 GitHub Releases, 0 remote tags | No release history, no rollback anchors | ⬜ Fix: Phase 7 |
| P1-02 | Code | `index.html`: 4 broken image refs (favicon-32x32, favicon-16x16, icon-192, og-image) | 404 errors on every page load | ⬜ Fix: Phase 3 |
| P1-03 | Code | `index.html` theme-color `#0d9488` (teal) — should be `#1a3d2b` (DMP forest green) | Wrong brand color in browser chrome | ⬜ Fix: Phase 3 |
| P1-04 | GitHub | No branch protection on `main` | Force-push could overwrite history | ⬜ Fix: Phase 4 |
| P1-05 | GitHub | No automated migration deployment workflow | Migrations must be run manually, high human error risk | ⬜ Fix: Phase 4 |
| P1-06 | GitHub | Conventional Commits compliance: 52% (last 48 commits) — below 70% threshold | Automated versioning unreliable | ⬜ Fix: Phase 4 (commitlint) |

## Medium Priority (P2)

| ID | Platform | Finding | Risk | Status |
|----|----------|---------|------|--------|
| P2-01 | Code | `package.json` version: `1.0.0` — should be `2.0.0` | Version mismatch misleads monitoring | ⬜ Fix: Phase 3 |
| P2-02 | Code | `src/config/company.ts` system.version: `1.0.0` — should be `2.0.0` | Displayed wrong version in app UI | ⬜ Fix: Phase 3 |
| P2-03 | GitHub | No `CHANGELOG.md` | No human-readable version history | ⬜ Fix: Phase 6 |
| P2-04 | GitHub | 31 stale branches, 19 open PRs | Confusing repo state, noise for contributors | ⬜ Fix: Phase 8 |
| P2-05 | GitHub | `dependabot/fetch-metadata@v2` not SHA-pinned | Supply chain risk | ⬜ Fix: Phase 4 |
| P2-06 | GitHub/Supabase | No weekly drift detection | Schema drift goes undetected until runtime error | ⬜ Fix: Phase 4 |

## Low Priority / Housekeeping (P3)

| ID | Platform | Finding | Status |
|----|----------|---------|--------|
| P3-01 | Code | No source file module headers on `api.ts`, `auth.tsx`, `supabase.ts`, `query.tsx`, `demo-data.ts`, `gemini.ts`, `useData.ts`, `CemeteryMap.tsx`, `company.ts`, `vercel.json` | ⬜ Fix: Phase 3 |
| P3-02 | Repo | No `RUNBOOK.md`, `CONTRIBUTING.md`, `.env.example` | ⬜ Fix: Phase 6 |
| P3-03 | Repo | No Linear project management integration | ⬜ Fix: Phase 9 |

---

## Change Log

| Timestamp | Phase | Action | Result |
|-----------|-------|--------|--------|
| 2026-05-06 | 0 | Created AUDIT_REPORT.md, captured branch/tag/commit inventory | ✅ Baseline established |
| 2026-05-06 | 2 | Merged claude/finish-site-audit-2ICL3 → main, pushed to remote | ✅ Production now at v2.0.0 |
| 2026-05-06 | 3 | Fixed index.html (4 broken refs, theme-color), bumped versions to 2.0.0, added source headers | ✅ |
| 2026-05-06 | 4 | Added release.yml, supabase-migrations.yml, drift-check.yml, commitlint, husky, SHA-pinned all actions | ✅ |
| 2026-05-06 | 5 | Applied 3 DMP migrations: cemetery_hierarchy, payment_schedule, burial_memorial_published | ✅ |
| 2026-05-06 | 5 | Applied RLS + auth_all policies to 12 previously unprotected business tables | ✅ CRITICAL fix |
| 2026-05-06 | 5 | pg_cron migration PENDING — enable pg_cron extension in Dashboard first, then run migration | ⬜ Manual |
