import { handleCron } from './cron.js';
import { scrapeAll } from './scrapers/index.js';
import { summarizeWithAI } from './ai.js';

export default {
  // Cron Trigger handler
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  },

  // HTTP handler for manual triggers and status
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // POST /trigger — manual cron trigger (protected)
      if (url.pathname === '/trigger' && request.method === 'POST') {
        const secret = url.searchParams.get('secret') || request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!secret || !timingSafeEqual(secret, env.CRON_SECRET || '')) {
          return json({ error: 'Unauthorized' }, 401, corsHeaders);
        }
        ctx.waitUntil(handleCron(env));
        return json({ ok: true, message: 'Crawl triggered' }, 200, corsHeaders);
      }

      // GET /status — health check
      if (url.pathname === '/status') {
        const lastCrawl = await env.DB.prepare(
          'SELECT * FROM crawl_log ORDER BY id DESC LIMIT 1'
        ).first().catch(() => null);

        return json({
          ok: true,
          status: 'healthy',
          last_crawl: lastCrawl,
          cron_schedule: '0 */2 * * *',
        }, 200, corsHeaders);
      }

      // GET /news — get latest news
      if (url.pathname === '/news') {
        const limit = parseInt(url.searchParams.get('limit') || '30', 10);
        const source = url.searchParams.get('source');

        let query = 'SELECT * FROM news ORDER BY date DESC, id DESC LIMIT ?';
        const params = [limit];

        if (source) {
          query = 'SELECT * FROM news WHERE source = ? ORDER BY date DESC, id DESC LIMIT ?';
          params.unshift(source);
        }

        const result = await env.DB.prepare(query).bind(...params).all();
        return json({ ok: true, news: result.results || [] }, 200, corsHeaders);
      }

      // GET / — API info
      return json({
        ok: true,
        name: 'mbg-monitor-cron',
        endpoints: {
          'POST /trigger': 'Manual crawl trigger (requires ?secret=)',
          'GET /status': 'Health check',
          'GET /news': 'Latest news (?limit=30&source=)',
        },
      }, 200, corsHeaders);

    } catch (err) {
      return json({ error: 'Internal error', message: err.message }, 500, corsHeaders);
    }
  },
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

async function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const ka = await crypto.subtle.importKey('raw', enc.encode(a), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const kb = await crypto.subtle.importKey('raw', enc.encode(b), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const msg = enc.encode('mbg-trigger');
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
