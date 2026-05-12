#!/usr/bin/env python3
"""
Geocode incidents in the D1 database with a slow pace to avoid rate limiting.
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

def esc(s):
    return s.replace("'", "''") if s else s

def extract_json(text):
    """Extract the JSON array from wrangler output (skip warnings)."""
    start = text.find('[')
    end = text.rfind(']') + 1
    if start == -1 or end == 0:
        return None
    json_str = text[start:end]
    return json.loads(json_str)

def main():
    batch_size = 10
    delay_between_incidents = 2.0  # seconds
    delay_between_batches = 60.0   # seconds

    # First, get all incidents that have NULL lat or lng
    sql = "SELECT id, loc FROM incidents WHERE lat IS NULL OR lng IS NULL;"
    cmd = ["npx", "wrangler", "d1", "execute", "mbg_db", "--remote", "--command", sql]
    print("Fetching incidents needing geocoding...")
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
        print(f"Error parsing output: {e}")
        print(f"Output: {result.stdout}")
        return
    
    total = len(rows)
    print(f"Found {total} incidents to geocode.")
    
    processed = 0
    for i in range(0, total, batch_size):
        batch = rows[i:i+batch_size]
        print(f"\n--- Processing batch {i//batch_size + 1} ({len(batch)} incidents) ---")
        for j, row in enumerate(batch):
            incident_id = row["id"]
            location = row["loc"]
            if not location:
                print(f"  [{i+j+1}/{total}] Skipping incident {incident_id}: empty location")
                processed += 1
                continue
            query = f"{location}, Indonesia"
            print(f"  [{i+j+1}/{total}] Geocoding: {query}")
            lat, lng = geocode(query)
            if lat is None or lng is None:
                print(f"    Could not geocode.")
            else:
                # Update the incident
                update_sql = f"UPDATE incidents SET lat = {lat}, lng = {lng} WHERE id = {incident_id};"
                update_cmd = ["npx", "wrangler", "d1", "execute", "mbg_db", "--remote", "--command", update_sql]
                update_result = subprocess.run(update_cmd, capture_output=True, text=True, timeout=30)
                if update_result.returncode != 0:
                    print(f"    Error updating: {update_result.stderr}")
                else:
                    print(f"    Updated to lat={lat}, lng={lng}")
            processed += 1
            # Delay between incidents (except the last in batch)
            if j < len(batch) - 1:
                time.sleep(delay_between_incidents)
        # Delay between batches (except the last batch)
        if i + batch_size < total:
            print(f"  Waiting {delay_between_batches} seconds before next batch...")
            time.sleep(delay_between_batches)
    
    print(f"\nDone. Processed {processed} incidents.")

if __name__ == "__main__":
    main()