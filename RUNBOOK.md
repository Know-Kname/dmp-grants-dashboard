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

### pg_cron migration (pending — one-time manual step)
1. Supabase Dashboard → Database → Extensions → search "pg_cron" → Enable
2. Run: `supabase db push` (applies `20260502_pg_cron_overdue.sql`)
3. Verify: `SELECT jobname, schedule FROM cron.job;` in SQL Editor

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

All business tables use `auth_all` for authenticated staff:
```sql
-- Authenticated users: full access
CREATE POLICY "auth_all" ON public.TABLE_NAME
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- burials additionally allows anon to read published memorials:
CREATE POLICY "anon_memorial_read" ON public.burials
  FOR SELECT TO anon USING (memorial_published = true);
```

To add a table: enable RLS, create both policies, test with `supabase db diff`.

---

## Contacts

- **Operations Coordinator:** Christian Hughes — chughes@detroitmemorialpark.com
- **Supabase project:** mgpwjnxtqcnoyjgebytg (us-east-1)
- **GitHub:** https://github.com/Know-Kname/dmpgrants
- **Vercel:** dmpgrants project (auto-deploy from `main`)
