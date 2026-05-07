# DMP CMS — Operations Runbook

Quick reference for on-call situations and routine maintenance.

---

## Emergency Rollback (Vercel)

```bash
# 1. Confirm the problem
vercel logs --environment production --status-code 5xx --since 30m

# 2. Execute rollback (reverts to previous Vercel build artifact)
vercel rollback

# 3. Verify completion
vercel rollback status
curl -I https://[production-domain]

# 4. IMPORTANT: Rollback does NOT revert:
#    - Environment variables
#    - Database migrations
#    Only application code (the Vite build) is reverted.

# 5. After stabilizing: fix the root cause, then re-enable deploys
vercel rollback --undo
```

---

## Database Migrations

### Check sync state
```bash
supabase link --project-ref mgpwjnxtqcnoyjgebytg
supabase migration list
# LOCAL-only row = not applied to production → run supabase db push
# REMOTE-only row = dashboard drift → run supabase db pull, then commit
```

### Apply pending migrations
```bash
supabase db push         # applies all local migrations not yet on remote
supabase migration list  # verify all are APPLIED
```

### Capture remote-only changes (dashboard drift)
```bash
supabase db pull         # creates a new migration file with remote-only changes
git add supabase/migrations/
git commit -m "chore(supabase): capture dashboard-applied schema changes"
```

### Verify pg_cron jobs are running

The three nightly sweep jobs were applied via migration `20260506013429_pg_cron_overdue.sql`.
To confirm they are active:

```sql
-- Run in Supabase SQL Editor
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
-- Expected: 3 rows, all active = true, schedule = '0 1 * * *' (01:00 UTC)
```

If a job shows `active = false`, re-enable it:
```sql
SELECT cron.schedule('job-name-here', '0 1 * * *', $$...original SQL...$$);
```

---

## Environment Variables

All secrets are managed in **Azure Key Vault**. Do not hardcode values.

To update a Vercel environment variable:
```bash
vercel env rm VARIABLE_NAME production
vercel env add VARIABLE_NAME production  # paste new value when prompted
# Mark as Sensitive: Vercel Dashboard → Project → Settings → Env Vars → toggle Sensitive
vercel deploy --prod                     # redeploy to apply new value
```

Current variables (names only — values from Key Vault):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPENROUTER_API_KEY`

---

## Vercel Deployment

Automatic on push to `main`. Manual trigger:
```bash
vercel deploy --prod
```

Check deployment status:
```bash
vercel list --prod | head -5
```

View production errors:
```bash
vercel logs --environment production --since 1h
vercel logs --environment production --status-code 5xx --since 72h
```

---

## GitHub Actions

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci-typescript.yml` | Every PR + push | typecheck + lint + build |
| `release.yml` | Push to `main` | Auto-creates SemVer tag + GitHub Release |
| `supabase-migrations.yml` | Push to `main` (migrations only) | Auto-deploys DB migrations |
| `drift-check.yml` | Every Monday 09:00 UTC | Opens Issue if DB drift detected |
| `security-scan.yml` | Push + schedule | CodeQL + npm audit |
| `stale-bot.yml` | Schedule | Closes stale PRs/issues |
| `dependabot-automerge.yml` | Dependabot PRs | Auto-merges minor/patch bumps |

---

## RLS Policy Reference

### Trust model

All authenticated users are treated as equally trusted DMP staff. This is intentional:
DMP CMS has no public user accounts — every authenticated session is a staff member
who has been issued credentials. The `auth_all` policy reflects this flat trust model.

`USING(true) WITH CHECK(true)` is not a mistake or a placeholder — it is the correct
policy for a closed, staff-only internal tool. Per-role restrictions (admin vs. read-only
staff) can be layered on top if the trust model changes, without removing this base policy.

### Policies in use

```sql
-- All business tables: full access for any authenticated (staff) session
CREATE POLICY "auth_all" ON public.TABLE_NAME
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- burials only: allow anonymous reads for published memorial pages (QR code access)
CREATE POLICY "anon_memorial_read" ON public.burials
  FOR SELECT TO anon USING (memorial_published = true);
```

### Adding a new table

```sql
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_all ON public.new_table
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Then verify with `supabase db diff` and add a migration file with the standard header.

### If the trust model needs to change

When per-role policies become necessary (e.g., read-only field staff):
1. Keep `auth_all` as a base
2. Add a more restrictive `USING` clause for the specific role
3. Test with `SET ROLE` in SQL Editor before deploying
4. Document the new trust model here

---

## Contacts

- **Operations Coordinator:** Christian Hughes — chughes@detroitmemorialpark.com
- **Supabase project:** mgpwjnxtqcnoyjgebytg (us-east-1)
- **GitHub:** https://github.com/Know-Kname/dmpgrants
- **Vercel:** dmpgrants project (auto-deploy from `main`)
