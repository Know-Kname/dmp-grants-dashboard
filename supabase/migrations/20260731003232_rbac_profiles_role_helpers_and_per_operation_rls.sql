-- Role-based access control: profiles, role helpers, and per-operation RLS.
--
-- WHAT THIS REPLACES
--
-- All 16 business tables carried a single policy `auth_all` -- `FOR ALL TO
-- authenticated USING (true) WITH CHECK (true)`. That is not access control;
-- it is RLS switched on and then switched back off. Any authenticated user
-- could read, alter, or DELETE every burial record, contract and invoice, with
-- no audit trail.
--
-- That was survivable while exactly one account existed. It stops being
-- survivable the moment office staff get logins, which is the entire point of
-- the password-reset work in #86. Hence this lands BEFORE the first invite,
-- not after.
--
-- WHY ROLE LIVES IN A TABLE, NOT IN THE JWT
--
-- `auth.users.user_metadata` is writable by the user it belongs to, via
-- `updateUser()`. Any role read from it is self-assigned -- a user could make
-- themselves an admin with one client-side call. The app currently reads
-- `user_metadata.role` for display only, which is the sole reason that is not
-- already a privilege-escalation bug. `profiles` is writable only through the
-- policies below.
--
-- THE (SELECT ...) WRAPPER IS LOAD-BEARING
--
-- Policies call the helpers as `(select public.can_write())` rather than
-- `public.can_write()`. Postgres hoists a scalar subquery to a once-per-
-- statement InitPlan; a bare function call is evaluated once per row. On a
-- 39,000-row burial scan that is the difference between one profile lookup and
-- 39,000 of them. Same predicate, same result, ~4 orders of magnitude apart.
--
-- ROLLBACK
--
--   drop policy if exists sel_active on public.<table>;   -- per table, per op
--   ...
--   create policy auth_all on public.<table> for all to authenticated
--     using (true) with check (true);
--   drop function if exists public.can_write, public.is_admin,
--                           public.current_app_role, public.is_active_user;
--   drop table if exists public.profiles;
--
-- Restoring `auth_all` restores the previous (wide-open) behaviour, so this is
-- reversible without data loss. The anon memorial policy is never touched.

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'readonly',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check') then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('admin', 'staff', 'readonly'));
  end if;
end $$;

comment on table public.profiles is
  'Application identity and role for each auth user. Role is authoritative here, never in user_metadata (which the user can write).';
comment on column public.profiles.role is
  'admin: full access incl. DELETE and user management. staff: read + create/update. readonly: read only.';
comment on column public.profiles.is_active is
  'Deactivated users keep their auth account but every RLS policy denies them. Cheaper and more reversible than deleting.';

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every auth user gets a profile. Default 'readonly' so a new account can see
-- but not change anything until an admin promotes it -- the safe direction to
-- fail. SECURITY DEFINER because the inserting context is auth, not the user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing accounts, then make the founding account an admin.
-- Order matters: if the policies below activated before this ran, the only
-- existing user would be 'readonly' and could not promote anyone -- including
-- themselves. That is how you lock yourself out of your own database.
insert into public.profiles (id, email, full_name)
select u.id, u.email, u.raw_user_meta_data ->> 'full_name'
from auth.users u
on conflict (id) do nothing;

update public.profiles
set role = 'admin', is_active = true
where email = 'chughes@detroitmemorialpark.com';

-- ---------------------------------------------------------------------------
-- 2. Role helpers
--
-- SECURITY DEFINER so they can read `profiles` without being subject to
-- `profiles`' own RLS -- otherwise every policy that calls them would recurse
-- into the policy protecting the table they read. STABLE so Postgres may cache
-- within a statement. `set search_path = ''` per the function-search-path
-- advisor; every reference below is schema-qualified.
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid()) and p.is_active
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  )
$$;

create or replace function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('admin', 'staff'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

comment on function public.can_write() is
  'True for admin and staff. Call as (select public.can_write()) inside policies so Postgres hoists it to a once-per-statement InitPlan.';

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.is_active_user()  from public, anon;
revoke all on function public.can_write()       from public, anon;
revoke all on function public.is_admin()        from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_active_user()  to authenticated;
grant execute on function public.can_write()       to authenticated;
grant execute on function public.is_admin()        to authenticated;

-- ---------------------------------------------------------------------------
-- 3. profiles RLS
--
-- A user may read their own profile and admins may read all. Only admins may
-- change a profile, and INSERT is closed entirely to PostgREST -- rows arrive
-- via the auth trigger, so an open INSERT would let anyone mint a profile for
-- an arbitrary uuid. DELETE is closed too; deactivate instead.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 4. Per-operation policies on the business tables
--
-- SELECT  -> any active profile
-- INSERT  -> admin or staff
-- UPDATE  -> admin or staff
-- DELETE  -> admin only
--
-- `burials.anon_memorial_read` is deliberately NOT dropped: it is the only
-- anon grant in the schema and the public memorial page depends on it.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'accounts_payable','accounts_receivable','burials','cemeteries',
    'contract_items','contracts','customers','deposits','grants','graves',
    'inventory','lots','payment_schedule','sections','vendors','work_orders'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists auth_all on public.%I', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select public.is_active_user()))', t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check ((select public.can_write()))', t || '_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using ((select public.can_write())) with check ((select public.can_write()))',
      t || '_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using ((select public.is_admin()))', t || '_delete', t);
  end loop;
end $$;
