-- Let the dashboard tell "this module has no data" from "this module's data
-- is all filtered out".
--
-- THE BUG
--
-- Dashboard.tsx decides between a live KPI card and a "Not loaded" placeholder.
-- Three of the five modules made that decision from a *filtered* figure rather
-- than from whether the table has any rows at all:
--
--   Contracts    activeContracts > 0   -- false once every contract is paid
--   Receivables  unpaidAR > 0          -- false once every invoice is settled
--   Deposits     revenue30d > 0        -- false unless a deposit landed in 30 days
--
-- Each of those is a state a healthy business is *supposed* to reach. The
-- receivables case is the clearest: collecting every invoice would make the
-- card claim no receivables were ever loaded.
--
-- Deposits is the one that would have bitten first. Every DMP dataset imported
-- so far is 2020, so loading the deposit ledger would insert thousands of rows
-- and leave the card reading "Not loaded" -- indistinguishable from a failed
-- import.
--
-- THE FIX
--
-- Three unfiltered counts, so every module answers the same question: does the
-- source table have rows? Work Orders and Inventory already did this with
-- totalWO and totalInventory; this brings the other three in line.
--
-- Additive to the payload. dashboardSummarySchema strips unknown keys, so this
-- can land before the client that reads it -- the same property that let the
-- previous two migrations ship without breaking the deployed bundle.

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

    -- Modules whose tables are still empty. Each now carries an unfiltered
    -- total* count beside its filtered figures: the total decides whether the
    -- UI shows a live card or "Not loaded", and the filtered figures fill that
    -- card in. Keeping the two separate is the whole point -- a table can be
    -- full while every filtered figure in it is legitimately zero.
    'totalContracts',   (select count(*) from public.contracts),
    'activeContracts',  (select count(*) from public.contracts where status = 'active'),
    'contractsValue',   (select coalesce(sum(total_amount), 0) from public.contracts where status = 'active'),

    'totalAR',          (select count(*) from public.accounts_receivable),
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

    'totalDeposits',    (select count(*) from public.deposits),
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
  'Every dashboard KPI in one round trip. Burial windows anchor on the latest burial_date (returned as dataAsOf); AR/AP aging stays relative to today by design. total* counts report table population so the UI can distinguish an empty module from a fully-filtered one. SECURITY INVOKER, so a deactivated user gets zeros rather than data.';

revoke all on function public.dashboard_summary() from public, anon;
grant execute on function public.dashboard_summary() to authenticated;
