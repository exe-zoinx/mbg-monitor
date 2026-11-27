#!/usr/bin/env python3
"""
Link poisoning incidents to the SPPG kitchen they accuse, and attribute each
kitchen to an operator (yayasan / PT / koperasi) with a citation URL.

Data sources
------------
* data/sppg.json          7.642 SPPG points (Kementan snapshot, 2025-09-30)
* data/wiki_incidents.json  520 incidents (Wikipedia)
* jejakmbg.id open data (CC BY 4.0) — cases + sources CSVs
  https://jejakmbg.id/data/

Output: data/sppg_links.json

Nothing is inferred silently: every operator carries the article that names it,
and every incident<->SPPG link carries the match rule that produced it.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
JEJAK = RAW / "jejak"
ARTICLES = RAW / "articles"

CASES_URL = "https://jejakmbg.id/unduh/mbg-cases.csv"
SOURCES_URL = "https://jejakmbg.id/unduh/sources.csv"
UA = "mbg-monitor/1.0 (+https://mbg-monitor.pages.dev; data linkage build)"

# ── text helpers ────────────────────────────────────────────────────────────

STOP = {
    "sppg", "dapur", "mbg", "indonesia", "kabupaten", "kab", "kota", "kecamatan",
    "kec", "kelurahan", "desa", "gampong", "provinsi", "wilayah", "area", "unit",
    "dan", "di", "the", "sekolah", "sd", "smp", "sma", "smk", "mi", "mts", "negeri",
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = re.sub(r"\([^)]*\)", " ", s).lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def tokens(s: str, minlen: int = 4) -> set[str]:
    return {t for t in norm(s).split() if len(t) >= minlen and t not in STOP}


def norm_regency(s: str) -> str:
    s = norm(s)
    s = re.sub(r"^(kabupaten|kab|kota|kabupaten administrasi|kota administrasi)\s+", "", s)
    return re.sub(r"\s+", " ", s).strip()


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lng1 = a
    lat2, lng2 = b
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def fnum(v) -> float | None:
    try:
        x = float(str(v).strip())
        return x if x == x else None
    except (TypeError, ValueError):
        return None


# ── fetch with on-disk cache ────────────────────────────────────────────────

def cached_get(url: str, cache_dir: Path, refresh: bool, timeout: int = 20) -> str:
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(url.encode()).hexdigest()[:20]
    path = cache_dir / f"{key}.bin"
    if path.exists() and not refresh:
        return path.read_bytes().decode("utf-8", "replace")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "id,en"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
        return path.read_bytes().decode("utf-8", "replace") if path.exists() else ""
    path.write_bytes(raw)
    return raw.decode("utf-8", "replace")


def html_text(html: str) -> str:
    html = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<[^>]+>", " ", html)
    html = re.sub(r"&nbsp;?", " ", html)
    html = re.sub(r"&amp;", "&", html)
    html = re.sub(r"&#\d+;", " ", html)
    return re.sub(r"\s+", " ", html)


# ── operator extraction ─────────────────────────────────────────────────────

ORG = r"(Yayasan|YP\.?|PT|Koperasi|Perkumpulan|BUMDes)"
ORG_RE = re.compile(ORG + r"\s+((?:[A-Z][\w&.'\-]*)(?:\s+(?:[A-Z][\w&.'\-]*)){0,4})")
CTX_RE = re.compile(
    r"sppg|dapur|pengelola|penyelenggara|mitra|dikelola|kelolaan|suspend|dicabut|"
    r"operasional|keracunan|korban|kepala sppg",
    re.I,
)
ORG = r"(Yayasan|YP\.?|PT|Koperasi|Perkumpulan|BUMDes)"
ORG_RE = re.compile(ORG + r"\s+((?:[A-Z][\w&.'\-]*)(?:\s+(?:[A-Z][\w&.'\-]*)){0,4})")

# Words that end a clause rather than an organisation name. Indonesian news text
# runs straight on ("Yayasan X Divonis ..."), so cut the name at the first of these.
ORG_STOPWORDS = {
    "divonis", "pendistribusian", "diduga", "menjadi", "yang", "dikelola", "dikelolakan",
    "korban", "siswa", "murid", "santri", "dapur", "sppg", "dalam", "untuk", "dengan",
    "oleh", "karena", "agar", "setelah", "sebelum", "namun", "tetapi", "juga", "dan",
    "dituntut", "tersangka", "saksi", "mangkling", "warga", "anak", "resmi", "kembali",
}
# Not organisations: government offices and program terms that sit next to "PT"/"Yayasan".
ORG_BLACKLIST = {
    "puskesmas", "dinas", "pemerintah", "kemenkes", "kementerian", "bgn", "polisi",
    "kejaksaan", "kepolisian", "sekolah", "kecamatan", "kabupaten", "kota", "provinsi",
    "dpr", "dprd", "bpom", "kpk", "tni", "pemkab", "pemkot", "yayasan",
    "pengelola", "mbg", "keterangan", "terkait", "dimintai", "menurut", "ujar",
}
SPPG_CTX = re.compile(r"\bSPPG\b|\bdapur\b", re.I)
KELOLA_CTX = re.compile(
    r"pengelola|penyelenggara|dikelola|kelolaan|mitra|suspend|dicabut|operasional|"
    r"kepala sppg|ketua yayasan",
    re.I,
)


def cut_org(raw: str) -> str:
    """Trim a candidate to the organisation name itself."""
    raw = re.split(r"[.,;:()\u201c\u201d\"']", raw)[0]
    words = raw.split()
    if not words:
        return ""
    keep = [words[0]]
    for w in words[1:]:
        if w.lower() in ORG_STOPWORDS or not re.match(r"^[A-Z0-9]", w):
            break
        keep.append(w)
        if len(keep) >= 5:
            break
    # "Yayasan Ulul Albab Fasihah Al" — a dangling Arabic connector is not a name.
    while len(keep) > 2 and keep[-1].lower() in {"al", "el", "an", "as", "ar", "ad", "at"}:
        keep.pop()
    return " ".join(keep).strip(" .,-")


def extract_orgs(text: str) -> list[str]:
    """Yayasan/PT names that appear next to SPPG/kitchen wording."""
    out = []
    for m in ORG_RE.finditer(text):
        name = cut_org(f"{m.group(1)} {m.group(2)}")
        if len(name) < 8:
            continue
        body = name.split()[1:]
        if not body or any(w.lower() in ORG_BLACKLIST for w in body):
            continue
        if not re.search(r"[a-z]", " ".join(body)):
            continue
        lo, hi = max(0, m.start() - 260), min(len(text), m.end() + 260)
        around = text[lo:hi]
        if not SPPG_CTX.search(around) or not KELOLA_CTX.search(around):
            continue
        out.append(name)
    return out


def trailing_num(s: str) -> str | None:
    m = re.search(r"(\d+)\s*$", (s or "").strip())
    return m.group(1) if m else None


def match_kitchen(case: dict, by_regency: dict[str, list[dict]]) -> dict | None:
    """Best SPPG row for a `kitchen_sppg` label; None when not confident.

    SPPG names follow "<kota/kab> <kecamatan> <kelurahan> [n]"; news labels are
    shorter ("SPPG Kalijaga 5"), so matching counts shared name tokens inside the
    same regency and prefers a matching numeric suffix.
    """
    label = (case.get("kitchen_sppg") or "").strip()
    if not label:
        return None
    reg = norm_regency(case.get("regency_city") or "")
    pool = by_regency.get(reg) or []
    if not pool:
        return None
    ktoks = tokens(label)
    if not ktoks:
        return None
    knum = trailing_num(label)
    clat, clng = fnum(case.get("lat")), fnum(case.get("lng"))

    scored = []
    for s in pool:
        stoks = tokens(f"{s.get('nama','')} {s.get('kecamatan','')} {s.get('kelurahan','')}")
        shared = ktoks & stoks
        if not shared:
            continue
        score = len(shared)
        snum = trailing_num(s.get("nama") or "")
        num_ok = bool(knum and snum and knum == snum)
        dist = None
        if clat is not None and clng is not None and s.get("lat") and s.get("lng"):
            dist = haversine_km((clat, clng), (s["lat"], s["lng"]))
        scored.append({"score": score, "num_ok": num_ok, "dist": dist, "row": s, "shared": sorted(shared)})

    if not scored:
        return None
    scored.sort(key=lambda c: (
        0 if c["num_ok"] else 1,
        -c["score"],
        c["dist"] if c["dist"] is not None else 999,
    ))
    best = scored[0]
    near = best["dist"] is not None and best["dist"] <= 3.0
    if best["score"] < 2 and not (best["score"] >= 1 and near):
        return None

    top = [c for c in scored if c["score"] == best["score"] and c["num_ok"] == best["num_ok"]]
    if best["score"] >= 3:
        confidence = "high"
    elif best["score"] == 2:
        confidence = "medium"
    else:
        confidence = "low"
    return {
        "sppg": best["row"],
        "score": best["score"],
        "shared": best["shared"],
        "distance_km": round(best["dist"], 2) if best["dist"] is not None else None,
        "rule": "name+distance" if near and best["score"] < 2 else "name",
        "confidence": confidence,
        "ambiguous": len(top) - 1,
    }


def match_incident(case: dict, incidents: list[dict]) -> dict | None:
    """Our incident row for a jejakmbg case (date window + regency, else distance)."""
    reg = norm_regency(case.get("regency_city") or "")
    raw_date = (case.get("event_date") or case.get("first_report_date_wib") or "")[:10]
    try:
        cd = datetime.strptime(raw_date, "%Y-%m-%d")
    except ValueError:
        cd = None
    clat, clng = fnum(case.get("lat")), fnum(case.get("lng"))
    best = None
    for inc in incidents:
        if inc.get("lat") is None or inc.get("lng") is None:
            continue
        ireg = norm_regency(inc.get("kabupaten") or inc.get("loc") or "")
        same_reg = bool(reg) and (reg == ireg or reg in ireg or ireg in reg)
        dist = haversine_km((clat, clng), (inc["lat"], inc["lng"])) if (clat is not None and clng is not None) else None
        if not same_reg and (dist is None or dist > 8):
            continue
        day_gap = 99
        if cd:
            try:
                idate = datetime.strptime((inc.get("date") or "")[:10], "%Y-%m-%d")
                day_gap = abs((idate - cd).days)
            except ValueError:
                pass
        if day_gap > 21:
            continue
        rank = (day_gap, dist if dist is not None else 99)
        if best is None or rank < best[0]:
            best = (rank, inc, dist, day_gap)
    if not best:
        return None
    _, inc, dist, gap = best
    return {
        "incident_date": (inc.get("date") or "")[:10],
        "incident_kabupaten": inc.get("kabupaten") or inc.get("loc") or "",
        "incident_lat": inc.get("lat"),
        "incident_lng": inc.get("lng"),
        "incident_title": inc.get("title"),
        "distance_km": round(dist, 2) if dist is not None else None,
        "day_gap": gap,
    }


# ── main build ──────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download jejakmbg CSVs and articles")
    ap.add_argument("--no-articles", action="store_true", help="skip article fetching (operator from CSV only)")
    args = ap.parse_args()

    sppg_doc = json.loads((ROOT / "data/sppg.json").read_text())
    sppg_rows = sppg_doc["sppg"]
    incidents = json.loads((ROOT / "data/wiki_incidents.json").read_text())["incidents"]

    by_regency: dict[str, list[dict]] = {}
    for s in sppg_rows:
        by_regency.setdefault(norm_regency(s.get("kabupaten") or ""), []).append(s)

    cases_raw = cached_get(CASES_URL, JEJAK, args.refresh)
    src_raw = cached_get(SOURCES_URL, JEJAK, args.refresh)
    cases = list(csv.DictReader(io.StringIO(cases_raw)))
    sources = list(csv.DictReader(io.StringIO(src_raw)))
    by_case: dict[str, list[dict]] = {}
    for s in sources:
        by_case.setdefault(s["case_id"], []).append(s)

    kitchen_cases = [c for c in cases if (c.get("kitchen_sppg") or "").strip()]

    # 1) fetch article text once per URL (only cases that name a kitchen)
    urls = []
    for c in kitchen_cases:
        for s in by_case.get(c["case_id"], []):
            u = (s.get("url") or "").strip()
            if u.startswith("http") and u not in urls:
                urls.append(u)
    texts: dict[str, str] = {}
    if not args.no_articles and urls:
        ARTICLES.mkdir(parents=True, exist_ok=True)

        def grab(u: str) -> tuple[str, str]:
            return u, html_text(cached_get(u, ARTICLES, args.refresh, timeout=20))

        with ThreadPoolExecutor(max_workers=8) as ex:
            for i, (u, t) in enumerate(ex.map(grab, urls), 1):
                texts[u] = t
                if i % 50 == 0:
                    print(f"  articles {i}/{len(urls)}", file=sys.stderr)

    out_cases = []
    owners: dict[str, dict] = {}
    n_op_csv = n_op_article = n_matched = n_linked = 0

    for c in kitchen_cases:
        cid = c["case_id"]
        m = match_kitchen(c, by_regency)
        srcs = by_case.get(cid, [])
        src_list = [
            {"url": s.get("url"), "outlet": s.get("outlet"), "title": (s.get("title") or "")[:160]}
            for s in srcs[:6]
            if (s.get("url") or "").startswith("http")
        ]

        operator = (c.get("operator_foundation") or "").strip() or None
        op_sources = []
        if operator:
            n_op_csv += 1
            # The case row itself is the citation for an explicit operator field.
            op_sources = src_list[:2]

        if not operator and texts:
            counts: dict[str, dict] = {}
            for s in srcs:
                u = (s.get("url") or "").strip()
                t = texts.get(u) or ""
                if not t:
                    continue
                for name in extract_orgs(t):
                    if len(name) < 8:
                        continue
                    slot = counts.setdefault(name, {"n": 0, "src": {"url": u, "outlet": s.get("outlet"), "title": (s.get("title") or "")[:160]}})
                    slot["n"] += 1
            if counts:
                best = sorted(counts.items(), key=lambda kv: (-kv[1]["n"], len(kv[0])))[0]
                operator = best[0]
                op_sources = [best[1]["src"]]
                n_op_article += 1

        rec = {
            "case_id": cid,
            "category": c.get("category"),
            "event_date": (c.get("event_date") or c.get("first_report_date_wib") or "")[:10],
            "regency": c.get("regency_city"),
            "province": c.get("province"),
            "school_or_site": c.get("school_or_site"),
            "kitchen_label": c.get("kitchen_sppg"),
            "victims": fnum(c.get("victims_count")),
            "deaths": fnum(c.get("deaths")),
            "hospitalised": fnum(c.get("hospitalised")),
            "operator": operator,
            "operator_sources": op_sources,
            "kitchen_head_removed": (c.get("kitchen_head_removed") or "").strip() or None,
            "named_parties": (c.get("named_parties") or "").strip()[:300] or None,
            "official_response": (c.get("official_response") or "").strip()[:300] or None,
            "sources": src_list,
            "lat": fnum(c.get("lat")),
            "lng": fnum(c.get("lng")),
            "sppg_id": None,
            "sppg_nama": None,
            "sppg_lat": None,
            "sppg_lng": None,
            "match_rule": None,
            "match_confidence": None,
            "match_ambiguous": None,
            "match_shared": None,
            "sppg_distance_km": None,
            "incident_key": None,
            "incident_date": None,
            "incident_kabupaten": None,
            "incident_lat": None,
            "incident_lng": None,
            "incident_title": None,
            "incident_distance_km": None,
        }

        if m:
            n_matched += 1
            s = m["sppg"]
            sid = s.get("id") if s.get("id") is not None else s.get("kode")
            rec.update({
                "sppg_id": sid,
                "sppg_nama": s.get("nama"),
                "sppg_lat": s.get("lat"),
                "sppg_lng": s.get("lng"),
                "match_rule": m["rule"],
                "match_confidence": m["confidence"],
                "match_ambiguous": m["ambiguous"],
                "match_shared": m["shared"],
                "sppg_distance_km": m["distance_km"],
            })
            slot = owners.setdefault(str(sid), {
                "sppg_id": sid,
                "nama": s.get("nama"),
                "kabupaten": s.get("kabupaten"),
                "provinsi": s.get("provinsi"),
                "operators": [],
                "case_ids": [],
                "sources": [],
                "named_parties": [],
                "head_removed": False,
            })
            slot["case_ids"].append(cid)
            if operator and operator not in [o["name"] for o in slot["operators"]]:
                slot["operators"].append({"name": operator, "case_id": cid, "sources": op_sources})
            if rec["named_parties"] and rec["named_parties"] not in slot["named_parties"]:
                slot["named_parties"].append(rec["named_parties"])
            if rec["kitchen_head_removed"]:
                slot["head_removed"] = True
            for src in src_list:
                if src["url"] not in [x["url"] for x in slot["sources"]] and len(slot["sources"]) < 6:
                    slot["sources"].append(src)

        inc = match_incident(c, incidents)
        if inc:
            n_linked += 1
            rec["incident_key"] = f'{inc["incident_date"]}|{norm_regency(inc["incident_kabupaten"])}'
            rec["incident_date"] = inc["incident_date"]
            rec["incident_kabupaten"] = inc["incident_kabupaten"]
            rec["incident_lat"] = inc["incident_lat"]
            rec["incident_lng"] = inc["incident_lng"]
            rec["incident_title"] = inc["incident_title"]
            rec["incident_distance_km"] = inc["distance_km"]

        out_cases.append(rec)

    payload = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "attribution": {
            "cases": "JejakMBG (jejakmbg.id), CC BY 4.0",
            "sppg_points": "Kementan AWR snapshot 2025-09-30 (data/sppg.json)",
            "incidents": "Wikipedia + media (data/wiki_incidents.json)",
        },
        "method": {
            "kitchen_match": "shared name tokens inside the same regency; 1 token needs <=3 km",
            "incident_match": "same regency (or <=8 km) and <=21 days",
            "operator": "explicit operator_foundation field, else Yayasan/PT/Koperasi named near SPPG context in a linked article",
        },
        "meta": {
            "cases_total": len(cases),
            "cases_with_kitchen": len(kitchen_cases),
            "cases_matched_to_sppg": n_matched,
            "cases_linked_to_incident": n_linked,
            "operators_from_case_field": n_op_csv,
            "operators_from_article": n_op_article,
            "sppg_matched": len(owners),
            "sppg_with_operator": sum(1 for v in owners.values() if v["operators"]),
            "articles_fetched": len(texts),
        },
        "sppg": owners,
        "cases": out_cases,
    }

    dest = ROOT / "data/sppg_links.json"
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=None, separators=(",", ":")))
    print(json.dumps(payload["meta"], indent=2, ensure_ascii=False))
    print(f"wrote {dest.relative_to(ROOT)} ({dest.stat().st_size/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
