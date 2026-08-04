-- Promote three burial dimensions and two vendor dimensions out of free text.
--
-- WHY THIS EXISTS
--
-- The 2026-07-31 import (docs/15-data-import.md) had nowhere to put the richest
-- columns in `dim_party.csv`, because `burials` has no field for the funeral
-- home, the counselor, or the deceased's age. They were concatenated into
-- `notes`:
--
--   'Mortician: PYE FUNERAL HOME | Counselor: CHERYL BERRIEN | Age at death: 88'
--
-- `vendors.notes` carries category and known spend the same way. None of it can
-- be grouped, filtered, or aggregated, so the dashboard cannot show any of it.
--
-- What is trapped in there is not incidental. Across the 796 imported
-- interments, two funeral homes account for 49.5% of referrals (PYE 26.0%,
-- James Cole 23.5%) and the top five for 64.8%. That is a customer-concentration
-- figure a cemetery operator needs on a dashboard, and today it is invisible.
--
-- WHY `funeral_home` AND NOT `mortician`
--
-- The source column is named `mortician`, but every value in it is a firm
-- ("PYE FUNERAL HOME", "JAMES COLE"), never a person. Naming the column after
-- what it holds keeps a future reader from joining it to a staff table.
--
-- SAFETY
--
-- Additive and nullable only. Existing rows keep working with NULLs until
-- `scripts/import/load.py --backfill` populates them, and no existing query,
-- policy, or type can break on a column it does not select. `notes` is left
-- exactly as it is -- after the backfill it is redundant, not wrong, and
-- rewriting it would destroy the only copy of anything the parse missed.
--
-- RLS is untouched: these columns inherit the per-operation policies added in
-- 20260731003232, because policies are table-scoped rather than column-scoped.

alter table public.burials
  add column if not exists funeral_home text,
  add column if not exists counselor    text,
  add column if not exists age_at_death integer;

comment on column public.burials.funeral_home is
  'Referring funeral home (source column `mortician`, which holds firms, not people). The referral channel -- concentration here is a business risk metric.';
comment on column public.burials.counselor is
  'Family service counselor credited with the arrangement (source `salesman_first`/`salesman_last`).';
comment on column public.burials.age_at_death is
  'Age in years as recorded on the burial record. Kept as given rather than derived from dates, because date_of_birth is absent for every imported row.';

-- Range rather than a bare non-negative check: 0 is legitimate (infant
-- interments -- 11 of them in the 2020 register), and the upper bound catches a
-- column-shifted import writing a year or an amount into this field. The
-- observed maximum is 106.
alter table public.burials
  drop constraint if exists burials_age_at_death_sane;
alter table public.burials
  add constraint burials_age_at_death_sane
  check (age_at_death is null or (age_at_death >= 0 and age_at_death <= 130));

alter table public.vendors
  add column if not exists category    text,
  add column if not exists known_spend numeric;

comment on column public.vendors.category is
  'Spend category from the vendor master (e.g. Burial Vault Supplier, Payment Processing).';
comment on column public.vendors.known_spend is
  'Spend attributed to this vendor across 2020-2024 in the source workbook. A partial, known-to-date figure -- not a ledger balance, and not to be summed as if it were one.';

alter table public.vendors
  drop constraint if exists vendors_known_spend_non_negative;
alter table public.vendors
  add constraint vendors_known_spend_non_negative
  check (known_spend is null or known_spend >= 0);

-- Indexed because the dashboard groups by these two on every load. Neither is
-- selective enough to help a row lookup; both exist to keep the grouped
-- aggregate off a sequential scan as the register grows past 2020.
create index if not exists idx_burials_funeral_home on public.burials (funeral_home);
create index if not exists idx_burials_counselor    on public.burials (counselor);
