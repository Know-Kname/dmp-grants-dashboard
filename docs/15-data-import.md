# Data import

Record of what real DMP data is in the database, where it came from, and how to
undo it. Companion to `docs/legacy/README.md`, which documents the 131 legacy
rows this replaced.

Until 2026-07-31 the database held no real operational data. The application,
schema, auth and CI were built; the import never was. This is that import.

---

## What is loaded

| Table | Rows | Source | `source_system` |
| --- | --- | --- | --- |
| `cemeteries` | 1 | `dim_party.csv` | `dim_party_dmp_west` |
| `sections` | 41 | `dim_party.csv` | `dim_party_dmp_west` |
| `lots` | 733 | `dim_party.csv` | `dim_party_dmp_west` |
| `graves` | 795 | `dim_party.csv` | `dim_party_dmp_west` |
| `customers` | 779 | `dim_party.csv` (next of kin) | `dim_party_dmp_west` |
| `burials` | 796 | `dim_party.csv` | `dim_party_dmp_west` |
| `vendors` | 47 | `dim_vendor.csv` | `dim_vendor` |

Verified after load: every row carries a `source_system`; no burial is missing
its `grave_id`; no orphan graves, lots or sections; burial dates span
2020-01-03 to 2020-12-31; no record has a death date after its burial date.

795 graves carry 796 burials — one grave holds two interments, which is a
legitimate double-depth plot, not a duplicate.

## Sources

Both are CSV exports from the Wright data pipeline, reached through the
Microsoft 365 connector.

- **`DMP-W_Ops_Undated_dim_party.csv`** — 796 rows, DMP-West, 2020, derived from
  `2020-01-01_DMP_Burial_BURIAL_RECORDS_DMP-WEST_2020.csv`.
- **`dim_vendor.csv`** — 51 rows, from `01_DMP_.../Operations/_PowerBI_Feed/`.

The `.xlsx` Silver workbooks cannot be used directly: Microsoft Graph returns
**HTTP 406, "couldn't convert this file for text extraction"** for every
workbook tried. The CSV exports carry the same data and read cleanly.

**The CSVs are not in this repository and must not be added to it.** They hold
real deceased and next-of-kin names, and this repository is public.
`scripts/import/data/` is gitignored as a local staging location.

### Vendor filtering

Only `operating_vendor = 'Yes'` is loaded — 47 of 51. The four excluded rows are
American Express, US Bank, car rental, and a card-incidental bucket. Those are
card issuers and travel lines, the same category of noise that made the original
131 legacy rows worthless. Loading them would recreate the problem the
2026-07-30 wipe was meant to solve.

## Not loaded: contracts

`dim_contract.csv` holds 11,720 contracts and its `gross_sales` sums to
**18,195,444.30**, matching the Silver workbook's stated total to the cent. It is
real. It is not loaded, because of four problems — three fixable, one not.

| Problem | Scale | Status |
| --- | --- | --- |
| `need_type = 'Other/General'` is illegal under `contracts_type_check`, which permits only `pre_need` and `at_need` | 1,595 rows (13.6%) | fixable — drop the rows, or widen the CHECK |
| `contract_nbr` collides across entities (e.g. `8160` exists as both a DMP-East and a DMP-West contract, different amounts) against a global `UNIQUE` | 19 rows | fixable — prefix with entity |
| Rows belong to Zoom2Day, a separate Wright business, not a cemetery | 610 rows / $281,612.69 | fixable — filter; leaves 11,110 rows / $17,913,831.61 |
| **No customer linkage exists.** `dim_contract.csv` has no purchaser column and `dim_party.csv` has no contract number. `contracts.customer_id` is `NOT NULL`. | all 11,720 | **blocking** |

Nothing in either export can satisfy the foreign key. Loading contracts would
require inventing the contract-to-customer relationship, so it was left out.

**Next step:** the CemSites/CemBooks exports under
`01_DMP_.../DMP/CemSites_Exports/` are the likely home of a real
contract-to-purchaser link. That folder could not be enumerated — Graph returned
a transient HTTP 500 on two attempts — and is worth retrying.

## Analytic columns and the backfill

The first load had nowhere to put the three richest columns in `dim_party.csv`,
so it concatenated them into `notes`:

```
Mortician: PYE FUNERAL HOME | Counselor: CHERYL BERRIEN | Age at death: 88
```

`vendors.notes` carried category and spend the same way. None of it could be
grouped or aggregated, which is why the dashboard could not show any of it.

