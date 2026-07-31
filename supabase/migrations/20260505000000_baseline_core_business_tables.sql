-- Baseline: the eleven core business tables, plus the template `users` table.
--
-- WHY THIS EXISTS
--
-- These tables were authored directly in the Supabase dashboard, so no
-- migration ever created them. Every migration in this directory dated
-- 20260506 or later ALTERs tables it assumes already exist. The consequence:
-- `supabase db reset` from this repo has never produced a working schema --
-- it fails on the first ALTER against a table nothing created. Local
-- development, preview branches, and the CI drift check were all built on a
-- foundation that only existed in production.
--
-- This file closes that gap. It is deliberately dated 20260505000000 so it
-- sorts BEFORE 20260506002740_cemetery_hierarchy.sql, the earliest migration
-- that depends on these tables.
--
-- WHAT SHAPE THIS DESCRIBES
--
-- The ORIGINAL shape, not the current one. Columns added by later migrations
-- are deliberately absent so that those migrations still do their work and
-- the history reads truthfully:
--
--   burials.grave_id            <- 20260506002740_cemetery_hierarchy
--   burials.memorial_published  <- 20260506002800_burial_memorial_published
--   contract_items.inventory_id <- 20260506002753_payment_schedule
--   contract_items.quantity     <- 20260506002753_payment_schedule
--   grants.created_by           <- 20260729232842_add_grants_created_by
--   source_system / source_ref  <- 20260730153033_add_source_provenance_columns
--
-- Likewise created_at/updated_at are declared here as nullable
-- `timestamp without time zone DEFAULT CURRENT_TIMESTAMP`, which is what they
-- actually were. 20260730152534 converts them to NOT NULL timestamptz and
-- attaches the touch trigger. Declaring the final shape here would leave that
-- migration with nothing to do and quietly break the chain.
--
-- Column types, lengths, numeric precision, defaults, nullability, constraints
-- and indexes were all read from the live production catalog rather than
-- reconstructed from memory.
--
-- SAFETY ON PRODUCTION
--
-- Every statement is IF NOT EXISTS. On production -- where all of this already
-- exists -- the whole file is a no-op, including the inline constraints, since
-- a skipped CREATE TABLE skips its constraints with it. On a fresh database it
-- builds the foundation the rest of the chain assumes.
--
-- Rollback: there isn't a meaningful one. Dropping these tables drops the
-- business. If this file is wrong, fix it forward.

-- ---------------------------------------------------------------------------
-- Template table from the original Supabase project scaffold.
--
-- Not used by the application and dropped by 20260506013416_drop_template_tables.
-- It has to exist here anyway: 20260506002815_enable_rls_all_business_tables
-- runs an UNGUARDED `ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`, so a
-- fresh reset fails at that migration without it. Recreated minimally -- the
-- original scaffold columns are unknown and irrelevant, since nothing reads
-- this table and it is dropped four migrations later.
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid()
);

-- ---------------------------------------------------------------------------
-- Root entities (no outbound foreign keys)
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  first_name  varchar(255) not null,
  last_name   varchar(255) not null,
  email       varchar(255),
  phone       varchar(50),
  address     text,
  city        varchar(100),
  state       varchar(50),
  zip_code    varchar(20),
  notes       text,
  created_at  timestamp default current_timestamp,
  updated_at  timestamp default current_timestamp
);

create table if not exists public.vendors (
  id           uuid primary key default gen_random_uuid(),
  name         varchar(255) not null,
  contact_name varchar(255),
  email        varchar(255),
  phone        varchar(50),
  address      text,
  notes        text,
  created_at   timestamp default current_timestamp,
  updated_at   timestamp default current_timestamp
);

create table if not exists public.burials (
  id                   uuid primary key default gen_random_uuid(),
  deceased_first_name  varchar(255) not null,
  deceased_last_name   varchar(255) not null,
  deceased_middle_name varchar(255),
  date_of_birth        date,
  date_of_death        date,
  burial_date          date not null,
  plot_location        varchar(255) not null,
  section              varchar(100) not null,
  lot                  varchar(100) not null,
  grave                varchar(100) not null,
  contact_name         varchar(255),
  contact_phone        varchar(50),
  contact_email        varchar(255),
  permit_number        varchar(100),
  notes                text,
  created_at           timestamp default current_timestamp,
  updated_at           timestamp default current_timestamp
);

create table if not exists public.grants (
  id               uuid primary key default gen_random_uuid(),
  title            varchar(255) not null,
  description      text,
  type             varchar(50) not null,
  source           varchar(255) not null,
  amount           numeric(10,2),
  deadline         date,
  status           varchar(50) not null,
  application_date date,
  notes            text,
  created_at       timestamp default current_timestamp,
  updated_at       timestamp default current_timestamp,
  constraint grants_type_check   check (type   in ('grant', 'benefit', 'opportunity')),
  constraint grants_status_check check (status in ('available', 'applied', 'approved', 'denied', 'received'))
);

