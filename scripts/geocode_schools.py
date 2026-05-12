#!/usr/bin/env python3
"""
Geocode school names from wiki_incidents.json using Photon (OSM-based, no API key).
Queries: "School Name, Kabupaten, Province, Indonesia"
Caches results to school_coords_cache.json to avoid re-geocoding.
"""
import json
import time
import urllib.request
import urllib.parse
from pathlib import Path

CACHE_FILE = Path(__file__).parent / "school_coords_cache.json"
INCIDENTS_FILE = Path(__file__).parent.parent / "data" / "wiki_incidents.json"
BASE_URL = "https://photon.komoot.io/api/"
DELAY = 0.5  # seconds between requests (Photon is more tolerant than Nominatim)


def load_cache():
    if CACHE_FILE.exists():
        with open(CACHE_FILE) as f:
            return json.load(f)
    return {}


def save_cache(cache):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)


def geocode(query):
    """Returns (lng, lat) from Photon or (None, None)."""
    url = BASE_URL + "?" + urllib.parse.urlencode({"q": query, "limit": 1})
    req = urllib.request.Request(url, headers={"User-Agent": "MBGMonitor/1.0 research tool"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            features = data.get("features", [])
            if features:
                coords = features[0]["geometry"]["coordinates"]
                return coords[1], coords[0]  # Photon returns [lng, lat]
    except Exception as e:
        print(f"  Error: {e}")
    return None, None


def build_query(school, kabupaten, province):
    """Build search query for Photon."""
    parts = []
    if school and school.strip():
        s = school.strip()
        # Strip suffixes that duplicate location info
        for skip in [kabupaten, province]:
            if skip and s.endswith(", " + skip):
                s = s[: -len(", " + skip)].strip()
        if s:
            parts.append(s)
    if kabupaten and kabupaten.strip():
        parts.append(kabupaten.strip())
    if province and province.strip():
        parts.append(province.strip())
    parts.append("Indonesia")
    return ", ".join(parts)


def main():
    cache = load_cache()

    # Track how many were already found in previous runs
    prev_found = sum(1 for v in cache.values() if v[0] is not None)
    print(f"Cache: {len(cache)} entries, {prev_found} with coords from previous runs\n")

    with open(INCIDENTS_FILE) as f:
        data = json.load(f)
    incidents = data["incidents"]

    # Collect unique (school, kabupaten, province) needing geocoding
    needed = {}
    for inc in incidents:
        if inc.get("lat") and inc.get("lng"):
            continue
        key = (inc.get("school") or "", inc.get("kabupaten") or "", inc.get("province") or "")
        if key not in needed:
            needed[key] = []
        needed[key].append(inc)

    print(f"Incidents needing geo: {sum(len(v) for v in needed.values())}")
    print(f"Unique locations: {len(needed)}")
    new_hits = sum(1 for k in needed if k in cache and cache[k][0] is not None)
    print(f"Already cached (will reuse): {new_hits}")
    print()

    updated = 0
    new_found = 0
    for idx, (key, incs) in enumerate(needed.items()):
        school, kabupaten, province = key
        query = build_query(school, kabupaten, province)

        if query in cache:
            lat, lng = cache[query]
        else:
            print(f"[{idx+1}/{len(needed)}] {query[:75]}")
            lat, lng = geocode(query)
            if lat is not None:
                cache[query] = (lat, lng)
                save_cache(cache)
                print(f"  → {lat:.6f}, {lng:.6f}")
                new_found += 1
            else:
                cache[query] = (None, None)
                save_cache(cache)
                print(f"  → not found")
            if idx < len(needed) - 1:
                time.sleep(DELAY)

        if lat is not None:
            for inc in incs:
                inc["lat"] = lat
                inc["lng"] = lng
            updated += len(incs)

    print(f"\nNew coords found: {new_found}")
    print(f"Incidents updated: {updated}")

    # Save updated JSON
    with open(INCIDENTS_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    has_geo = sum(1 for i in incidents if i.get("lat"))
    no_geo = sum(1 for i in incidents if not i.get("lat"))
    print(f"Final: {has_geo}/{len(incidents)} with geo ({no_geo} still missing)")


if __name__ == "__main__":
    main()
