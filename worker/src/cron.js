import { scrapeAll } from './scrapers/index.js';
import { summarizeWithAI } from './ai.js';

export async function handleCron(env) {
  const start = Date.now();
  let newsAdded = 0;
  let rawOk = true;

  try {
    console.log('[CRON] Starting crawl...');

    // Step 1: Scrape all sources
    const articles = await scrapeAll(env);
    console.log(`[CRON] Scraped ${articles.length} articles`);

    // Step 2: Process and insert each article
    for (const article of articles) {
      try {
        // Generate content hash for dedup
        const contentHash = await generateHash(article.url + article.title);

        // Check if already exists
        const existing = await env.DB.prepare(
          'SELECT id FROM news WHERE content_hash = ?'
        ).bind(contentHash).first();

        if (existing) continue;

        // AI summarization (optional — only if API key available)
        let summary = article.summary || '';
        let tag = article.tag || '';

        if (env.AI_API_KEY && article.title) {
          try {
            const aiResult = await summarizeWithAI(article, env.AI_API_KEY);
            if (aiResult) {
              summary = aiResult.summary || summary;
              tag = aiResult.tag || tag;
            }
          } catch (aiErr) {
            console.warn('[CRON] AI summarization failed:', aiErr.message);
          }
        }

        // Insert into D1
        await env.DB.prepare(`
          INSERT INTO news (date, headline, summary, source, url, tag, content_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          article.date || new Date().toISOString().slice(0, 19).replace('T', ' '),
          article.title,
          summary,
          article.source,
          article.url,
          tag,
          contentHash,
        ).run();

        newsAdded++;
      } catch (insertErr) {
        console.warn('[CRON] Failed to insert article:', insertErr.message);
      }
    }

    // Step 3: Update KV meta
    if (env.mbg_kv) {
      await env.mbg_kv.put('mbg:meta', JSON.stringify({
        refreshed_at: new Date().toISOString(),
        provider: 'cron',
        model: 'rss-scraper',
      }));
    }

    // Step 4: Log the crawl
    const duration = Date.now() - start;
    await env.DB.prepare(`
      INSERT INTO crawl_log (duration_ms, news_added, raw_ok, provider, model)
      VALUES (?, ?, ?, ?, ?)
    `).bind(duration, newsAdded, rawOk ? 1 : 0, 'rss', 'cron-v1').run();

    console.log(`[CRON] Complete: ${newsAdded} new articles in ${duration}ms`);

  } catch (err) {
    console.error('[CRON] Failed:', err);
    const duration = Date.now() - start;
    await env.DB.prepare(`
      INSERT INTO crawl_log (duration_ms, news_added, raw_ok, provider, model)
      VALUES (?, ?, ?, ?, ?)
    `).bind(duration, newsAdded, 0, 'rss', 'cron-v1').run().catch(() => {});
  }
}

async function generateHash(str) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
