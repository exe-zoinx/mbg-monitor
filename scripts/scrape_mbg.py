#!/usr/bin/env python3
"""
Scrape MBG (Makanan Bergizi Gratis) poisoning incidents from Indonesian Wikipedia.
Insert into D1 database (mbg_db) incidents table.
"""

import json
import re
import time
import urllib.request
from pathlib import Path

WIKI_URL = "https://id.wikipedia.org/wiki/Daftar_kasus_keracunan_makanan_massal_di_dunia"
USER_AGENT = "Mozilla/5.0 (compatible; MBGMonitor/1.0; +https://github.com/your-repo)"
OUTPUT = Path(__file__).parent.parent / "data" / "mbg_incidents.json"
MAX_INCIDENTS = 200

def fetch_wikipedia():
    req = urllib.request.Request(WIKI_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")

def extract_number(text):
    if not text:
        return None
    m = re.search(r'(\d+)', str(text).replace(',', '').replace('+', ''))
    return int(m.group(1)) if m else None

def clean_text(html):
    text = re.sub(r'<[^>]+>', '', html)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def geocode(query):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "q": query,
        "format": "json",
        "limit": 1,
    })
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        print(f"  geocode error for '{query}': {e}")
    return None, None

def parse_date(date_str):
    months = {
        'Januari': '01', 'Februari': '02', 'Maret': '03', 'April': '04',
        'Mei': '05', 'Juni': '06', 'Juli': '07', 'Agustus': '08',
        'September': '09', 'Oktober': '10', 'November': '11', 'Desember': '12'
    }
    parts = date_str.split()
    if len(parts) != 3:
        return None
    day, month_name, year = parts
    month = months.get(month_name)
    if not month:
        return None
    day = day.zfill(2)
    return f"{year}-{month}-{day}"

def parse_table(html):
    table_match = re.search(r'<table[^>]*id="mwLA"[^>]*>.*?</table>', html, re.DOTALL | re.IGNORECASE)
    if not table_match:
        table_match = re.search(r'<table[^>]*class="wikitable"[^>]*>.*?</table>', html, re.DOTALL | re.IGNORECASE)
    if not table_match:
        raise ValueError("Could not find wikitable")
    table_html = table_match.group(0)
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL | re.IGNORECASE)
    if not rows:
        return []
    data_rows = rows[2:]
    incidents = []
    for tr in data_rows:
        if len(incidents) >= MAX_INCIDENTS:
            break
        tds = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, re.DOTALL | re.IGNORECASE)
        if not tds:
            continue
        cells = [clean_text(td) for td in tds]
        if len(cells) < 6:
            continue
        # Check first cell looks like a date row
        if not re.search(r'\d{4}', cells[0]):
            continue
        date_str = cells[0]
        provinsi = cells[1] if len(cells) > 1 else ""
        kabkot = cells[2] if len(cells) > 2 else ""
        tempat = cells[3] if len(cells) > 3 else ""
        korban = cells[4] if len(cells) > 4 else ""
        meninggal = cells[5] if len(cells) > 5 else ""
        source_url = ""
        if len(cells) > 6:
            href_match = re.search(r'href=["\']([^"\']+)["\']', cells[6], re.IGNORECASE)
            if href_match:
                href = href_match.group(1)
                source_url = "https://id.wikipedia.org" + href if href.startswith('/') else href
        date = parse_date(date_str)
        if not date:
            continue
        location_parts = [p for p in [provinsi, kabkot, tempat] if p]
        location = ", ".join(location_parts)
        victims = extract_number(korban)
        deaths = extract_number(meninggal)
        note = f"{deaths} meninggal" if deaths else ""
        incident = {
            "date": date,
            "location": location,
            "victims": victims if victims is not None else 0,
            "note": note,
            "source": source_url,
            "title": "Keracunan Makanan Bergizi Gratis",
            "loc": location,
            "url": source_url,
            "is_baseline": 0
        }
        incidents.append(incident)
    return incidents

def main():
    print("Fetching Wikipedia page...")
    html = fetch_wikipedia()
    print("Parsing table...")
    incidents = parse_table(html)
    print(f"Found {len(incidents)} incidents")
    unique_queries = {}
    for inc in incidents:
        query = f"{inc['location']}, Indonesia"
        if query not in unique_queries:
            lat, lng = geocode(query)
            unique_queries[query] = (lat, lng)
            print(f"  {query} -> {lat}, {lng}")
            time.sleep(1.0)
    for inc in incidents:
        query = f"{inc['location']}, Indonesia"
        lat, lng = unique_queries.get(query, (None, None))
        inc["lat"] = lat
        inc["lng"] = lng
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(incidents, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(incidents)} incidents to {OUTPUT}")
    print(f"Geocoded: {sum(1 for inc in incidents if inc.get('lat') is not None)}/{len(incidents)}")

if __name__ == "__main__":
    main()
