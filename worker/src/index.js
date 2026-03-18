import { handleCron, deduplicateArticles } from './cron.js';
import { scrapeAll, extractVictims, extractLocation } from './scrapers/index.js';
import { classifyArticlesBatch, classifyArticle, heuristicClassify } from './ai-classify.js';
import { deepSearchKeracunanMBG } from './search-apis.js';

function TODAY() {
  return new Date().toISOString().slice(0, 10);
}

function truncateNote(text, maxLen = 200) {
  if (!text) return '';
  // Remove HTML tags if any
  const clean = text.replace(/<[^>]*>/g, '').trim();
  if (clean.length <= maxLen) return clean;
  // Find last sentence boundary before maxLen
  const truncated = clean.slice(0, maxLen);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastSpace = truncated.lastIndexOf(' ');
  const cutAt = lastPeriod > maxLen * 0.5 ? lastPeriod + 1 : lastSpace;
  return truncated.slice(0, cutAt > 0 ? cutAt : maxLen).trim() + '...';
}

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
      // POST /trigger — manual cron trigger (background, protected)
      if (url.pathname === '/trigger' && request.method === 'POST') {
        const secret = url.searchParams.get('secret') || request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!secret || !timingSafeEqual(secret, env.CRON_SECRET || '')) {
          return json({ error: 'Unauthorized' }, 401, corsHeaders);
        }
        ctx.waitUntil(handleCron(env));
        return json({ ok: true, message: 'Crawl triggered (background)' }, 200, corsHeaders);
      }

      // POST /crawl — run crawl synchronously and return results (protected)
      if (url.pathname === '/crawl' && request.method === 'POST') {
        const secret = url.searchParams.get('secret') || request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!secret || !timingSafeEqual(secret, env.CRON_SECRET || '')) {
          return json({ error: 'Unauthorized' }, 401, corsHeaders);
        }

        const start = Date.now();
        const articles = await scrapeAll(env);
        const classifications = await classifyArticlesBatch(env, articles);

        const incidents = [];
        const skipped = [];

        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];
          const classification = i < classifications.length ? classifications[i] : heuristicClassify(article);

          if (!classification.is_incident) {
            skipped.push({ title: article.title?.slice(0, 80), category: classification.category, reasoning: classification.reasoning });
            continue;
          }

          // Use AI victims/location if better
          if (classification.victims > 0 && !article.victims) article.victims = classification.victims;
          if (classification.location && (!article.location || article.location === 'Indonesia')) article.location = classification.location;

          incidents.push({
            ...article,
            ai_category: classification.category,
            ai_reasoning: classification.reasoning,
          });
        }

        // Dedup and insert
        const existingUrls = new Set();
        try {
          const rows = await env.DB.prepare('SELECT url FROM incidents').all();
          for (const row of rows.results || []) existingUrls.add(row.url);
        } catch (e) {}

        let inserted = 0;
        const insertErrors = [];
        for (const article of incidents) {
          if (!article.url || existingUrls.has(article.url)) continue;
          try {
            await env.DB.prepare(`
              INSERT INTO incidents (cat, date, lat, lng, title, loc, victims, note, source, url, is_baseline)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              article.tag || 'keracunan',
              article.date || new Date().toISOString().slice(0, 10),
              article.lat || null,
              article.lng || null,
              article.title,
              article.location || 'Indonesia',
              article.victims || 0,
              truncateNote(article.summary),
              article.source || 'Unknown',
              article.url,
              0,
            ).run();
            inserted++;
          } catch (err) {
            insertErrors.push({ title: article.title?.slice(0, 60), error: err.message });
          }
        }

        const duration = Date.now() - start;

        // Log crawl
        try {
          await env.DB.prepare(`
            INSERT INTO crawl_log (duration_ms, news_added, incidents_added, raw_ok, provider, model)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(duration, inserted, inserted, 1, 'ai-scraper-sync', 'ai-classify-v1').run();
        } catch (e) {}

        return json({
          ok: true,
          duration_ms: duration,
          total_scraped: articles.length,
          total_classified: classifications.length,
          actual_incidents: incidents.length,
          filtered_out: skipped.length,
          inserted,
          insert_errors: insertErrors.length,
          incidents: incidents.map(a => ({
            title: a.title?.slice(0, 80),
            source: a.source,
            victims: a.victims,
            location: a.location,
            category: a.ai_category,
            reasoning: a.ai_reasoning,
            url: a.url,
          })),
          skipped: skipped.slice(0, 10),
        }, 200, corsHeaders);
      }

      // POST /truncate — clear ALL incidents (protected)
      if (url.pathname === '/truncate' && request.method === 'POST') {
        const secret = url.searchParams.get('secret') || request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!secret || !timingSafeEqual(secret, env.CRON_SECRET || '')) {
          return json({ error: 'Unauthorized' }, 401, corsHeaders);
        }

        const result = await env.DB.prepare('DELETE FROM incidents').run();
        await env.DB.prepare('DELETE FROM stats_snapshot').run().catch(() => {});
        await env.DB.prepare('DELETE FROM crawl_log').run().catch(() => {});

        return json({
          ok: true,
          deleted: result.meta?.changes || 0,
          message: 'All incidents cleared',
        }, 200, corsHeaders);
      }

      // POST /truncate-and-refetch — truncate then re-fetch all data from 2024-today (protected, synchronous)
      if (url.pathname === '/truncate-and-refetch' && request.method === 'POST') {
        const secret = url.searchParams.get('secret') || request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!secret || !timingSafeEqual(secret, env.CRON_SECRET || '')) {
          return json({ error: 'Unauthorized' }, 401, corsHeaders);
        }

        const start = Date.now();

        if (env.mbg_kv) {
          await env.mbg_kv.put('mbg:refetch_status', JSON.stringify({
            status: 'in_progress',
            started_at: new Date().toISOString(),
          }));
        }

        try {
          // Step 1: Truncate
          await env.DB.prepare('DELETE FROM incidents').run();
          await env.DB.prepare('DELETE FROM stats_snapshot').run().catch(() => {});
          await env.DB.prepare('DELETE FROM crawl_log').run().catch(() => {});

          // Step 2: Deep search via search APIs
          const deepResults = await deepSearchKeracunanMBG(env).catch(err => {
            console.error('[REFETCH] Deep search failed:', err.message);
            return [];
          });

          if (deepResults.length === 0) {
            if (env.mbg_kv) {
              await env.mbg_kv.put('mbg:refetch_status', JSON.stringify({
                status: 'completed',
                completed_at: new Date().toISOString(),
                incidents_added: 0,
                duration_ms: Date.now() - start,
              }));
            }
            return json({ ok: true, message: 'Completed with 0 incidents', duration_ms: Date.now() - start }, 200, corsHeaders);
          }

          // Step 3: Extract victims and location, filter for relevance, then dedup and insert
          const unique = deduplicateArticles(deepResults, []);
          for (const article of unique) {
            article.victims = extractVictims(article.title, article.summary || article.note || '');
            const locData = extractLocation(article.title, article.summary || article.note || '');
            if (locData) { article.location = locData.city; article.lat = locData.lat; article.lng = locData.lng; }
          }
          const relevant = unique.filter(a => isRelevantMBGPoisoning(a));
          console.log(`[REFETCH] ${relevant.length}/${unique.length} articles passed relevance filter`);
          let incidentsAdded = 0;
          const BATCH_SIZE = 10;
          for (let i = 0; i < relevant.length; i += BATCH_SIZE) {
            const batch = relevant.slice(i, i + BATCH_SIZE);
            const stmts = batch.map(article =>
              env.DB.prepare(`
                INSERT INTO incidents (cat, date, lat, lng, title, loc, victims, note, source, url, is_baseline)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                article.tag || 'keracunan',
                article.date || new Date().toISOString().slice(0, 10),
                article.lat || null,
                article.lng || null,
                article.title,
                article.location || 'Indonesia',
                article.victims || 0,
                article.victims || 0,
                truncateNote(article.summary),
                article.source || 'Unknown',
                article.url,
                0,
              )
            );
            try {
              await env.DB.batch(stmts);
              incidentsAdded += batch.length;
            } catch (batchErr) {
              for (const article of batch) {
                try {
                  await env.DB.prepare(`
                    INSERT INTO incidents (cat, date, lat, lng, title, loc, victims, note, source, url, is_baseline)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).bind(
                    article.tag || 'keracunan',
                    article.date || new Date().toISOString().slice(0, 10),
                    article.lat || null,
                    article.lng || null,
                    article.title,
                    article.location || 'Indonesia',
                    article.victims || 0,
                    truncateNote(article.summary),
                    article.source || 'Unknown',
                    article.url,
                    0,
                  ).run();
                  incidentsAdded++;
                } catch (e) {}
              }
            }
          }

          const duration = Date.now() - start;

          // Log crawl
          try {
            await env.DB.prepare(`
              INSERT INTO crawl_log (duration_ms, news_added, incidents_added, raw_ok, provider, model)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(duration, incidentsAdded, incidentsAdded, 1, 'truncate-refetch-search-api', 'heuristic-v1').run();
          } catch (e) {}

          if (env.mbg_kv) {
            await env.mbg_kv.put('mbg:refetch_status', JSON.stringify({
              status: 'completed',
              completed_at: new Date().toISOString(),
              incidents_added: incidentsAdded,
              duration_ms: duration,
            }));
            await env.mbg_kv.put('mbg:meta', JSON.stringify({
              refreshed_at: new Date().toISOString(),
              provider: 'truncate-refetch-search-api',
              model: 'heuristic-v1',
            }));
          }

          return json({
            ok: true,
            message: `Completed: ${incidentsAdded} incidents in ${duration}ms`,
            incidents_added: incidentsAdded,
            duration_ms: duration,
          }, 200, corsHeaders);

        } catch (err) {
          console.error('[REFETCH] Failed:', err);
          if (env.mbg_kv) {
            await env.mbg_kv.put('mbg:refetch_status', JSON.stringify({
              status: 'error',
              error: err.message,
              completed_at: new Date().toISOString(),
            })).catch(() => {});
          }
          return json({ error: 'Refetch failed', message: err.message }, 500, corsHeaders);
        }
      }

      // GET /status — health check
      if (url.pathname === '/status') {
        const lastCrawl = await env.DB.prepare(
          'SELECT * FROM crawl_log ORDER BY id DESC LIMIT 1'
        ).first().catch(() => null);

        const incidentCount = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM incidents'
        ).first().catch(() => null);

        const victimsCount = await env.DB.prepare(
          'SELECT SUM(victims) as total FROM incidents WHERE victims > 0'
        ).first().catch(() => null);

        let refetchStatus = null;
        if (env.mbg_kv) {
          try {
            const raw = await env.mbg_kv.get('mbg:refetch_status');
            if (raw) refetchStatus = JSON.parse(raw);
          } catch (e) {}
        }

        return json({
          ok: true,
          status: 'healthy',
          last_crawl: lastCrawl,
          total_incidents: incidentCount?.count || 0,
          total_victims: victimsCount?.total || 0,
          cron_schedule: '0 */2 * * *',
          refetch_status: refetchStatus,
        }, 200, corsHeaders);
      }

      // GET /news — get latest news
      if (url.pathname === '/news') {
        const limit = parseInt(url.searchParams.get('limit') || '30', 10);
        const source = url.searchParams.get('source');

        let query = 'SELECT * FROM incidents ORDER BY date DESC, id DESC LIMIT ?';
        const params = [limit];

        if (source) {
          query = 'SELECT * FROM incidents WHERE source = ? ORDER BY date DESC, id DESC LIMIT ?';
          params.unshift(source);
        }

        const result = await env.DB.prepare(query).bind(...params).all();
        return json({ ok: true, incidents: result.results || [] }, 200, corsHeaders);
      }

      // GET /debug — test scraping for Antara
      if (url.pathname === '/debug') {
        const results = {};

        try {
          const antaraRes = await fetch('https://www.antaranews.com/search?q=keracunan+mbg', {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html',
            },
          });
          const antaraHtml = await antaraRes.text();

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
              });
            }
          }

          results.antara = {
            status: antaraRes.status,
            htmlLength: antaraHtml.length,
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
            with_victims: articles.filter(a => a.victims > 0).length,
            articles: articles.slice(0, 15).map(a => ({
              title: a.title,
              source: a.source,
              date: a.date,
              victims: a.victims,
              location: a.location,
              tag: a.tag,
              url: a.url,
              summary_length: a.summary?.length || 0,
            })),
          }, 200, corsHeaders);
        } catch (err) {
          return json({ error: err.message, stack: err.stack }, 500, corsHeaders);
        }
      }

      // GET /test-classify — scrape and classify articles with AI
      if (url.pathname === '/test-classify') {
        try {
          const articles = await scrapeAll(env);
          const classifications = await classifyArticlesBatch(env, articles.slice(0, 10));
          
          const results = articles.slice(0, 10).map((a, i) => ({
            title: a.title?.slice(0, 80),
            source: a.source,
            url: a.url,
            victims: a.victims,
            classification: classifications[i] || { error: 'no classification' },
          }));

          const incidents = results.filter(r => r.classification.is_incident);
          const skipped = results.filter(r => !r.classification.is_incident);

          return json({
            ok: true,
            total_scraped: articles.length,
            classified: results.length,
            actual_incidents: incidents.length,
            filtered_out: skipped.length,
            incidents,
            filtered: skipped,
          }, 200, corsHeaders);
        } catch (err) {
          return json({ error: err.message, stack: err.stack }, 500, corsHeaders);
        }
      }

      // POST /deep-search — run comprehensive historical search for keracunan MBG (protected)
      if (url.pathname === '/deep-search' && request.method === 'POST') {
        const secret = url.searchParams.get('secret') || request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!secret || !timingSafeEqual(secret, env.REFRESH_SECRET || env.CRON_SECRET || '')) {
          return json({ error: 'Unauthorized' }, 401, corsHeaders);
        }

        try {
          const start = Date.now();
          const articles = await deepSearchKeracunanMBG(env);

          // Extract victims and location before filtering
          for (const article of articles) {
            article.victims = extractVictims(article.title, article.summary || article.note || '');
            const locData = extractLocation(article.title, article.summary || article.note || '');
            if (locData) { article.location = locData.city; article.lat = locData.lat; article.lng = locData.lng; }
          }

          // Filter for relevance
          const relevant = articles.filter(a => isRelevantMBGPoisoning(a));
          console.log(`[DEEP-SEARCH] ${relevant.length}/${articles.length} articles passed relevance filter`);

          // Dedup against existing URLs
          const existingUrls = new Set();
          try {
            const rows = await env.DB.prepare('SELECT url FROM incidents').all();
            for (const row of rows.results || []) existingUrls.add(row.url);
          } catch (e) {}

          let inserted = 0;
          const insertErrors = [];
          for (const article of relevant) {
            if (!article.url || existingUrls.has(article.url)) continue;
            try {
              await env.DB.prepare(`
                INSERT INTO incidents (cat, date, lat, lng, title, loc, victims, note, source, url, is_baseline)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                'keracunan',
                article.date || new Date().toISOString().slice(0, 10),
                article.lat || null,
                article.lng || null,
                article.title,
                'Indonesia',
                0,
                article.victims || 0,
                truncateNote(article.summary),
                article.source || 'Unknown',
                article.url,
                0,
              ).run();
              inserted++;
            } catch (err) {
              insertErrors.push({ title: article.title?.slice(0, 60), error: err.message });
            }
          }

          const duration = Date.now() - start;

          return json({
            ok: true,
            duration_ms: duration,
            total_articles: articles.length,
            relevant_articles: relevant.length,
            new_articles: inserted,
            duplicates_skipped: relevant.length - inserted - insertErrors.length,
            insert_errors: insertErrors.length,
            errors: insertErrors.slice(0, 10),
          }, 200, corsHeaders);
        } catch (err) {
          return json({ error: 'Deep search failed', message: err.message }, 500, corsHeaders);
        }
      }

      // GET / — API info
      return json({
        ok: true,
        name: 'mbg-monitor-cron',
        version: 'v7-heuristic-v2',
        endpoints: {
          'POST /trigger': 'Manual crawl trigger (requires ?secret=)',
          'POST /crawl': 'Run synchronous crawl (requires ?secret=)',
          'POST /deep-search': 'Comprehensive historical keracunan search (requires ?secret=)',
          'POST /truncate': 'Clear ALL incidents (requires ?secret=)',
          'POST /truncate-and-refetch': 'Truncate then re-fetch all data from 2024-today (requires ?secret=)',
          'GET /status': 'Health check',
          'GET /news': 'Latest news (?limit=30&source=)',
          'GET /test-scrape': 'Test scraper output (raw articles)',
          'GET /test-classify': 'Test AI classification on scraped articles',
          'GET /debug': 'Test Antara HTML structure',
        },
      }, 200, corsHeaders);

    } catch (err) {
      return json({ error: 'Internal error', message: err.message }, 500, corsHeaders);
    }
  },
};

