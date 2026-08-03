#!/usr/bin/env python3
"""Scrape SPPG GeoJSON data from the government map site."""
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
import math
URL = 'https://awr.ditjenpkh.pertanian.go.id/sppg/assets/js/geojson/sppg3.js'
OUT = 'data/sppg.json'
INC = 'data/wiki_incidents.json'


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def fetch_js(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (mbg-monitor scraper)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8')


def main():
    js = fetch_js(URL)
    # File is `var sppg = { ... };` — strip the var prefix and trailing semicolon
    start = js.index('{')
    end = js.rindex('}')
    raw = js[start:end + 1]
    data = json.loads(raw)

    features = data.get('features', [])
    sppg = []
    for f in features:
        p = f.get('properties', {})
        g = f.get('geometry', {})
        coords = g.get('coordinates') or [None, None]
        sppg.append({
            'id': p.get('No'),
            'kode': p.get('Kode SPPG'),
            'nama': p.get('Nama SPPG'),
            'provinsi': p.get('Provinsi'),
            'kabupaten': p.get('Kab/Kota'),
            'kecamatan': p.get('Kecamata'),
            'kelurahan': p.get('Kelurahan'),
            'alamat': p.get('Alamat'),
            'lat': coords[1],
            'lng': coords[0],
            'tanggal_pembangunan': p.get('Tanggal Operasional'),
            'berita_url': 'https://www.google.com/search?q=' + urllib.parse.quote(
                f"{p.get('Nama SPPG', '')} berita pembangunan"
            ),
        })

    # ── Cross-reference: flag SPPG near poisoning incidents (<10km) ────────────
    with open(INC) as f:
        incidents = json.load(f).get('incidents', [])
    inc_coords = [(i.get('lat'), i.get('lng'), i.get('deaths', 0))
                  for i in incidents if i.get('lat') and i.get('lng')]
    risk_count = 0
    death_count = 0
    for s in sppg:
        s['risiko'] = False
        s['meninggal_terkait'] = False
        if not s.get('lat') or not s.get('lng'):
            continue
        for lat, lng, deaths in inc_coords:
            if haversine_km(s['lat'], s['lng'], lat, lng) < 10:
                s['risiko'] = True
                if deaths > 0:
                    s['meninggal_terkait'] = True
                break
        if s['risiko']:
            risk_count += 1
            if s['meninggal_terkait']:
                death_count += 1
    out = {
        'sppg': sppg,
        'total': len(sppg),
        'risiko_count': risk_count,
        'meninggal_terkait_count': death_count,
        'scraped_at': datetime.now(timezone.utc).isoformat(),
        'source': URL,
        'source_note': 'Data per 30 September 2025 (snapshot di situs pemerintah)',
    }
    with open(OUT, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    # Province distribution summary
    provs = {}
    for s in sppg:
        provs[s['provinsi']] = provs.get(s['provinsi'], 0) + 1
    print(f"Total SPPG: {len(sppg)}")
    print(f"Provinces: {len(provs)}")
    print(f"Risiko (dekat insiden): {out.get('risiko_count', 0)}")
    print(f"Meninggal terkait: {out.get('meninggal_terkait_count', 0)}")
    for p, c in sorted(provs.items(), key=lambda x: -x[1])[:10]:
        print(f"  {p}: {c}")


if __name__ == '__main__':
    main()
