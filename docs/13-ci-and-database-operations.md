# 13 — CI & Database Operations

Everything a human has to do by hand to make the GitHub Actions workflows in
`.github/workflows/` actually work, plus the log of known repo↔production
database divergence.

Nothing in this guide can be automated by an agent: repository secrets, repo
settings, and Supabase credentials all require a human with admin rights.

---

## 1. Required repository secrets

Add these under **Settings → Secrets and variables → Actions → New repository
secret**. Until all three exist, `supabase-migrations.yml` and
`drift-check.yml` fail fast on their "Verify required secrets are configured"
step with an error naming exactly which ones are missing.

| Secret | Value | Where to get it |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | A Supabase personal access token | <https://supabase.com/dashboard/account/tokens> → **Generate new token**. Scope it to this account; the CLI needs it to `link` and `db push`. |
| `PRODUCTION_PROJECT_REF` | `mgpwjnxtqcnoyjgebytg` | This is not really a secret — it is already in `supabase/config.toml` and appears in the project URL. It stays a secret only because both workflows already reference it that way; changing that is a separate cleanup. |
| `PRODUCTION_DB_PASSWORD` | The project's Postgres password | Supabase dashboard → **Project Settings → Database → Database password**. If nobody has it, use **Reset database password** there and store the new one in the password manager *and* in this secret. |

### Verifying

1. Actions → **Deploy Supabase Migrations** → **Run workflow** (it has a
   `workflow_dispatch` trigger).
2. The run should get past "Verify required secrets are configured" and print a
   migration table at "Verify migration state pre-push".

### Why this was broken

All three secrets were unset and expanded to empty strings, so the link step ran
literally as:

```
supabase link --project-ref "" --password ""
```

which fails with what looks like an authentication error rather than a
configuration gap. The guard step now catches this before the CLI runs.

---

## 2. Dependabot auto-merge (`dependabot-automerge.yml`)

This workflow **cannot work with the default `GITHUB_TOKEN`** and currently
no-ops with a warning.

On a `pull_request` event raised by Dependabot, GitHub downgrades
`secrets.GITHUB_TOKEN` to read-only *regardless of the workflow's `permissions:`
block*, because Dependabot PRs are treated as coming from a fork. So
`gh pr merge --auto --squash` fails with a permissions error.

Pick one:

- **Option A (recommended).** Create a fine-grained PAT scoped to this repo with
  **Contents: read/write** and **Pull requests: read/write**, and store it as the
  repository secret `DEPENDABOT_AUTOMERGE_TOKEN`. The workflow already prefers
  it and skips cleanly when it is absent.
- **Option B.** Switch the trigger to `pull_request_target`, which does receive a
  writable token — but only with a hardened `if:` guard, since
  `pull_request_target` runs with repository secrets against PR head code.
- **Option C.** Leave it as-is and merge Dependabot PRs by hand.

Either way, **Settings → General → Pull Requests → Allow auto-merge** must be
enabled, or `gh pr merge --auto` is rejected outright.

> The workflow showing as *skipped* on human-authored PRs is correct — that is
> the `if: github.actor == 'dependabot[bot]'` guard doing its job. Do not
> "fix" it.

---

## 3. Known repo ↔ production database divergence

The production project (`mgpwjnxtqcnoyjgebytg`) records migrations that have no
file in this repo. Read this before running `supabase db reset` or trusting a
clean drift check.

### 3a. Benign — do not recreate

| Version | Name |
|---|---|
| `20260124040716` | `create_flights_table` |
| `20260124040723` | `create_reviews_table` |

Leftovers from the Supabase starter template. `20260506013416_drop_template_tables.sql`
drops both with `IF EXISTS`, so on a fresh `db reset` the tables are never
created and the drop no-ops. Net schema matches production. **Recreating these
files would be wrong** — it would reintroduce tables the repo deliberately drops.

### 3b. Recovered — now committed

| Version | Name |
|---|---|
| `20260523232936` | `add_covering_indexes_for_unindexed_fks` |

**Not** benign. This was the only source of covering indexes on three
foreign keys, and nothing else in the repo recreated them, so a `db reset` from
`main` produced a schema where those FK joins sequential-scan.

The DDL was read back out of
`supabase_migrations.schema_migrations.statements` on the production project and
committed verbatim as
`supabase/migrations/20260523232936_add_covering_indexes_for_unindexed_fks.sql`.
It creates:

- `idx_contract_items_contract_id` on `contract_items (contract_id)`
- `idx_deposits_customer_id` on `deposits (customer_id)`
- `idx_inventory_vendor_id` on `inventory (vendor_id)`

All three statements are `create index if not exists`, and production already has
the version recorded as applied, so committing the file changes nothing in
production — it only repairs fresh and local resets.

