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

# ── Geo lookup ─────────────────────────────────────────────────────────────────
# Indonesian cities → (lat, lng)
CITY_COORDS = {
    'jakarta': (-6.2088, 106.8456), 'dki jakarta': (-6.2088, 106.8456),
    'jawa timur': (-7.5, 112.5), 'jatim': (-7.5, 112.5),
    'jawa tengah': (-7.15, 110.14), 'jateng': (-7.15, 110.14),
    'jawa barat': (-6.9, 107.6), 'jawa': (-7.5, 110.5),
    'bandung': (-6.9175, 107.6191), 'bandung barat': (-6.93, 107.35),
    'bogor': (-6.6127, 106.8), 'sukoharjo': (-7.7149, 110.8258),
    'wonogiri': (-7.867, 110.907), 'boyolali': (-7.5321, 110.5274),
    'klaten': (-7.7055, 110.5911), 'yogyakarta': (-7.7972, 110.3615),
    'jogja': (-7.7972, 110.3615), 'sleman': (-7.7158, 110.3554),
    'bantul': (-7.8885, 110.3275), 'gunung kidul': (-7.9997, 110.5985),
    'kulon progo': (-7.6667, 110.15),
    'semarang': (-6.9667, 110.4204), 'kudus': (-6.8042, 110.8416),
    'pekalongan': (-6.8886, 109.6755), 'tegal': (-6.8741, 109.1402),
    'cirebon': (-6.7328, 108.5527), 'gresik': (-7.1583, 112.6512),
    'surabaya': (-7.2571, 112.7521), 'sidoarjo': (-7.4542, 112.7178),
    'mojokerto': (-7.5215, 112.4188), 'kediri': (-7.8483, 112.0169),
    'blitar': (-8.0892, 112.0489), 'malang': (-7.9784, 112.6311),
    'pasuruan': (-7.76, 112.9078), 'probolinggo': (-7.7551, 113.1547),
    'banyuwangi': (-8.2192, 114.3695), 'situbondo': (-7.7069, 114.0104),
    'jember': (-8.1853, 113.6825), 'lumajang': (-8.1321, 113.2214),
    'ponorogo': (-7.8672, 111.4719), 'nganjuk': (-7.6038, 111.9017),
    'tuban': (-6.898, 112.0486), 'lamongan': (-7.1176, 112.4173),
    'banten': (-6.12, 106.15), 'serang': (-6.1156, 106.1842),
    'lebak': (-6.56, 106.22), 'pandeglang': (-6.36, 105.6),
    'cianjur': (-6.8176, 107.1457), 'subang': (-6.5597, 107.7593),
    'karawang': (-6.3064, 107.3366), 'purwakarta': (-6.5569, 107.4432),
    'garut': (-7.2181, 107.9036), 'tasikmalaya': (-7.3267, 108.2243),
    'ciamis': (-7.32, 108.35), 'kuningan': (-6.97, 108.5),
    'majalengka': (-6.83, 108.2), 'sumedang': (-6.83, 107.92),
    'indramayu': (-6.35, 108.05), 'majene': (-3.54, 118.97),
    'polewali mandar': (-3.42, 119.32), 'mamuju': (-2.5, 119.4),
    'lampung': (-4.9956, 105.2836), 'bandar lampung': (-5.4299, 105.262),
    'lampung selatan': (-5.6, 105.4), 'lampung tengah': (-4.95, 105.2),
    'lampung timur': (-4.8, 105.7), 'lampung barat': (-5.0, 103.8),
    'pesawaran': (-5.24, 105.07), 'pringsewu': (-5.36, 104.97),
    'tulang bawang': (-4.3, 105.3),
    'sumatera utara': (3.6, 98.7), 'sumut': (3.6, 98.7),
    'medan': (3.5952, 98.6722), 'deli serdang': (3.5, 98.7),
    'langkat': (3.9, 98.3), 'serdang bedagai': (3.5, 99.0),
    'karo': (3.1, 98.5), 'simalungun': (2.9, 99.0),
    'dairi': (2.5, 98.1), 'toba': (2.3, 99.0),
    'nias': (1.1, 97.6),
    'sumatera barat': (-0.9, 100.4), 'padang': (-0.9489, 100.3613),
    'limapuluh kota': (-0.3, 100.5), 'solok': (-0.9, 100.6),
    'agam': (-0.6, 100.5), 'pasaman': (-0.2, 100.0),
    'padang pariaman': (-0.7, 100.4), 'pesisir selatan': (-1.3, 100.7),
    'dharmasraya': (-1.3, 101.4), 'solok selatan': (-1.4, 101.2),
    'sijunjung': (-0.8, 101.1), 'mentawai': (-1.8, 99.3),
    'pekanbaru': (0.5071, 101.4478), 'riau': (0.5, 101.5),
    'siak': (1.0, 102.0), 'pelalawan': (0.8, 102.0),
    'kuansing': (0.3, 101.4), 'bengkalis': (1.5, 102.1),
    'kampar': (0.4, 101.1), 'bengkulu': (-3.8, 102.3),
    'jambi': (-1.6, 103.6), 'palembang': (-2.9908, 104.7558),
    'ogan ilir': (-3.5, 104.5), 'lahat': (-3.8, 103.5),
    'bali': (-8.34, 115.09), 'denpasar': (-8.6525, 115.2192),
    'badung': (-8.6, 115.17), 'gianyar': (-8.47, 115.33),
    'tabanan': (-8.55, 115.07), 'buleleng': (-8.15, 115.0),
    'jembrana': (-8.3, 114.6), 'klungkung': (-8.53, 115.4),
    'ntb': (-8.65, 117.4), 'mataram': (-8.5833, 116.1167),
    'lombok barat': (-8.65, 116.1), 'lombok tengah': (-8.6, 116.3),
    'lombok timur': (-8.5, 116.5), 'lombok utara': (-8.35, 116.4),
    'sumbawa': (-8.7, 117.5), 'bima': (-8.5, 118.7),
    'ntt': (-8.75, 121.5), 'kupang': (-10.1774, 123.6635),
    'kalimantan selatan': (-3.1, 115.2), 'banjarmasin': (-3.318, 114.5912),
    'tabalong': (-1.9, 115.7), 'tanah bumbu': (-2.9, 115.9),
    'tanah laut': (-3.6, 114.7), 'barito kuala': (-3.2, 114.6),
    'hulu sungai selatan': (-2.7, 115.3), 'tapin': (-2.9, 115.0),
    'banjar': (-3.5, 114.8),
    'kalimantan tengah': (-1.5, 113.0), 'palangka raya': (-2.2138, 113.9213),
    'kapuas': (-1.5, 113.0),
    'kalimantan timur': (1.0, 116.0), 'samarinda': (-0.4943, 117.1488),
    'balikpapan': (-1.2671, 116.8286), 'kutai kartanegara': (0.5, 117.0),
    'berau': (2.0, 117.5), 'paser': (-1.5, 115.8),
    'kalimantan barat': (0.0, 109.3), 'pontianak': (-0.03, 109.33),
    'singkawang': (0.9, 108.9), 'ketapang': (-1.8, 110.0),
    'sambas': (1.4, 108.9),
    'sulawesi selatan': (-4.0, 120.0), 'makassar': (-5.1427, 119.4125),
    'parepare': (-3.8, 119.6), 'palopo': (-3.0, 120.2),
    'luwu': (-3.0, 120.3), 'luwu timur': (-2.5, 120.8),
    'bombana': (-4.5, 122.0), 'kendari': (-3.9865, 122.5146),
    'kolaka': (-4.2, 121.6), 'konawe': (-4.0, 122.0),
    'sulawesi tengah': (-1.0, 121.0), 'palu': (-0.9025, 119.87),
    'donggala': (-0.7, 119.7), 'poso': (-1.4, 120.7),
    'morowali': (-2.7, 121.5),
    'sulawesi utara': (1.0, 124.8), 'manado': (1.4741, 124.8412),
    'bitung': (1.4, 125.0), 'tomohon': (1.3, 124.8),
    'sulawesi tenggara': (-4.0, 122.5),
    'sulawesi barat': (-2.8, 119.4),
    'aceh': (5.5483, 95.3238), 'bireuen': (5.0833, 96.7),
    'blora': (-7.0231, 111.4029), 'grobogan': (-7.05, 110.9),
}

