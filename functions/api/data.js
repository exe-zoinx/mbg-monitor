/**
 * GET /api/data
 * Reads incidents + latest news + stats from D1.
 * Response cached 3 minutes (max-age=180) — fresh enough for a news map.
 *
 * Bindings: DB (D1), MBG_KV (optional)
 */
export async function onRequestGet(ctx) {
  const { DB, MBG_KV } = ctx.env;
  const url = new URL(ctx.request.url);

  if (!DB) {
    return json({ error: 'D1_NOT_BOUND', message: 'D1 not configured. See README.' }, 503);
  }

  // KV meta — fast, no DB hit
  let meta = null;
  if (MBG_KV) {
    try {
      const raw = await MBG_KV.get('mbg:meta');
      if (raw) meta = JSON.parse(raw);
    } catch { /* non-fatal */ }
  }

  // Optional date range filtering
  const dateFrom = url.searchParams.get('from');
  const dateTo = url.searchParams.get('to');

  try {
    // Build incident query with optional date filters
    let incidentQuery = `
      SELECT id, cat, date, lat, lng, title, loc, victims, note, source, url, is_baseline
      FROM incidents
    `;
    const params = [];
    const conditions = [];

    if (dateFrom) {
      conditions.push('date >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('date <= ?');
      params.push(dateTo);
    }

    if (conditions.length > 0) {
      incidentQuery += ' WHERE ' + conditions.join(' AND ');
    }

    incidentQuery += ' ORDER BY date DESC LIMIT 2000';

    // Run all queries in parallel — catch errors for tables that may not exist yet
    const [incRes, statsRes] = await Promise.all([
      DB.prepare(incidentQuery).bind(...params).all().catch(() => ({ results: [] })),

      DB.prepare(`
        SELECT poisoning_incidents, total_victims, victims_note, budget_spent_t, budget_note, captured_at
        FROM stats_snapshot
        ORDER BY id DESC LIMIT 1
      `).first().catch(() => null),
    ]);

    // If meta not in KV, pull from crawl_log
    if (!meta) {
      const last = await DB.prepare(
        'SELECT crawled_at, provider, model FROM crawl_log ORDER BY id DESC LIMIT 1'
      ).first().catch(() => null);
      if (last) meta = { refreshed_at: last.crawled_at, provider: last.provider, model: last.model };
    }

    // If DB is completely empty (no incidents, no crawl history) return 404
    const hasAnyData = (incRes.results?.length > 0) || !!meta;
    if (!hasAnyData) {
      return json({ error: 'NO_DATA', message: 'No crawl data yet. Trigger /trigger on the Worker.' }, 404);
    }

    return json(
      {
        ok: true,
        incidents: incRes.results  || [],
        stats:     statsRes        || null,
        meta,
      },
      200,
      // Cache 3 minutes at CDN edge — users always get reasonably fresh data
      { 'Cache-Control': 'public, max-age=180, stale-while-revalidate=60' }
    );

  } catch (err) {
    return json({ error: 'DB_ERROR', message: err.message }, 500);
  }
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extra,
    },
  });
}
