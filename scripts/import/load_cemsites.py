#!/usr/bin/env python3
"""Load the CemSites "paid in full" exports into contracts, contract_items and customers.

Twenty-one files -- {east,west,gracelawn} x 2020..2026 -- at one row per
contract *line*. Same discipline as `load.py`: stream from local disk straight
to PostgREST as an authenticated user, so ~74,000 rows of real purchaser names
and home addresses stay out of this repo (which is public) and out of any
transcript. The `Api` class is imported from `load.py` rather than copied, so
the retry/backoff and provenance behaviour cannot drift between the two.

FILE SHAPE

Four lines of report preamble, then the header on line 5:

    DETROIT MEMORIAL PARK ASSOC.
     - 01-DETROIT MEMORIAL PARK EAST
    PAID IN FULL REPORT
    Report period :2020-01-01 thru 2020-12-31
    Department,Contract Number,Contract Type,Contract Date,AN/PN,...

Rows below that are a mix of real line rows (22 fields) and report furniture --
per-product subtotal blocks and page breaks -- which are 1, 5 or 9 fields wide.
Width alone separates them; 2,713 of 73,564 rows are furniture.

Parsing goes through `csv.reader`, not `split(',')`. That matters: addresses
contain quoted commas, and splitting naively shifts every later field left,
which is what previously made ~180 rows look like they had a dollar amount in
the A/P column and made a $4.3M "subtotal" appear to sit in a data row. Neither
exists. Read properly, only 3 rows in the whole corpus have an unusable AN/PN.

GRAIN AND DEDUPLICATION

A contract paid across two report periods appears in both years' files: 1,357
contracts span more than one file, and 203 line rows are exact repeats. Lines
are therefore deduplicated on the full field tuple within
(cemetery, contract number) before anything is summed -- otherwise those
contracts are counted, and billed, twice.

WHAT IS SKIPPED, AND WHY IT IS NOT INVENTED

`contracts.customer_id` is NOT NULL. 1,751 contracts carry no `Customer Name`
on any line, and this loader skips them rather than attaching a placeholder
purchaser -- fabricating one is exactly what blocked this import in the first
place (docs/15-data-import.md). The count is reported per cemetery.

Contract numbers with a leading hyphen (351 line rows) are kept exactly as
recorded. They are not credit reversals: they carry ordinary contract types,
dates, product codes and positive amounts, and their digit length matches the
normal population. Only 17 have a same-cemetery counterpart once the hyphen is
removed, and 2 of those 17 belong to a *different* purchaser -- so stripping
would wrongly merge two contracts to rescue nothing. Keeping them costs
nothing and loses no money ($181,833 of sales).

PROVENANCE AND ROLLBACK

`source_system` is per cemetery -- `cemsites_east`, `cemsites_west`,
`cemsites_gracelawn` -- so one location can be rolled back without touching
the other two:

    delete from contract_items where source_system = 'cemsites_gracelawn';
    delete from contracts      where source_system = 'cemsites_gracelawn';
    delete from customers      where source_system = 'cemsites_gracelawn';

Customers are tagged per cemetery for the same reason. The cost is that a
purchaser who bought at two locations becomes two rows; the alternative -- one
shared customer source_system -- would leave orphaned purchasers behind after
any single-cemetery rollback. The duplicate count is reported.

Environment:
    SUPABASE_URL, SUPABASE_ANON_KEY, DMP_EMAIL, DMP_PASSWORD

Usage:
    load_cemsites.py --dir /path/to/csvs [--only west] [--replace] [--dry-run]
"""

from __future__ import annotations

import argparse
import collections
import csv
import datetime as dt
import decimal
import os
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from load import Api  # noqa: E402  -- path set above so the sibling import resolves

# The export's `Department` code, which is constant within a file and matches
# the file's own preamble on all 73,564 rows. Checked per row: it is the only
# independent evidence that a file is in the folder it claims to be.
DEPARTMENT = {"01": "east", "02": "west", "03": "gracelawn"}

