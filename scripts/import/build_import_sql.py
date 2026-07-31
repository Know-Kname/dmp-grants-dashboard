#!/usr/bin/env python3
"""Turn the DMP star-schema CSV exports into idempotent SQL for Supabase.

Emits one .sql file per target table, in foreign-key dependency order. Every row
carries (source_system, source_ref), so each statement ends in

    on conflict (source_system, source_ref) where source_system is not null
    do nothing

which matches the partial unique indexes (uq_<table>_source) already on all 16
tables. Re-running a load is therefore a no-op rather than a duplicate, and any
load can be undone with a single delete on its source_system tag.

The CSVs hold real deceased and next-of-kin names. They are NOT in this repo --
the repo is public. Point --csv at a local copy; see docs/15-data-import.md.

Usage:
    build_import_sql.py vendors --csv dim_vendor.csv --out sql/
    build_import_sql.py party   --csv dim_party.csv  --out sql/
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import pathlib
import sys

# source_system tags. Lower-case and trimmed -- the *_source_canonical CHECK
# constraints reject anything else.
SS_VENDOR = "dim_vendor"
SS_PARTY = "dim_party_dmp_west"

# dim_party.csv covers DMP-West only, and company.ts is the source of truth for
# how that location is named.
CEMETERY_NAME = "Detroit Memorial Park West"
CEMETERY_CITY = "Redford"
CEMETERY_STATE = "MI"
CEMETERY_REF = "CEM-DMP-West"


def q(value: str | None) -> str:
    """Quote a value as a SQL literal, or NULL when empty."""
    if value is None:
        return "NULL"
    text = str(value).strip()
    if not text:
        return "NULL"
    return "'" + text.replace("'", "''") + "'"


def cell(row: dict, key: str) -> str:
    return (row.get(key) or "").strip()


def parse_date(value: str) -> str | None:
    """M/D/YYYY, optionally followed by a time, to an ISO date.

    dim_party.csv uses M/D/YYYY for death_date and M/D/YYYY H:MM for
    interment_date. Anything unparseable returns None so the caller can decide
    whether the row is still loadable.
    """
    text = (value or "").strip()
    if not text:
        return None
    text = text.split(" ")[0]
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def read_csv(path: pathlib.Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def write_sql(out_dir: pathlib.Path, index: int, table: str, body: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{index:02d}_{table}.sql"
    path.write_text(body.rstrip() + "\n", encoding="utf-8")
    print(f"  wrote {path}", file=sys.stderr)


CONFLICT = (
    "on conflict (source_system, source_ref) "
    "where source_system is not null do nothing;"
)


# --------------------------------------------------------------------------
# vendors
# --------------------------------------------------------------------------


def build_vendors(rows: list[dict], out_dir: pathlib.Path) -> None:
    """dim_vendor.csv -> vendors.

    Only operating_vendor == 'Yes' is loaded. The rows marked
    'No (incidental)' are card issuers and travel/meal lines -- American
    Express, US Bank, car rental -- i.e. exactly the noise that made the
    original 131 legacy rows worthless (docs/legacy/README.md). Loading them
    would recreate the problem that wipe was meant to solve.
    """
    values = []
    skipped = 0
    for row in rows:
        if cell(row, "operating_vendor") != "Yes":
            skipped += 1
            continue
        name = cell(row, "canonical_name")
        ref = cell(row, "vendor_id")
        if not name or not ref:
            skipped += 1
            continue

        notes = []
        if cell(row, "category"):
            notes.append(f"Category: {cell(row, 'category')}")
        if cell(row, "subcategory"):
            notes.append(f"Subcategory: {cell(row, 'subcategory')}")
        if cell(row, "entity_scope"):
            notes.append(f"Entity scope: {cell(row, 'entity_scope')}")
        if cell(row, "spend_known_usd"):
            notes.append(f"Known spend (2020-2024): ${cell(row, 'spend_known_usd')}")
        if cell(row, "status"):
            notes.append(f"Status: {cell(row, 'status')}")

        values.append(
            f"  ({q(name)}, {q(' | '.join(notes))}, {q(SS_VENDOR)}, {q(ref)})"
        )

    body = (
        f"-- vendors <- dim_vendor.csv ({len(values)} operating vendors, "
        f"{skipped} non-operating rows skipped)\n"
        "insert into vendors (name, notes, source_system, source_ref)\nvalues\n"
        + ",\n".join(values)
        + f"\n{CONFLICT}"
    )
    write_sql(out_dir, 1, "vendors", body)
    print(f"  vendors: {len(values)} loadable, {skipped} skipped", file=sys.stderr)


# --------------------------------------------------------------------------
# dim_party -> cemetery hierarchy, customers, burials
# --------------------------------------------------------------------------


def build_party(rows: list[dict], out_dir: pathlib.Path) -> None:
    sections: dict[str, None] = {}
    lots: dict[tuple[str, str], None] = {}
    graves: dict[tuple[str, str, str], None] = {}
    customers: dict[tuple[str, str], None] = {}
    burials: list[dict] = []
    rejected: list[tuple[str, str]] = []

    for row in rows:
        party_id = cell(row, "party_id")
        first = cell(row, "deceased_first")
        last = cell(row, "deceased_last")
        section = cell(row, "section")
        lot = cell(row, "lot")
        site = cell(row, "site")
        burial_date = parse_date(cell(row, "interment_date"))

        # Every one of these is NOT NULL downstream; a row missing any of them
        # cannot be loaded, so record it rather than silently coercing.
        missing = [
            label
            for label, value in (
                ("party_id", party_id),
                ("deceased_first", first),
                ("deceased_last", last),
                ("section", section),
                ("lot", lot),
                ("site", site),
                ("burial_date", burial_date),
            )
            if not value
        ]
        if missing:
            rejected.append((party_id or "<no id>", ",".join(missing)))
            continue

        sections.setdefault(section)
        lots.setdefault((section, lot))
        graves.setdefault((section, lot, site))

        kin_first = cell(row, "kin_first")
        kin_last = cell(row, "kin_last")
        if kin_first or kin_last:
            customers.setdefault((kin_first, kin_last))

        notes = []
        if cell(row, "mortician"):
            notes.append(f"Mortician: {cell(row, 'mortician')}")
        salesman = " ".join(
            p for p in (cell(row, "salesman_first"), cell(row, "salesman_last")) if p
        )
        if salesman:
            notes.append(f"Counselor: {salesman}")
        if cell(row, "deceased_age"):
            notes.append(f"Age at death: {cell(row, 'deceased_age')}")

        burials.append(
            {
                "first": first,
                "last": last,
                "middle": cell(row, "deceased_middle"),
                "death": parse_date(cell(row, "death_date")),
                "burial": burial_date,
                # department is a constant '2' in this export, but keep it in
                # the composite so the label stays correct if that changes.
                "plot": f"{cell(row, 'department')}-{section}-{lot}-{site}",
                "section": section,
                "lot": lot,
                "site": site,
                "contact": " ".join(p for p in (kin_first, kin_last) if p),
                "permit": cell(row, "burial_nbr"),
                "notes": " | ".join(notes),
                "ref": party_id,
            }
        )

    def sec_ref(section: str) -> str:
        return f"SEC-{section}"

    def lot_ref(section: str, lot: str) -> str:
        return f"SEC-{section}|LOT-{lot}"

    def grave_ref(section: str, lot: str, site: str) -> str:
        return f"SEC-{section}|LOT-{lot}|SITE-{site}"

    # 1. cemetery
    write_sql(
        out_dir,
        1,
        "cemeteries",
        "-- cemeteries <- dim_party.csv (entity = DMP-West)\n"
        "insert into cemeteries (name, city, state, source_system, source_ref)\n"
        f"values ({q(CEMETERY_NAME)}, {q(CEMETERY_CITY)}, {q(CEMETERY_STATE)}, "
        f"{q(SS_PARTY)}, {q(CEMETERY_REF)})\n{CONFLICT}",
    )

    # 2. sections -- FK resolved by looking the cemetery up on its source_ref,
    # so these files stay runnable in isolation and in any repeat run.
    section_values = ",\n".join(
        f"  ({q(name)}, {q(sec_ref(name))})" for name in sorted(sections)
    )
    write_sql(
        out_dir,
        2,
        "sections",
        f"-- sections <- dim_party.csv ({len(sections)} distinct)\n"
        "insert into sections (cemetery_id, name, source_system, source_ref)\n"
        f"select c.id, v.name, {q(SS_PARTY)}, v.ref\n"
        f"from (values\n{section_values}\n) as v(name, ref)\n"
        "cross join (select id from cemeteries\n"
        f"            where source_system = {q(SS_PARTY)}\n"
        f"              and source_ref = {q(CEMETERY_REF)}) c\n{CONFLICT}",
    )

    # 3. lots
    lot_values = ",\n".join(
        f"  ({q(sec_ref(s))}, {q(l)}, {q(lot_ref(s, l))})"
        for s, l in sorted(lots)
    )
    write_sql(
        out_dir,
        3,
        "lots",
        f"-- lots <- dim_party.csv ({len(lots)} distinct section+lot)\n"
        "insert into lots (section_id, lot_number, source_system, source_ref)\n"
        f"select s.id, v.lot_number, {q(SS_PARTY)}, v.ref\n"
        f"from (values\n{lot_values}\n) as v(section_ref, lot_number, ref)\n"
        f"join sections s on s.source_system = {q(SS_PARTY)}\n"
        "                and s.source_ref = v.section_ref\n"
        f"{CONFLICT}",
    )

    # 4. graves -- status 'occupied' because every grave here has an interment.
    grave_values = ",\n".join(
        f"  ({q(lot_ref(s, l))}, {q(site)}, {q(grave_ref(s, l, site))})"
        for s, l, site in sorted(graves)
    )
    write_sql(
        out_dir,
        4,
        "graves",
        f"-- graves <- dim_party.csv ({len(graves)} distinct section+lot+site)\n"
        "insert into graves (lot_id, grave_number, status, source_system, source_ref)\n"
        f"select l.id, v.grave_number, 'occupied', {q(SS_PARTY)}, v.ref\n"
        f"from (values\n{grave_values}\n) as v(lot_ref, grave_number, ref)\n"
        f"join lots l on l.source_system = {q(SS_PARTY)}\n"
        "            and l.source_ref = v.lot_ref\n"
        f"{CONFLICT}",
    )

    # 5. customers -- the next of kin on each record.
    customer_values = ",\n".join(
        f"  ({q(f or '(unknown)')}, {q(l or '(unknown)')}, "
        f"{q(SS_PARTY)}, {q(f'KIN-{l}|{f}')})"
        for f, l in sorted(customers)
    )
    write_sql(
        out_dir,
        5,
        "customers",
        f"-- customers <- dim_party.csv next of kin ({len(customers)} distinct)\n"
        "insert into customers (first_name, last_name, source_system, source_ref)\n"
        f"values\n{customer_values}\n{CONFLICT}",
    )

    # 6. burials
    burial_values = ",\n".join(
        "  ("
        + ", ".join(
            [
                q(b["first"]),
                q(b["last"]),
                q(b["middle"]),
                q(b["death"]),
                q(b["burial"]),
                q(b["plot"]),
                q(b["section"]),
                q(b["lot"]),
                q(b["site"]),
                q(b["contact"]),
                q(b["permit"]),
                q(b["notes"]),
                q(grave_ref(b["section"], b["lot"], b["site"])),
                q(b["ref"]),
            ]
        )
        + ")"
        for b in burials
    )
    write_sql(
        out_dir,
        6,
        "burials",
        f"-- burials <- dim_party.csv ({len(burials)} rows)\n"
        "insert into burials (deceased_first_name, deceased_last_name,\n"
        "  deceased_middle_name, date_of_death, burial_date, plot_location,\n"
        "  section, lot, grave, contact_name, permit_number, notes, grave_id,\n"
        "  source_system, source_ref)\n"
        "select v.first_name, v.last_name, v.middle_name,\n"
        "       v.date_of_death::date, v.burial_date::date, v.plot_location,\n"
        "       v.section, v.lot, v.grave, v.contact_name, v.permit_number,\n"
        f"       v.notes, g.id, {q(SS_PARTY)}, v.ref\n"
        f"from (values\n{burial_values}\n) as v(first_name, last_name, middle_name,\n"
        "        date_of_death, burial_date, plot_location, section, lot, grave,\n"
        "        contact_name, permit_number, notes, grave_ref, ref)\n"
        f"join graves g on g.source_system = {q(SS_PARTY)}\n"
        "              and g.source_ref = v.grave_ref\n"
        f"{CONFLICT}",
    )

    print(
        f"  cemeteries 1 | sections {len(sections)} | lots {len(lots)} | "
        f"graves {len(graves)} | customers {len(customers)} | "
        f"burials {len(burials)}",
        file=sys.stderr,
    )
    if rejected:
        print(f"  REJECTED {len(rejected)} rows:", file=sys.stderr)
        for ref, why in rejected[:20]:
            print(f"    {ref}: missing {why}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", choices=["vendors", "party"])
    parser.add_argument("--csv", required=True, type=pathlib.Path)
    parser.add_argument("--out", required=True, type=pathlib.Path)
    args = parser.parse_args()

    rows = read_csv(args.csv)
    print(f"{args.source}: read {len(rows)} rows from {args.csv}", file=sys.stderr)

    if args.source == "vendors":
        build_vendors(rows, args.out)
    else:
        build_party(rows, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
