-- Server-side aggregation: aging views and the dashboard summary RPC.
--
-- WHAT THIS FIXES
--
-- Dashboard.tsx fetches seven whole tables (`useWorkOrders`, `useBurials`,
-- `useInventory`, `useReceivables`, `useDeposits`, `useContracts`, `useGrants`)
-- and reduces them in ten `useMemo`s in the browser. Nothing in that path is
-- bounded, and PostgREST caps a response at ~1000 rows with no truncation
-- signal -- so past that threshold the KPIs do not error, they quietly go
-- wrong, dropping the oldest rows first. With 39K burials the trend charts
-- would show a business that collapsed years ago.
--
-- Aggregating in SQL also fixes a quieter problem: `SUM` over `numeric` is
-- exact, while JS `reduce` over doubles drifts. On a full ledger the dashboard
-- and the accountant would disagree by cents with no way to say which is right.
--
-- ON `status` VERSUS DATE ARITHMETIC
--
-- The aging views below derive their buckets from `due_date` rather than from
-- the `status` column. Note the reason, because an earlier plan got it wrong
-- and it is worth not repeating: it is NOT that the pg_cron sweep never runs.
-- It does -- `mark-overdue-ar`, `mark-overdue-ap` and `mark-overdue-schedule`
-- are all active on `0 1 * * *`, with 258 successful runs as of this migration.
--
-- The real reason is subtler. The sweep runs once daily at 01:00 UTC, so
-- `status` lags reality by up to a day, and it depends on a scheduled job
-- continuing to run for a number on a financial dashboard to stay true. Date
-- arithmetic costs nothing, is always current, and survives someone disabling
-- the job. `status` remains the right thing for a human to filter a worklist
-- by; it is the wrong thing to compute an aging report from.
--
-- SECURITY
--
-- Views are `security_invoker = on` so they are subject to the caller's RLS --
-- without it a view owned by postgres would hand every row to a deactivated
-- user. Functions are SECURITY INVOKER for the same reason: `dashboard_summary`
-- must show a `readonly` user exactly what they could have read themselves, and
-- nothing to someone whose profile is inactive. Verified on a local replay: a
-- deactivated profile gets 0 for every KPI, a readonly profile gets real ones.

-- ---------------------------------------------------------------------------
-- Aging views
-- ---------------------------------------------------------------------------
create or replace view public.v_ar_aging
with (security_invoker = on) as
select
  ar.id,
  ar.customer_id,
  ar.invoice_number,
  ar.amount,
  ar.amount_paid,
  ar.amount - ar.amount_paid                      as open_balance,
  ar.due_date,
  ar.status,
  greatest(0, (current_date - ar.due_date::date)) as days_past_due,
  case
    when ar.amount - ar.amount_paid <= 0        then 'settled'
    when ar.due_date::date >= current_date      then 'current'
    when current_date - ar.due_date::date <= 30 then '1_30'
    when current_date - ar.due_date::date <= 60 then '31_60'
    when current_date - ar.due_date::date <= 90 then '61_90'
    else '90_plus'
  end                                             as bucket
from public.accounts_receivable ar;

create or replace view public.v_ap_aging
with (security_invoker = on) as
select
  ap.id,
  ap.vendor_id,
  ap.invoice_number,
  ap.amount,
  ap.amount_paid,
  ap.amount - ap.amount_paid                      as open_balance,
  ap.due_date,
  ap.status,
  greatest(0, (current_date - ap.due_date::date)) as days_past_due,
  case
    when ap.amount - ap.amount_paid <= 0        then 'settled'
    when ap.due_date::date >= current_date      then 'current'
    when current_date - ap.due_date::date <= 30 then '1_30'
    when current_date - ap.due_date::date <= 60 then '31_60'
    when current_date - ap.due_date::date <= 90 then '61_90'
    else '90_plus'
  end                                             as bucket
from public.accounts_payable ap;

comment on view public.v_ar_aging is
  'Receivables with open balance and aging bucket derived from due_date, not from status. security_invoker: the caller''s RLS applies.';
comment on view public.v_ap_aging is
  'Payables with open balance and aging bucket derived from due_date, not from status. security_invoker: the caller''s RLS applies.';

grant select on public.v_ar_aging to authenticated;
grant select on public.v_ap_aging to authenticated;

