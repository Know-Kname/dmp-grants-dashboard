-- LabCore LIMS — Migration 3: Lab Operations
-- Instruments, Reagents, Billing, QC Runs

-- ─── instruments ──────────────────────────────────────────────────────────────
create table instruments (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  manufacturer             text,
  model                    text,
  serial_number            text,
  category                 text not null check (category in (
    'chemistry','hematology','microbiology','immunology',
    'molecular','pathology','urinalysis','panel'
  )),
  location                 text,
  status                   text not null default 'operational' check (status in (
    'operational','maintenance','calibration','out_of_service','retired'
  )),
  last_maintenance_date    date,
  next_maintenance_date    date,
  last_calibration_date    date,
  next_calibration_date    date,
  install_date             date,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index instruments_status_idx on instruments (status);
create index instruments_category_idx on instruments (category);
create index instruments_next_maintenance_idx on instruments (next_maintenance_date);
create index instruments_next_calibration_idx on instruments (next_calibration_date);

create trigger instruments_updated_at
  before update on instruments
  for each row execute procedure lc_set_updated_at();

-- Add FK from test_results to instruments (deferred until instrument table exists)
alter table test_results
  add constraint test_results_instrument_id_fkey
  foreign key (instrument_id) references instruments (id);

-- ─── reagents ─────────────────────────────────────────────────────────────────
create table reagents (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  catalog_number   text,
  lot_number       text not null,
  manufacturer     text,
  category         text not null check (category in (
    'reagent','control','calibrator','consumable','kit'
  )),
  quantity_on_hand numeric(10,3) not null default 0 check (quantity_on_hand >= 0),
  unit             text not null,
  reorder_point    numeric(10,3) not null default 0 check (reorder_point >= 0),
  expiration_date  date not null,
  storage_location text,
  instrument_id    uuid references instruments (id),
  status           text not null default 'in_stock' check (status in (
    'in_stock','low_stock','expired','on_order'
  )),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index reagents_status_idx on reagents (status);
create index reagents_expiration_date_idx on reagents (expiration_date);
create index reagents_instrument_id_idx on reagents (instrument_id);

create trigger reagents_updated_at
  before update on reagents
  for each row execute procedure lc_set_updated_at();

-- ─── invoices ─────────────────────────────────────────────────────────────────
create table invoices (
  id                  uuid primary key default gen_random_uuid(),
  invoice_number      text not null unique,
  order_id            uuid not null references orders (id),
  patient_id          uuid not null references patients (id),
  total_amount        numeric(10,2) not null default 0 check (total_amount >= 0),
  amount_paid         numeric(10,2) not null default 0 check (amount_paid >= 0),
  status              text not null default 'draft' check (status in (
    'draft','sent','partial','paid','overdue','void'
  )),
  issue_date          date not null,
  due_date            date not null,
  insurance_claim_id  uuid,  -- FK to insurance_claims added after that table
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index invoices_patient_id_idx on invoices (patient_id);
create index invoices_order_id_idx on invoices (order_id);
create index invoices_status_idx on invoices (status);
create index invoices_due_date_idx on invoices (due_date);

create trigger invoices_updated_at
  before update on invoices
  for each row execute procedure lc_set_updated_at();

-- ─── insurance_claims ─────────────────────────────────────────────────────────
create table insurance_claims (
  id                 uuid primary key default gen_random_uuid(),
  claim_number       text not null unique,
  invoice_id         uuid not null references invoices (id),
  patient_id         uuid not null references patients (id),
  insurance_provider text not null,
  policy_number      text,
  claim_amount       numeric(10,2) not null default 0 check (claim_amount >= 0),
  approved_amount    numeric(10,2) check (approved_amount >= 0),
  status             text not null default 'draft' check (status in (
    'draft','submitted','in_review','approved',
    'partially_approved','denied','paid'
  )),
  submitted_date     date,
  resolved_date      date,
  denial_reason      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index insurance_claims_invoice_id_idx on insurance_claims (invoice_id);
create index insurance_claims_patient_id_idx on insurance_claims (patient_id);
create index insurance_claims_status_idx on insurance_claims (status);

create trigger insurance_claims_updated_at
  before update on insurance_claims
  for each row execute procedure lc_set_updated_at();

-- Add FK from invoices to insurance_claims now that the table exists
alter table invoices
  add constraint invoices_insurance_claim_id_fkey
  foreign key (insurance_claim_id) references insurance_claims (id);

-- ─── qc_runs ──────────────────────────────────────────────────────────────────
create table qc_runs (
  id                uuid primary key default gen_random_uuid(),
  instrument_id     uuid not null references instruments (id),
  test_catalog_id   uuid not null references test_catalog (id),
  control_level     text not null check (control_level in ('level_1','level_2','level_3')),
  control_lot_number text,
  measured_value    numeric not null,
  expected_mean     numeric not null,
  expected_sd       numeric not null check (expected_sd > 0),
  result            text not null check (result in ('pass','warning','fail')),
  performed_by      uuid references staff (id),
  run_date          date not null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index qc_runs_instrument_id_idx on qc_runs (instrument_id);
create index qc_runs_test_catalog_id_idx on qc_runs (test_catalog_id);
create index qc_runs_result_idx on qc_runs (result);
create index qc_runs_run_date_idx on qc_runs (run_date desc);

create trigger qc_runs_updated_at
  before update on qc_runs
  for each row execute procedure lc_set_updated_at();
