/**
 * Search API Integrations for MBG Monitor
 *
 * Tavily/Exa for search, Firecrawl for full article content extraction.
 * Firecrawl returns metadata with dates and full content with victim counts.
 */

// Tavily Search API
async function searchTavily(query, apiKey, opts = {}) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: opts.maxResults || 10,
        search_depth: 'advanced',
        topic: 'news',
        start_date: opts.startDate || '2024-01-01',
        include_answer: false,
        include_raw_content: true,
      }),
    });

    if (!res.ok) {
      console.warn(`[TAVILY] HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    return (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      summary: r.content || r.raw_content?.slice(0, 500) || '',
      source: extractDomain(r.url),
      date: r.published_date ? r.published_date.slice(0, 10) : null,
      provider: 'tavily',
    }));
  } catch (err) {
    console.warn(`[TAVILY] Error: ${err.message}`);
    return null;
  }
}

// Exa Neural Search API
async function searchExa(query, apiKey, opts = {}) {
  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        query,
        numResults: opts.maxResults || 10,
        type: 'auto',
        startPublishedDate: opts.startDate || '2024-01-01',
        contents: {
          text: true,
          highlights: { numSentences: 5 },
        },
      }),
    });

    if (!res.ok) {
      console.warn(`[EXA] HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    return (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      summary: (r.text || '').slice(0, 500) || (r.highlights || []).join(' '),
      source: extractDomain(r.url),
      date: r.publishedDate ? r.publishedDate.slice(0, 10) : null,
      provider: 'exa',
    }));
  } catch (err) {
    console.warn(`[EXA] Error: ${err.message}`);
    return null;
  }
}

// Firecrawl - scrape full article content with metadata
async function scrapeWithFirecrawl(url, apiKey) {
  try {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!res.ok) {
      console.warn(`[FIRECRAWL] HTTP ${res.status} for ${url}`);
      return null;
    }

    const data = await res.json();
    if (!data.success || !data.data) return null;

    const meta = data.data.metadata || {};
    const content = data.data.markdown || '';

    // Extract date from metadata (multiple possible fields)
    let date = null;
    if (meta.publishedTime) {
      date = meta.publishedTime.slice(0, 10);
    } else if (meta['article:published_time']) {
      date = meta['article:published_time'].slice(0, 10);
    } else if (meta.content_PublishedDate) {
      date = meta.content_PublishedDate.slice(0, 10);
    }

    return {
      title: meta.title || meta.ogTitle || '',
      content: content.slice(0, 3000),
      date,
      source: extractDomain(url),
      description: meta.description || meta.ogDescription || '',
      provider: 'firecrawl',
    };
  } catch (err) {
    console.warn(`[FIRECRAWL] Error: ${err.message}`);
    return null;
  }
}

/**
 * Search MBG articles using Tavily/Exa, then enrich top articles with Firecrawl
 */
export async function searchMBGArticles(env, queries) {
  const allArticles = [];
  const tavilyKey = env.TAVILY_API_KEY;
  const exaKey = env.EXA_API_KEY;
  const firecrawlKey = env.FIRECRAWL_API_KEY;

  // Phase 1: Search via Tavily/Exa
  for (const query of queries) {
    let results = null;
    if (tavilyKey) {
      results = await searchTavily(query, tavilyKey);
      if (results?.length) {
        console.log(`[SEARCH] Tavily "${query}": ${results.length}`);
        allArticles.push(...results);
        await delay(300);
        continue;
      }
    }
    if (exaKey) {
      results = await searchExa(query, exaKey);
      if (results?.length) {
        console.log(`[SEARCH] Exa "${query}": ${results.length}`);
        allArticles.push(...results);
        await delay(300);
        continue;
      }
    }
    await delay(300);
  }

  // Phase 2: Enrich top articles with Firecrawl for full content + dates
  if (firecrawlKey && allArticles.length > 0) {
    // Pick articles with poisoning/keracunan keywords that need victim counts
    const toEnrich = allArticles
      .filter(a => {
        const t = (a.title + ' ' + a.summary).toLowerCase();
        return t.includes('keracunan') || t.includes('poisoning') || t.includes('korban') ||
               t.includes('kasus') || t.includes('dirawat') || t.includes('victim');
      })
      .slice(0, 3); // Max 3 Firecrawl calls (worker CPU limit)

    for (const article of toEnrich) {
      try {
        const enriched = await scrapeWithFirecrawl(article.url, firecrawlKey);
        if (enriched) {
          // Merge enriched data - prefer Firecrawl's content and date
          if (enriched.content && enriched.content.length > 100) {
            article.summary = enriched.content.slice(0, 800);
          }
          if (enriched.date) {
            article.date = enriched.date;
          }
          if (enriched.description && !article.summary) {
            article.summary = enriched.description;
          }
          article.enriched = true;
          console.log(`[FIRECRAWL] Enriched: ${article.title.slice(0, 50)}...`);
        }
        await delay(500);
      } catch (err) {
        console.warn(`[FIRECRAWL] Enrich failed: ${err.message}`);
      }
    }
  }

  return allArticles;
}

export { scrapeWithFirecrawl };

function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return 'Unknown';
  }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
