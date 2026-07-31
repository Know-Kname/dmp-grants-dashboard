#!/usr/bin/env python3
"""Load the DMP star-schema CSV exports into Supabase over PostgREST.

Why REST rather than raw SQL: the burial export is ~800 rows wide enough that
inlining it as SQL literals is unwieldy, and the rows contain real deceased and
next-of-kin names. Streaming straight from a local CSV to the API keeps that
data out of transcripts and out of this repo, which is public.

Auth is a normal password sign-in, so every write lands as an authenticated
user and is subject to the same RLS policies the app runs under.

Every row carries (source_system, source_ref). That pair is covered by the
partial unique index uq_<table>_source on all 16 tables, so a load can be
undone precisely:

    delete from burials where source_system = 'dim_party_dmp_west';

Rerunning with --replace does exactly that delete first, in reverse dependency
order, which makes the whole import repeatable.

Environment:
    SUPABASE_URL, SUPABASE_ANON_KEY, DMP_EMAIL, DMP_PASSWORD

Usage:
    load.py vendors --csv dim_vendor.csv
    load.py party   --csv dim_party.csv [--replace]
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

SS_VENDOR = "dim_vendor"
SS_PARTY = "dim_party_dmp_west"

CEMETERY_NAME = "Detroit Memorial Park West"
CEMETERY_CITY = "Redford"
CEMETERY_STATE = "MI"
CEMETERY_REF = "CEM-DMP-West"

BATCH = 500


class Api:
    def __init__(self, url: str, anon_key: str):
        self.url = url.rstrip("/")
        self.anon_key = anon_key
        self.token: str | None = None

    def _request(self, method: str, path: str, body=None, headers=None):
        payload = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"{self.url}{path}", data=payload, method=method)
        req.add_header("apikey", self.anon_key)
        req.add_header("Authorization", f"Bearer {self.token or self.anon_key}")
        req.add_header("Content-Type", "application/json")
        for key, value in (headers or {}).items():
            req.add_header(key, value)
        try:
            with urllib.request.urlopen(req) as response:
                text = response.read().decode()
                return json.loads(text) if text.strip() else None
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode()
            raise SystemExit(f"{method} {path} -> HTTP {exc.code}\n{detail}") from exc

    def sign_in(self, email: str, password: str) -> None:
        data = self._request(
            "POST",
            "/auth/v1/token?grant_type=password",
            {"email": email, "password": password},
        )
        self.token = data["access_token"]
        print(f"signed in as {data['user']['email']}", file=sys.stderr)

    def insert(self, table: str, rows: list[dict]) -> int:
        total = 0
        for start in range(0, len(rows), BATCH):
            chunk = rows[start : start + BATCH]
            self._request(
                "POST",
                f"/rest/v1/{table}",
                chunk,
                {"Prefer": "return=minimal"},
            )
            total += len(chunk)
            print(f"  {table}: {total}/{len(rows)}", file=sys.stderr)
        return total

    def select(self, table: str, params: str) -> list[dict]:
        return self._request("GET", f"/rest/v1/{table}?{params}") or []

    def delete_by_source(self, table: str, source_system: str) -> None:
        self._request(
            "DELETE",
            f"/rest/v1/{table}?source_system=eq.{source_system}",
            headers={"Prefer": "return=minimal"},
        )
        print(f"  cleared {table} ({source_system})", file=sys.stderr)

    def ref_map(self, table: str, source_system: str) -> dict[str, str]:
        """source_ref -> id, paged so it survives PostgREST's default limit."""
        out: dict[str, str] = {}
        offset = 0
        while True:
            rows = self.select(
                table,
                f"source_system=eq.{source_system}&select=id,source_ref"
                f"&order=source_ref&limit=1000&offset={offset}",
            )
            if not rows:
                break
            out.update({r["source_ref"]: r["id"] for r in rows})
            offset += len(rows)
        return out


def cell(row: dict, key: str) -> str:
    return (row.get(key) or "").strip()


