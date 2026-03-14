/**
 * MBG Monitor — Cloudflare Worker
 *
 * Handlers:
 *   scheduled()  — cron every 6h → AI crawl → write D1 + KV
 *   fetch()      — POST /trigger  (protected, manual run)
 *                  GET  /status   (public, cached)
 *
 * Secrets required (wrangler secret put):
 *   AI_API_KEY    — AI provider key
 *   CRON_SECRET   — min 32-char random string
 *   PAGES_ORIGIN  — your Pages URL (for CORS, e.g. https://mbg.pages.dev)
 *
 * Vars in wrangler.toml:
 *   AI_PROVIDER, AI_MODEL
 */

import { runCrawl } from './crawl.js';

// Timing-safe string comparison — prevents timing attacks on secret comparison
async function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc  = new TextEncoder();
  const ka   = await crypto.subtle.importKey('raw', enc.encode(a), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const kb   = await crypto.subtle.importKey('raw', enc.encode(b), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const msg  = enc.encode('mbg-compare');
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

function corsHeaders(origin, allowedOrigin) {
  // Only allow the configured Pages origin + localhost for dev
  const allowed = [allowedOrigin, 'http://localhost:8788', 'http://localhost:3000'].filter(Boolean);
  const use = allowed.includes(origin) ? origin : allowedOrigin || '*';
  return {
    'Access-Control-Allow-Origin':  use,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

export default {
  // ── Cron ──────────────────────────────────────────────
  async scheduled(_event, env, ctx) {
    console.log('[cron]', new Date().toISOString());
    ctx.waitUntil(
      runCrawl(env).catch(err => console.error('[cron] failed:', err.message))
    );
  },

  // ── HTTP ──────────────────────────────────────────────
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors   = corsHeaders(origin, env.PAGES_ORIGIN);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // POST /trigger — protected manual crawl
    if (url.pathname === '/trigger') {
      if (request.method !== 'POST') {
        return Response.json({ error: 'Use POST' }, { status: 405, headers: cors });
      }

      const provided = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim()
        || url.searchParams.get('secret') || '';

      if (!env.CRON_SECRET) {
        return Response.json({ error: 'CRON_SECRET not configured' }, { status: 503, headers: cors });
      }

      const ok = await safeEqual(provided, env.CRON_SECRET);
      if (!ok) {
        // Constant-time delay to slow brute-force attempts
        await new Promise(r => setTimeout(r, 300));
        return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
      }

      const t0 = Date.now();
      try {
        const result = await runCrawl(env);
        return Response.json(
          { ok: true, duration_ms: Date.now() - t0, ...result },
          { headers: cors }
        );
      } catch (err) {
        return Response.json({ error: err.message }, { status: 502, headers: cors });
      }
    }

    // GET /status — public, cached 5 minutes
    if (url.pathname === '/status' && request.method === 'GET') {
      if (!env.DB) {
        return Response.json({ error: 'D1 not bound' }, { status: 503, headers: cors });
      }
      const [last, counts] = await Promise.all([
        env.DB.prepare(
          'SELECT id, crawled_at, provider, model, duration_ms, incidents_added, news_added, raw_ok FROM crawl_log ORDER BY id DESC LIMIT 1'
        ).first(),
        env.DB.prepare(
          `SELECT COUNT(*) total,
             SUM(CASE WHEN cat='keracunan'  THEN 1 ELSE 0 END) keracunan,
             SUM(CASE WHEN cat='sppg'       THEN 1 ELSE 0 END) sppg,
             SUM(CASE WHEN cat='tewas'      THEN 1 ELSE 0 END) tewas,
             SUM(victims) victims
           FROM incidents`
        ).first(),
      ]);
      return Response.json(
        { ok: true, last_crawl: last, db: counts },
        { headers: { ...cors, 'Cache-Control': 'public, max-age=300' } }
      );
    }

    return Response.json(
      { service: 'MBG Monitor Worker', version: '1.0' },
      { headers: cors }
    );
  },
};
