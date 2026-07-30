-- Make created_at/updated_at trustworthy.
--
-- Three problems, fixed together because fixing them separately would mean
-- rewriting the same 16 tables three times:
--
-- 1. NULLABLE. Every one of the 131 legacy rows had created_at IS NULL, so
--    ordering by it was non-deterministic and "when did this arrive" was
--    unanswerable. The column had a DEFAULT, but a default does nothing when
--    an import passes NULL explicitly -- which is what happened.
--
-- 2. MIXED TIME-ZONE TYPES. Ten tables used `timestamp without time zone`
--    and five used `timestamptz`. Aging buckets are computed against
--    CURRENT_DATE; comparing a naive timestamp to a tz-aware one silently
--    reinterprets it in the session time zone, which puts an invoice in the
--    wrong bucket near midnight and around DST. Standardising on timestamptz
--    now costs nothing (the tables are empty); doing it after a 39K-row
--    burial import would be a rewrite of every page of every table.
--
-- 3. updated_at NEVER UPDATED. There was no trigger anywhere in the schema,
--    so updated_at only ever held its insert-time default unless a client
--    remembered to set it. Half the legacy AP rows proved it: 55 of 90 had
--    a stale updated_at from the one pg_cron sweep that ever ran.
--
-- The backfill below is a no-op on this database (the tables are empty after
-- the preceding migration). It is kept so the migration is also correct when
-- replayed against a branch or a restored backup that still holds rows.

-- One documented sentinel for rows whose true creation time is unknowable.
-- Deliberately not now() (which would claim legacy rows were created during
-- a migration) and not due_date (which would conflate a business date with a
-- record-keeping one). 2000-01-01Z sorts before every real row and is
-- obviously artificial when it shows up in a UI.
do $$
declare
  legacy_ts constant timestamptz := timestamptz '2000-01-01 00:00:00+00';
  t text;
  has_updated boolean;
begin
  foreach t in array array[
    'accounts_payable','accounts_receivable','burials','cemeteries',
    'contract_items','contracts','customers','deposits','grants','graves',
    'inventory','lots','payment_schedule','sections','vendors','work_orders'
  ]
  loop
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'updated_at'
    ) into has_updated;

    -- created_at: naive -> timestamptz (existing values are already UTC),
    -- backfill, default, NOT NULL.
    --
    -- Branch on the CURRENT type. Applying `at time zone 'UTC'` to a column
    -- that is ALREADY timestamptz does the opposite of what is wanted: it
    -- yields a naive UTC wall clock, which ALTER ... TYPE timestamptz then
    -- re-interprets in the session TimeZone. That round-trip is lossy and
    -- session-dependent -- replaying this file from a psql session with
    -- PGTZ=America/Detroit would shift every row in the five tables that
    -- were created as timestamptz (cemeteries, sections, lots, graves,
    -- payment_schedule) by 4-5 hours, silently and with no error.
    --
    -- It happened to be harmless on first application (those tables were
    -- empty and the Supabase session TimeZone is UTC), but the file must be
    -- correct for the replay-against-a-restored-backup case it claims to
    -- support below.
    if (select data_type from information_schema.columns
          where table_schema = 'public' and table_name = t and column_name = 'created_at')
       = 'timestamp without time zone' then
      execute format(
        'alter table public.%I alter column created_at type timestamptz using created_at at time zone ''UTC''', t);
    end if;
    execute format(
      'update public.%I set created_at = $1 where created_at is null', t) using legacy_ts;
    execute format(
      'alter table public.%I alter column created_at set default now()', t);
    execute format(
      'alter table public.%I alter column created_at set not null', t);

    if has_updated then
      if (select data_type from information_schema.columns
            where table_schema = 'public' and table_name = t and column_name = 'updated_at')
         = 'timestamp without time zone' then
        execute format(
          'alter table public.%I alter column updated_at type timestamptz using updated_at at time zone ''UTC''', t);
      end if;
      -- Fall back to created_at, not the sentinel: a row that was created and
      -- never edited has updated_at = created_at, which is the truth.
      execute format(
        'update public.%I set updated_at = created_at where updated_at is null', t);
      execute format(
        'alter table public.%I alter column updated_at set default now()', t);
      execute format(
        'alter table public.%I alter column updated_at set not null', t);
    end if;
  end loop;
end $$;

-- The touch trigger. `set search_path = ''` per Supabase's function-search-path
-- advisor; the body references no objects, so an empty path is sufficient.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at = now(). Attached to every table that has an updated_at column.';

do $$
declare t text;
begin
  foreach t in array array[
    'accounts_payable','accounts_receivable','burials','cemeteries','contracts',
    'customers','grants','graves','inventory','lots','payment_schedule',
    'sections','vendors','work_orders'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