Migration `20260804001947_burial_and_vendor_analytic_columns.sql` adds real
columns — `burials.funeral_home`, `burials.counselor`, `burials.age_at_death`,
`vendors.category`, `vendors.known_spend` — all additive and nullable.
`load.py --backfill` then populates them in place.

The source column is `mortician`, but every value in it is a firm
("PYE FUNERAL HOME", "JAMES COLE") rather than a person, so the column is named
`funeral_home` to stop anyone joining it to a staff table.

What that unlocked, on the 2020 register:

| Measure | Value |
| --- | --- |
| Referral concentration | PYE 26.0% + James Cole 23.5% = **49.5% from two homes**; top 5 = 64.8% of 47 |
| Counselors | 7; the largest holds 46% of arrangements |
| Age at death | median 69, range 0–106 |
| April 2020 interments | **123 against a ~55 monthly baseline** — Detroit's first COVID wave |

`notes` is left untouched. After the backfill it is redundant rather than wrong,
and it remains the only copy of anything the parse did not pick up.

## Running an import

```bash
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_ANON_KEY="<anon key>"
export DMP_EMAIL="<staff email>"
export DMP_PASSWORD="<password>"

python3 scripts/import/load.py vendors --csv /path/to/dim_vendor.csv
python3 scripts/import/load.py party   --csv /path/to/dim_party.csv
```

`load.py` authenticates as a normal user, so writes are subject to the same RLS
policies the application runs under. It resolves foreign keys by `source_ref`
and skips rows already present, so it is safe to re-run and safe to restart
part-way through. `--replace` deletes the load's own rows first (in reverse
dependency order) and reloads from scratch.

`--backfill` is the third mode, and the right one for widening an existing load:

```bash
python3 scripts/import/load.py party --csv /path/to/dim_party.csv --backfill
```

It patches rows in place, matched on `source_ref`, writing only the columns
added after the original import. It inserts nothing and deletes nothing.

Prefer it over `--replace` for a column addition. `--replace` deletes and
reloads ~3,150 rows across six tables in foreign-key order, which briefly
empties a database someone may be looking at and leaves it empty if the run
fails part way — which is exactly what happened on the first attempt, when a
dropped TLS handshake aborted the job at 600 of 796 rows. Requests now retry
with exponential backoff on connection resets and on 429/5xx, so a single bad
connection no longer costs the whole run.

`scripts/import/build_import_sql.py` emits the same load as `.sql` files, for
review or for applying through a SQL client instead of the API.

Both idempotency and rollback were exercised on 2026-07-31: re-running `party`
with no flag inserted nothing, and `--replace` on `vendors` cleared and reloaded
all 47 rows.

## Undoing a load

Each load is removable by its tag, no other state involved:

```sql
delete from vendors  where source_system = 'dim_vendor';

-- reverse dependency order
delete from burials    where source_system = 'dim_party_dmp_west';
delete from customers  where source_system = 'dim_party_dmp_west';
delete from graves     where source_system = 'dim_party_dmp_west';
delete from lots       where source_system = 'dim_party_dmp_west';
delete from sections   where source_system = 'dim_party_dmp_west';
delete from cemeteries where source_system = 'dim_party_dmp_west';
```

This works because `(source_system, source_ref)` is covered on all 16 tables by
the partial unique index `uq_<table>_source ... WHERE source_system IS NOT NULL`,
with `<table>_source_pair_complete` and `<table>_source_canonical` keeping the
pair well-formed. The provenance columns exist for exactly this purpose.

## Access note

The database now holds real deceased names, next-of-kin names and burial
locations.

Role-based access control landed in #91 while this import was being written, so
the flat `FOR ALL TO authenticated USING (true)` policies are gone. Each table
now carries per-operation policies backed by `public.current_app_role()`, with
`profiles.role` in `('admin', 'staff', 'readonly')` as the authoritative source
— never `user_metadata`, which the user can write. `can_write()` gates INSERT,
UPDATE and DELETE to `admin` and `staff`. This import ran under an `admin`
account, which is why it was permitted; `load.py` authenticates as a normal
user and gets no special treatment.

Two things are still worth knowing before more accounts exist:

- **`readonly` still reads everything.** The role split governs writes much more
  than reads, so any active account can see every deceased and next-of-kin
  record. New accounts default to `readonly`, which bounds what they can change
  but not what they can see.
- **There is still no audit log.** Nothing records who read or altered a row.

See `supabase/migrations/20260731003232_rbac_profiles_role_helpers_and_per_operation_rls.sql`
for the policy definitions and `docs/14-auth-platform-evaluation.md` for how the
model was chosen.
