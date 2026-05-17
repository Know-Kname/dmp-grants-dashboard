-- LabCore LIMS — Migration 2: Test Catalog, Orders, Specimens, Results

-- ─── test_catalog ─────────────────────────────────────────────────────────────
create table test_catalog (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,
  name                  text not null,
  loinc_code            text,
  cpt_code              text,
  category              text not null check (category in (
    'chemistry','hematology','microbiology','immunology',
    'molecular','pathology','urinalysis','panel'
  )),
  specimen_type         text not null check (specimen_type in (
    'blood','serum','plasma','urine','stool',
    'swab','csf','tissue','sputum','other'
  )),
  turnaround_hours      integer not null default 24 check (turnaround_hours > 0),
  price                 numeric(10,2) not null default 0 check (price >= 0),
  unit                  text,
  reference_range_low   numeric,
  reference_range_high  numeric,
  reference_range_text  text,
  is_panel              boolean not null default false,
  panel_component_ids   uuid[],
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index test_catalog_category_idx on test_catalog (category);
create index test_catalog_active_idx on test_catalog (active);

create trigger test_catalog_updated_at
  before update on test_catalog
  for each row execute procedure lc_set_updated_at();

-- ─── orders ───────────────────────────────────────────────────────────────────
create table orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique,
  patient_id      uuid not null references patients (id),
  provider_id     uuid not null references providers (id),
  priority        text not null default 'routine' check (priority in ('routine','stat','asap')),
  status          text not null default 'ordered' check (status in (
    'ordered','collected','received','in_progress','resulted','completed','cancelled'
  )),
  ordered_date    date not null,
  clinical_notes  text,
  icd10_codes     text[],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index orders_patient_id_idx on orders (patient_id);
create index orders_provider_id_idx on orders (provider_id);
create index orders_status_idx on orders (status);
create index orders_ordered_date_idx on orders (ordered_date desc);

create trigger orders_updated_at
  before update on orders
  for each row execute procedure lc_set_updated_at();

-- ─── order_items ──────────────────────────────────────────────────────────────
create table order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders (id) on delete cascade,
  test_catalog_id  uuid not null references test_catalog (id),
  test_name        text not null,  -- snapshot
  price            numeric(10,2) not null,  -- snapshot
  status           text not null default 'pending' check (status in (
    'pending','in_progress','resulted','cancelled'
  )),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index order_items_order_id_idx on order_items (order_id);
create index order_items_test_catalog_id_idx on order_items (test_catalog_id);

create trigger order_items_updated_at
  before update on order_items
  for each row execute procedure lc_set_updated_at();

-- ─── specimens ────────────────────────────────────────────────────────────────
create table specimens (
  id                 uuid primary key default gen_random_uuid(),
  accession_number   text not null unique,
  order_id           uuid not null references orders (id),
  patient_id         uuid not null references patients (id),
  specimen_type      text not null check (specimen_type in (
    'blood','serum','plasma','urine','stool',
    'swab','csf','tissue','sputum','other'
  )),
  status             text not null default 'pending_collection' check (status in (
    'pending_collection','collected','in_transit',
    'received','stored','rejected','disposed'
  )),
  collected_by       text,
  collection_date    timestamptz,
  received_date      timestamptz,
  storage_location   text,
  rejection_reason   text check (rejection_reason in (
    'hemolyzed','insufficient_volume','clotted',
    'mislabeled','contaminated','expired','other'
  )),
  rejection_notes    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index specimens_order_id_idx on specimens (order_id);
create index specimens_patient_id_idx on specimens (patient_id);
create index specimens_status_idx on specimens (status);
create index specimens_accession_number_idx on specimens (accession_number);

create trigger specimens_updated_at
  before update on specimens
  for each row execute procedure lc_set_updated_at();

-- ─── test_results ─────────────────────────────────────────────────────────────
create table test_results (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders (id),
  order_item_id    uuid not null references order_items (id),
  specimen_id      uuid references specimens (id),
  test_catalog_id  uuid not null references test_catalog (id),
  patient_id       uuid not null references patients (id),
  result_value     text not null,
  unit             text,
  reference_range  text,
  flag             text not null default 'normal' check (flag in (
    'normal','low','high','critical_low','critical_high','abnormal'
  )),
  status           text not null default 'preliminary' check (status in (
    'preliminary','pending_verification','verified','amended'
  )),
  performed_by     uuid references staff (id),
  verified_by      uuid references staff (id),
  result_date      timestamptz,
  verified_date    timestamptz,
  instrument_id    uuid,  -- FK to instruments added in migration 3
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index test_results_order_id_idx on test_results (order_id);
create index test_results_patient_id_idx on test_results (patient_id);
create index test_results_flag_idx on test_results (flag);
create index test_results_status_idx on test_results (status);

create trigger test_results_updated_at
  before update on test_results
  for each row execute procedure lc_set_updated_at();
