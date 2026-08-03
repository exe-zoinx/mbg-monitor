#!/usr/bin/env python3
"""Scrape SPPG GeoJSON data from the government map site."""
import json
import urllib.request
from datetime import datetime, timezone

URL = 'https://awr.ditjenpkh.pertanian.go.id/sppg/assets/js/geojson/sppg3.js'
OUT = 'data/sppg.json'


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
            'tanggal_operasional': p.get('Tanggal Operasional'),
        })

    out = {
        'sppg': sppg,
        'total': len(sppg),
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
    for p, c in sorted(provs.items(), key=lambda x: -x[1])[:10]:
        print(f"  {p}: {c}")


if __name__ == '__main__':
    main()
