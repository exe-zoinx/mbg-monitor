/**
 * Incident ↔ SPPG link helpers.
 *
 * `data/sppg_links.json` is produced by `scripts/build_sppg_links.py` from the
 * JejakMBG open dataset (CC BY 4.0): each case names the kitchen that fed the
 * school, plus — when a source says so — the yayasan/PT running that kitchen.
 *
 * The Python builder keys incidents as `<ISO date>|<normalised regency>` because
 * D1 ids are regenerated on every seed. Mirror that key exactly here.
 */

export function normRegency(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(kabupaten|kab|kota)\s+/, '')
    .trim();
}

export function incidentKey(inc) {
  if (!inc) return '';
  const date = String(inc.date || '').slice(0, 10);
  return `${date}|${normRegency(inc.kabupaten || inc.loc || '')}`;
}

const EMPTY = {
  byIncident: new Map(),
  bySppg: new Map(),
  cases: [],
  accusedCount: 0,
  incidentCount: 0,
  operatorCount: 0,
  generatedAt: null,
};

export function buildLinkIndex(doc) {
  if (!doc?.cases?.length) return EMPTY;

  const byIncident = new Map();
  for (const c of doc.cases) {
    if (!c.incident_key) continue;
    const bucket = byIncident.get(c.incident_key);
    if (bucket) bucket.push(c);
    else byIncident.set(c.incident_key, [c]);
  }

  const bySppg = new Map(Object.entries(doc.sppg || {}));
  return {
    byIncident,
    bySppg,
    cases: doc.cases,
    accusedCount: byIncident.size,
    incidentCount: doc.cases.filter(c => c.incident_key).length,
    operatorCount: bySppg.size,
    generatedAt: doc.generated_at,
    meta: doc.meta || {},
    attribution: doc.attribution || {},
  };
}

/** Owner record for an SPPG row (id or kode), or null. */
export function ownerFor(index, sppg) {
  if (!index || !sppg) return null;
  return index.bySppg.get(String(sppg.id)) || index.bySppg.get(String(sppg.kode)) || null;
}

export function operatorName(owner) {
  return owner?.operators?.[0]?.name || null;
}

/**
 * Citation for an owner record: BGN roster rows point at the official list,
 * article-derived rows at the outlet. `siteShared` > 1 means BGN lists one
 * kitchen for that kelurahan while our point data has several units there.
 */
export function operatorEvidence(owner) {
  const op = owner?.operators?.[0];
  if (!op) return null;
  const src = (op.sources && op.sources[0]) || null;
  const isRoster = op.source_type === 'bgn_roster';
  return {
    name: op.name,
    sourceType: op.source_type || 'article',
    label: isRoster ? 'BGN · Daftar SPPG Maret 2025' : (src?.outlet || 'pemberitaan'),
    url: src?.url || null,
    archiveUrl: src?.url_archive || null,
    siteShared: op.site_shared || 1,
  };
}

/** Cases that accuse an SPPG row, matched by id or kode. */
export function casesForSppg(index, sppg) {
  if (!index || !sppg || !index.cases?.length) return [];
  const ids = new Set([String(sppg.id), String(sppg.kode)]);
  return index.cases.filter(c => ids.has(String(c.sppg_id)));
}
