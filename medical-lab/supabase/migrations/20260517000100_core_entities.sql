-- LabCore LIMS — Migration 1: Core Entities
-- Patients, Providers, Staff
-- All PKs use gen_random_uuid(); timestamps auto-managed via trigger.

-- ─── Trigger helper ──────────────────────────────────────────────────────────
create or replace function lc_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── patients ─────────────────────────────────────────────────────────────────
create table patients (
  id                      uuid primary key default gen_random_uuid(),
  mrn                     text not null unique,
  first_name              text not null,
  last_name               text not null,
  middle_name             text,
  date_of_birth           date not null,
  sex                     text not null check (sex in ('male','female','other','unknown')),
  phone                   text,
  email                   text,
  address                 text,
  city                    text,
  state                   text,
  zip_code                text,
  insurance_provider      text,
  insurance_policy_number text,
  insurance_group_number  text,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index patients_mrn_idx on patients (mrn);
create index patients_last_name_idx on patients (last_name);

create trigger patients_updated_at
  before update on patients
  for each row execute procedure lc_set_updated_at();

-- ─── providers ────────────────────────────────────────────────────────────────
create table providers (
  id           uuid primary key default gen_random_uuid(),
  npi          text not null unique,
  first_name   text not null,
  last_name    text not null,
  credentials  text,
  organization text,
  specialty    text,
  phone        text,
  fax          text,
  email        text,
  address      text,
  city         text,
  state        text,
  zip_code     text,
  status       text not null default 'active' check (status in ('active','inactive')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index providers_npi_idx on providers (npi);
create index providers_last_name_idx on providers (last_name);
create index providers_status_idx on providers (status);

create trigger providers_updated_at
  before update on providers
  for each row execute procedure lc_set_updated_at();

-- ─── staff ────────────────────────────────────────────────────────────────────
create table staff (
  id               uuid primary key default gen_random_uuid(),
  first_name       text not null,
  last_name        text not null,
  email            text not null unique,
  role             text not null check (role in (
    'lab_director','pathologist','supervisor',
    'medical_technologist','technician','phlebotomist','admin'
  )),
  license_number   text,
  license_type     text,
  license_expiry   date,
  department       text check (department in (
    'chemistry','hematology','microbiology',
    'immunology','pathology','phlebotomy','general'
  )),
  phone            text,
  status           text not null default 'active' check (status in ('active','on_leave','inactive')),
  hire_date        date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index staff_role_idx on staff (role);
create index staff_status_idx on staff (status);
create index staff_department_idx on staff (department);

create trigger staff_updated_at
  before update on staff
  for each row execute procedure lc_set_updated_at();
