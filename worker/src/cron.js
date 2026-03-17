import { scrapeAll } from './scrapers/index.js';
import { classifyArticlesBatch } from './ai-classify.js';

// Keywords that indicate non-incident articles (skip AI classification)
const SKIP_KEYWORDS = ['hoaks', 'insentif', 'standar sppg', 'pengawasan', 'dinas kesehatan', 'regulasi', 'sop'];
// Keywords that strongly suggest an incident (prioritize for AI)
const INCIDENT_KEYWORDS = ['keracunan', 'korban', 'dirawat', 'dilarikan', 'racun', 'keracu', 'diare', 'mual', 'muntah'];

// Location aliases — map common sub-district/regency forms to canonical city names
const LOCATION_ALIASES = {
  'jakarta selatan': 'jakarta', 'jakarta utara': 'jakarta', 'jakarta barat': 'jakarta',
  'jakarta timur': 'jakarta', 'jakarta pusat': 'jakarta', 'dki jakarta': 'jakarta',
  'kota bandung': 'bandung', 'kabupaten bandung': 'bandung', 'bandung barat': 'bandung',
  'kota surabaya': 'surabaya', 'kota semarang': 'semarang', 'kota medan': 'medan',
  'kota makassar': 'makassar', 'kota palembang': 'palembang', 'kota bogor': 'bogor',
  'kota malang': 'malang', 'kota yogyakarta': 'yogyakarta', 'kota solo': 'solo',
  'kota denpasar': 'denpasar', 'kota bekasi': 'bekasi', 'kota depok': 'depok',
  'kota tangerang': 'tangerang', 'kota balikpapan': 'balikpapan', 'kota samarinda': 'samarinda',
  'kota banjarmasin': 'banjarmasin', 'kota manado': 'manado', 'kota padang': 'padang',
  'kota pekanbaru': 'pekanbaru', 'kota serang': 'serang', 'kota tasikmalaya': 'tasikmalaya',
  'kota kediri': 'kediri', 'kota madiun': 'madiun', 'kota blitar': 'blitar',
  'kota mojokerto': 'mojokerto', 'kota pasuruan': 'pasuruan', 'kota probolinggo': 'probolinggo',
  'kota batu': 'batu', 'kota magelang': 'magelang', 'kota salatiga': 'salatiga',
  'kota tegal': 'tegal', 'kota cirebon': 'cirebon', 'kota sukabumi': 'sukabumi',
  'sleman': 'yogyakarta', 'bantul': 'yogyakarta', 'kulon progo': 'yogyakarta',
  'gunung kidul': 'yogyakarta', 'gowa': 'makassar', 'maros': 'makassar',
  'gianyar': 'bali', 'badung': 'bali', 'denpasar': 'bali',
};

/**
 * Normalize a location string to a canonical form for dedup comparison.
 */
function normalizeLocation(loc) {
  if (!loc || loc === 'Indonesia') return '';
  let normalized = loc.toLowerCase().trim();
  if (LOCATION_ALIASES[normalized]) return LOCATION_ALIASES[normalized];
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (normalized.includes(alias)) return canonical;
  }
  return normalized;
}

/**
 * Generate a semantic signature for an article/incident.
 * Format: "date|victims|normalized_location"
 */
function articleSignature(article) {
  const date = (article.date || '').slice(0, 10);
  const victims = article.victims || 0;
  const loc = normalizeLocation(article.location);
  return `${date}|${victims}|${loc}`;
}

/**
 * Semantic deduplication — filters articles that describe incidents already
 * in the database or that duplicate other articles in the same batch.
 *
 * Matches on: same date + same victim count + same normalized location.
 * When two batch articles match, keeps the one with more content (longer summary).
 */
