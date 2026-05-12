#!/usr/bin/env python3
"""
Geocode incidents in the D1 database that have NULL lat/lng.
Updates the lat and lng columns.
"""

import json
import re
import subprocess
import sys
import time
import urllib.request
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
    except Exception as e:
        print(f"  geocode error for '{query}': {e}")
    return None, None

def esc(s):
    return s.replace("'", "''") if s else s

def extract_json(text):
    """Extract the JSON array from wrangler output (skip warnings)."""
    # Find the first '[' and last ']'
    start = text.find('[')
    end = text.rfind(']') + 1
    if start == -1 or end == 0:
        return None
    json_str = text[start:end]
    return json.loads(json_str)

def main():
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
    
    print(f"Found {len(rows)} incidents to geocode.")
    
    for i, row in enumerate(rows):
        incident_id = row["id"]
        location = row["loc"]
        if not location:
            print(f"  Skipping incident {incident_id}: empty location")
            continue
        query = f"{location}, Indonesia"
        print(f"  [{i+1}/{len(rows)}] Geocoding: {query}")
        lat, lng = geocode(query)
        if lat is None or lng is None:
            print(f"    Could not geocode.")
            continue
        # Update the incident
        update_sql = f"UPDATE incidents SET lat = {lat}, lng = {lng} WHERE id = {incident_id};"
        update_cmd = ["npx", "wrangler", "d1", "execute", "mbg_db", "--remote", "--command", update_sql]
        update_result = subprocess.run(update_cmd, capture_output=True, text=True, timeout=30)
        if update_result.returncode != 0:
            print(f"    Error updating: {update_result.stderr}")
        else:
            print(f"    Updated to lat={lat}, lng={lng}")
        # Be nice to Nominatim: sleep 1 second between requests
        time.sleep(1.0)
    
    print("Done.")

if __name__ == "__main__":
    main()