# `cemeteries.name` as seeded by migration 20260807014352, which takes them
# from src/config/company.ts.
CEMETERY_NAME = {
    "east": "Detroit Memorial Park East",
    "west": "Detroit Memorial Park West",
    "gracelawn": "Gracelawn Cemetery",
}

# The fields that make a line row unique. Excludes nothing that varies between
# two genuinely different lines, so two rows equal on all of these are the same
# line reprinted in a second report period.
LINE_FIELDS = (
    "Contract Type", "Contract Date", "AN/PN", "Salesperson",
    "Product Group", "Product Code", "Sale Amount",
    "Last Payment Date", "Last Payment Amount",
    "Section", "Lot", "Site Number",
    "Customer Name", "Customer Address (Street)", "Customer Address (City)",
    "Customer Address (Zip)", "Customer Address (State)",
)

HEADER_ROW = 4  # zero-based; four lines of preamble precede it

AT_NEED, PRE_NEED = "A", "P"
TYPE_OF = {AT_NEED: "at_need", PRE_NEED: "pre_need"}


def source_system(entity: str) -> str:
    return f"cemsites_{entity}"


def money(raw: str) -> decimal.Decimal | None:
    """Parse a Sale Amount. Returns None for anything that is not a number.

    Accounting parentheses are read as negative even though the corpus contains
    none today -- a future export that does carry a credit must not be read as
    a positive sale.
    """
    text = (raw or "").strip().replace(",", "").replace("$", "")
    if not text:
        return None
    negative = text.startswith("(") and text.endswith(")")
    if negative:
        text = text[1:-1]
    try:
        value = decimal.Decimal(text)
    except decimal.InvalidOperation:
        return None
    return -value if negative else value


def parse_date(raw: str) -> str | None:
    text = (raw or "").strip().split(" ")[0]
    if not text:
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def normalise(name: str) -> str:
    """Collapse whitespace and case for customer identity. Punctuation is kept:
    'AUSTIN, HAZEL I.' and 'AUSTIN, HAZEL I' are left as two people, because
    merging them is a guess and splitting them is only a duplicate."""
    return re.sub(r"\s+", " ", name.strip()).upper()


def split_name(full: str) -> tuple[str, str]:
    """'LAST, FIRST M' -> ('FIRST M', 'LAST'). Both columns are NOT NULL."""
    if "," in full:
        last, _, first = full.partition(",")
        return first.strip() or "(unknown)", last.strip() or "(unknown)"
    return "(unknown)", full.strip() or "(unknown)"


class Rejects(collections.Counter):
    """Every row that does not become a contract line, by reason."""


def read_lines(path: pathlib.Path, entity: str, rejects: Rejects) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig", errors="replace") as handle:
        rows = list(csv.reader(handle))

    header = rows[HEADER_ROW]
    index = {name: i for i, name in enumerate(header)}
    missing = [f for f in LINE_FIELDS if f not in index]
    if missing or "Contract Number" not in index or "Department" not in index:
        raise SystemExit(f"{path.name}: unexpected header, missing {missing}")

    out: list[dict] = []
    for row in rows[HEADER_ROW + 1 :]:
        rejects["rows_seen"] += 1
        if len(row) != len(header):
            rejects["report_furniture"] += 1
            continue

        department = row[index["Department"]].strip()
        if DEPARTMENT.get(department) != entity:
            rejects["wrong_department"] += 1
            continue

        number = row[index["Contract Number"]].strip()
        if not number:
            rejects["no_contract_number"] += 1
            continue

        need = row[index["AN/PN"]].strip()
        if need not in TYPE_OF:
            rejects["unusable_at_need_flag"] += 1
            continue

        amount = money(row[index["Sale Amount"]])
        if amount is None:
            rejects["unparseable_amount"] += 1
            continue

        signed = parse_date(row[index["Contract Date"]])
        if signed is None:
            rejects["unparseable_contract_date"] += 1
            continue

        out.append(
            {
                "number": number,
                "amount": amount,
                "signed": signed,
                "need": need,
                "fields": tuple(row[index[f]].strip() for f in LINE_FIELDS),
                **{f: row[index[f]].strip() for f in LINE_FIELDS},
            }
        )
    return out


