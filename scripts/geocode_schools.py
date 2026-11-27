"""Resolve each wiki incident to the most precise place available.

Chain, best first:
  1. the school itself            → precision "school"
  2. the kelurahan/desa named inside the school's name
     ("SDN 6 Matangkuli" → Matangkuli village/district) → "kelurahan"
  3. the kecamatan named in loc/note/title or in the school name → "kecamatan"
  4. the kabupaten centroid       → "kabupaten"
  5. the province centroid        → "province"

Only Nominatim is used (Photon started refusing after ~1000 queries). Every hit
is validated against the named kabupaten/province before it is accepted, and a
coarse level is recorded instead of being presented as a precise school point.

Usage:
  python3 scripts/geocode_schools.py              # cache-only, fast
  python3 scripts/geocode_schools.py --net        # query Nominatim (1 req/s)
  python3 scripts/geocode_schools.py --net --limit 50
"""
import argparse, ast, difflib, json, os, re, time, urllib.parse, urllib.request
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INC = os.path.join(ROOT, 'data', 'wiki_incidents.json')
CACHE = os.path.join(ROOT, 'scripts', 'geo_cache.json')
AUDIT = os.path.join(ROOT, 'data', 'coord_audit.json')
UA = 'mbg-monitor/1.0 (coordinate audit; contact: github.com/exe-zoinx/mbg-monitor)'
PAUSE = 1.05  # Nominatim policy: max 1 request/second


def _load_city_coords():
    text = open(os.path.join(ROOT, 'scripts', 'scrape_wiki.py')).read()
    start = text.index('CITY_COORDS = {')
    i = text.index('{', start)
    depth = 0
    for j in range(i, len(text)):
        if text[j] == '{':
            depth += 1
        elif text[j] == '}':
            depth -= 1
            if depth == 0:
                return ast.literal_eval(text[i:j + 1])
    raise RuntimeError('CITY_COORDS not found')


CITY_COORDS = _load_city_coords()

GENERIC = {
    'sd', 'sd negeri', 'smp', 'sma', 'smk', 'negeri', 'swasta', 'sekolah', 'dasar', 'menengah',
    'pertama', 'atas', 'kejuruan', 'madrasah', 'aliyah', 'ibtidaiyah', 'taman', 'kanak',
    'n', 'no', 'nomor', 'sdn', 'smpn', 'sman', 'smkn', 'man', 'min', 'mts', 'mi', 'tk',
    'terdampak', 'siswa', 'murid', 'warga', 'dan', 'di', 'kecamatan', 'kelurahan', 'desa', 'kec',
}
NOT_A_SCHOOL = re.compile(
    r'^\d+\s+sekolah|^warga\b|^tba\b|^tidak disebutkan$|^spesifik tidak disebutkan$|'
    r'^siswa|^murid', re.I)
KEC_RE = re.compile(r'(?:kecamatan|kec\.?)\s+([A-Z][\w\'\-]+(?:\s+[A-Z][\w\'\-]+){0,3})')

ABBREV = [
    (r'\bSMKN\b', 'SMK Negeri'), (r'\bSMK N\b', 'SMK Negeri'),
    (r'\bSDN\b', 'SD Negeri'), (r'\bSD N\b', 'SD Negeri'),
    (r'\bSMPN\b', 'SMP Negeri'), (r'\bSMP N\b', 'SMP Negeri'),
    (r'\bSMAN\b', 'SMA Negeri'), (r'\bSMA N\b', 'SMA Negeri'),
    (r'\bMAN\b', 'Madrasah Aliyah Negeri'), (r'\bMIN\b', 'Madrasah Ibtidaiyah Negeri'),
    (r'\bMTsN\b', 'Madrasah Tsanawiyah Negeri'), (r'\bMTSN\b', 'Madrasah Tsanawiyah Negeri'),
]


