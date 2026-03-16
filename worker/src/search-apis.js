/**
 * Search API Integrations for MBG Monitor
 *
 * Supports Tavily, Exa, and Firecrawl APIs with automatic key rotation/fallback.
 * Each API is tried in order; if one fails, the next is used.
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
        include_raw_content: false,
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
      summary: r.content || '',
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
          text: false,
          highlights: { numSentences: 3 },
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
      summary: (r.highlights || []).join(' '),
      source: extractDomain(r.url),
      date: r.publishedDate ? r.publishedDate.slice(0, 10) : null,
      provider: 'exa',
    }));
  } catch (err) {
    console.warn(`[EXA] Error: ${err.message}`);
    return null;
  }
}

// Firecrawl - scrape full article content
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
    if (!data.success || !data.data?.markdown) return null;

    return {
      title: data.data.metadata?.title || '',
      content: data.data.markdown.slice(0, 2000),
      source: extractDomain(url),
      provider: 'firecrawl',
    };
  } catch (err) {
    console.warn(`[FIRECRAWL] Error: ${err.message}`);
    return null;
  }
}

/**
 * Search MBG-related articles using Tavily and Exa with fallback
 * @param {object} env - Worker environment with API keys
 * @param {string[]} queries - Search queries
 * @returns {Promise<Array>} Array of article objects
 */
export async function searchMBGArticles(env, queries) {
  const allArticles = [];

  // Get API keys from env (Cloudflare secrets) or fallback
  const tavilyKey = env.TAVILY_API_KEY;
  const exaKey = env.EXA_API_KEY;

  for (const query of queries) {
    let results = null;

    // Try Tavily first
    if (tavilyKey) {
      results = await searchTavily(query, tavilyKey);
      if (results?.length) {
        console.log(`[SEARCH] Tavily "${query}": ${results.length} results`);
        allArticles.push(...results);
        await delay(500);
        continue;
      }
    }

    // Fallback to Exa
    if (exaKey) {
      results = await searchExa(query, exaKey);
      if (results?.length) {
        console.log(`[SEARCH] Exa "${query}": ${results.length} results`);
        allArticles.push(...results);
        await delay(500);
        continue;
      }
    }

    console.warn(`[SEARCH] No results for "${query}" from any provider`);
    await delay(500);
  }

  return allArticles;
}

/**
 * Enrich an article with full content using Firecrawl
 * @param {object} env - Worker environment
 * @param {string} url - Article URL
 * @returns {Promise<string|null>} Full article content or null
 */
export async function enrichWithFirecrawl(env, url) {
  const firecrawlKey = env.FIRECRAWL_API_KEY;
  if (!firecrawlKey || !url) return null;

  const result = await scrapeWithFirecrawl(url, firecrawlKey);
  return result?.content || null;
}

/**
 * Extract domain from URL for source attribution
 */
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