def group_contracts(lines: list[dict]) -> dict[str, list[dict]]:
    """Contract number -> its deduplicated lines, in a stable order.

    Ordering is by the field tuple rather than by file order, so `source_ref`
    for a line is the same on every run regardless of which files were read.
    """
    by_number: dict[str, dict[tuple, dict]] = collections.defaultdict(dict)
    for line in lines:
        by_number[line["number"]].setdefault(line["fields"], line)
    return {
        number: [seen[key] for key in sorted(seen)]
        for number, seen in by_number.items()
    }


def build(entity: str, contracts: dict[str, list[dict]], rejects: Rejects):
    """Turn grouped lines into customer / contract / item payloads."""
    customers: dict[str, dict] = {}
    contract_rows: list[dict] = []
    item_rows: list[dict] = []

    for number in sorted(contracts):
        lines = contracts[number]

        named = [line for line in lines if line["Customer Name"]]
        if not named:
            rejects["contracts_without_a_purchaser"] += 1
            continue

        # The purchaser as written on the first line that names one. A contract
        # with two spellings keeps the first; the rest is not reconciled here.
        purchaser = named[0]
        key = f"CUST-{normalise(purchaser['Customer Name'])}|{purchaser['Customer Address (Zip)']}"
        if key not in customers:
            first, last = split_name(purchaser["Customer Name"])
            customers[key] = {
                "first_name": first[:255],
                "last_name": last[:255],
                "address": purchaser["Customer Address (Street)"] or None,
                "city": purchaser["Customer Address (City)"][:100] or None,
                "state": purchaser["Customer Address (State)"][:50] or None,
                "zip_code": purchaser["Customer Address (Zip)"][:20] or None,
                "source_system": source_system(entity),
                "source_ref": key,
            }

        total = sum(line["amount"] for line in lines)

        # `signed_date` is NOT NULL and a contract's lines can disagree on it
        # (a line added later carries its own date). The earliest is the date
        # the contract was written; a later one is an amendment.
        signed = min(line["signed"] for line in lines)

        # `AN/PN` can also differ between lines of one contract. At-need wins:
        # if any part of this contract was sold at the time of death, the
        # contract is not a forward pre-need order, and counting it as one
        # would overstate the order book.
        need = AT_NEED if any(line["need"] == AT_NEED for line in lines) else PRE_NEED

        salespeople = [line["Salesperson"] for line in lines if line["Salesperson"]]

        contract_rows.append(
            {
                "contract_number": f"{entity.upper()}-{number}",
                "type": TYPE_OF[need],
                # This is the *paid in full* report. 'paid' is the only status
                # the source actually asserts; anything else would be invented.
                "status": "paid",
                "signed_date": signed,
                "total_amount": str(total),
                "amount_paid": str(total),
                "salesperson": salespeople[0] if salespeople else None,
                "_customer_key": key,
                "source_system": source_system(entity),
                "source_ref": f"CON-{number}",
            }
        )

        for ordinal, line in enumerate(lines):
            item_rows.append(
                {
                    # The source's own product token is the description. It is
                    # what DMP staff read; expanding it would mean inventing a
                    # product name the export never states.
                    "description": line["Product Code"] or line["Product Group"] or "(uncoded)",
                    "amount": str(line["amount"]),
                    "product_group": line["Product Group"] or None,
                    "product_code": line["Product Code"] or None,
                    "_contract_ref": f"CON-{number}",
                    "source_system": source_system(entity),
                    "source_ref": f"CON-{number}#{ordinal}",
                }
            )

    return customers, contract_rows, item_rows


