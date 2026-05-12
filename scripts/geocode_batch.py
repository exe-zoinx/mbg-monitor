#!/usr/bin/env python3
"""
Geocode incidents in batches to avoid rate limiting.
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
BATCH_SIZE = 20
DELAY_BETWEEN_REQUESTS = 2.0  # seconds

def geocode(query):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "q": query,
        "format": "json",
        "limit": 1,
    })
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
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
    # First, get the count of incidents that need geocoding
    count_sql = "SELECT COUNT(*) as cnt FROM incidents WHERE lat IS NULL OR lng IS NULL;"
    count_cmd = ["npx", "wrangler", "d1", "execute", "mbg_db", "--remote", "--command", count_sql]
    count_result = subprocess.run(count_cmd, capture_output=True, text=True, timeout=30)
    if count_result.returncode != 0:
        print(f"Error getting count: {count_result.stderr}")
        return
    try:
        count_data = extract_json(count_result.stdout)
        if not count_data:
            raise ValueError("No JSON found")
        total_needed = count_data[0]["results"][0]["cnt"]
    except Exception as e:
        print(f"Error parsing count: {e}")
        print(f"Output: {count_result.stdout}")
        return

    print(f"Total incidents needing geocoding: {total_needed}")
    if total_needed == 0:
        print("All incidents have been geocoded.")
        return

    # We'll process up to BATCH_SIZE incidents
    limit_sql = f"SELECT id, loc FROM incidents WHERE lat IS NULL OR lng IS NULL LIMIT {BATCH_SIZE};"
    limit_cmd = ["npx", "wrangler", "d1", "execute", "mbg_db", "--remote", "--command", limit_sql]
    print(f"Fetching up to {BATCH_SIZE} incidents...")
    limit_result = subprocess.run(limit_cmd, capture_output=True, text=True, timeout=30)
    if limit_result.returncode != 0:
        print(f"Error fetching batch: {limit_result.stderr}")
        return
    try:
        limit_data = extract_json(limit_result.stdout)
        if not limit_data:
            raise ValueError("No JSON found")
        rows = limit_data[0]["results"]
    except Exception as e:
        print(f"Error parsing batch: {e}")
        print(f"Output: {limit_result.stdout}")
        return

    print(f"Fetched {len(rows)} incidents to process.")
    updated = 0
    for i, row in enumerate(rows):
        incident_id = row["id"]
        location = row["loc"]
        if not location:
            print(f"  [{i+1}/{len(rows)}] Skipping incident {incident_id}: empty location")
            continue
        query = f"{location}, Indonesia"
        print(f"  [{i+1}/{len(rows)}] Geocoding: {query}")
        lat, lng = geocode(query)
        if lat is None or lng is None:
            print(f"    Could not geocode.")
        else:
            update_sql = f"UPDATE incidents SET lat = {lat}, lng = {lng} WHERE id = {incident_id};"
            update_cmd = ["npx", "wrangler", "d1", "execute", "mbg_db", "--remote", "--command", update_sql]
            update_result = subprocess.run(update_cmd, capture_output=True, text=True, timeout=30)
            if update_result.returncode != 0:
                print(f"    Error updating: {update_result.stderr}")
            else:
                print(f"    Updated to lat={lat}, lng={lng}")
                updated += 1
        # Delay between requests to avoid rate limiting
        if i < len(rows) - 1:
            time.sleep(DELAY_BETWEEN_REQUESTS)
    
    print(f"\nBatch complete. Updated {updated} incidents.")
    print(f"Remaining to geocode: {total_needed - updated}")

if __name__ == "__main__":
    main()