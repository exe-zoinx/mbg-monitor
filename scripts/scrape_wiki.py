#!/usr/bin/env python3
"""
Scrape MBG poisoning incidents from Indonesian Wikipedia.
Lightweight: requests + wikitextparser only.

  pip install requests wikitextparser
"""
import re, json, sys, os
import requests
import wikitextparser as wwp

# ── Config ────────────────────────────────────────────────────────────────────
WIKI_PAGE = "Daftar_kasus_keracunan_massal_program_Makan_Bergizi_Gratis"
API_URL   = "https://id.wikipedia.org/w/api.php"

def unwikify(text):
    """[[Link|text]] → text, [[Link]] → Link."""
    return re.sub(r'\[\[([^\]|]+?\|)?([^\]]+?)\]\]', r'\2', text)

def cite_url(cite_text):
    """Extract first HTTPS URL from a {{Cite web|...}} wikitext template."""
    m = re.search(r'\burl\s*=\s*(https?://[^\s|\}]+)', cite_text, re.IGNORECASE)
    return m.group(1).rstrip(", ") if m else ""

def ref_url(ref_cell, wikitext):
    """Resolve a <ref> cell to its news URL."""
    inline = cite_url(ref_cell)
    if inline:
        return inline
    m = re.search(r'<ref[^>]+\bname="([^"]+)"', ref_cell)
    if not m:
        return ""
    ref_id = m.group(1)
    pattern = re.compile(
        r'<ref[^>]*\bname="[^"]*' + re.escape(ref_id) + r'"[^>]*>(.*?)</ref>',
        re.DOTALL | re.IGNORECASE,
    )
    for match in pattern.finditer(wikitext):
        url = cite_url(match.group(1))
        if url:
            return url
    return ""

def scrape(out_file="data/wiki_incidents.json"):
    print("Fetching wikitext from MediaWiki API...")
    resp = requests.get(API_URL, params={
        "action": "parse",
        "page":   WIKI_PAGE,
        "prop":   "wikitext",
        "format": "json",
    }, headers={"User-Agent": "mb-monitor/1.0 (educational)"})
    resp.raise_for_status()
    wikitext = resp.json()["parse"]["wikitext"]["*"]
    print(f"  {len(wikitext):,} chars")

    tables = wwp.parse(wikitext).tables
    if not tables:
        raise SystemExit("No tables found in wikitext")
    table = tables[0]
    rows = table.data()
    print(f"  {len(rows)} rows (incl. 2 headers)")

    # Columns: date | province | city | school | symptomatic | deaths | ref
    SKIP = {"Tanggal Kejadian", "Provinsi", "Lokasi", "Jumlah Korban", "Ref", "TOTAL"}
    incidents = []
    for row in rows[2:]:  # skip 2 header rows
        if len(row) < 7:
            continue
        date     = str(row[0]).strip()
        province = str(row[1]).strip()
        if not date or date in SKIP:
            continue

        incidents.append({
            "date":        unwikify(date),
            "province":    unwikify(province),
            "city":        unwikify(str(row[2]).strip()),
            "school":      unwikify(str(row[3]).strip()),
            "symptomatic": str(row[4]).strip(),
            "deaths":      str(row[5]).strip(),
            "url":         ref_url(str(row[6]).strip(), wikitext),
        })

    print(f"  {len(incidents)} incidents")
    print(f"  {sum(1 for i in incidents if i['url'])} with source URLs")

    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(incidents, f, ensure_ascii=False, indent=2)
    print(f"✓  {len(incidents)} incidents → {out_file}")
    return incidents

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "data/wiki_incidents.json"
    scrape(out)
