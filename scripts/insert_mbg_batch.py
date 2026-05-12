#!/usr/bin/env python3
"""
Scrape MBG incidents from Wikipedia and batch insert into D1 database.
"""

import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

WIKI_URL = "https://id.wikipedia.org/wiki/Daftar_kasus_keracunan_makanan_massal_di_dunia"
USER_AGENT = "Mozilla/5.0 (compatible; MBGMonitor/1.0; +https://github.com/your-repo)"
SQL_FILE = Path(__file__).parent.parent / "data" / "insert_mbg.sql"
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

def esc(s):
    return s.replace("'", "''") if s else s

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
    
    # Geocode unique locations
    unique_queries = {}
    for inc in incidents:
        query = f"{inc['location']}, Indonesia"
        if query not in unique_queries:
            lat, lng = geocode(query)
            unique_queries[query] = (lat, lng)
            print(f"  {query} -> {lat}, {lng}")
            time.sleep(1.0)
    
    # Attach coordinates
    for inc in incidents:
        query = f"{inc['location']}, Indonesia"
        lat, lng = unique_queries.get(query, (None, None))
        inc["lat"] = lat
        inc["lng"] = lng
    
    # Generate SQL file
    SQL_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SQL_FILE, "w", encoding="utf-8") as f:
        f.write("BEGIN TRANSACTION;\n")
        for inc in incidents:
            lat_val = "NULL" if inc["lat"] is None else inc["lat"]
            lng_val = "NULL" if inc["lng"] is None else inc["lng"]
            sql = f"""INSERT INTO incidents (date, lat, lng, title, loc, victims, note, source, url, is_baseline, cat)
VALUES ('{inc['date']}', {lat_val}, {lng_val}, '{esc(inc['title'])}', '{esc(inc['loc'])}', {inc['victims']}, '{esc(inc['note'])}', '{esc(inc['source'])}', '{esc(inc['url'])}', {inc['is_baseline']}, 'racun');\n"""
            f.write(sql)
        f.write("COMMIT;\n")
    print(f"SQL file written to {SQL_FILE} ({len(incidents)} statements)")
    
    # Execute via wrangler
    print("Executing SQL via wrangler...")
    cmd = ["npx", "wrangler", "d1", "execute", "mbg_db", "--remote", "--file", str(SQL_FILE)]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            print(f"Error: {result.stderr}")
        else:
            print("Successfully inserted incidents.")
            print(result.stdout[:2000])
    except subprocess.TimeoutExpired:
        print("Wrangler command timed out.")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    main()