#!/usr/bin/env python3
"""
Link poisoning incidents to the SPPG kitchen they accuse, and attribute each
kitchen to an operator (yayasan / PT / koperasi) with a citation URL.

Data sources
------------
* data/sppg.json          7.642 SPPG points (Kementan snapshot, 2025-09-30)
* data/wiki_incidents.json  520 incidents (Wikipedia)
* data/bgn_sppg_yayasan.json  315 SPPG with their managing yayasan (BGN, March 2025 batch)
  produced by scripts/fetch_bgn_roster.py
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

    # How sure are we that THIS unit fed the poisoned school? A news label that
    # names the unit outright is treated as fact (100); everything else is a
    # score built from shared name tokens, distance and rival candidates.
    label_toks = tokens(label)
    row_toks = tokens(f"{best['row'].get('nama','')} {best['row'].get('kecamatan','')} {best['row'].get('kelurahan','')}")
    snum = trailing_num(best["row"].get("nama") or "")
    num_compatible = (knum is None and snum is None) or (bool(knum and snum and knum == snum))
    exact = (label_toks and row_toks
             and (label_toks <= row_toks or row_toks <= label_toks)
             and len(label_toks & row_toks) >= 2
             and num_compatible)
    if exact:
        link_conf, link_basis = 100, "nama SPPG disebut langsung oleh sumber"
    else:
        base = {"high": 92, "medium": 78, "low": 58}[confidence]
        if best["num_ok"]:
            base += 4
        dist = best["dist"]
        if dist is None:
            base -= 10
        else:
            base -= int(min(25, max(0.0, dist - 0.5) * 4))
        if best["score"] < 2:
            base -= 8
        base -= min(24, 12 * (len(top) - 1))
        link_conf = max(35, min(99, base))
        bits = [f"{best['score']} kata nama sama"]
        if best["num_ok"]:
            bits.append("nomor unit cocok")
        bits.append(f"{round(dist, 2)} km" if dist is not None else "jarak tak diketahui")
        if len(top) > 1:
            bits.append(f"{len(top) - 1} kandidat lain")
        link_basis = ", ".join(bits)

    return {
        "sppg": best["row"],
        "score": best["score"],
        "shared": best["shared"],
        "distance_km": round(best["dist"], 2) if best["dist"] is not None else None,
        "rule": "name+distance" if near and best["score"] < 2 else "name",
        "confidence": confidence,
        "ambiguous": len(top) - 1,
        "link_confidence": link_conf,
        "link_basis": link_basis,
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


  # ── BGN roster: SPPG → yayasan (official, one March-2025 batch) ─────────────

BGN_ROSTER = ROOT / "data/bgn_sppg_yayasan.json"


def squash(s: str) -> str:
    return norm(s).replace(" ", "")


def kabkey(s: str) -> str:
    return re.sub(r"^(kota|kabupaten|kab|adm|administrasi)\s+", "", norm(s)).replace(" ", "")


def match_roster(rows: list[dict], sppg_rows: list[dict]) -> tuple[dict[str, dict], dict]:
    """Map roster rows (which carry a free-text address) to SPPG points.

    A roster address only names provinsi/kabupaten + a street address, so the
    unit is identified by kecamatan inside the address, then by kelurahan. When
    the kecamatan is missing we fall back to a kelurahan that is unique inside
    the kabupaten. Rows that cannot be pinned, or whose site carries two
    different yayasan, are dropped — a wrong owner is worse than none.
    """
    import difflib
    from collections import defaultdict

    by_kab: dict[str, list[dict]] = defaultdict(list)
    for s in sppg_rows:
        by_kab[kabkey(s.get("kabupaten") or "")].append(s)

    kec_vocab: dict[str, set[str]] = {}
    kel_by_kec: dict[str, dict[str, set[str]]] = {}
    kel_global: dict[str, dict[str, set[str]]] = {}
    for k, cands in by_kab.items():
        kec_vocab[k] = {norm(c.get("kecamatan") or "") for c in cands if c.get("kecamatan")}
        kel_by_kec[k] = defaultdict(set)
        kel_global[k] = defaultdict(set)
        for c in cands:
            if c.get("kecamatan") and c.get("kelurahan"):
                kk = squash(c["kelurahan"])
                kel_by_kec[k][norm(c["kecamatan"])].add(kk)
                kel_global[k][kk].add(norm(c["kecamatan"]))

    def resolve_kab(name: str) -> str | None:
        k = kabkey(name)
        if k in by_kab:
            return k
        close = difflib.get_close_matches(k, list(by_kab), n=1, cutoff=0.86)
        return close[0] if close else None

    def addr_tokens(text: str) -> set[str]:
        return {t for t in norm(text).split() if len(t) > 3 and t not in STOP}

    sites: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    stats = {"rows": len(rows), "kabupaten_missing": 0, "site_missing": 0,
             "kelurahan_fallback": 0, "resolved": 0}

    for r in rows:
        k = resolve_kab(r.get("kabupaten") or "")
        if not k:
            stats["kabupaten_missing"] += 1
            continue
        addr = r.get("alamat") or ""
        atoks = addr_tokens(addr)
        hit = sorted((len(set(kc.split())), kc) for kc in kec_vocab[k]
                     if set(kc.split()) and set(kc.split()) <= atoks)
        kec = None
        if hit:
            best = hit[-1][0]
            kecs = [kc for n, kc in hit if n == best]
            if len(kecs) > 1:
                sq = squash(addr)
                narrowed = [kc for kc in kecs if any(kk in sq for kk in kel_by_kec[k][kc])]
                kecs = narrowed or kecs
            kec = kecs[0]
        kel = None
        if kec:
            sq = squash(addr)
            hits = [kk for kk in kel_by_kec[k][kec] if kk and kk in sq]
            if hits:
                kel = max(hits, key=len)
        if not (kec and kel):
            sq = squash(addr)
            cands = sorted(((len(kk), kk, kecs) for kk, kecs in kel_global[k].items()
                            if len(kk) >= 5 and kk in sq), reverse=True)
            if cands and len(cands[0][2]) == 1:
                kec, kel = next(iter(cands[0][2])), cands[0][1]
                stats["kelurahan_fallback"] += 1
            else:
                stats["site_missing"] += 1
                continue
        sites[(k, kec, kel)].append(r.get("yayasan") or "")
        stats["resolved"] += 1

    owner_by_site: dict[tuple[str, str, str], str] = {}
    conflicts = 0
    for site, names in sites.items():
        uniq = {n for n in names if n}
        if len(uniq) == 1:
            owner_by_site[site] = uniq.pop()
        elif len(uniq) > 1:
            conflicts += 1

    site_points: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for s in sppg_rows:
        if not s.get("kecamatan") or not s.get("kelurahan"):
            continue
        site_points[(kabkey(s.get("kabupaten") or ""), norm(s["kecamatan"]), squash(s["kelurahan"]))].append(s)

    hits: dict[str, dict] = {}
    for site, points in site_points.items():
        owner = owner_by_site.get(site)
        if not owner:
            continue
        for s in points:
            sid = s.get("id")
            hits[str(sid)] = {
                "sppg_id": sid,
                "nama": s.get("nama"),
                "kabupaten": s.get("kabupaten"),
                "provinsi": s.get("provinsi"),
                "yayasan": owner,
                # BGN lists one kitchen per address; when our point data has
                # several units at that kelurahan the owner is site-level.
                "site_shared": len(points),
            }
    stats.update({"sites": len(owner_by_site), "conflicts": conflicts, "units": len(hits)})
    return hits, stats


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
                "link_confidence": m["link_confidence"],
                "link_basis": m["link_basis"],
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

    # 2) official BGN roster — per-unit yayasan for the March-2025 batch
    roster_stats: dict = {}
    roster = None
    if BGN_ROSTER.exists():
        roster = json.loads(BGN_ROSTER.read_text())
        roster_hits, roster_stats = match_roster(roster.get("rows") or [], sppg_rows)
        roster_src = {
            "url": (roster.get("meta") or {}).get("source") or "https://www.bgn.go.id/sppg-march-deleted/",
            "url_archive": (roster.get("meta") or {}).get("source_wayback"),
            "outlet": "BGN",
            "title": "Daftar SPPG Bulan Maret 2025",
        }
        roster_stats["source"] = roster_src["url"]
        roster_stats["source_archive"] = roster_src.get("url_archive")
        for sid, hit in roster_hits.items():
            slot = owners.get(sid)
            if slot is None:
                slot = owners[sid] = {
                    "sppg_id": hit["sppg_id"],
                    "nama": hit["nama"],
                    "kabupaten": hit["kabupaten"],
                    "provinsi": hit["provinsi"],
                    "operators": [],
                    "case_ids": [],
                    "sources": [],
                    "named_parties": [],
                    "head_removed": False,
                }
            if hit["yayasan"] not in [o["name"] for o in slot["operators"]]:
                slot["operators"].append({
                    "name": hit["yayasan"],
                    "source_type": "bgn_roster",
                    "site_shared": hit.get("site_shared", 1),
                    "sources": [roster_src],
                })
            if roster_src["url"] not in [x.get("url") for x in slot["sources"]]:
                slot["sources"].append(roster_src)

    for slot in owners.values():
        for op in slot["operators"]:
            op.setdefault("source_type", "article")

    payload = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "attribution": {
            "cases": "JejakMBG (jejakmbg.id), CC BY 4.0",
            "sppg_points": "Kementan AWR snapshot 2025-09-30 (data/sppg.json)",
            "incidents": "Wikipedia + media (data/wiki_incidents.json)",
            "owners": "BGN 'Daftar SPPG Bulan Maret 2025' (315 units with yayasan), plus media articles that name an operator",
        },
        "method": {
            "kitchen_match": "shared name tokens inside the same regency; 1 token needs <=3 km",
            "incident_match": "same regency (or <=8 km) and <=21 days",
            "operator": "explicit operator_foundation field, else Yayasan/PT/Koperasi named near SPPG context in a linked article",
            "roster_match": "roster address -> kecamatan inside address -> kelurahan; fallback to a kelurahan unique in the kabupaten; sites with two different yayasan are dropped",
        },
        "meta": {
            "cases_total": len(cases),
            "cases_with_kitchen": len(kitchen_cases),
            "cases_matched_to_sppg": n_matched,
            "cases_linked_to_incident": n_linked,
            "operators_from_case_field": n_op_csv,
            "operators_from_article": n_op_article,
            "sppg_matched": sum(1 for v in owners.values() if v["case_ids"]),
            "sppg_with_operator": sum(1 for v in owners.values() if v["operators"]),
            "operators_by_source": {
                "bgn_roster": sum(1 for v in owners.values()
                                  for o in v["operators"] if o.get("source_type") == "bgn_roster"),
                "article": sum(1 for v in owners.values()
                               for o in v["operators"] if o.get("source_type") != "bgn_roster"),
            },
            "roster": roster_stats,
            "sppg_points_total": len(sppg_rows),
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