export function deduplicateArticles(articles, existingIncidents) {
  const existingSigs = new Set();
  for (const inc of existingIncidents) {
    const date = (inc.date || '').slice(0, 10);
    const victims = inc.victims || 0;
    const loc = normalizeLocation(inc.loc);
    existingSigs.add(`${date}|${victims}|${loc}`);
  }

  const batchSigs = new Map();
  const keep = new Array(articles.length).fill(true);

  for (let i = 0; i < articles.length; i++) {
    const sig = articleSignature(articles[i]);

    if (sig && existingSigs.has(sig)) {
      keep[i] = false;
      continue;
    }

    if (!sig || sig === '|0|') continue;

    if (batchSigs.has(sig)) {
      const prevIdx = batchSigs.get(sig);
      const prevLen = (articles[prevIdx].summary || '').length;
      const currLen = (articles[i].summary || '').length;
      if (currLen > prevLen) {
        keep[prevIdx] = false;
        batchSigs.set(sig, i);
      } else {
        keep[i] = false;
      }
    } else {
      batchSigs.set(sig, i);
    }
  }

  return articles.filter((_, i) => keep[i]);
}

export async function handleCron(env) {
  const start = Date.now();
  let incidentsAdded = 0;
  let articlesClassified = 0;
  let rawOk = true;

  try {
    console.log('[CRON] Starting keracunan MBG crawl...');

    // Step 1: Scrape all sources
    const articles = await scrapeAll(env);
    console.log(`[CRON] Scraped ${articles.length} articles`);

    if (articles.length === 0) {
      console.log('[CRON] No articles found, skipping');
      await logCrawl(env, start, 0, 0, true, 'no-articles');
      return;
    }

    // Step 2: Pre-filter — separate articles into "likely incidents" vs "likely non-incidents"
    const likelyIncidents = [];
    const likelyNonIncidents = [];

    for (const article of articles) {
      const titleLower = (article.title || '').toLowerCase();
      const contentLower = (article.summary || '').toLowerCase();
      const text = titleLower + ' ' + contentLower;

      // Skip articles with obvious non-incident keywords
      if (SKIP_KEYWORDS.some(kw => text.includes(kw))) {
        likelyNonIncidents.push(article);
        continue;
      }

      // Prioritize articles with incident keywords for AI classification
      if (INCIDENT_KEYWORDS.some(kw => text.includes(kw))) {
        likelyIncidents.push(article);
      } else {
        likelyNonIncidents.push(article);
      }
    }

    console.log(`[CRON] Pre-filter: ${likelyIncidents.length} likely incidents, ${likelyNonIncidents.length} others`);

    // Step 3: AI classification on likely incidents only (limit to 10 for speed)
    const toClassify = likelyIncidents.slice(0, 10);
    let incidentArticles = [];

    if (toClassify.length > 0 && env.AI) {
      console.log(`[CRON] AI classifying ${toClassify.length} articles...`);
      const classifications = await classifyArticlesBatch(env, toClassify);
      articlesClassified = classifications.length;

      for (let i = 0; i < toClassify.length && i < classifications.length; i++) {
        const article = toClassify[i];
        const classification = classifications[i];

        if (!classification.is_incident) {
          console.log(`[SKIP] ${classification.category}: ${article.title?.slice(0, 60)}`);
          continue;
        }

        // Use AI-extracted victims/location if better
        if (classification.victims > 0 && !article.victims) {
          article.victims = classification.victims;
        }
        if (classification.location && (!article.location || article.location === 'Indonesia')) {
          article.location = classification.location;
        }

        incidentArticles.push({
          ...article,
          ai_category: classification.category,
          ai_reasoning: classification.reasoning,
        });
      }
    } else if (toClassify.length > 0 && !env.AI) {
      // No AI binding — use heuristic (from ai-classify module)
      console.log('[CRON] No AI binding, using heuristic classification');
      for (const article of toClassify) {
        // Simple heuristic: if title has "keracunan" and "MBG" it's likely an incident
        const titleLower = (article.title || '').toLowerCase();
        if (titleLower.includes('keracunan') && titleLower.includes('mbg') && !titleLower.includes('hoaks')) {
          incidentArticles.push(article);
        }
      }
    }

    // Also add remaining likely incidents (beyond AI limit) with simple heuristic
    const remaining = likelyIncidents.slice(10);
    for (const article of remaining) {
      const titleLower = (article.title || '').toLowerCase();
      if (titleLower.includes('keracunan') && !titleLower.includes('hoaks') && !titleLower.includes('sembuh')) {
        incidentArticles.push(article);
      }
    }

    console.log(`[CRON] ${incidentArticles.length} actual incidents after filtering`);

    if (incidentArticles.length === 0) {
      console.log('[CRON] No incidents after filtering');
      await logCrawl(env, start, 0, 0, true, 'filtered-none');
      return;
    }

    // Step 4: Dedup — check existing URLs
    const existingUrls = new Set();
    try {
      const rows = await env.DB.prepare('SELECT url FROM incidents').all();
      for (const row of rows.results || []) {
        existingUrls.add(row.url);
      }
    } catch (e) {
      console.warn('[CRON] Could not fetch existing URLs, proceeding without dedup');
    }

    let newArticles = incidentArticles.filter(a => a.url && !existingUrls.has(a.url));
    console.log(`[CRON] ${newArticles.length} articles after URL dedup`);

    // Step 4b: Semantic dedup — match by date + victims + location
    if (newArticles.length > 0) {
      let existingIncidents = [];
      try {
        const rows = await env.DB.prepare(
          "SELECT date, victims, loc FROM incidents WHERE date >= '2024-01-01'"
        ).all();
        existingIncidents = rows.results || [];
      } catch (e) {
        console.warn('[CRON] Could not fetch existing incidents for semantic dedup:', e.message);
      }

      const beforeSemantic = newArticles.length;
      newArticles = deduplicateArticles(newArticles, existingIncidents);
      const removed = beforeSemantic - newArticles.length;
      if (removed > 0) {
        console.log(`[CRON] Semantic dedup removed ${removed} duplicate(s)`);
      }
    }

    console.log(`[CRON] ${newArticles.length} new incidents to insert`);

    // Step 5: Batch insert
    if (newArticles.length > 0) {
      const BATCH_SIZE = 10;
      for (let i = 0; i < newArticles.length; i += BATCH_SIZE) {
        const batch = newArticles.slice(i, i + BATCH_SIZE);
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
            article.summary || '',
            article.source || 'Unknown',
            article.url,
            0,
          )
        );

        try {
          await env.DB.batch(stmts);
          incidentsAdded += batch.length;
        } catch (batchErr) {
          console.warn(`[CRON] Batch insert failed, trying individual:`, batchErr.message);
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
                article.summary || '',
                article.source || 'Unknown',
                article.url,
                0,
              ).run();
              incidentsAdded++;
            } catch (insertErr) {
              console.warn('[CRON] Failed to insert:', insertErr.message);
            }
          }
        }
      }
    }

    // Step 6: Update stats
    try {
      const stats = await env.DB.prepare(
        'SELECT COUNT(*) as count, SUM(victims) as total FROM incidents WHERE victims > 0'
      ).first().catch(() => null);

      if (stats?.total > 0) {
        await env.DB.prepare(`
          INSERT INTO stats_snapshot (poisoning_incidents, total_victims, victims_note)
          VALUES (?, ?, ?)
        `).bind(
          stats.count,
          stats.total,
          `AI-classified: ${stats.count} incidents with ${stats.total} total victims`,
        ).run();
      }
    } catch (statsErr) {
      console.warn('[CRON] Stats update failed:', statsErr.message);
    }

    // Update KV meta
    if (env.mbg_kv) {
      await env.mbg_kv.put('mbg:meta', JSON.stringify({
        refreshed_at: new Date().toISOString(),
        provider: 'cron-ai',
        model: 'ai-classify-v1',
      }));
    }

    const duration = Date.now() - start;
    await env.DB.prepare(`
      INSERT INTO crawl_log (duration_ms, news_added, incidents_added, raw_ok, provider, model)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(duration, incidentsAdded, incidentsAdded, rawOk ? 1 : 0, 'ai-scraper', 'ai-classify-v1').run();

    console.log(`[CRON] Complete: ${incidentsAdded} incidents, ${articlesClassified} AI-classified in ${duration}ms`);

  } catch (err) {
    console.error('[CRON] Failed:', err);
    await logCrawl(env, start, incidentsAdded, 0, false, 'error');
  }
}

async function logCrawl(env, start, incidentsAdded, newsAdded, ok, note) {
  const duration = Date.now() - start;
  try {
    await env.DB.prepare(`
      INSERT INTO crawl_log (duration_ms, news_added, incidents_added, raw_ok, provider, model)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(duration, newsAdded || incidentsAdded, incidentsAdded, ok ? 1 : 0, 'ai-scraper', `ai-classify-v1:${note}`).run();
  } catch (e) { /* best effort */ }
}
