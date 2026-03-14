/**
 * GET /api/history?secret=YOUR_SECRET
 * Returns crawl log + DB aggregate stats.
 * Protected — same secret as CRON_SECRET on the Worker.
 *
 * Bindings: DB (D1)
 * Env var:  REFRESH_SECRET (set in Pages env vars, same value as Worker CRON_SECRET)
 */
export async function onRequestGet(ctx) {
  const { DB, REFRESH_SECRET } = ctx.env;
  const url = new URL(ctx.request.url);

  if (!REFRESH_SECRET) {
    return json({ error: 'REFRESH_SECRET not configured' }, 503);
  }

  // Timing-safe comparison
  const provided = url.searchParams.get('secret') || '';
  const ok       = await timingSafeEqual(provided, REFRESH_SECRET);
  if (!ok) {
    await new Promise(r => setTimeout(r, 300)); // constant-time delay
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!DB) return json({ error: 'D1 not bound' }, 503);

  const [crawls, agg] = await Promise.all([
    DB.prepare(`
      SELECT id, crawled_at, provider, model, duration_ms,
             incidents_added, news_added, poisoning_total, victims_total, raw_ok
      FROM crawl_log ORDER BY id DESC LIMIT 20
    `).all(),
    DB.prepare(`
      SELECT
        COUNT(*)                                               AS total_incidents,
        SUM(victims)                                           AS total_victims,
        SUM(CASE WHEN cat='keracunan'  THEN 1 ELSE 0 END)     AS keracunan,
        SUM(CASE WHEN cat='sppg'       THEN 1 ELSE 0 END)     AS sppg,
        SUM(CASE WHEN cat='kecelakaan' THEN 1 ELSE 0 END)     AS kecelakaan,
        SUM(CASE WHEN cat='tewas'      THEN 1 ELSE 0 END)     AS tewas,
        SUM(CASE WHEN is_baseline=1    THEN 1 ELSE 0 END)     AS baseline,
        SUM(CASE WHEN is_baseline=0    THEN 1 ELSE 0 END)     AS live
      FROM incidents
    `).first(),
  ]);

  return json({
    ok:        true,
    db:        agg,
    crawl_log: crawls.results || [],
  }, 200, { 'Cache-Control': 'no-store' });
}

async function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const ka  = await crypto.subtle.importKey('raw', enc.encode(a), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const kb  = await crypto.subtle.importKey('raw', enc.encode(b), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const msg = enc.encode('mbg-history');
  const [sa, sb] = await Promise.all([
    crypto.subtle.sign('HMAC', ka, msg),
    crypto.subtle.sign('HMAC', kb, msg),
  ]);
  if (sa.byteLength !== sb.byteLength) return false;
  const va = new Uint8Array(sa), vb = new Uint8Array(sb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}
