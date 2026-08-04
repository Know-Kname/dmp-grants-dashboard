-- Anchor the dashboard's time windows to the data, and add the KPIs the
-- cemetery register can actually populate.
--
-- WHAT WAS WRONG
--
-- Nothing in 20260731012746 was incorrect -- it faithfully reported zero. The
-- problem is that it measures a *live operational business* (this month, YTD,
-- last 30 days) while the database holds a 2020 historical interment register.
-- 796 burials exist and every burial KPI read 0, because 2020 is outside every
-- window. A zero with no explanation reads as a broken dashboard.
--
-- THE ANCHOR RULE
--
-- Burial windows now resolve against the latest date that actually has data,
-- falling back to current_date when the table is empty, and the anchor is
-- returned as `dataAsOf` so the UI can state the period instead of implying
-- "now". An explicit p_anchor argument overrides it.
--
-- The AR/AP aging views are deliberately NOT anchored and keep current_date:
-- an aging report is *defined* relative to today. A 2020 invoice really is
-- 2000+ days past due, and anchoring that would be a lie rather than a fix.
--
-- WHY THE OLD KEYS SURVIVE
--
-- `burialsThisMonth`, `burialsLastMonth` and `burialsYTD` are kept alongside
-- the new anchored counters. They are required (not optional) by
-- `dashboardSummarySchema` in the *currently deployed* bundle, so dropping them
-- here would make production fail its Zod parse the moment this migration
-- lands -- a broken page, not a stale one. They can go in a follow-up once the
-- new client is deployed. Their calendar-relative meaning is unchanged.
--
-- Adding keys is always safe in the other direction: that schema strips unknown
-- keys rather than rejecting them, so the database may grow a KPI before the
-- client learns to render it.

-- ---------------------------------------------------------------------------
-- Trends
--
-- The old single-argument functions must be dropped, not replaced: adding a
-- parameter creates a *new* signature, and monthly_burial_trend(12) would then
-- match both and fail as ambiguous. Dropping and recreating in one migration is
-- atomic, and the deployed client's one-argument call still resolves because
-- p_anchor carries a default.
--
-- Labels gain the year. With a register spanning more than one year 'Mon' alone
-- is ambiguous, and a 24-month window would show two identically-labelled Mays.
-- ---------------------------------------------------------------------------
drop function if exists public.monthly_burial_trend(integer);
drop function if exists public.monthly_revenue_trend(integer);

