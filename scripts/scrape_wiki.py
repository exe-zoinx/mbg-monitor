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

# ── Outlet name lookup ─────────────────────────────────────────────────────────
OUTLET_NAMES = {
    'kompas.com': 'Kompas.com',
    'regional.kompas.com': 'Kompas.com',
    'detik.com': 'Detik.com',
    'detiknews.com': 'Detik.com',
    'news.detik.com': 'Detik.com',
    'cnnindonesia.com': 'CNN Indonesia',
    'www.cnnindonesia.com': 'CNN Indonesia',
    'tribunnews.com': 'Tribunnews.com',
    'www.tribunnews.com': 'Tribunnews.com',
    'tribun-jabar.com': 'Tribunnews.com',
    'tribun-timur.com': 'Tribunnews.com',
    'tribunbali.com': 'Tribunnews.com',
    'tribunpekanbaru.com': 'Tribunnews.com',
    'tribunpontianak.com': 'Tribunnews.com',
    'tribunmedan.com': 'Tribunnews.com',
    'tribunpadang.com': 'Tribunnews.com',
    'tribunsolo.com': 'Tribunnews.com',
    'tribunbogor.com': 'Tribunnews.com',
    'tribundepok.com': 'Tribunnews.com',
    'tribunjateng.com': 'Tribunnews.com',
    'tribunjatim.com': 'Tribunnews.com',
    'tribunlampung.com': 'Tribunnews.com',
    'antaranews.com': 'Antara',
    'rmol.id': 'RMOL.id',
    'mediaindonesia.com': 'Media Indonesia',
    'suara.com': 'Suara.com',
    'suaracommerce.com': 'Suara.com',
    'tempo.co': 'Tempo.co',
    'www.tempo.co': 'Tempo.co',
    'pikiran-rakyat.com': 'Pikiran Rakyat',
    'pikiranrakyat.com': 'Pikiran Rakyat',
    'www.pikiran-rakyat.com': 'Pikiran Rakyat',
    'rri.co.id': 'RRI.co.id',
    'www.rri.co.id': 'RRI.co.id',
    'ajnn.net': 'AJNN.net',
    'www.ajnn.net': 'AJNN.net',
    'harian-analisa.com': 'Harian Analisa',
    'www.harian-analisa.com': 'Harian Analisa',
    'acehtoday.id': 'Aceh Today',
    'www.acehtoday.id': 'Aceh Today',
    'susercontent.id': 'Susercontent.id',
    'www.susercontent.id': 'Susercontent.id',
    'paganujateng.com': 'Paganujateng.com',
    'daerahpos.com': 'Daerah Pos',
    'www.daerahpos.com': 'Daerah Pos',
    'daerahpost.com': 'Daerah Pos',
    'www.daerahpost.com': 'Daerah Pos',
    'cianjurekspres.disway.id': 'Cianjur Ekspres',
    'solopos.com': 'Solopos.com',
    'www.solopos.com': 'Solopos.com',
    'waspada.co.id': 'Waspada Online',
    'www.waspada.co.id': 'Waspada Online',
    'banjarmasinpost.co.id': 'Banjarmasin Post',
    'www.banjarmasinpost.co.id': 'Banjarmasin Post',
    'jambonews.id': 'Jambo News',
    'jambiseru.com': 'Jambi Seru',
    'paluekspres.co.id': 'Palu Ekspres',
    'www.paluekspres.co.id': 'Palu Ekspres',
    'sulteng raya.com': 'Sulteng Raya',
    'sultengrayanews.com': 'Sulteng Raya',
    'fajar.co.id': 'Fajar.co.id',
    'www.fajar.co.id': 'Fajar.co.id',
    'makassar.terkini.id': 'Terbit Indonesia',
    'terkini.id': 'Terbit Indonesia',
    'sultra.terkini.id': 'Terbit Indonesia',
    'radarsultra.co.id': 'Radar Sultra',
    'www.radarsultra.co.id': 'Radar Sultra',
    'kendariinfo.com': 'Kendari Info',
    'www.kendariinfo.com': 'Kendari Info',
    'lombokpost.jawapos.com': 'Lombok Post',
    'jawapos.com': 'Jawa Pos',
    'www.jawapos.com': 'Jawa Pos',
    'jatimnetwork.com': 'Jatim Network',
    'wartabromo.com': 'Warta Bromo',
    'www.wartabromo.com': 'Warta Bromo',
    'kaltimkeadilan.id': 'Kaltim Keadilan',
    'www.kaltimkeadilan.id': 'Kaltim Keadilan',
    'posmetro.co.id': 'Posmetro',
    'www.posmetro.co.id': 'Posmetro',
    'cirebonpro.com': 'Cirebon Pro',
    'jatinegara.com': 'Jatinegara.com',
    'infoblitar.co.id': 'Info Blitar',
    'wartajatim.com': 'WartaJatim.com',
    'busercontent.id': 'Busercontent.id',
    'beritadaerah.com': 'Beritadaerah.com',
    'kliksulteng.com': 'Klik Sulteng',
    'infopublik.id': 'InfoPublik.id',
    'www.infopublik.id': 'InfoPublik.id',
    'katadata.co.id': 'Katadata',
    'radarbanyumas.com': 'Radar Banyumas',
    'radarjateng.com': 'Radarjateng.com',
    'radarsemarang.com': 'Radar Semarang',
    'radarsolo.com': 'Radar Solo',
    'fjconews.com': 'FJCO News',
}

