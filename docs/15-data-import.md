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
- **`paid_in_full_*.csv`** — 21 raw CemSites reports, 73,564 rows, from
  `01_DMP_.../DMP/CemSites_Exports/{East,West,Gracelawn}/raw/`. Files matching
  `*-sample.csv` are superseded extracts and are never fetched: Gracelawn's
  `2025-sample.csv` is byte-identical to its `202501-202512.csv`.

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

## Contracts: the CemSites paid-in-full exports

Contracts were blocked through 2026-08-04 and are not blocked any more.

The derived `dim_contract.csv` holds 11,720 contracts summing to **$18,195,444.30**
— real, and matching the Silver workbook to the cent — but it carries no
purchaser column, and `contracts.customer_id` is `NOT NULL`. Loading it would
have meant inventing the contract-to-customer relationship, so it was left out.

**The raw exports do carry the purchaser.** Twenty-one files under
`01_DMP_.../DMP/CemSites_Exports/{East,West,Gracelawn}/raw/paid_in_full_*.csv`,
2020 through mid-2026, one row per contract *line*, with `Customer Name` and a
full postal address on the row.

### Control totals

Measured by `load_cemsites.py --dry-run`, and independently by a separate
characterisation pass that agrees to the cent:

| | Contracts | Lines | Customers | Sale value |
| --- | ---: | ---: | ---: | ---: |
| DMP East | 4,626 | 19,046 | 2,730 | $12,791,339.46 |
| DMP West | 10,596 | 42,054 | 6,324 | $28,203,544.90 |
| Gracelawn | 2,089 | 5,919 | 1,367 | $2,533,770.41 |
| **Total** | **17,311** | **67,019** | **10,421** | **$43,528,654.77** |

Average contract $2,514.51; 3.87 lines per contract; pre-need 11.6% of contracts.
Contract dates span 1962–2026, because a pre-need contract written decades ago
enters a paid-in-full report in the year it is finally settled.

Cross-check against `dim_contract.csv`: 17,311 / $43.5M against 11,720 / $18.2M.
It does not tie and is not meant to — different periods, different derivation,
and the derived file includes Zoom2Day. As a magnitude check it passes.

The 10,421 customers are per-cemetery. Deduplicated globally the figure is
10,220; the 201-row difference is purchasers who bought at more than one
location, which is the deliberate cost of tagging customers per cemetery so a
single location can be rolled back without orphaning them.

### What is rejected, and why

Of 73,564 raw rows, 70,497 become contract lines. The rest:

| Reason | Rows |
| --- | ---: |
| Report furniture — preamble and per-product subtotal blocks, 1/5/9 fields wide against the header's 22 | 2,713 |
| `AN/PN` neither `A` nor `P` | 13 |
| Duplicate lines, same contract reprinted in a second report period | 205 |

and 1,751 whole contracts are skipped for carrying no `Customer Name` on any
line. Those are **not** given a placeholder purchaser — fabricating one is the
exact thing that blocked this import in the first place.

### Three traps that turned out not to exist

An earlier pass over these files reported a column-shift defect (~180 rows with
a dollar amount where `A`/`P` belongs) and an embedded report subtotal of
`4,372,752.33` sitting in a data row. **Neither is real.** Both were artifacts of
splitting the CSV on commas: customer addresses contain quoted commas, and every
field after one shifts left. Read with a real CSV parser, the largest single
line is $99,598.00 (`PRIV`) and the largest contract $125,918.00 — both
plausible — and only 13 rows in the entire corpus have an unusable `AN/PN`.

The third, superseded `*-sample.csv` extracts, is real and is handled by never
fetching those files.

### Two judgement calls

**Leading-hyphen contract numbers are kept as recorded.** 351 line rows carry a
number like `-514420`. They are not credit reversals: they have ordinary
contract types, dates and product codes, positive amounts, and a digit length
matching the normal population. Stripping the hyphen would merge 17 of them into
an existing contract — 14 correctly, but 2 into a *different purchaser's*
contract. Keeping them costs nothing and loses none of the $181,833 they carry.

**Product codes are stored and displayed as codes.** `Product Group` is a single
letter (23 distinct) and `Product Code` a four-character token (`SRVM`, `MINC`,
`CARE` — 530 distinct). The export defines no expansion for them, DMP staff read
them directly, and inventing readable names would put invented products on the
dashboard.

### Schema changes

`20260807014352_contract_sales_dimensions_and_all_three_cemeteries.sql` adds
`contracts.cemetery_id` and `contracts.salesperson`, `contract_items.product_group`
and `contract_items.product_code`, all additive and nullable — and seeds
`cemeteries` with **DMP East** and **Gracelawn** from `src/config/company.ts`,
so the location FK is satisfiable for all three.

The export agrees with that seed independently: each file carries a `Department`
code that is constant within the file and matches its own report preamble —
`01` East, `02` West, `03` Gracelawn — on all 73,564 rows, with zero mismatches
against the folder the file came from. The loader checks it per row.

### Status

The loader is written and its dry run ties to the table above. **The load itself
has not been run**: it needs `DMP_EMAIL` / `DMP_PASSWORD`, which were not
available in the session that wrote it. Nothing downstream is blocked by that —
`dashboard_summary().sales` and every chart it feeds render an honest empty
state until the rows land, and were verified against a synthetic fixture.

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

### The CemSites contract load

`scripts/import/load_cemsites.py` reuses `load.py`'s `Api` class — same
authentication, retry/backoff and provenance — and takes a directory of
`{east,west,gracelawn}_{year}.csv` rather than a single file:

```bash
# Parse and report control totals only. Touches nothing, needs no credentials.
python3 scripts/import/load_cemsites.py --dir /path/to/cemsites --dry-run

# Load everything, or one cemetery at a time.
python3 scripts/import/load_cemsites.py --dir /path/to/cemsites
python3 scripts/import/load_cemsites.py --dir /path/to/cemsites --only gracelawn
python3 scripts/import/load_cemsites.py --dir /path/to/cemsites --only west --replace
```

Run `--dry-run` first and check its totals against the control table above. A
cemetery whose figures do not tie should be rolled back by its `source_system`
tag rather than patched in place.

`scripts/import/build_import_sql.py` emits the `load.py` load as `.sql` files,
for review or for applying through a SQL client instead of the API.

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

The CemSites contract load is tagged per cemetery, so one location comes out
without disturbing the other two:

```sql
-- reverse dependency order; repeat for cemsites_east / cemsites_west
delete from contract_items where source_system = 'cemsites_gracelawn';
delete from contracts      where source_system = 'cemsites_gracelawn';
delete from customers      where source_system = 'cemsites_gracelawn';
```

The two cemetery rows seeded by migration `20260807014352` are tagged
`company_config` and are deliberately *not* part of any load's rollback —
they describe the business, not an import.

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
