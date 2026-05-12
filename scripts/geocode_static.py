#!/usr/bin/env python3
"""
Geocode incidents using a static mapping of Indonesian provinces to coordinates.
"""

import json
import subprocess
import sys
from pathlib import Path

# Static mapping of Indonesian province names (as they appear in Wikipedia) to approximate coordinates (capital city)
# Coordinates are approximate (lat, lng) for the capital or center of the province.
PROVINCE_COORDS = {
    "Nanggroe Aceh Darussalam": (5.5483, 95.3238),  # Banda Aceh
    "Aceh": (5.5483, 95.3238),  # alias
    "Sumatera Utara": (3.5952, 98.6722),  # Medan
    "Sumatera Barat": (-0.7399, 100.8000),  # Padang
    "Riau": (0.5071, 101.4478),  # Pekanbaru
    "Kepulauan Riau": (0.9200, 104.4500),  # Tanjung Pinang
    "Jambi": (-1.5900, 103.6100),  # Jambi
    "Sumatera Selatan": (-3.3194, 104.9144),  # Palembang
    "Bengkulu": (-3.7928, 102.2608),  # Bengkulu
    "Lampung": (-5.4294, 105.2614),  # Bandar Lampung
    "Kepulauan Bangka Belitung": (-2.7411, 106.4406),  # Pangkal Pinang
    "Banten": (-6.4058, 106.0640),  # Serang
    "DKI Jakarta": (-6.2088, 106.8456),  # Jakarta
    "Jawa Barat": (-6.9175, 107.6191),  # Bandung
    "Jawa Tengah": (-7.1509, 110.1403),  # Semarang
    "DI Yogyakarta": (-7.7956, 110.3695),  # Yogyakarta
    "Jawa Timur": (-7.2575, 112.7521),  # Surabaya
    "Bali": (-8.4095, 115.1889),  # Denpasar
    "Nusa Tenggara Barat": (-8.6529, 117.3612),  # Mataram
    "Nusa Tenggara Timur": (-10.1772, 123.6071),  # Kupang
    "Kalimantan Barat": (-0.0263, 109.3425),  # Pontianak
    "Kalimantan Tengah": (-1.6814, 113.3823),  # Palangka Raya
    "Kalimantan Selatan": (-3.0926, 115.2838),  # Banjarmasin
    "Kalimantan Timur": (0.5383, 116.5550),  # Samarinda
    "Kalimantan Utara": (3.5731, 116.6282),  # Tanjung Selor
    "Sulawesi Utara": (1.4930, 124.8408),  # Manado
    "Sulawesi Tengah": (-0.8911, 119.8716),  # Palu
    "Sulawesi Selatan": (-5.1477, 119.4327),  # Makassar
    "Sulawesi Tenggara": (-4.0833, 122.5167),  # Kendari
    "Gorontalo": (0.5412, 123.0595),  # Gorontalo
    "Sulawesi Barat": (-3.2833, 119.3333),  # Mamuju
    "Maluku": (-3.2385, 130.1453),  # Ambon
    "Maluku Utara": (1.4833, 127.8833),  # Ternate
    "Papua Barat": (-0.8607, 134.0532),  # Manokwari
    "Papua": (-4.1000, 138.9500),  # Jayapura
    # Additional variations
    "Kabupaten Aceh Utara": (5.0333, 97.25),  # approximate
    "Kabupaten Aceh Timur": (4.45, 97.8333),
    "Kabupaten Aceh Singkil": (2.75, 97.9167),
    "Kabupaten Toba": (2.5333, 99.1333),
    "Nias Utara": (1.3833, 97.6333),
    "Banyuwangi": (-8.2167, 114.3667),
    "Bogor": (-6.5944, 106.8228),
    "Bandung Barat": (-6.7833, 107.4),
    "Jakarta Selatan": (-6.2614, 106.81),
    "Surabaya": (-7.2575, 112.7521),
    # Add more as needed...
}

def extract_json(text):
    start = text.find('[')
    end = text.rfind(']') + 1
    if start == -1 or end == 0:
        return None
    json_str = text[start:end]
    return json.loads(json_str)

def main():
    sql = "SELECT id, loc FROM incidents WHERE lat IS NULL OR lng IS NULL;"
    cmd = ["npx", "wrangler", "d1", "execute", "mbg_db", "--remote", "--command", sql]
    print("Fetching incidents...")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        print(f"Error fetching: {result.stderr}")
        return
    try:
        data = extract_json(result.stdout)
        if not data:
            raise ValueError("No JSON found")
        rows = data[0]["results"]
    except Exception as e:
        print(f"Error parsing: {e}")
        return

    total = len(rows)
    print(f"Found {total} incidents to update.")
    updated = 0
    skipped = 0
    for i, row in enumerate(rows):
        incident_id = row["id"]
        loc = row["loc"]
        if not loc:
            print(f"  [{i+1}/{total}] Skipping {incident_id}: empty location")
            skipped += 1
            continue
        # Extract province (first part before comma)
        province = loc.split(',')[0].strip()
        if not province:
            print(f"  [{i+1}/{total}] Skipping {incident_id}: no province")
            skipped += 1
            continue
        # Look up in static mapping
        if province in PROVINCE_COORDS:
            lat, lng = PROVINCE_COORDS[province]
            update_sql = f"UPDATE incidents SET lat = {lat}, lng = {lng} WHERE id = {incident_id};"
            update_cmd = ["npx", "wrangler", "d1", "execute", "mbg_db", "--remote", "--command", update_sql]
            update_result = subprocess.run(update_cmd, capture_output=True, text=True, timeout=30)
            if update_result.returncode != 0:
                print(f"  [{i+1}/{total}] Error updating {incident_id}: {update_result.stderr}")
            else:
                print(f"  [{i+1}/{total}] Updated {incident_id} -> {province} ({lat}, {lng})")
                updated += 1
        else:
            print(f"  [{i+1}/{total}] Province '{province}' not in mapping, skipping.")
            skipped += 1

    print(f"\nDone. Updated: {updated}, Skipped: {skipped}")

if __name__ == "__main__":
    main()