-- ---------------------------------------------------------------------------
-- Monthly trends
--
-- generate_series zero-fills months with no rows, so the chart keeps its shape
-- instead of collapsing gaps -- which is what the client's `months.map()` did.
-- Returned as ordered rows; the client maps them to its {month, Burials} and
-- {month, Revenue} series.
-- ---------------------------------------------------------------------------
create or replace function public.monthly_burial_trend(p_months integer default 12)
returns table (month_start date, label text, burials bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', current_date) - ((greatest(p_months, 1) - 1) || ' months')::interval,
      date_trunc('month', current_date),
      interval '1 month'
    )::date as m
  )
  select months.m,
         to_char(months.m, 'Mon'),
         count(b.id)
  from months
  left join public.burials b
    on date_trunc('month', b.burial_date)::date = months.m
  group by months.m
  order by months.m
$$;

create or replace function public.monthly_revenue_trend(p_months integer default 12)
returns table (month_start date, label text, revenue numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', current_date) - ((greatest(p_months, 1) - 1) || ' months')::interval,
      date_trunc('month', current_date),
      interval '1 month'
    )::date as m
  )
  select months.m,
         to_char(months.m, 'Mon'),
         coalesce(sum(d.amount), 0)
  from months
  left join public.deposits d
    on date_trunc('month', d.date)::date = months.m
  group by months.m
  order by months.m
$$;

-- ---------------------------------------------------------------------------
-- dashboard_summary
--
-- One round trip instead of seven full-table downloads. Deliberately does NOT
-- include the month trends: the 6M/12M/24M control on the dashboard changes
-- only the trend range, and bundling them would refetch every KPI on each
-- toggle.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'generatedAt', now(),

    'burialsThisMonth', (select count(*) from public.burials
                          where date_trunc('month', burial_date) = date_trunc('month', current_date)),
    'burialsLastMonth', (select count(*) from public.burials
                          where date_trunc('month', burial_date)
                                = date_trunc('month', current_date - interval '1 month')),
    'burialsYTD',       (select count(*) from public.burials
                          where burial_date >= date_trunc('year', current_date)),

    'activeContracts',  (select count(*) from public.contracts where status = 'active'),
    'contractsValue',   (select coalesce(sum(total_amount), 0) from public.contracts where status = 'active'),

    -- Open balance and overdue count both come from the aging view, so the
    -- dashboard and any future AR report cannot disagree.
    'arOutstanding',    (select coalesce(sum(open_balance), 0) from public.v_ar_aging
                          where bucket <> 'settled'),
    'unpaidAR',         (select count(*) from public.v_ar_aging where bucket <> 'settled'),
    'overdueAR',        (select count(*) from public.v_ar_aging
                          where bucket not in ('settled', 'current')),

    'apOutstanding',    (select coalesce(sum(open_balance), 0) from public.v_ap_aging
                          where bucket <> 'settled'),

    'activeWO',         (select count(*) from public.work_orders where status = 'in_progress'),
    'totalWO',          (select count(*) from public.work_orders),

    'lowStock',         (select count(*) from public.inventory where quantity <= reorder_point),
    'totalInventory',   (select count(*) from public.inventory),

    'revenue30d',       (select coalesce(sum(amount), 0) from public.deposits
                          where date >= current_date - interval '30 days'),
    'revenuePrior30d',  (select coalesce(sum(amount), 0) from public.deposits
                          where date >= current_date - interval '60 days'
                            and date <  current_date - interval '30 days'),

    'workOrdersByStatus', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
      from (select status, count(*) as n from public.work_orders group by status) s),

    'inventoryByCategory', (
      select coalesce(jsonb_object_agg(category, n), '{}'::jsonb)
      from (select category, count(*) as n from public.inventory group by category) c),

    'upcomingGrants', (
      select coalesce(jsonb_agg(g order by g."daysLeft"), '[]'::jsonb)
      from (
        select id, title, source, amount, deadline, status,
               (deadline - current_date) as "daysLeft"
        from public.grants
        where status in ('available', 'applied')
          and deadline is not null
          and deadline >= current_date
          and deadline <= current_date + 30
        order by deadline
        limit 3
      ) g)
  )
$$;

comment on function public.dashboard_summary() is
  'Every dashboard KPI in one round trip. SECURITY INVOKER, so a deactivated user gets zeros rather than data. Month trends are separate functions so the range toggle does not refetch KPIs.';

revoke all on function public.dashboard_summary()      from public, anon;
revoke all on function public.monthly_burial_trend(integer)  from public, anon;
revoke all on function public.monthly_revenue_trend(integer) from public, anon;
grant execute on function public.dashboard_summary()      to authenticated;
grant execute on function public.monthly_burial_trend(integer)  to authenticated;
grant execute on function public.monthly_revenue_trend(integer) to authenticated;
