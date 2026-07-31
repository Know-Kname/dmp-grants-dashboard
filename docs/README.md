# Documentation Index

Welcome to the DMP CMS documentation. Every guide is self-contained — you can read just one, or read them all in order to get a complete picture.

---

## If you're brand new

Read in this order:

1. **[01 Getting Started](01-getting-started.md)** — Get the app running on your machine in 10 minutes.
2. **[02 Architecture](02-architecture.md)** — Understand how the pieces fit together.
3. **[04 GitHub Guide](04-github.md)** — Learn the tools and workflows used to collaborate.
4. **[05 Vercel Guide](05-vercel.md)** — Understand how the app gets to the internet.
5. **[06 Supabase Guide](06-supabase.md)** — Understand the database and authentication.

---

## All guides

| # | Guide | One-line summary |
|---|---|---|
| 01 | [Getting Started](01-getting-started.md) | Clone, install, set up env vars, run locally |
| 02 | [Architecture](02-architecture.md) | Pages, data flow, routing, auth, state, tests |
| 03 | [Development](03-development.md) | Daily workflow, code conventions, testing, linting |
| 04 | [GitHub](04-github.md) | Branches, pull requests, CI, Dependabot, secrets |
| 05 | [Vercel](05-vercel.md) | Hosting, deploys, env vars, preview URLs, rollbacks |
| 06 | [Supabase](06-supabase.md) | Database, auth, schema, row-level security |
| 07 | [Deployment Pipeline](07-deployment.md) | Full path: code push → preview → production |
| 08 | [Environment Variables](08-environment.md) | Every variable: what it does, where to set it |
| 09 | [Security](09-security.md) | Keys, secrets, RLS, security headers, best practices |
| 10 | [Troubleshooting](10-troubleshooting.md) | Common errors and exactly how to fix them |
| 11 | [Design System](11-design-system.md) | Colors, components, dark mode, Tailwind tokens |
| 12 | [Roadmap](12-roadmap.md) | Upcoming features, known limitations |
| 13 | [CI & Database Operations](13-ci-and-database-operations.md) | Required Actions secrets, drift check, repo↔production DB divergence |
| 14 | [Auth Platform Evaluation](14-auth-platform-evaluation.md) | Clerk vs Supabase vs Azure vs others — decision record and recommendation |
| 15 | [Data Import](15-data-import.md) | What real DMP data is loaded, from which export, and how to undo it |

---

## Assets

- `screenshots/` — Drop app screenshots here; reference them from guides with `![](screenshots/filename.png)`.
- `diagrams/` — Architecture diagrams (ASCII or Mermaid).

---

## Repo-health audit history

[`archive/2026-05-06-platform-audit.md`](archive/2026-05-06-platform-audit.md)
records the 2026-05-06 full platform audit (GitHub/Vercel/Supabase hygiene,
security findings, remediation log). It was previously `/AUDIT_REPORT.md` at the
repo root, alongside three raw scratch dumps (`AUDIT_BRANCH_INVENTORY.txt`,
`AUDIT_COMMIT_LOG.txt`, `AUDIT_TAG_INVENTORY.txt`); those were `git rm`'d — they
were unannotated point-in-time output reproducible from `git branch`, `git log`,
and `git tag`, and had gone stale.

Treat the archived report as a snapshot, not a living doc; check the actual repo
state for anything time-sensitive. For current CI and database-divergence facts
see [13 — CI & Database Operations](13-ci-and-database-operations.md).

---

← Back to [README.md](../README.md)