def expand_school(name):
    out = name or ''
    for pat, rep in ABBREV:
        out = re.sub(pat, rep, out, flags=re.I)
    return re.sub(r'\s+', ' ', out).strip()


def norm_name(s):
    return re.sub(r'\s+', ' ', (s or '').lower().strip())


def norm_regency(s):
    s = norm_name(s)
    for p in ('kabupaten ', 'kab. ', 'kab ', 'kota administrasi ', 'kota '):
        if s.startswith(p):
            s = s[len(p):]
    return s


def tokens(s):
    return {t for t in re.findall(r"[a-z0-9']+", norm_name(s)) if t not in GENERIC and len(t) > 1}


def is_school_name(s):
    s = (s or '').strip()
    if len(s) < 4 or NOT_A_SCHOOL.search(s):
        return False
    return bool(re.search(r'\b(sd|smp|sma|smk|mi|mts|ma|man|min|mt|sdn|smpn|sman|smkn|pesantren|ponpes|tk)\b', s, re.I))


_lock = 0
GEO_CACHE = {}
_last_call = [0.0]


def cache_get(key):
    return GEO_CACHE.get(key.lower())


def cache_set(key, val):
    GEO_CACHE[key.lower()] = val


def nominatim(query, limit=5, extras=None):
    """One polite Nominatim search; returns the raw feature list."""
    wait = PAUSE - (time.time() - _last_call[0])
    if wait > 0:
        time.sleep(wait)
    params = {
        'q': query, 'format': 'jsonv2', 'limit': limit, 'addressdetails': 1,
        'countrycodes': 'id',
    }
    if extras:
        params.update(extras)
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'id,en'})
            with urllib.request.urlopen(req, timeout=25) as r:
                _last_call[0] = time.time()
                return json.loads(r.read())
        except Exception as e:
            _last_call[0] = time.time()
            if attempt == 2:
                print(f'    nominatim error for {query!r}: {e}', flush=True)
                return []
            time.sleep(3 * (attempt + 1))
    return []


def addr_matches(feat, kabupaten, province):
    a = feat.get('address') or {}
    joined = ' '.join(norm_name(a.get(k)) for k in
                      ('city', 'town', 'village', 'municipality', 'county', 'district', 'state_district', 'state')
                      if a.get(k))
    target = norm_regency(kabupaten)
    prov = norm_name(province)
    if target and (target in joined or difflib.SequenceMatcher(None, target, norm_name(a.get('county') or a.get('city') or '')).ratio() > 0.86):
        return True
    if prov and prov in joined:
        return True
    return False


def name_matches(feat_name, school_name):
    a = tokens(school_name)
    b = tokens(feat_name)
    if not a or not b:
        return False
    shared = a & b
    if not shared:
        return False
    na = re.findall(r'\d+', school_name)
    nb = re.findall(r'\d+', feat_name)
    if na and nb and not (set(na) & set(nb)):
        return False
    return len(shared) >= 1 and (len(shared) >= min(len(a), len(b)) or len(shared) >= 2 or bool(na and nb))


def hit(feat, precision, query, matched):
    lat, lng = float(feat['lat']), float(feat['lon'])
    a = feat.get('address') or {}
    return {
        'lat': lat, 'lng': lng, 'precision': precision, 'query': query, 'matched': matched,
        'kecamatan': a.get('city_district') or a.get('district') or a.get('suburb') or a.get('town') or '',
        'kelurahan': a.get('village') or a.get('hamlet') or a.get('suburb') or '',
    }


