# Legacy data archive

Permanent record of the only rows this database ever held before the real
import. Migration `20260730152445_archive_and_wipe_legacy_ap_vendors.sql`
deleted them; these files are why that was safe.

**Do not delete these CSVs.** They are the sole surviving copy of what was in
Supabase on 2026-07-30, and the migration that wiped the tables cites them by
path.

| File | Rows | Table |
| --- | --- | --- |
| `2026-07-30_accounts_payable_pre_wipe.csv` | 90 | `accounts_payable` (+ joined `vendor_name`) |
| `2026-07-30_vendors_pre_wipe.csv` | 41 | `vendors` |

The archive was verified against the database before the wipe and ties out
exactly:

| Measure | Database | Archive |
| --- | --- | --- |
| AP rows | 90 | 90 |
| `sum(amount)` | 308,342.72 | 308,342.72 |
| `sum(amount_paid)` | 156,336.74 | 156,336.74 |
| Outstanding | 152,005.98 | 152,005.98 |
| Vendor rows | 41 | 41 |

## What these rows actually were

Not accounts payable. They are **2020–2022 credit-card and bank statement
expense lines** that were loaded into the AP table during an early experiment,
with the statement description used as the vendor name. That is why the vendor
list reads the way it does:

- **Card and bank issuers as "vendors"** — US Bank ($88.8K across 6 name
  variants), Amex CC / American Express / American Express Accrual / Closing
  Date / Payment / TVL / Amex Travel ($66.3K across 7 variants), US Bank CC.
- **Fuel and retail** — Speedway, BP OIL, Sams Club, Jaxkarwash.
- **Outright non-vendors** — Capital Grille, Five Guys, Texas Roadhouse,
  Panera Bread, Stoney River, Street Grill, Vals Delicatessen, Marriott
  Suites, Hertz CAR Rental, Franklin Athletic Club, Prime,
  "Points Redeemed For Statement Credit Tibtsadik".
- **Garbled or truncated strings** — "Contactors NAT LAD", "Vzwrlss",
  "Thryv Computer Store", and three single-character rows: "TM", "U", "W".

Re-importing this as a vendor master would poison vendor dedupe from day one:
seven Amex spellings and six US Bank spellings, none of them a real trade
vendor.

## What was worth keeping

Three things, and only three. Everything else is re-derivable from the Silver
vendor workbook (`DMP-E_Ops_2026_2026-06-20_DMP_VENDORS_silver.xlsx`, 51
vendors, $0.93M) or is not vendor data at all.

### 1. American Eagle vault payables — $93,334, fully outstanding

The one genuinely useful financial fact in the whole set. American Eagle is a
real vault supplier. Ten invoices, all 2020, all `amount_paid = 0`:

| Due date | Amount |
| --- | --- |
| 2020-01-31 | 13,217.00 |
| 2020-01-31 | 4,422.00 |
| 2020-02-29 | 12,775.00 |
| 2020-02-29 | 3,278.00 |
| 2020-09-30 | 11,949.00 |
| 2020-09-30 | 9,945.00 |
| 2020-11-30 | 9,945.00 |
| 2020-11-30 | 5,909.00 |
| 2020-12-31 | 11,949.00 |
| 2020-12-31 | 9,945.00 |
| **Total** | **93,334.00** |

All ten were filed under the vendor string
`DMP Vault Pymts East & West American Eagle`. Two further empty vendor rows
exist for the same supplier — `DMP Vault Payment American Eagle` and
`DMP Vault Pymts West American Eagle` — plus a clean `American Eagle` row with
no invoices against it.

**Open question for the business, not for code:** whether $93,334 of 2020
vault payables is genuinely still outstanding or was simply never marked paid
in this table. Given the statement-line provenance of everything around it,
"never marked paid" is the likelier reading — but it is a large enough number
to be worth confirming against the trust/AP books before it is either written
off or carried into the new AP balance.

### 2. Two plausible operational vendors

- `Jett Pump & Valve` — grounds/irrigation equipment; a real trade vendor.
- `Elavon Service FEE` — the card processor's merchant fees. Real, but it
  belongs in an expense account, not the vendor master.

Neither has invoices attached in the archive.

### 3. The name variants themselves, as dedupe fixtures

The 41 vendor strings are the best real-world test data available for the
vendor dedupe work: seven Amex spellings, six US Bank spellings, three
American Eagle spellings, and three single-character rows all in 41 records.
When `merge_vendor()` and the alias resolution land, this list is what they
should be tested against.

They are deliberately **not** seeded into the database. Curated merge pairs
belong in their own reviewed migration, not guessed from a string-similarity
pass — merging two vendors that only look alike moves invoices onto the wrong
payee.

## Re-importing

`docs/legacy/*.csv` is an archive, not an import source. The real vendor and
AP load comes from the Silver workbooks per the Phase 7 load order. If any of
the above needs to re-enter the database, it should arrive through the normal
staging → validate → promote path with `source_system = 'legacy_supabase_2026_07'`
so it is distinguishable from CemSites-sourced data forever after.
