-- Give contracts a location and a sales dimension, and register the two
-- cemeteries that exist in the business but not yet in the database.
--
-- WHY THIS EXISTS
--
-- `contracts` has been empty since the schema was written, and the first
-- import (docs/15-data-import.md) could not fill it: the derived
-- `dim_contract.csv` carried no purchaser, and `contracts.customer_id` is NOT
-- NULL. The raw CemSites "paid in full" exports do carry the purchaser -- 21
-- files, 2020 through mid-2026, one row per contract *line* -- so the load is
-- now possible. This migration adds the columns that load needs and that the
-- dashboard will group by.
--
-- The single most useful cemetery comparison -- which location sells what --
-- is not expressible today, because a contract has no location at all. Every
-- other level of the hierarchy (sections, lots, graves) already hangs off
-- `cemeteries`; contracts were the gap.
--
-- WHY THE CEMETERY SEED IS PART OF THIS MIGRATION
--
-- `cemeteries` holds exactly one row, DMP West, created as a side effect of
-- the burial import. East and Gracelawn have existed since the association's
-- history but have never been rows. Adding `contracts.cemetery_id` without
-- them would produce a foreign key that two thirds of the business cannot
-- satisfy, so the column and the rows it points at belong in one change.
--
-- Names, addresses and phones come from `src/config/company.ts`, which the
-- app already treats as the source of truth for all three locations. The
-- export files agree independently: each carries a `Department` code that is
-- constant per file and matches its own report preamble -- 01 DETROIT
-- MEMORIAL PARK EAST, 02 (West), 03 GRACELAWN CORPORATION -- across all
-- 73,564 rows, with zero mismatches. That agreement is why the loader can
-- trust the folder a file came from.
--
-- WHY THE CODES ARE STORED AS CODES
--
-- `Product Group` is a single letter (S, R, I, B, P, H, V, X, JPM ...) and
-- `Product Code` a four-character token (SRVM, MINC, CARE, VSET, LAND ...),
-- 23 and 530 distinct respectively. They are not abbreviations of anything
-- written down in the export, and DMP staff read them directly. Expanding
-- "SRVM" into a guessed English phrase would put invented product names on a
-- dashboard, so both are stored exactly as recorded and rendered as-is.
--
-- SAFETY
--
-- Additive and nullable only. `contracts` and `contract_items` are both empty
-- today, so nothing is rewritten and no existing query, policy or generated
-- type can break on a column it does not select. RLS is untouched: these
-- columns inherit the per-operation policies added in 20260731003232, because
-- policies are table-scoped rather than column-scoped.

-- ---------------------------------------------------------------------------
-- The two missing cemeteries
-- ---------------------------------------------------------------------------
--
-- Guarded on `name` rather than on the provenance index, because DMP West is
-- already present under its own `source_system` from the burial import and
-- must not be duplicated or re-tagged -- rewriting its provenance would erase
-- the only record of where that row came from.
insert into public.cemeteries (name, address, city, state, zip, phone, source_system, source_ref)
select v.name, v.address, v.city, v.state, v.zip, v.phone, 'company_config', v.ref
from (values
  ('Detroit Memorial Park East', '4280 E. Thirteen Mile Rd', 'Warren', 'MI', '48092',
   '(586) 751-1313', 'east'),
  ('Gracelawn Cemetery',         '5710 N. Saginaw Street',   'Flint',  'MI', '48505',
   '(810) 785-7890', 'gracelawn')
) as v(name, address, city, state, zip, phone, ref)
where not exists (
  select 1 from public.cemeteries c where c.name = v.name
);

-- ---------------------------------------------------------------------------
-- Contract dimensions
-- ---------------------------------------------------------------------------

alter table public.contracts
  add column if not exists cemetery_id uuid references public.cemeteries(id),
  add column if not exists salesperson text;

comment on column public.contracts.cemetery_id is
  'Which of the three DMP locations sold this contract. Derived from the export''s `Department` code (01 East, 02 West, 03 Gracelawn), which agrees with the source folder on every row. NULL for contracts entered in this app before a location is chosen.';
comment on column public.contracts.salesperson is
  'Family service counselor credited with the sale (source column `Salesperson`, "LAST, FIRST"). Not every row has one, and one value -- GRACELAWN, CEMETERY -- is a house account rather than a person, so this is a credit tag, not a staff reference.';

-- `cemetery_id` and `salesperson` are both grouped on by the dashboard on
-- every load; `signed_date` orders the sales trend. None is selective enough
-- to help a single-row lookup -- they exist to keep the grouped aggregates off
-- a sequential scan of 17K contracts.
create index if not exists idx_contracts_cemetery    on public.contracts (cemetery_id);
create index if not exists idx_contracts_salesperson on public.contracts (salesperson);
create index if not exists idx_contracts_signed_date on public.contracts (signed_date);

-- ---------------------------------------------------------------------------
-- Contract line dimensions
-- ---------------------------------------------------------------------------

alter table public.contract_items
  add column if not exists product_group text,
  add column if not exists product_code  text;

comment on column public.contract_items.product_group is
  'Product family as recorded in CemSites: a single letter (S, R, I, B, ...), 23 distinct. Stored as the source code, never expanded -- the export defines no names for these letters.';
comment on column public.contract_items.product_code is
  'Product as recorded in CemSites: a four-character token (SRVM, MINC, CARE, ...), 530 distinct. Stored as the source code for the same reason as product_group.';

create index if not exists idx_contract_items_product_code
  on public.contract_items (product_code);