create or replace function public.monthly_burial_trend(
  p_months integer default 12,
  p_anchor date    default null
)
returns table (month_start date, label text, burials bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with anchor as (
    select date_trunc('month', coalesce(
             p_anchor,
             (select max(b.burial_date) from public.burials b),
             current_date))::date as a
  ),
  months as (
    select generate_series(
      (select a from anchor) - ((greatest(p_months, 1) - 1) || ' months')::interval,
      (select a from anchor),
      interval '1 month'
    )::date as m
  )
  select months.m,
         to_char(months.m, 'Mon YYYY'),
         count(b.id)
  from months
  left join public.burials b
    on date_trunc('month', b.burial_date)::date = months.m
  group by months.m
  order by months.m
$$;

create or replace function public.monthly_revenue_trend(
  p_months integer default 12,
  p_anchor date    default null
)
returns table (month_start date, label text, revenue numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with anchor as (
    select date_trunc('month', coalesce(
             p_anchor,
             (select max(d.date) from public.deposits d),
             current_date))::date as a
  ),
  months as (
    select generate_series(
      (select a from anchor) - ((greatest(p_months, 1) - 1) || ' months')::interval,
      (select a from anchor),
      interval '1 month'
    )::date as m
  )
  select months.m,
         to_char(months.m, 'Mon YYYY'),
         coalesce(sum(d.amount), 0)
  from months
  left join public.deposits d
    on date_trunc('month', d.date)::date = months.m
  group by months.m
  order by months.m
$$;

comment on function public.monthly_burial_trend(integer, date) is
  'Interments per month, zero-filled. Anchors on the latest burial_date unless p_anchor is given, so a historical register charts where its data is rather than as a flat line at today.';
comment on function public.monthly_revenue_trend(integer, date) is
  'Deposit totals per month, zero-filled. Anchors on the latest deposit date unless p_anchor is given. Deposits are cash received, not recognised revenue.';

-- ---------------------------------------------------------------------------
-- dashboard_summary
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with anchor as (
    select coalesce((select max(b.burial_date) from public.burials b),
                    current_date) as a
  ),
  referral_total as (
    select count(*)::numeric as n
    from public.burials where funeral_home is not null
  )
  select jsonb_build_object(
    'generatedAt', now(),
    -- Null when there are no burials at all, so the UI can tell "no data" from
    -- "data that happens to end today".
    'dataAsOf', (select max(b.burial_date) from public.burials b),

    -- Anchored burial counters -- what the new dashboard renders.
    'burialsLatestMonth', (select count(*) from public.burials
                            where date_trunc('month', burial_date)
                                  = date_trunc('month', (select a from anchor))),
    'burialsPriorMonth',  (select count(*) from public.burials
                            where date_trunc('month', burial_date)
                                  = date_trunc('month', (select a from anchor) - interval '1 month')),
    'burialsTrailing12',  (select count(*) from public.burials
                            where burial_date > (select a from anchor) - interval '12 months'
                              and burial_date <= (select a from anchor)),
    'totalInterments',    (select count(*) from public.burials),
    'intermentsByYear', (
      select coalesce(jsonb_object_agg(y.yr::text, y.n), '{}'::jsonb)
      from (select extract(year from burial_date)::int as yr, count(*) as n
            from public.burials group by 1) y),

    -- Legacy calendar-relative counters. Retained for the deployed bundle;
    -- see the header note before removing them.
    'burialsThisMonth', (select count(*) from public.burials
                          where date_trunc('month', burial_date) = date_trunc('month', current_date)),
    'burialsLastMonth', (select count(*) from public.burials
                          where date_trunc('month', burial_date)
                                = date_trunc('month', current_date - interval '1 month')),
    'burialsYTD',       (select count(*) from public.burials
                          where burial_date >= date_trunc('year', current_date)),

    -- Referral channel. The concentration figure is the point: on the 2020
    -- register two homes account for roughly half of all interments.
    'topFuneralHomes', (
      select coalesce(jsonb_agg(f order by f.n desc), '[]'::jsonb)
      from (
        select funeral_home as name,
               count(*) as n,
               round(100.0 * count(*) / nullif((select n from referral_total), 0), 1) as pct
        from public.burials
        where funeral_home is not null
        group by funeral_home
        order by count(*) desc
        limit 6
      ) f),
    'referralTop5Pct', (
      select round(100.0 * coalesce(sum(t.n), 0) / nullif((select n from referral_total), 0), 1)
      from (select count(*) as n from public.burials
            where funeral_home is not null
            group by funeral_home order by count(*) desc limit 5) t),
    'distinctFuneralHomes', (select count(distinct funeral_home) from public.burials
                              where funeral_home is not null),

    'topCounselors', (
      select coalesce(jsonb_agg(c order by c.n desc), '[]'::jsonb)
      from (select counselor as name, count(*) as n
            from public.burials where counselor is not null
            group by counselor order by count(*) desc limit 6) c),

    'ageBands', (
      select coalesce(jsonb_object_agg(b.band, b.n), '{}'::jsonb)
      from (select case when age_at_death < 18 then '0-17'
                        when age_at_death < 45 then '18-44'
                        when age_at_death < 65 then '45-64'
                        when age_at_death < 80 then '65-79'
                        else '80+' end as band,
                   count(*) as n
            from public.burials where age_at_death is not null
            group by 1) b),
    'medianAgeAtDeath', (
      select percentile_cont(0.5) within group (order by age_at_death)
      from public.burials where age_at_death is not null),

    'sectionsInUse', (select count(distinct section) from public.burials),
    'topSections', (
      select coalesce(jsonb_agg(s order by s.n desc), '[]'::jsonb)
      from (select section as name, count(*) as n
            from public.burials group by section
            order by count(*) desc limit 6) s),

    -- Occupancy is reported, never scored. Per the cemetery analytics doctrine
    -- high occupancy means less left to sell, so it carries no direction. And
    -- runway is genuinely not computable: the import only created graves that
    -- have an interment, so there is no available-space denominator. Saying so
    -- is correct; printing 100% occupancy would not be.
    'capacity', jsonb_build_object(
      'gravesTotal',    (select count(*) from public.graves),
      'gravesOccupied', (select count(*) from public.graves where status = 'occupied'),
      'lotsTotal',      (select count(*) from public.lots),
      'runwayYears',    null,
      'runwayReason',   'Only graves with a recorded interment were imported, so there is no available-space inventory to divide by annual absorption. Runway needs the full plot register.'),

    'customerCount', (select count(*) from public.customers),

    'vendorCount',      (select count(*) from public.vendors),
    'vendorSpendKnown', (select coalesce(sum(known_spend), 0) from public.vendors),
    'vendorSpendByCategory', (
      select coalesce(jsonb_object_agg(v.category, v.total), '{}'::jsonb)
      from (select category, sum(known_spend) as total
            from public.vendors
            where category is not null and known_spend is not null
            group by category) v),
    'topVendorsBySpend', (
      select coalesce(jsonb_agg(x order by x.spend desc), '[]'::jsonb)
      from (select name, category, known_spend as spend
            from public.vendors
            where known_spend is not null and known_spend > 0
            order by known_spend desc limit 5) x),

    -- Unchanged below: these read tables that are still empty. They return
    -- honest zeros, and the client renders an explicit empty state rather than
    -- a bare 0.
    'activeContracts',  (select count(*) from public.contracts where status = 'active'),
    'contractsValue',   (select coalesce(sum(total_amount), 0) from public.contracts where status = 'active'),

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
  'Every dashboard KPI in one round trip. Burial windows anchor on the latest burial_date (returned as dataAsOf); AR/AP aging stays relative to today by design. SECURITY INVOKER, so a deactivated user gets zeros rather than data.';

revoke all on function public.dashboard_summary()                 from public, anon;
revoke all on function public.monthly_burial_trend(integer, date)  from public, anon;
revoke all on function public.monthly_revenue_trend(integer, date) from public, anon;
grant execute on function public.dashboard_summary()                 to authenticated;
grant execute on function public.monthly_burial_trend(integer, date)  to authenticated;
grant execute on function public.monthly_revenue_trend(integer, date) to authenticated;