def geocode_school(school, kabupaten, province, allow_net):
    if not is_school_name(school):
        return None
    key = f'school|{school}|{kabupaten}|{province}'
    cached = cache_get(key)
    if cached is not None:
        return cached
    if not allow_net:
        return None

    expanded = expand_school(school)
    res, loose = None, None
    for q in (f'{expanded}, {kabupaten}, {province}, Indonesia', f'{expanded}, {kabupaten}'):
        for feat in nominatim(q, limit=10):
            nm = feat.get('name') or (feat.get('display_name') or '').split(',')[0]
            if not (name_matches(nm, expanded) and addr_matches(feat, kabupaten, province)):
                continue
            if (feat.get('type') or '') in ('school', 'college', 'university'):
                res = hit(feat, 'school', q, nm)
                break
            if loose is None:
                loose = hit(feat, 'school', q, nm)
        if res:
            break
    res = res or loose
    cache_set(key, res)
    return res


def geocode_place(place, kabupaten, province, allow_net):
    """Named kelurahan/kecamatan fallback when the school itself is not mapped."""
    place = (place or '').strip()
    if len(place) < 3:
        return None
    key = f'place|{place}|{kabupaten}|{province}'
    cached = cache_get(key)
    if cached is not None:
        return cached
    if not allow_net:
        return None
    res = None
    for q in (f'{place}, {kabupaten}, {province}, Indonesia', f'{place}, {kabupaten}'):
        for feat in nominatim(q, limit=5):
            addr = feat.get('address') or {}
            label = addr.get('village') or addr.get('suburb') or addr.get('town') \
                or addr.get('city_district') or addr.get('district') or feat.get('name') or ''
            if not addr_matches(feat, kabupaten, province):
                continue
            if difflib.SequenceMatcher(None, norm_name(place), norm_name(label)).ratio() < 0.75 \
                    and norm_name(place) not in norm_name(label):
                continue
            precision = 'kelurahan' if (addr.get('village') or addr.get('suburb')) else 'kecamatan'
            res = hit(feat, precision, q, label)
            break
        if res:
            break
    cache_set(key, res)
    return res


def geocode_region(kabupaten, province, allow_net):
    """Kabupaten centroid (validated), else province; never claims school level."""
    key = f'region|{kabupaten}|{province}'
    cached = cache_get(key)
    if cached is not None:
        return cached
    res = None
    if allow_net and kabupaten:
        for feat in nominatim(f'{kabupaten}, {province}, Indonesia', limit=5):
            if addr_matches(feat, kabupaten, province):
                res = hit(feat, 'kabupaten', f'{kabupaten}, {province}', feat.get('name'))
                break
    if not res:
        c = CITY_COORDS.get(norm_regency(kabupaten))
        if c and c[0] is not None:
            res = {'lat': c[0], 'lng': c[1], 'precision': 'kabupaten', 'query': kabupaten,
                   'matched': 'CITY_COORDS', 'kecamatan': '', 'kelurahan': ''}
    if not res:
        c = sppg_cloud(kabupaten)
        if c:
            res = {'lat': c[0], 'lng': c[1], 'precision': 'kabupaten', 'query': kabupaten,
                   'matched': 'sppg_cloud', 'kecamatan': '', 'kelurahan': ''}
    if not res and province:
        c = CITY_COORDS.get(norm_name(province)) or sppg_cloud('', province)
        if c and c[0] is not None:
            res = {'lat': c[0], 'lng': c[1], 'precision': 'province', 'query': province,
                   'matched': 'CITY_COORDS', 'kecamatan': '', 'kelurahan': ''}
    cache_set(key, res)
    return res

_CLOUD = {}


def sppg_cloud(kabupaten, province=''):
    """Mean of the SPPG points we already have — a real centroid for regencies
    missing from CITY_COORDS (Papua Barat Daya, Manokwari, Nabire, …)."""
    if not _CLOUD:
        path = os.path.join(ROOT, 'data', 'sppg.json')
        rows = json.load(open(path))['sppg']
        for r in rows:
            lat, lng = r.get('lat'), r.get('lng')
            if lat is None or lng is None:
                continue
            for key in (norm_regency(r.get('kabupaten') or ''), norm_name(r.get('provinsi') or '')):
                if key:
                    _CLOUD.setdefault(key, []).append((lat, lng))
    for key in (norm_regency(kabupaten), norm_name(province)):
        pts = _CLOUD.get(key)
        if pts:
            return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    return None