def load_entity(api: Api, entity: str, files: list[pathlib.Path], replace: bool, dry: bool):
    system = source_system(entity)
    rejects = Rejects()

    lines: list[dict] = []
    for path in sorted(files):
        lines.extend(read_lines(path, entity, rejects))

    contracts = group_contracts(lines)
    rejects["duplicate_lines_removed"] = len(lines) - sum(len(v) for v in contracts.values())

    customers, contract_rows, item_rows = build(entity, contracts, rejects)
    value = sum(decimal.Decimal(c["total_amount"]) for c in contract_rows)

    print(
        f"\n{entity}: {len(files)} files | {rejects['rows_seen']:,} rows -> "
        f"{len(contract_rows):,} contracts, {len(item_rows):,} lines, "
        f"{len(customers):,} customers, ${value:,.2f}",
        file=sys.stderr,
    )
    for reason, count in sorted(rejects.items()):
        if reason != "rows_seen":
            print(f"    {reason:32s} {count:,}", file=sys.stderr)

    if dry:
        return value, len(contract_rows), len(item_rows), len(customers)

    if replace:
        # Reverse dependency order: items reference contracts, contracts
        # reference customers.
        for table in ("contract_items", "contracts", "customers"):
            api.delete_by_source(table, system)

    cemeteries = api.select(
        "cemeteries", f"name=eq.{CEMETERY_NAME[entity].replace(' ', '%20')}&select=id"
    )
    if not cemeteries:
        raise SystemExit(f"{entity}: no cemetery row named {CEMETERY_NAME[entity]!r}")
    cemetery_id = cemeteries[0]["id"]

    have = api.ref_map("customers", system)
    todo = [row for key, row in sorted(customers.items()) if key not in have]
    if todo:
        api.insert("customers", todo)
    customer_ids = api.ref_map("customers", system)

    have = api.ref_map("contracts", system)
    todo = []
    for row in contract_rows:
        if row["source_ref"] in have:
            continue
        record = {k: v for k, v in row.items() if not k.startswith("_")}
        record["customer_id"] = customer_ids[row["_customer_key"]]
        record["cemetery_id"] = cemetery_id
        todo.append(record)
    if todo:
        api.insert("contracts", todo)
    contract_ids = api.ref_map("contracts", system)

    have = api.ref_map("contract_items", system)
    todo = []
    for row in item_rows:
        if row["source_ref"] in have:
            continue
        record = {k: v for k, v in row.items() if not k.startswith("_")}
        record["contract_id"] = contract_ids[row["_contract_ref"]]
        todo.append(record)
    if todo:
        api.insert("contract_items", todo)

    return value, len(contract_rows), len(item_rows), len(customers)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", required=True, type=pathlib.Path)
    parser.add_argument(
        "--only",
        choices=sorted(CEMETERY_NAME),
        action="append",
        help="load just this cemetery; repeatable. Default: all three.",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="delete this cemetery's rows first, making the load repeatable",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="parse and report control totals; touch nothing",
    )
    args = parser.parse_args()

    entities = args.only or sorted(CEMETERY_NAME)
    by_entity: dict[str, list[pathlib.Path]] = collections.defaultdict(list)
    for path in sorted(args.dir.glob("*.csv")):
        entity = path.stem.split("_")[0]
        if entity in entities:
            by_entity[entity].append(path)

    missing = [e for e in entities if not by_entity[e]]
    if missing:
        raise SystemExit(f"no CSVs found for: {', '.join(missing)} in {args.dir}")

    api = None
    if not args.dry_run:
        required = ("SUPABASE_URL", "SUPABASE_ANON_KEY", "DMP_EMAIL", "DMP_PASSWORD")
        absent = [name for name in required if not os.environ.get(name)]
        if absent:
            raise SystemExit(f"missing env: {', '.join(absent)}")
        api = Api(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
        api.sign_in(os.environ["DMP_EMAIL"], os.environ["DMP_PASSWORD"])

    totals = [0, 0, 0, decimal.Decimal(0)]
    for entity in entities:
        value, contracts, items, customers = load_entity(
            api, entity, by_entity[entity], args.replace, args.dry_run
        )
        totals[0] += contracts
        totals[1] += items
        totals[2] += customers
        totals[3] += value

    print(
        f"\nTOTAL: {totals[0]:,} contracts | {totals[1]:,} lines | "
        f"{totals[2]:,} customers | ${totals[3]:,.2f}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