def parse_date(value: str) -> str | None:
    text = (value or "").strip().split(" ")[0]
    if not text:
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def read_csv(path: pathlib.Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def sec_ref(section: str) -> str:
    return f"SEC-{section}"


def lot_ref(section: str, lot: str) -> str:
    return f"SEC-{section}|LOT-{lot}"


def grave_ref(section: str, lot: str, site: str) -> str:
    return f"SEC-{section}|LOT-{lot}|SITE-{site}"


def load_vendors(api: Api, rows: list[dict], replace: bool) -> None:
    """Only operating vendors. The 'No (incidental)' rows are card issuers and
    travel lines -- American Express, US Bank, car rental -- the same noise that
    made the original 131 legacy rows worthless (docs/legacy/README.md)."""
    if replace:
        api.delete_by_source("vendors", SS_VENDOR)

    payload = []
    skipped = 0
    for row in rows:
        if cell(row, "operating_vendor") != "Yes":
            skipped += 1
            continue
        name, ref = cell(row, "canonical_name"), cell(row, "vendor_id")
        if not name or not ref:
            skipped += 1
            continue
        notes = [
            f"{label}: {cell(row, key)}"
            for label, key in (
                ("Category", "category"),
                ("Subcategory", "subcategory"),
                ("Entity scope", "entity_scope"),
                ("Known spend (2020-2024)", "spend_known_usd"),
                ("Status", "status"),
            )
            if cell(row, key)
        ]
        payload.append(
            {
                "name": name,
                "notes": " | ".join(notes) or None,
                "source_system": SS_VENDOR,
                "source_ref": ref,
            }
        )

    api.insert("vendors", payload)
    print(f"vendors: {len(payload)} loaded, {skipped} non-operating skipped", file=sys.stderr)


def load_party(api: Api, rows: list[dict], replace: bool) -> None:
    if replace:
        # Reverse dependency order -- burials reference graves, graves lots,
        # lots sections, sections the cemetery.
        for table in ("burials", "customers", "graves", "lots", "sections", "cemeteries"):
            api.delete_by_source(table, SS_PARTY)

    sections: set[str] = set()
    lots: set[tuple[str, str]] = set()
    graves: set[tuple[str, str, str]] = set()
    customers: dict[tuple[str, str], None] = {}
    burials: list[dict] = []
    rejected: list[str] = []

    for row in rows:
        party_id = cell(row, "party_id")
        first, last = cell(row, "deceased_first"), cell(row, "deceased_last")
        section, lot, site = cell(row, "section"), cell(row, "lot"), cell(row, "site")
        burial_date = parse_date(cell(row, "interment_date"))

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
            rejected.append(f"{party_id or '<no id>'}: missing {','.join(missing)}")
            continue

        sections.add(section)
        lots.add((section, lot))
        graves.add((section, lot, site))

        kin_first, kin_last = cell(row, "kin_first"), cell(row, "kin_last")
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
                "deceased_first_name": first,
                "deceased_last_name": last,
                "deceased_middle_name": cell(row, "deceased_middle") or None,
                "date_of_death": parse_date(cell(row, "death_date")),
                "burial_date": burial_date,
                "plot_location": f"{cell(row, 'department')}-{section}-{lot}-{site}",
                "section": section,
                "lot": lot,
                "grave": site,
                "contact_name": " ".join(p for p in (kin_first, kin_last) if p) or None,
                "permit_number": cell(row, "burial_nbr") or None,
                "notes": " | ".join(notes) or None,
                "_grave_ref": grave_ref(section, lot, site),
                "source_system": SS_PARTY,
                "source_ref": party_id,
            }
        )

    # cemetery -> sections -> lots -> graves, each resolving its parent by
    # source_ref so the load is restartable at any stage.
    if not api.select("cemeteries", f"source_system=eq.{SS_PARTY}&select=id"):
        api.insert(
            "cemeteries",
            [
                {
                    "name": CEMETERY_NAME,
                    "city": CEMETERY_CITY,
                    "state": CEMETERY_STATE,
                    "source_system": SS_PARTY,
                    "source_ref": CEMETERY_REF,
                }
            ],
        )
    cemetery_id = api.ref_map("cemeteries", SS_PARTY)[CEMETERY_REF]

    have = api.ref_map("sections", SS_PARTY)
    todo = [
        {
            "cemetery_id": cemetery_id,
            "name": s,
            "source_system": SS_PARTY,
            "source_ref": sec_ref(s),
        }
        for s in sorted(sections)
        if sec_ref(s) not in have
    ]
    if todo:
        api.insert("sections", todo)
    section_ids = api.ref_map("sections", SS_PARTY)

    have = api.ref_map("lots", SS_PARTY)
    todo = [
        {
            "section_id": section_ids[sec_ref(s)],
            "lot_number": l,
            "source_system": SS_PARTY,
            "source_ref": lot_ref(s, l),
        }
        for s, l in sorted(lots)
        if lot_ref(s, l) not in have
    ]
    if todo:
        api.insert("lots", todo)
    lot_ids = api.ref_map("lots", SS_PARTY)

    have = api.ref_map("graves", SS_PARTY)
    todo = [
        {
            "lot_id": lot_ids[lot_ref(s, l)],
            "grave_number": site,
            # every grave in this export has an interment against it
            "status": "occupied",
            "source_system": SS_PARTY,
            "source_ref": grave_ref(s, l, site),
        }
        for s, l, site in sorted(graves)
        if grave_ref(s, l, site) not in have
    ]
    if todo:
        api.insert("graves", todo)
    grave_ids = api.ref_map("graves", SS_PARTY)

    have = api.ref_map("customers", SS_PARTY)
    todo = [
        {
            "first_name": f or "(unknown)",
            "last_name": l or "(unknown)",
            "source_system": SS_PARTY,
            "source_ref": f"KIN-{l}|{f}",
        }
        for f, l in sorted(customers)
        if f"KIN-{l}|{f}" not in have
    ]
    if todo:
        api.insert("customers", todo)

    have = api.ref_map("burials", SS_PARTY)
    todo = []
    for b in burials:
        if b["source_ref"] in have:
            continue
        record = {k: v for k, v in b.items() if k != "_grave_ref"}
        record["grave_id"] = grave_ids[b["_grave_ref"]]
        todo.append(record)
    if todo:
        api.insert("burials", todo)

    print(
        f"cemeteries 1 | sections {len(sections)} | lots {len(lots)} | "
        f"graves {len(graves)} | customers {len(customers)} | burials {len(burials)}",
        file=sys.stderr,
    )
    if rejected:
        print(f"REJECTED {len(rejected)}:", file=sys.stderr)
        for line in rejected[:20]:
            print(f"  {line}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", choices=["vendors", "party"])
    parser.add_argument("--csv", required=True, type=pathlib.Path)
    parser.add_argument(
        "--replace",
        action="store_true",
        help="delete this source_system's rows first, making the load repeatable",
    )
    args = parser.parse_args()

    missing = [
        name
        for name in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "DMP_EMAIL", "DMP_PASSWORD")
        if not os.environ.get(name)
    ]
    if missing:
        raise SystemExit(f"missing env: {', '.join(missing)}")

    api = Api(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    api.sign_in(os.environ["DMP_EMAIL"], os.environ["DMP_PASSWORD"])

    rows = read_csv(args.csv)
    print(f"{args.source}: read {len(rows)} rows from {args.csv}", file=sys.stderr)

    if args.source == "vendors":
        load_vendors(api, rows, args.replace)
    else:
        load_party(api, rows, args.replace)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
