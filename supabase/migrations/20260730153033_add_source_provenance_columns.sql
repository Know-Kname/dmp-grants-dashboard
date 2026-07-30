-- Provenance: where did this row come from, and which record in that system is it?
--
-- This is the single most load-bearing change in the phase. The partial
-- unique index below is the idempotency contract every future import
-- depends on: a load can be re-run after a partial failure and will update
-- rather than duplicate, because ON CONFLICT (source_system, source_ref)
-- has something to conflict against. Without it, the first real import --
-- 39K burials from a CSV whose own "Burial #" column is 0 on every row --
-- is a one-shot operation that cannot be safely retried, and retrying is
-- exactly what a first import needs.
--
-- Deliberately format-agnostic, so it can land now, before any source file
-- is finalised. `source_system` names the system of record (e.g. 'cemsites',
-- 'silver_ar_aging'), `source_ref` its key within that system. Rows created
-- by staff in this app leave both NULL.
--
-- The CHECK forces both-or-neither. Without it a row could carry a
-- source_system with a NULL source_ref, and because NULLs compare as
-- distinct in a unique index, unlimited such rows would slip past the
-- constraint -- a hole precisely where imports are sloppiest.

do $$
declare t text;
begin
  foreach t in array array[
    'accounts_payable','accounts_receivable','burials','cemeteries',
    'contract_items','contracts','customers','deposits','grants','graves',
    'inventory','lots','payment_schedule','sections','vendors','work_orders'
  ]
  loop
    execute format('alter table public.%I add column if not exists source_system text', t);
    execute format('alter table public.%I add column if not exists source_ref text', t);

    -- Postgres has no ADD CONSTRAINT IF NOT EXISTS, and the rest of this
    -- loop is guarded, so without this check the migration would be half
    -- idempotent -- which is worse than not idempotent at all, because a
    -- replay gets partway through the loop before aborting on
    -- "constraint already exists".
    if not exists (
      select 1 from pg_constraint
      where conrelid = format('public.%I', t)::regclass
        and conname = t || '_source_pair_complete'
    ) then
      execute format(
        'alter table public.%I add constraint %I check ((source_system is null) = (source_ref is null)) not valid',
        t, t || '_source_pair_complete');
      execute format(
        'alter table public.%I validate constraint %I', t, t || '_source_pair_complete');
    end if;

    execute format(
      'create unique index if not exists %I on public.%I (source_system, source_ref) where source_system is not null',
      'uq_' || t || '_source', t);

    execute format(
      'comment on column public.%I.source_system is %L', t,
      'System of record this row was imported from (NULL for rows entered in this app). Paired with source_ref.');
    execute format(
      'comment on column public.%I.source_ref is %L', t,
      'Primary key of this row within source_system. Unique per source_system; the ON CONFLICT target that makes imports idempotent.');
  end loop;
end $$;
