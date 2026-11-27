#!/usr/bin/env python3
"""Fetch the BGN "SPPG Bulan Maret 2025" roster (SPPG → yayasan).

BGN published 315 SPPG units with their managing yayasan. The canonical page
(`/sppg-march`) now 404s; the surviving mirror is `/sppg-march-deleted`, and
the Wayback Machine keeps dated copies. Output:

    data/bgn_sppg_yayasan.json   {meta, rows:[{provinsi, kabupaten, alamat, yayasan}]}

Usage:
    python3 scripts/fetch_bgn_roster.py            # use cached raw copy
    python3 scripts/fetch_bgn_roster.py --refresh  # re-download
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data/raw/bgn"
DEST = ROOT / "data/bgn_sppg_yayasan.json"

SOURCE = "https://www.bgn.go.id/sppg-march-deleted/"
WAYBACK = "https://web.archive.org/web/20260519000326/https://www.bgn.go.id/sppg-march-deleted/"
UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/140.0 Safari/537.36"
)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_rows(html: str) -> list[dict]:
    rows = []
    for raw in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S):
        cells = [
            re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", c)).strip()
            for c in re.findall(r"<td[^>]*>(.*?)</td>", raw, re.S)
        ]
        if len(cells) < 5 or not cells[0].isdigit():
            continue
        rows.append(
            {
                "no": int(cells[0]),
                "provinsi": cells[1],
                "kabupaten": cells[2],
                "alamat": cells[3],
                "yayasan": cells[4],
            }
        )
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download the BGN page")
    args = ap.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)
    cache = RAW / "sppg-march-deleted.html"
    if args.refresh or not cache.exists():
        html = fetch(SOURCE)
        cache.write_text(html, encoding="utf-8")
        print(f"downloaded {SOURCE} ({len(html):,} bytes)")
    else:
        html = cache.read_text(encoding="utf-8")
        print(f"using cache {cache.relative_to(ROOT)}")

    rows = parse_rows(html)
    if len(rows) < 300:
        raise SystemExit(f"only {len(rows)} rows parsed — page layout changed?")

    yayasan = sorted({r["yayasan"] for r in rows})
    payload = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "meta": {
            "title": "SPPG Bulan Maret 2025 — satuan pelayanan siap operasional 17 Maret 2025",
            "rows": len(rows),
            "distinct_yayasan": len(yayasan),
            "source": SOURCE,
            "source_wayback": WAYBACK,
            "note": "BGN publishes no per-unit owner roster beyond this batch; absence here means unpublished, not ownerless.",
        },
        "rows": rows,
    }
    DEST.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {DEST.relative_to(ROOT)} — {len(rows)} rows, {len(yayasan)} distinct yayasan")


if __name__ == "__main__":
    main()
