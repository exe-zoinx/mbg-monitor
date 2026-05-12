#!/usr/bin/env python3
"""
Geocode incidents by province (first part of location) to reduce number of requests.
"""

import json
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

USER_AGENT = "Mozilla/5.0 (compatible; MBGMonitor/1.0; +https://github.com/your-repo)"

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
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"    Rate limited (429) for '{query}'")
        else:
            print(f"    HTTP error {e.code} for '{query}': {e.reason}")
    except Exception as e:
        print(f"    Error for '{query}': {e}")
    return None, None

def extract_json(text):
    start = text.find('[')
    end = text.rfind(']') + 1
    if start == -1 or end == 0:
        return None
    json_str = text[start:end]
    return json.loads(json_str)

def main():
    # Fetch incidents needing geocoding
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
        print(f"Output: {result.stdout}")
        return

    total = len(rows)
    print(f"Found {total} incidents to geocode.")
    
    province_cache = {}  # province -> (lat, lng)
    processed = 0
    for i, row in enumerate(rows):
        incident_id = row["id"]
        loc = row["loc"]
        if not loc:
            print(f"  [{i+1}/{total}] Skipping incident {incident_id}: empty location")
            processed += 1
            continue
        # Extract province (first part before comma)
        parts = [p.strip() for p in loc.split(',')]
        province = parts[0] if parts else ""
        if not province:
            print(f"  [{i+1}/{total}] Skipping incident {incident_id}: no province")
            processed += 1
            continue
        # Check cache
        if province in province_cache:
            lat, lng = province_cache[province]
            if lat is None or lng is None:
                print(f"  [{i+1}/{total}] Province {province} previously failed, skipping.")
                processed += 1
                continue
            # Update incident
            update_sql = f"UPDATE incidents SET lat = {lat}, lng = {lng} WHERE id = {incident_id};"
            update_cmd = ["npx", "wrangler", "d1", "execute", "mbg_db", "--remote", "--command", update_sql]
            update_result = subprocess.run(update_cmd, capture_output=True, text=True, timeout=30)
            if update_result.returncode != 0:
                print(f"    Error updating: {update_result.stderr}")
            else:
                print(f"  [{i+1}/{total}] Updated {incident_id} with {province} coords ({lat}, {lng})")
            processed += 1
            continue
        # Geocode province
        query = f"{province}, Indonesia"
        print(f"  [{i+1}/{total}] Geocoding province: {query}")
        lat, lng = geocode(query)
        if lat is None or lng is None:
            print(f"    Could not geocode province {province}. Skipping.")
            province_cache[province] = (None, None)
            processed += 1
            continue
        province_cache[province] = (lat, lng)
        # Update incident
        update_sql = f"UPDATE incidents SET lat = {lat}, lng = {lng} WHERE id = {incident_id};"
        update_cmd = ["npx", "wrangler", "d1", "execute", "mbg_db", "--remote", "--command", update_sql]
        update_result = subprocess.run(update_cmd, capture_output=True, text=True, timeout=30)
        if update_result.returncode != 0:
            print(f"    Error updating: {update_result.stderr}")
        else:
            print(f"    Updated {incident_id} with ({lat}, {lng})")
        processed += 1
        # Be nice: sleep 1 second between geocode requests
        time.sleep(1.0)
    
    print(f"\nDone. Processed {processed} incidents. Cached {len(province_cache)} provinces.")

if __name__ == "__main__":
    main()