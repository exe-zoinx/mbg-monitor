import { scrapeAll } from './scrapers/index.js';
import { summarizeWithAI } from './ai.js';

export async function handleCron(env) {
  const start = Date.now();
  let incidentsAdded = 0;
  let rawOk = true;

  try {
    console.log('[CRON] Starting crawl...');

    // Step 1: Scrape all sources — returns incident-formatted articles
    const articles = await scrapeAll(env);
    console.log(`[CRON] Scraped ${articles.length} articles`);

    // Step 2: Process and insert each article as an incident
    for (const article of articles) {
      try {
        // Generate content hash for dedup
        const contentHash = await generateHash(article.url + article.title);

        // Check if already exists in incidents table
        const existing = await env.DB.prepare(
          'SELECT id FROM incidents WHERE source = ? AND title = ?'
        ).bind(article.source || '', article.title).first().catch(() => null);

        if (existing) continue;

        // AI summarization (optional — only if API key available)
        let summary = article.summary || '';
        let tag = article.tag || 'mbg';
        let victims = 0;
        let location = article.location || 'Indonesia';

        if (env.AI_API_KEY && article.title) {
          try {
            const aiResult = await summarizeWithAI(article, env.AI_API_KEY);
            if (aiResult) {
              summary = aiResult.summary || summary;
              tag = aiResult.tag || tag;
              victims = aiResult.victims || 0;
              location = aiResult.location || location;
            }
          } catch (aiErr) {
            console.warn('[CRON] AI summarization failed:', aiErr.message);
          }
        }

        // Insert into incidents table (news articles become incidents)
        await env.DB.prepare(`
          INSERT INTO incidents (cat, date, lat, lng, title, loc, victims, note, source, url, is_baseline)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          tag,
          article.date || new Date().toISOString().slice(0, 19).replace('T', ' '),
          null, // lat — news articles don't have coordinates
          null, // lng
          article.title,
          location,
          victims,
          summary,
          article.source || 'Unknown',
          article.url,
          0, // is_baseline: 0 = from scraper
        ).run();

        incidentsAdded++;
      } catch (insertErr) {
        console.warn('[CRON] Failed to insert incident:', insertErr.message);
      }
    }

    // Step 3: Update KV meta
    if (env.mbg_kv) {
      await env.mbg_kv.put('mbg:meta', JSON.stringify({
        refreshed_at: new Date().toISOString(),
        provider: 'cron',
        model: 'web-scraper-v1',
      }));
    }

    // Step 4: Log the crawl
    const duration = Date.now() - start;
    await env.DB.prepare(`
      INSERT INTO crawl_log (duration_ms, news_added, raw_ok, provider, model)
      VALUES (?, ?, ?, ?, ?)
    `).bind(duration, incidentsAdded, rawOk ? 1 : 0, 'scraper', 'web-v1').run();

    console.log(`[CRON] Complete: ${incidentsAdded} new incidents in ${duration}ms`);

  } catch (err) {
    console.error('[CRON] Failed:', err);
    const duration = Date.now() - start;
    await env.DB.prepare(`
      INSERT INTO crawl_log (duration_ms, news_added, raw_ok, provider, model)
      VALUES (?, ?, ?, ?, ?)
    `).bind(duration, incidentsAdded, 0, 'scraper', 'web-v1').run().catch(() => {});
  }
}

async function generateHash(str) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