def haversine_km(a, b):
    import math
    lat1, lng1 = map(math.radians, a)
    lat2, lng2 = map(math.radians, b)
    dp, dl = lat2 - lat1, lng2 - lng1
    h = math.sin(dp / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dl / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def audit(incs):
    prec = Counter(i.get('geo_precision') or 'missing' for i in incs)
    pts = [(i['lat'], i['lng']) for i in incs if i.get('lat') is not None]
    close = 0
    pairs = 0
    for a in range(len(pts)):
        for b in range(a + 1, len(pts)):
            pairs += 1
            if haversine_km(pts[a], pts[b]) < 0.05:
                close += 1
    return {'incidents': len(incs), 'precision': dict(prec),
            'pairs_within_50m': close, 'pairs_total': pairs}


def main():
    global GEO_CACHE
    ap = argparse.ArgumentParser()
    ap.add_argument('--net', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    args = ap.parse_args()

    GEO_CACHE = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    doc = json.load(open(INC))
    incs = doc['incidents'][:args.limit] if args.limit else doc['incidents']

    for n, inc in enumerate(incs):
        kab, prov = inc.get('kabupaten') or '', inc.get('province') or ''
        names = [inc.get('school') or ''] + list(inc.get('schools_list') or [])
        seen, uniq = set(), []
        for name in names:
            if name and name not in seen:
                seen.add(name)
                uniq.append(name)

        school_hits = []
        for name in uniq:
            r = geocode_school(name, kab, prov, args.net)
            if r:
                school_hits.append({'name': name, **r})

        chosen = school_hits[0] if school_hits else None

        # kelurahan/kecamatan fallback: a place named inside the school string
        if not chosen and uniq:
            for name in uniq:
                for cand in tokens(name):
                    if len(cand) < 4:
                        continue
                    r = geocode_place(cand.title(), kab, prov, args.net)
                    if r:
                        chosen = {**r, 'name': name}
                        break
                if chosen:
                    break

        # explicit "Kecamatan X" in the narrative
        if not chosen:
            for field in ('loc', 'note', 'title'):
                m = KEC_RE.search(inc.get(field) or '')
                if m:
                    chosen = geocode_place(m.group(1), kab, prov, args.net)
                    if chosen:
                        break

        if not chosen:
            chosen = geocode_region(kab, prov, args.net)

        if chosen:
            inc['lat'], inc['lng'] = chosen['lat'], chosen['lng']
            inc['geo_precision'] = chosen['precision']
            inc['geo_query'] = chosen.get('query')
            inc['geo_matched'] = chosen.get('matched')
            inc['geo_kecamatan'] = chosen.get('kecamatan') or ''
            inc['geo_kelurahan'] = chosen.get('kelurahan') or ''
            if len(school_hits) > 1:
                inc['schools_geo'] = [{k: h[k] for k in ('name', 'lat', 'lng', 'precision')} for h in school_hits]
            else:
                inc.pop('schools_geo', None)
        else:
            inc['geo_precision'] = 'missing'
            inc.pop('schools_geo', None)

        if (n + 1) % 20 == 0:
            print(f'  ...{n+1}/{len(incs)}', flush=True)
            json.dump(GEO_CACHE, open(CACHE, 'w'))
            json.dump(doc, open(INC, 'w'), ensure_ascii=False, indent=2)

    json.dump(doc, open(INC, 'w'), ensure_ascii=False, indent=2)
    json.dump(GEO_CACHE, open(CACHE, 'w'))
    result = audit(doc['incidents'])
    json.dump(result, open(AUDIT, 'w'), indent=2)
    print('precision:', result['precision'])
    print('pairs within 50 m:', result['pairs_within_50m'], 'of', result['pairs_total'])


if __name__ == '__main__':
    main()