create table if not exists public.work_orders (
  id             uuid primary key default gen_random_uuid(),
  title          varchar(255) not null,
  description    text,
  type           varchar(50) not null,
  priority       varchar(50) not null,
  status         varchar(50) not null,
  assigned_to    uuid,
  due_date       timestamp,
  completed_date timestamp,
  created_by     uuid,
  created_at     timestamp default current_timestamp,
  updated_at     timestamp default current_timestamp,
  constraint work_orders_type_check     check (type     in ('maintenance', 'burial_prep', 'grounds', 'repair', 'other')),
  constraint work_orders_priority_check check (priority in ('low', 'medium', 'high', 'urgent')),
  constraint work_orders_status_check   check (status   in ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- ---------------------------------------------------------------------------
-- Entities referencing the roots
-- ---------------------------------------------------------------------------
create table if not exists public.inventory (
  id            uuid primary key default gen_random_uuid(),
  name          varchar(255) not null,
  category      varchar(50) not null,
  sku           varchar(100),
  quantity      integer not null default 0,
  reorder_point integer not null default 0,
  unit_price    numeric(10,2) not null default 0,
  vendor_id     uuid references public.vendors(id),
  location      varchar(255),
  created_at    timestamp default current_timestamp,
  updated_at    timestamp default current_timestamp,
  constraint inventory_category_check
    check (category in ('casket', 'urn', 'vault', 'marker', 'supplies', 'other'))
);

create table if not exists public.contracts (
  id              uuid primary key default gen_random_uuid(),
  contract_number varchar(100) not null unique,
  type            varchar(50) not null,
  customer_id     uuid not null references public.customers(id),
  total_amount    numeric(10,2) not null,
  amount_paid     numeric(10,2) not null default 0,
  status          varchar(50) not null,
  signed_date     date not null,
  payment_plan    jsonb,
  created_at      timestamp default current_timestamp,
  updated_at      timestamp default current_timestamp,
  constraint contracts_type_check   check (type   in ('pre_need', 'at_need')),
  constraint contracts_status_check check (status in ('active', 'paid', 'cancelled', 'transferred'))
);

create table if not exists public.contract_items (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  description text not null,
  amount      numeric(10,2) not null,
  created_at  timestamp default current_timestamp
);

create table if not exists public.accounts_receivable (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers(id),
  invoice_number varchar(100) not null unique,
  amount         numeric(10,2) not null,
  amount_paid    numeric(10,2) not null default 0,
  due_date       timestamp not null,
  status         varchar(50) not null,
  created_at     timestamp default current_timestamp,
  updated_at     timestamp default current_timestamp,
  constraint accounts_receivable_status_check
    check (status in ('pending', 'partial', 'paid', 'overdue'))
);

create table if not exists public.accounts_payable (
  id             uuid primary key default gen_random_uuid(),
  vendor_id      uuid not null references public.vendors(id),
  invoice_number varchar(100) not null,
  amount         numeric(10,2) not null,
  amount_paid    numeric(10,2) not null default 0,
  due_date       timestamp not null,
  status         varchar(50) not null,
  created_at     timestamp default current_timestamp,
  updated_at     timestamp default current_timestamp,
  constraint accounts_payable_status_check
    check (status in ('pending', 'partial', 'paid', 'overdue'))
);

create table if not exists public.deposits (
  id          uuid primary key default gen_random_uuid(),
  amount      numeric(10,2) not null,
  date        timestamp not null,
  method      varchar(50) not null,
  reference   varchar(255),
  customer_id uuid references public.customers(id),
  notes       text,
  created_by  uuid,
  created_at  timestamp default current_timestamp,
  constraint deposits_method_check
    check (method in ('cash', 'check', 'credit_card', 'wire', 'other'))
);

-- ---------------------------------------------------------------------------
-- Indexes present before the migration history begins.
--
-- Deliberately excluded, because later migrations own them and should keep
-- doing so:
--   idx_burials_grave, idx_burials_memorial          <- 20260506002740 / 002800
--   idx_contract_items_inventory                     <- 20260506002753
--   idx_contract_items_contract_id                   <- 20260523232936
--   idx_deposits_customer_id, idx_inventory_vendor_id <- 20260523232936
-- ---------------------------------------------------------------------------
create index if not exists idx_ap_vendor            on public.accounts_payable    (vendor_id);
create index if not exists idx_ar_customer          on public.accounts_receivable (customer_id);
create index if not exists idx_burials_date         on public.burials             (burial_date);
create index if not exists idx_burials_location     on public.burials             (section, lot, grave);
create index if not exists idx_contracts_customer   on public.contracts           (customer_id);
create index if not exists idx_grants_status        on public.grants              (status);
create index if not exists idx_inventory_category   on public.inventory           (category);
create index if not exists idx_work_orders_status   on public.work_orders         (status);
create index if not exists idx_work_orders_assigned_to on public.work_orders      (assigned_to);