### 3c. Still divergent — the base schema

The repo has **no `create table` migration for the core business tables**
(`customers`, `contracts`, `burials`, `inventory`, `work_orders`, `grants`,
`vendors`, `accounts_payable`, `accounts_receivable`, `deposits`). They were
created in the Supabase dashboard before migrations were adopted, and were never
captured as a file. Consequently these production indexes also have no repo
source:

`idx_ap_vendor`, `idx_ar_customer`, `idx_contracts_customer`,
`idx_work_orders_assigned_to`, `idx_work_orders_status`, `idx_burials_date`,
`idx_burials_location`, `idx_grants_status`, `idx_inventory_category`

**A `supabase db reset` from this repo does not currently produce a working
schema.** Fixing this properly means running `supabase db pull` against
production to generate a baseline migration and committing it ahead of
`20260506002740_cemetery_hierarchy.sql`. That is a larger change than the CI
repair this document accompanies and is deliberately left open.

### 3d. Ordering dependency

Four migrations dated `20260730*` are applied in production
(`archive_and_wipe_legacy_ap_vendors`, `timestamps_not_null_tz_and_touch_triggers`,
`money_and_quantity_check_constraints`, `add_source_provenance_columns`,
`allow_overpayment_refunds_and_harden_provenance`) but live only on the unmerged
branch `claude/phase-1-data-integrity`. They are **not** copied here — they merge
with that branch.

Because `20260523232936` sorts before all of them, merge order does not matter
for correctness. But until that branch lands, a drift check run against
production will legitimately report those `20260730*` versions as
remote-only. That is expected, not a new fault.

---

## 4. Why the drift check never caught any of this

`drift-check.yml` had four independent defects, all now fixed:

1. **Unresolvable action pin.** `supabase/setup-cli` was pinned to
   `78e2f5c76c9df4afd4b7ed5cac1c5b2b0b8e7c71`, a SHA that does not exist in that
   repository. All 12 scheduled runs failed with "Unable to resolve action"
   before doing any work. The sibling `supabase-migrations.yml` had already been
   moved to `@v1` in `daee2ef`; this file was missed.
2. **Missing credentials.** It never passed `--password` to `supabase link`, so
   the link could not reach the database even with a valid token.
3. **No `permissions:` block.** On a `schedule` event the default
   `GITHUB_TOKEN` is read-only, so `github.rest.issues.create` would have
   returned 403. It now declares `issues: write, contents: read`.
4. **An unsound drift regex.** The check was:

   ```
   grep -qE "^\s*│\s+[0-9]+.*│\s*$"
   ```

   which matches any table row whose first cell is numeric — i.e. **every** data
   row, in sync or not, because the Local column always holds a version number.
   Had the workflow ever run, it would have opened a drift issue 100% of the
   time. It is replaced with an explicit Local-vs-Remote comparison: a row is in
   sync only when the same 14-digit version appears in both columns. The parser
   is column-position-independent (the CLI's table borders have varied across
   releases) and fails loudly if it cannot parse any rows at all.

---

## 5. Action pin audit

Every `uses:` SHA in `.github/workflows/` was checked by fetching the object
from the upstream repository
(`git fetch --depth=1 https://github.com/<owner>/<repo> <sha>`):

| Action | Pin | Result |
|---|---|---|
| `supabase/setup-cli` | `78e2f5c…` | **did not resolve** — replaced with `@v1` |
| `anothrNick/github-tag-action` | `a29250a…` | **did not resolve** — replaced with `4ed44965e0db8dab2b466a16da04aec3cc312fd8` (`v1` / `1.75.0`) |
| `dependabot/fetch-metadata` | `d7284e0…` | **did not resolve** — replaced with `21025c705c08248db411dc16f3619e6b5f9ea21a` (`v2` / `v2.5.0`) |
| `softprops/action-gh-release` | `c062e08…` | resolves |
| `actions/stale` | `5bef64f…` | resolves |
| `actions/github-script` | `3a2844b…` | resolves |
| `actions/checkout` | `11bd719…` | resolves |
| `actions/setup-node` | `48b55a0…` | resolves |

Replacement SHAs were taken from `git ls-remote --tags` on the upstream
repository and then confirmed to be fetchable commit objects — not copied from
a changelog or guessed.

---

## 6. Release workflow gating

`release.yml` triggers on push to `main`. Previously that meant every commit —
including docs-only and CI-only ones — patch-bumped the version. It is now
gated with a `paths:` filter covering shipped code (`src/`, `api/`, `public/`,
build config, `supabase/migrations/`) plus a `workflow_dispatch` trigger for
cutting a release the filter would skip.

---

← Back to [docs/README.md](README.md)
