-- Aggregate the contract ledger for the dashboard: one `sales` object on
-- dashboard_summary(), plus a monthly contract trend beside the existing two.
--
-- NAMING IS A CORRECTNESS REQUIREMENT HERE, NOT A PREFERENCE
--
-- Every figure below is the sum of `contracts.total_amount` over contracts the
-- CemSites "paid in full" report says were settled. That is an operational
-- **sale value** -- a booking figure -- and it is not recognised revenue:
--
--   * a pre-need contract is cash collected years before the service is
--     delivered, and recognising it on collection would overstate the period;
--   * the report is a payment-completion register, so a contract enters it in
--     the period it was *paid off*, which may be decades after it was signed
--     (the corpus contains contracts signed in 1962);
--   * trust and perpetual-care components are inside these totals and are not
--     the association's money to recognise.
--
-- So every key here is `value` / `saleValue`, never `revenue`, and the UI must
-- carry the qualifier. Nothing on this dashboard may be titled "Revenue" from
-- this source.
--
-- WHY signed_date AND NOT THE REPORT PERIOD
--
-- Trends group by `signed_date`, the date the contract was written. That is
-- when the sale happened. Grouping by payment-completion date would draw a
-- chart of collections and label it sales -- and because the export is one
-- file per payment year, that chart would be flat by construction.
--
-- The consequence is visible and intended: contracts signed before the export
-- window appear in early years at low volume (roughly 550 of 17,300 predate
-- 2020, thinning back to a single 1962 contract). Those are matured pre-need
-- sales, not a data error. `byYear` returns every year it finds rather than
-- truncating, so the client can window the chart and still state what it left
-- out.

