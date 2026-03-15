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

      // GET /debug — test scraping
      if (url.pathname === '/debug') {
        const results = {};

        // Test Antara fetch and parse
        try {
          const antaraRes = await fetch('https://www.antaranews.com/search?q=mbg', {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html',
            },
          });
          const antaraHtml = await antaraRes.text();

          // Test the regex patterns
          const cardRegex = /<div\s+class="card__post\s+card__post-list\s+card__post__transition\s+mt-30">([\s\S]*?)(?=<div\s+class="card__post\s+card__post-list\s+card__post__transition\s+mt-30">|<div\s+class="pagination-area">|<\/main>)/g;
          let cardMatch;
          let count = 0;
          const sampleArticles = [];
          while ((cardMatch = cardRegex.exec(antaraHtml)) !== null) {
            count++;
            const chunk = cardMatch[1];
            const urlMatch = chunk.match(/<h2\s+class="h5">\s*<a\s+href="(https:\/\/www\.antaranews\.com\/[^"]+)"/);
            const titleMatch = chunk.match(/<h2\s+class="h5">\s*<a\s+href="[^"]+"\s+title="([^"]+)"/);
            if (count <= 3) {
              sampleArticles.push({
                url: urlMatch ? urlMatch[1] : null,
                title: titleMatch ? titleMatch[1] : null,
                chunkLen: chunk.length,
              });
            }
          }

          results.antara = {
            status: antaraRes.status,
            htmlLength: antaraHtml.length,
            hasCardPost: antaraHtml.includes('card__post'),
            articlesFound: count,
            sampleArticles,
          };
        } catch (err) {
          results.antara = { error: err.message };
        }

        return json(results, 200, corsHeaders);
      }

      // GET /test-scrape — run the full scraper and return results
      if (url.pathname === '/test-scrape') {
        try {
          const articles = await scrapeAll(env);
          return json({
            ok: true,
            count: articles.length,
            articles: articles.slice(0, 5),
          }, 200, corsHeaders);
        } catch (err) {
          return json({ error: err.message, stack: err.stack }, 500, corsHeaders);
        }
      }

      // GET /test-insert — test full scrape + insert flow
      if (url.pathname === '/test-insert') {
        try {
          const articles = await scrapeAll(env);
          const results = [];

          for (const article of articles.slice(0, 3)) {
            try {
              const tag = article.tag || 'mbg';
              const insertResult = await env.DB.prepare(`
                INSERT INTO incidents (cat, date, lat, lng, title, loc, victims, note, source, url, is_baseline)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                tag,
                article.date || new Date().toISOString().slice(0, 19).replace('T', ' '),
                null, null,
                article.title,
                article.location || 'Indonesia',
                0,
                article.summary || '',
                article.source || 'Unknown',
                article.url || '',
                0,
              ).run();
              results.push({ title: article.title, success: true, meta: insertResult.meta });
            } catch (err) {
              results.push({ title: article.title, error: err.message });
            }
          }

          return json({ ok: true, totalArticles: articles.length, insertResults: results }, 200, corsHeaders);
        } catch (err) {
          return json({ error: err.message, stack: err.stack }, 500, corsHeaders);
        }
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