def geo_lookup(text):
    t = text.lower()
    for city, (lat, lng) in CITY_COORDS.items():
        if city in t:
            return lat, lng
    return None, None

def unwikify(text):
    return re.sub(r'\[\[([^\]|]+?\|)?([^\]]+?)\]\]', r'\2', text)

def cite_url(cite_text):
    m = re.search(r'\burl\s*=\s*(https?://[^\s|\}]+)', cite_text, re.IGNORECASE)
    return m.group(1).rstrip(", ") if m else ""

def ref_url(ref_cell, wikitext):
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
        raise SystemExit("No tables found")
    table = tables[0]
    rows = table.data()
    print(f"  {len(rows)} rows (incl. 2 headers)")

    SKIP = {"Tanggal Kejadian", "Provinsi", "Lokasi", "Jumlah Korban", "Ref", "TOTAL"}
    incidents = []
    for row in rows[2:]:
        if len(row) < 7:
            continue
        date     = str(row[0]).strip()
        province = str(row[1]).strip()
        if not date or date in SKIP:
            continue
        province = unwikify(province)
        city     = unwikify(str(row[2]).strip())
        school   = unwikify(str(row[3]).strip())
        symp     = str(row[4]).strip()
        deaths   = str(row[5]).strip()
        url      = ref_url(str(row[6]).strip(), wikitext)

        # Build location string
        loc = city
        if province and province not in city:
            loc = f"{city}, {province}" if city else province
        elif not city:
            loc = province

        # Geo lookup: check city, city+province, province
        lat, lng = geo_lookup(city) or geo_lookup(f"{city} {province}") or geo_lookup(province)

        # Parse victims
        v = re.sub(r'[^\d]', '', symp) if symp else ''
        victims = int(v) if v else 0

        # Title
        title = school or f"{city} ({victims} korban)" if victims else city

        # Deaths
        d = re.sub(r'[^\d]', '', deaths) if deaths else ''
        deaths_val = int(d) if d else 0

        incidents.append({
            "cat": "keracunan",
            "date": unwikify(date),
            "lat": lat,
            "lng": lng,
            "province": unwikify(province),
            "kabupaten": city,
            "school": school,
            "loc": loc,
            "victims": victims,
            "deaths": deaths_val,
            "title": title,
            "source": "Wikipedia",
            "source_url": url,
            "note": f"Sekolah: {school}" if school else "",
        })

    geo_count = sum(1 for i in incidents if i["lat"] is not None)
    print(f"  {len(incidents)} incidents ({geo_count} with geo)")
    print(f"  {sum(1 for i in incidents if i['source_url'])} with source URLs")

    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(incidents, f, ensure_ascii=False, indent=2)
    print(f"✓  {len(incidents)} → {out_file}")

    for inc in incidents[:3]:
        print(f"\n  {inc['date']} | {inc['loc']}")
        print(f"  {inc['title']} | {inc['victims']} korban | {inc['deaths']} meninggal")
        print(f"  Lat/Lng: {inc['lat']}, {inc['lng']}")
        print(f"  URL: {inc['source_url'][:50] if inc['source_url'] else 'N/A'}")

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "data/wiki_incidents.json"
    scrape(out)
