#!/usr/bin/env python3
"""
Scrape Wikipedia's MBG poisoning incidents table.
Produces wiki_incidents.json for the worker or frontend to consume.
Run via cron every 2 hours.
"""

import json, re, sys
from pathlib import Path
from datetime import datetime
from urllib.request import urlopen, Request
from urllib.error import URLError

def fetch(url):
    req = Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; mbg-monitor/1.0; +https://github.com/)"
    })
    with urlopen(req, timeout=15) as r:
        return r.read().decode("utf-8")

from bs4 import BeautifulSoup

URL = "https://id.wikipedia.org/wiki/Daftar_kasus_keracunan_massal_program_Makan_Bergizi_Gratis"
OUT = Path(__file__).parent.parent / "data" / "wiki_incidents.json"

# Indonesian city → (lat, lng)
CITY_COORDS = {
  'jakarta': (-6.2088, 106.8456), 'dki jakarta': (-6.2088, 106.8456),
  'jawa timur': (-7.5, 112.5), 'jatim': (-7.5, 112.5),
  'jawa tengah': (-7.15, 110.14), 'jateng': (-7.15, 110.14),
  'jawa barat': (-6.9, 107.6),
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
  'cianjur': (-6.8176, 107.1457), 'bandung': (-6.9175, 107.6191),
  'subang': (-6.5597, 107.7593), 'karawang': (-6.3064, 107.3366),
  'purwakarta': (-6.5569, 107.4432), 'garut': (-7.2181, 107.9036),
  'tasikmalaya': (-7.3267, 108.2243), 'ciamis': (-7.32, 108.35),
  'kuningan': (-6.97, 108.5), 'majalengka': (-6.83, 108.2),
  'sumedang': (-6.83, 107.92), 'indramayu': (-6.35, 108.05),
  'majene': (-3.54, 118.97), 'polewali mandar': (-3.42, 119.32),
  'mamuju': (-2.5, 119.4), 'jawa': (-7.5, 110.5),
  # ACEH
  'aceh utara': (4.95, 97.15), 'utar': (4.95, 97.15),
  'aceh barat': (4.16, 96.12), 'nagan raya': (4.1, 96.5),
  'aceh besar': (5.35, 95.6), 'pidie': (4.95, 96.15),
  'pidie jaya': (4.9, 96.15), 'bireuen': (4.9, 96.4),
  'lhokseumawe': (5.18, 97.13), 'langsa': (4.5, 97.95),
  'subulussalam': (2.7, 98.0), 'tapaktuan': (2.8, 97.2),
  'meulaboh': (4.15, 96.13), 'singkil': (2.3, 97.8),
  'tanah luas': (4.85, 96.2), 'matangkuli': (5.0, 97.2),
  'trienggadeng': (4.9, 96.6),
  # LAMPUNG
  'lampung': (-4.9956, 105.2836), 'bandar lampung': (-5.4299, 105.262),
  'lampung selatan': (-5.6, 105.4), 'lampung tengah': (-4.95, 105.2),
  'lampung timur': (-4.8, 105.7), 'lampung barat': (-5.0, 103.8),
  'pesawaran': (-5.24, 105.07), 'pringsewu': (-5.36, 104.97),
  'tulang bawang': (-4.3, 105.3), 'way kanan': (-4.7, 104.5),
  'mesuji': (-4.1, 105.5), 'tulang bawang barat': (-4.5, 105.0),
  'metro': (-5.11, 105.3),
  # SUMUT
  'sumatera utara': (3.6, 98.7), 'sumut': (3.6, 98.7),
  'medan': (3.5952, 98.6722), 'deli serdang': (3.5, 98.7),
  'langkat': (3.9, 98.3), 'serdang bedagai': (3.5, 99.0),
  'karo': (3.1, 98.5), 'simalungun': (2.9, 99.0),
  'dairi': (2.5, 98.1), 'humbang hasundutan': (2.5, 98.5),
  'tapanuli tengah': (1.8, 98.8), 'tapanuli utara': (2.0, 98.8),
  'tapanuli selatan': (1.5, 99.0), 'nias': (1.1, 97.6),
  'nias selatan': (0.8, 97.5), 'gunungsitoli': (1.3, 97.6),
  'pematangsiantar': (2.95, 99.06), 'tebing tinggi': (3.13, 99.14),
  'binjai': (3.6, 98.5), 'stabat': (3.7, 98.5),
  # SUMBAR
  'sumatera barat': (-0.9, 100.4), 'padang': (-0.9489, 100.3613),
  'limapuluh kota': (-0.3, 100.5), 'solok': (-0.9, 100.6),
  'agam': (-0.6, 100.5), 'pasaman': (-0.2, 100.0),
  'padang pariaman': (-0.7, 100.4), 'pesisir selatan': (-1.3, 100.7),
  'dharmasraya': (-1.3, 101.4), 'solok selatan': (-1.4, 101.2),
  'sijunjung': (-0.8, 101.1), 'mentawai': (-1.8, 99.3),
  'payakumbuh': (-0.2, 100.6), 'bukittinggi': (-0.3, 100.37),
  # RIAU
  'pekanbaru': (0.5071, 101.4478), 'riau': (0.5, 101.5),
  'siak': (1.0, 102.0), 'pelalawan': (0.8, 102.0),
  'kuansing': (0.3, 101.4), 'inhil': (-0.3, 102.7),
  'bengkalis': (1.5, 102.1), 'rohil': (2.3, 100.8),
  'kampar': (0.4, 101.1), 'meranti': (1.0, 102.4),
  ' Kep. Riau': (1.0, 104.5), 'batam': (1.13, 104.04),
  # BENGKULU
  'bengkulu': (-3.8, 102.3), 'lebang': (-3.74, 102.4),
  'bengkulu tengah': (-3.5, 102.2), 'bengkulu selatan': (-4.2, 102.3),
  'bengkulu utara': (-3.4, 101.9), 'kaur': (-4.3, 103.3),
  'seluma': (-3.9, 102.4), 'muko-muko': (-2.3, 101.1),
  'rejang lebat': (-3.4, 102.5), 'muko': (-2.3, 101.1),
  'lebong': (-3.74, 102.4),
  # JAMBI & SUMSEL
  'jambi': (-1.6, 103.6), 'palembang': (-2.9908, 104.7558),
  'sumsel': (-2.9908, 104.7558), 'ogan ilir': (-3.5, 104.5),
  'ogan komering ilir': (-3.4, 105.0), 'muara enim': (-3.0, 104.2),
  'lahat': (-3.8, 103.5), 'lubuk linggau': (-3.3, 102.9),
  ' Prabumulih': (-3.4, 104.2), 'musi rawas': (-2.9, 103.0),
  'banyuasin': (-2.5, 104.5), 'empat lawang': (-3.8, 103.0),
  # BALI
  'bali': (-8.34, 115.09), 'denpasar': (-8.6525, 115.2192),
  'badung': (-8.6, 115.17), 'gianyar': (-8.47, 115.33),
  'tabanan': (-8.55, 115.07), 'buleleng': (-8.15, 115.0),
  'jembrana': (-8.3, 114.6), 'klungkung': (-8.53, 115.4),
  # NTB
  'ntb': (-8.65, 117.4), 'mataram': (-8.5833, 116.1167),
  'lombok barat': (-8.65, 116.1), 'lombok tengah': (-8.6, 116.3),
  'lombok timur': (-8.5, 116.5), 'lombok utara': (-8.35, 116.4),
  'sumbawa': (-8.7, 117.5), 'bima': (-8.5, 118.7),
  'dompu': (-8.55, 119.0), 'sumbawa barat': (-8.8, 116.8),
  # NTT
  'ntt': (-8.75, 121.5), 'kupang': (-10.1774, 123.6635),
  'flores': (-8.65, 121.3), 'sikka': (-8.6, 122.3),
  'ende': (-8.6, 121.6), 'ngada': (-8.7, 121.1),
  'sumba': (-9.6, 119.9), 'timor': (-9.5, 124.2),
  'malaka': (-9.6, 124.9), 'manggarai': (-8.6, 120.4),
  'manggarai timur': (-8.5, 120.8), 'nagekeo': (-8.6, 121.0),
  # KALSEL
  'kalimantan selatan': (-3.1, 115.2), 'banjarmasin': (-3.318, 114.5912),
  'tabalong': (-1.9, 115.7), 'tanah bumbu': (-2.9, 115.9),
  'tanah laut': (-3.6, 114.7), 'barito kuala': (-3.2, 114.6),
  'hulu sungai selatan': (-2.7, 115.3), 'hulu sungai tengah': (-2.5, 115.4),
  'hulu sungai utara': (-2.3, 115.4), 'tapin': (-2.9, 115.0),
  'rantau': (-2.8, 115.3), 'balangan': (-2.4, 115.4),
  # KALTENG
  'kalimantan tengah': (-1.5, 113.0), 'palangka raya': (-2.2138, 113.9213),
  'katingan': (-1.5, 113.0), 'seruyan': (-2.3, 112.2),
  'sintang': (-0.2, 111.5), 'melawi': (-0.5, 111.8),
  'kapuas': (-1.5, 113.0), 'gunung mas': (-1.2, 113.0),
  'barito selatan': (-2.0, 113.5), 'barito utara': (-1.5, 114.8),
  'murung raya': (-0.5, 114.0), 'lamandau': (-1.8, 111.5),
  # KALTIM
  'kalimantan timur': (1.0, 116.0), 'samarinda': (-0.4943, 117.1488),
  'balikpapan': (-1.2671, 116.8286), 'bontang': (1.0, 117.5),
  'kutai kartanegara': (0.5, 117.0), 'kutai timur': (1.0, 117.8),
  'kutai barat': (-0.5, 116.5), 'berau': (2.0, 117.5),
  'penajam paser utara': (-1.3, 116.5), 'paser': (-1.5, 115.8),
  # KALBAR
  'kalimantan barat': (0.0, 109.3), 'pontianak': (-0.03, 109.33),
  'singkawang': (0.9, 108.9), 'sanggau': (0.1, 110.6),
  'ketapang': (-1.8, 110.0), 'sintang': (-0.2, 111.5),
  'melawi': (-0.5, 111.8), 'sekadau': (-0.1, 110.6),
  'mempawah': (-0.2, 108.9), 'landak': (-0.2, 109.4),
  'bengkayang': (0.8, 109.5), 'sambas': (1.4, 108.9),
  # SULSEL
  'sulawesi selatan': (-4.0, 120.0), 'makassar': (-5.1427, 119.4125),
  'parepare': (-3.8, 119.6), 'palopo': (-3.0, 120.2),
  'toraja': (-3.0, 119.9), 'luwu': (-3.0, 120.3),
  'luwu timur': (-2.5, 120.8), 'luwu utara': (-2.7, 120.4),
  'bombana': (-4.5, 122.0), 'kendari': (-3.9865, 122.5146),
  'buton': (-5.5, 122.6), 'muna': (-4.9, 122.5),
  'bau-bau': (-5.5, 122.6), 'wakatobi': (-5.2, 123.5),
  'kolaka': (-4.2, 121.6), 'kolaka timur': (-4.2, 122.0),
  'konawe': (-4.0, 122.0), 'konawe selatan': (-4.2, 122.5),
  'konawe utara': (-3.5, 122.0),
  'maros': (-4.97, 119.7), 'pangkajene': (-4.8, 119.6),
  'barru': (-4.0, 119.7), 'parepare': (-3.8, 119.6),
  'enrekang': (-3.7, 119.8), 'toraja utara': (-3.1, 119.9),
  # SULTENG
  'sulawesi tengah': (-1.0, 121.0), 'palu': (-0.9025, 119.87),
  'donggala': (-0.7, 119.7), 'parigi moutong': (-0.8, 120.6),
  'poso': (-1.4, 120.7), 'tojo una-una': (-0.8, 121.6),
  'buol': (-1.2, 121.4), 'tolitoli': (-1.0, 120.8),
  'morowali': (-2.7, 121.5), 'banggai': (-1.8, 123.5),
  'banggai kepulauan': (-1.5, 123.0),
  # SULUT
  'sulawesi utara': (1.0, 124.8), 'manado': (1.4741, 124.8412),
  'bitung': (1.4, 125.0), 'tomohon': (1.3, 124.8),
  'kotamobagu': (0.7, 124.3), 'minahasa': (1.2, 124.8),
  'minahasa selatan': (1.0, 124.8), 'minahasa utara': (1.3, 124.9),
  'minahasa tenggara': (1.0, 124.9), 'bolmong': (1.3, 124.4),
  'bolmong timur': (1.2, 124.6), 'bolsel': (0.9, 124.5),
  # SULTRA
  'sulawesi tenggara': (-4.0, 122.5), 'kendari': (-3.9865, 122.5146),
  'bau-bau': (-5.5, 122.6),
  # SULBAR
  'sulawesi barat': (-2.8, 119.4), 'majene': (-3.54, 118.97),
  'polewali mandar': (-3.42, 119.32), 'mamuju': (-2.5, 119.4),
  'mamuju tengah': (-2.3, 119.5), 'mamuju utara': (-2.0, 119.3),
  # GORONTALO
  'gorontalo': (0.55, 123.0), 'kota gorontalo': (0.54, 123.06),
  'boalemo': (0.5, 122.5), 'gorontalo utara': (0.7, 122.5),
  'pahuwato': (0.6, 122.8), 'bone bolango': (0.5, 123.0),
  # MALUKU
  'maluku': (-3.0, 129.5), 'ambon': (-3.7, 128.1),
  'maluku tengah': (-3.0, 128.5), 'maluku utara': (1.5, 128.0),
  'maluku barat': (-6.5, 130.0), 'kepulauan aru': (-6.5, 134.5),
  # MALUKU UTARA
  'maluku utara': (1.5, 128.0), 'ternate': (0.8, 127.4),
  'tidore': (0.7, 127.4), 'halmahera': (0.5, 127.5),
  # PAPUA & Papua Barat
  'papua': (-4.0, 140.0), 'papua barat': (-1.2, 133.0),
  'jayapura': (-2.5, 140.7), 'sorong': (-0.9, 131.2),
}

