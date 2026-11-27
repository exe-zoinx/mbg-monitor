"""Push school-level coordinates + their precision into D1.

Reads data/wiki_incidents.json (written by scripts/geocode_schools.py), adds the
geo_* columns when missing, then updates each incident row matched on
(date, kabupaten, title). Rows are matched, never re-inserted, so D1 ids — and
therefore the incident↔SPPG link keys — stay stable.

Usage:
  python3 scripts/seed_d1_coords.py --dry-run     # SQL only, no writes
  python3 scripts/seed_d1_coords.py               # apply to production D1
"""
import argparse, json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INC = os.path.join(ROOT, 'data', 'wiki_incidents.json')
DB = 'mbg_db'
NEEDED = [
    ('geo_precision', 'TEXT'),
    ('geo_kelurahan', 'TEXT'),
    ('geo_kecamatan', 'TEXT'),
]


def wrangler(args, capture=True):
    cmd = ['npx', 'wrangler', 'd1', 'execute', DB, '--remote'] + args
    r = subprocess.run(cmd, cwd=ROOT, capture_output=capture, text=True)
    if r.returncode != 0:
        sys.exit(f'wrangler failed: {r.stdout[-800:]}{r.stderr[-800:]}')
    return r.stdout


def sql_quote(s):
    return "'" + str(s).replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    audit = {}
    audit_path = os.path.join(ROOT, 'data', 'coord_audit.json')
    if os.path.exists(audit_path):
        audit = json.load(open(audit_path))

    incs = json.load(open(INC))['incidents']
    complete = [i for i in incs if i.get('lat') is not None and i.get('lng') is not None]
    print(f'incidents: {len(incs)}, with coordinates: {len(complete)}')
    if audit:
        print('precision:', audit.get('precision'))

    # 1. columns
    out = wrangler(['--json', '--command', "SELECT name FROM pragma_table_info('incidents')"])
    try:
        existing = {r['name'] for r in json.loads(out[out.index('['):])[0]['results']}
    except Exception:
        existing = set()
    alters = [f'ALTER TABLE incidents ADD COLUMN {name} {typ};'
              for name, typ in NEEDED if name not in existing]
    print('columns to add:', alters or 'none')

    # 2. updates
    updates = []
    for i in complete:
        sets = [f'lat={i["lat"]!r}', f'lng={i["lng"]!r}',
                f'geo_precision={sql_quote(i.get("geo_precision") or "")}']
        if i.get('geo_kelurahan'):
            sets.append(f'geo_kelurahan={sql_quote(i["geo_kelurahan"])}')
        if i.get('geo_kecamatan'):
            sets.append(f'geo_kecamatan={sql_quote(i["geo_kecamatan"])}')
        where = (f'date={sql_quote(i.get("date") or "")} '
                 f'AND kabupaten={sql_quote(i.get("kabupaten") or "")} '
                 f'AND title={sql_quote(i.get("title") or "")}')
        updates.append(f'UPDATE incidents SET {", ".join(sets)} WHERE {where};')

    sql = '\n'.join(alters + updates) + '\n'
    with open('/tmp/d1_coords.sql', 'w') as f:
        f.write(sql)
    print(f'wrote /tmp/d1_coords.sql ({len(updates)} updates)')

    if args.dry_run:
        return

    if alters:
        wrangler(['--command', alters[0]])
        for a in alters[1:]:
            wrangler(['--command', a])

    # run updates in chunks of 100 statements to keep each request small
    chunk = 100
    for start in range(0, len(updates), chunk):
        part = updates[start:start + chunk]
        with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False) as fh:
            fh.write('\n'.join(part) + '\n')
            path = fh.name
        wrangler(['--file', path])
        os.unlink(path)
        print(f'  applied {min(start + chunk, len(updates))}/{len(updates)}')

    # 3. report
    out = wrangler(['--json', '--command',
                    "SELECT geo_precision AS p, COUNT(*) AS n FROM incidents GROUP BY geo_precision ORDER BY n DESC"])
    print(out[out.index('['):][:600])


if __name__ == '__main__':
    main()