# ── Helpers ───────────────────────────────────────────────────────────────────

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


def extract_outlet(url):
    """Extract publication name from URL."""
    if not url:
        return 'Wikipedia'
    url_lower = url.lower()
    for key, name in OUTLET_NAMES.items():
        if key in url_lower:
            return name
    # Fallback: strip protocol + www, capitalize first part
    domain = re.sub(r'^https?://(www\.)?', '', url_lower).split('/')[0]
    name = domain.split('.')[0].replace('-', ' ').replace('_', ' ').title()
    return name or 'Wikipedia'


def parse_num(s):
    """Extract integer from string like '5 Siswa', '38 Siswa', ''."""
    m = re.sub(r'[^\d]', '', str(s)) if s else ''
    return int(m) if m else 0


def format_date(raw):
    """Convert Indonesian date like '29 September 2025' to '29 Sep 2025'."""
    raw = unwikify(raw).strip()
    months = {
        'januari':'Jan','februari':'Feb','maret':'Mar','april':'Apr',
        'mei':'Mei','juni':'Jun','juli':'Jul','agustus':'Agt',
        'september':'Sep','oktober':'Okt','november':'Nov','desember':'Des',
    }
    m = re.match(r'(\d{1,2})\s+(\w+)\s+(\d{4})', raw)
    if m:
        month = months.get(m.group(2).lower(), m.group(2))
        return f"{m.group(1)} {month} {m.group(3)}"
    return raw


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
    print(f"  {len(rows)} rows (incl. headers)")

    SKIP = {"Tanggal Kejadian", "Provinsi", "Lokasi", "Jumlah Korban", "Ref", "TOTAL"}
    incidents = []
    for row in rows[2:]:
        if len(row) < 7:
            continue
        date_raw  = str(row[0]).strip()
        if not date_raw or date_raw in SKIP:
            continue

        province  = unwikify(str(row[1]).strip())
        city      = unwikify(str(row[2]).strip())  # e.g. "Kabupaten Aceh Utara"
        school    = unwikify(str(row[3]).strip()) # e.g. "SDN 6 Matangkuli" or "TBA"
        symp      = str(row[4]).strip()              # e.g. "3 Siswa"
        deaths_s  = str(row[5]).strip()             # e.g. "" or "1"
        url       = ref_url(str(row[6]).strip(), wikitext)

        victims   = parse_num(symp)
        deaths    = parse_num(deaths_s)

        # ── Title: school name or "TBA" fallback ──
        tba_patterns = ('tba', 'tidak disebutkan', 'tidak disebut', 'tidak disebutkan')
        is_tba = school.lower().startswith(tba_patterns) if school else True
        if is_tba:
            title = city  # e.g. "Kabupaten Aceh Utara"
        else:
            title = school  # e.g. "SDN 6 Matangkuli"

        # ── Location: just "Kabupaten Xxx" (no province) ──
        kab = city  # already unwikified, already has "Kabupaten" prefix
        loc = kab  # single-line location, no province

        # ── Geo lookup ──
        lat, lng = geo_lookup(city) or geo_lookup(province) or (None, None)

        # ── Note: 🚑 N Keracunan | N Meninggal ──
        note = f"🚑 {victims} Keracunan"
        if deaths > 0:
            note += f" | {deaths} Meninggal"

        # ── Source: publication name ──
        source = extract_outlet(url)

        incidents.append({
            "cat":       "keracunan",
            "date":      format_date(date_raw),
            "lat":       lat,
            "lng":       lng,
            "province":  province,
            "kabupaten": city,
            "school":    school,
            "loc":       loc,
            "victims":   victims,
            "deaths":    deaths,
            "title":     title,
            "source":    source,
            "source_url": url,
            "note":      note,
        })

    geo_count = sum(1 for i in incidents if i["lat"] is not None)
    url_count = sum(1 for i in incidents if i["source_url"])
    print(f"  {len(incidents)} incidents ({geo_count} with geo)")
    print(f"  {url_count} with source URLs")

    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump({"incidents": incidents}, f, ensure_ascii=False, indent=2)
    print(f"✓  {len(incidents)} → {out_file}")

    # Preview
    for inc in incidents[:3]:
        print(f"\n  {inc['title']}")
        print(f"  📍 {inc['loc']}")
        print(f"  📅 {inc['date']}")
        print(f"  {inc['note']}")
        print(f"  🔗 {inc['source']} — {inc['source_url'][:60] if inc['source_url'] else 'N/A'}")

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "data/wiki_incidents.json"
    scrape(out)