def geo_lookup(text: str):
    t = text.lower()
    # Strip "kabupaten" / "kota" prefix for better matching
    t = re.sub(r'\bkabupaten\b', '', t)
    t = re.sub(r'\bkota\b', '', t)
    # Try exact city first
    for city, (lat, lng) in CITY_COORDS.items():
        if city in t:
            return lat, lng
    return None, None

def parse_ref_cell(td):
    """Extract reference links from a table cell."""
    links = []
    for a in td.find_all("a", href=True):
        href = a.get("href", "")
        if href.startswith("/wiki/") or href.startswith("https://id.wikipedia.org"):
            continue
        if href.startswith("http"):
            text = a.get_text(strip=True)
            if text:
                links.append({"url": href, "text": text})
    return links

def parse():
    print(f"Fetching {URL}")
    try:
        html = fetch(URL)
    except URLError as e:
        print(f"FAIL: {e}")
        sys.exit(1)

    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", class_="wikitable")
    if not table:
        print("No wikitable found")
        sys.exit(1)

    rows = table.find_all("tr")
    print(f"Table rows: {len(rows)}")

    incidents = []
    for i, row in enumerate(rows[1:], 1):  # skip header
        cells = row.find_all(["td", "th"])
        if len(cells) < 6:
            continue

        def txt(n):
            return cells[n].get_text(strip=True)

        # Parse date
        date_raw = txt(0)
        date_match = re.search(r'\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w+\s+\d{4}|\d{1,2}/\d{1,2}/\d{4}', date_raw)
        date_str = date_match.group(0) if date_match else date_raw
        # Normalize to YYYY-MM-DD
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d")
            date_iso = d.strftime("%Y-%m-%d")
        except:
            date_iso = date_str

        # Province, Kabupaten
        province = txt(1)
        kab = txt(2)
        school = txt(3)

        # Victims
        bergejala_raw = txt(4)
        try:
            bergejala = int(re.sub(r'[^\d]', '', bergejala_raw)) if bergejala_raw else 0
        except:
            bergejala = 0

        # Deaths
        meninggal_raw = txt(5)
        try:
            meninggal = int(re.sub(r'[^\d]', '', meninggal_raw)) if meninggal_raw else 0
        except:
            meninggal = 0

        # References (links from ref column)
        refs = parse_ref_cell(cells[-1]) if len(cells) >= 7 else []
        ref_url = refs[0]["url"] if refs else ""

        lat, lng = geo_lookup(f"{province} {kab} {school}")

        incidents.append({
            "date": date_iso,
            "province": province,
            "kabupaten": kab,
            "school": school,
            "victims": bergejala,
            "deaths": meninggal,
            "lat": lat,
            "lng": lng,
            "source": ref_url or "Wikipedia",
            "source_url": ref_url,
            "title": f"Keracunan MBG — {kab}, {province} ({bergejala} korban)",
            "cat": "keracunan",
            "loc": f"{kab}, {province}",
            "note": f"Sekolah: {school}" + (f" · {meninggal} meninggal" if meninggal else ""),
        })

    return incidents

def main():
    incidents = parse()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "source": "wikipedia",
        "scraped_at": datetime.now().isoformat(),
        "count": len(incidents),
        "incidents": incidents,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"OK: {len(incidents)} incidents → {OUT}")

if __name__ == "__main__":
    main()