-- ---------------------------------------------------------------------------
-- Monthly contract trend
--
-- Anchored on the newest signed contract, exactly like monthly_burial_trend --
-- see 20260804002631 for why windows resolve against the data instead of
-- current_date. Zero-filled by generate_series so a month with no sales is a
-- gap in the line rather than a missing point that Recharts would interpolate
-- straight through.
-- ---------------------------------------------------------------------------
create or replace function public.contract_trend(
  p_months integer default 24,
  p_anchor date    default null
)
returns table (month_start date, label text, contracts bigint, sale_value numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with anchor as (
    select date_trunc('month', coalesce(
             p_anchor,
             (select max(c.signed_date) from public.contracts c),
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
         count(c.id),
         coalesce(sum(c.total_amount), 0)
  from months
  left join public.contracts c
    on date_trunc('month', c.signed_date)::date = months.m
  group by months.m
  order by months.m
$$;

comment on function public.contract_trend(integer, date) is
  'Contracts written and their sale value per month, anchored on the newest signed_date. Sale value is a booking figure from the paid-in-full register, not recognised revenue.';

-- Same revoke-then-grant as every other dashboard RPC: `anon` must not be able
-- to read the ledger, and PUBLIC EXECUTE is the default on a new function.
revoke all  on function public.contract_trend(integer, date) from public, anon;
grant execute on function public.contract_trend(integer, date) to authenticated;

-- ---------------------------------------------------------------------------
-- dashboard_summary(): add `sales`
--
-- Nested under one key rather than flattened into twelve more top-level ones,
-- so the sales block can be read, versioned and reasoned about as a unit.
--
-- Everything above the new block is carried through byte-identically from
-- 20260804063939. Adding keys is safe in the deployed direction --
-- `dashboardSummarySchema` strips unknown keys, so the database may grow a KPI
-- before the client renders it -- but removing or renaming one breaks the
-- deployed bundle's parse, so nothing here is dropped.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_summary()
returns jsonb
language sql
stable
set search_path to ''
as $function$
  with anchor as (
    select coalesce((select max(b.burial_date) from public.burials b),
                    current_date) as a
  ),
  referral_total as (
    select count(*)::numeric as n
    from public.burials where funeral_home is not null
  ),
  -- Materialised once: five of the sales figures below divide by these, and
  -- recomputing count(*) over 17K contracts per key is wasteful on a function
  -- the dashboard calls on every load.
  sales_total as (
    select count(*)::numeric               as n,
           coalesce(sum(total_amount), 0)  as v
    from public.contracts
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'dataAsOf', (select max(b.burial_date) from public.burials b),

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

    'burialsThisMonth', (select count(*) from public.burials
                          where date_trunc('month', burial_date) = date_trunc('month', current_date)),
    'burialsLastMonth', (select count(*) from public.burials
                          where date_trunc('month', burial_date)
                                = date_trunc('month', current_date - interval '1 month')),
    'burialsYTD',       (select count(*) from public.burials
                          where burial_date >= date_trunc('year', current_date)),

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

    -- ---------------------------------------------------------------------
    -- Sales: the contract ledger
    -- ---------------------------------------------------------------------
    'sales', jsonb_build_object(
      -- Its own as-of date. The contract ledger and the interment register
      -- cover different periods, and sharing the burials' `dataAsOf` would
      -- put the wrong period label under every sales card.
      'dataAsOf',  (select max(signed_date) from public.contracts),
      'earliestSignedDate', (select min(signed_date) from public.contracts),

      'contracts', (select n from sales_total),
      'lines',     (select count(*) from public.contract_items),
      'value',     (select v from sales_total),
      'avgValue',  (select round(v / nullif(n, 0), 2) from sales_total),
      'linesPerContract', (
        select round((select count(*) from public.contract_items)::numeric
                     / nullif((select n from sales_total), 0), 2)),

      -- The forward order book: sales collected for services not yet
      -- delivered. Reported as a share of both count and value because they
      -- differ -- a pre-need contract is typically larger than an at-need one.
      'preNeedContracts', (select count(*) from public.contracts where type = 'pre_need'),
      'preNeedValue',     (select coalesce(sum(total_amount), 0) from public.contracts
                            where type = 'pre_need'),
      'preNeedSharePct',  (select round(100.0 * count(*) filter (where type = 'pre_need')
                                        / nullif((select n from sales_total), 0), 1)
                           from public.contracts),

      'byCemetery', (
        select coalesce(jsonb_agg(x order by x.value desc), '[]'::jsonb)
        from (
          select coalesce(cem.name, 'Unassigned')       as name,
                 count(*)                                as contracts,
                 coalesce(sum(c.total_amount), 0)        as value,
                 round(coalesce(avg(c.total_amount), 0), 2) as "avgValue",
                 count(*) filter (where c.type = 'pre_need') as "preNeed"
          from public.contracts c
          left join public.cemeteries cem on cem.id = c.cemetery_id
          group by coalesce(cem.name, 'Unassigned')
        ) x),

      -- Every year present, not a fixed window. The pre-window tail is real
      -- (matured pre-need), and truncating it here would hide it from a
      -- client that has no way to know it was dropped.
      'byYear', (
        select coalesce(jsonb_agg(x order by x.year), '[]'::jsonb)
        from (
          select extract(year from signed_date)::int          as year,
                 count(*)                                     as contracts,
                 coalesce(sum(total_amount), 0)               as value,
                 count(*) filter (where type = 'pre_need')    as "preNeed",
                 count(*) filter (where type = 'at_need')     as "atNeed",
                 coalesce(sum(total_amount) filter (where type = 'pre_need'), 0) as "preNeedValue"
          from public.contracts
          group by 1
        ) x),

      -- Product codes are the source system's own tokens (SRVM, MINC, CARE).
      -- Returned as recorded -- see migration 20260807014352 for why they are
      -- never expanded into guessed English names.
      'topProducts', (
        select coalesce(jsonb_agg(x order by x.value desc), '[]'::jsonb)
        from (
          select product_code as code,
                 max(product_group) as "group",
                 count(*) as lines,
                 coalesce(sum(amount), 0) as value
          from public.contract_items
          where product_code is not null
          group by product_code
          order by sum(amount) desc nulls last
          limit 12
        ) x),
      'distinctProducts', (select count(distinct product_code) from public.contract_items
                            where product_code is not null),

      'topSalespeople', (
        select coalesce(jsonb_agg(x order by x.value desc), '[]'::jsonb)
        from (
          select salesperson as name,
                 count(*) as contracts,
                 coalesce(sum(total_amount), 0) as value
          from public.contracts
          where salesperson is not null
          group by salesperson
          order by sum(total_amount) desc nulls last
          limit 8
        ) x),

      -- Distribution of contract size. Bands rather than a percentile summary
      -- because the shape is the finding: a long right tail on a $2.5K median
      -- is what tells an operator where the money actually comes from.
      'valueBands', (
        select coalesce(jsonb_object_agg(b.band, b.n), '{}'::jsonb)
        from (
          select case when total_amount <  500   then '<$500'
                      when total_amount <  1000  then '$500-999'
                      when total_amount <  2500  then '$1K-2.4K'
                      when total_amount <  5000  then '$2.5K-4.9K'
                      when total_amount < 10000  then '$5K-9.9K'
                      else '$10K+' end as band,
                 count(*) as n
          from public.contracts
          group by 1
        ) b)
    ),

    'totalContracts',   (select n from sales_total),
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
$function$;

comment on function public.dashboard_summary() is
  'Every dashboard KPI in one round trip. Burial windows anchor on max(burial_date) and sales windows on max(signed_date); both as-of dates are returned. `sales.value` is booked sale value from the paid-in-full contract register -- a cash/booking figure, not recognised revenue.';

-- CREATE OR REPLACE preserves the existing grants, so these are a restatement
-- rather than a change. Kept explicit because a future migration that DROPs
-- and recreates the function would otherwise silently leave it PUBLIC.
revoke all  on function public.dashboard_summary() from public, anon;
grant execute on function public.dashboard_summary() to authenticated;