/**
 * Relevance filter for MBG poisoning articles.
 * Requires BOTH a poisoning keyword AND an MBG/school context keyword.
 * Applies negative filters to exclude prevention, positive health, and policy articles.
 * Only checks title + note (summary) — NOT the full article body which may have boilerplate.
 */
function isRelevantMBGPoisoning(article) {
  const title = (article.title || '').toLowerCase();
  const note = (article.summary || article.note || '').toLowerCase();
  const text = title + ' ' + note;

  // Exclude hoax/debunked articles
  if (/hoaks|tidak benar|disinformasi|klarifikasi|bantahan/.test(text)) return false;

  // Exclude tag/category pages
  if (/^tag\s*:/.test(title) || /^kategori\s*:/.test(title)) return false;

  // Exclude educational/how-to articles about poisoning without incident context
  if (/penyebab/.test(title) && /keracunan/.test(title) && !/korban|dirawat|siswa|murid|warga|orang/.test(text)) return false;
  if (/^cara\s/.test(title) && /keracunan/.test(title) && !/korban|dirawat|siswa|murid|warga|orang/.test(text)) return false;

  // Negative filter: reject clearly non-poisoning articles
  if (/cegah/.test(title) && /penyakit/.test(title)) return false;       // prevention article
  if (/tingkatkan/.test(title) && /kesehatan/.test(title)) return false; // positive health article
  if (/akan/.test(title) && !/keracunan/.test(title)) return false;       // policy/future article

  // Negative filter: reject first aid, explanatory, and non-incident articles
  if (/pertolongan\s+pertama/.test(title)) return false;                  // first aid article
  if (/cara\s+penanganan/.test(title)) return false;                      // how-to-handle guide
  if (/^mengapa\s/.test(title)) return false;                             // explanatory "why" article
  if (/^bahaya/.test(title)) return false;                                // dangers-of article
  if (/keracunan/.test(title) && /kecubung|metanol|gas/.test(title)) return false; // not food poisoning
  if (/di\s+berbagai\s+negara/.test(text)) return false;                  // international comparison
  if (/^pembelajaran\s+dari/.test(title)) return false;                   // lessons-learned article

  // Require: poisoning keyword AND (MBG context OR incident indicator)
  const hasPoisoning = /keracunan/.test(text);
  const hasMBGContext = /mbg|makan bergizi|makan bergizi gratis|sppg|makanan sekolah|dapur sekolah/.test(text);
  const hasIncidentIndicator = /korban|dirawat|siswa|murid|warga|orang|massal|sekolah|dilarikan|pasien|terdampak/.test(text);

  return hasPoisoning && (hasMBGContext || hasIncidentIndicator);
}

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
