/**
 * Search API Integrations for MBG Monitor
 *
 * Uses Tavily for keyword search, Exa as fallback, Firecrawl for full content.
 * Focus: "keracunan MBG" poisoning incidents from Indonesian local sources ONLY.
 * 
 * BANNED: International sources (BBC, Guardian, NYT, Reuters, etc.)
 * APPROVED: Indonesian local news only (.id TLD or whitelisted domains)
 */

// ===== INDONESIAN LOCAL SOURCE WHITELIST =====
const APPROVED_LOCAL_DOMAINS = [
  'kompas.com', 'detik.com', 'antaranews.com', 'tempo.co', 'tribunnews.com',
  'cnnindonesia.com', 'liputan6.com', 'suara.com', 'tirto.id', 'kumparan.com',
  'republika.co.id', 'okezone.com', 'sindonews.com', 'merdeka.com', 'jpnn.com',
  'viva.co.id', 'beritasatu.com', 'kompas.tv', 'cnbcindonesia.com',
  'bisnis.com', 'jawapos.com', 'pikiran-rakyat.com', 'radarbogor.id',
  'solopos.com', 'joglosemar.com', 'surya.co.id', 'jatimnetwork.com',
  'galamedia.pikiran-rakyat.com', 'jabarekspres.com', 'poskota.co.id',
  'kalderanews.com', 'kaltimpost.co.id', 'banjarmasinpost.co.id',
  'suarasurabaya.net', 'malangtimes.com', 'kediripost.jawapos.com',
  'medcom.id', 'idntimes.com', 'tagar.id', 'fajar.co.id',
  'kompas.id', 'harianjogja.com', 'koran-jakarta.com',
  'radarmalang.jawapos.com', 'radarcirebon.com', 'radartegal.com',
  'radarbanyuwangi.jawapos.com', 'radarsolo.jawapos.com',
  'bali.tribunnews.com', 'makassar.tribunnews.com',
  'kaltim.tribunnews.com', 'surabaya.tribunnews.com',
  'solo.tribunnews.com', 'jogja.tribunnews.com',
  'medan.tribunnews.com', 'padang.tribunnews.com',
  'lampung.tribunnews.com', 'pontianak.tribunnews.com',
  'wartakota.tribunnews.com', 'bangka.tribunnews.com',
];

const BANNED_DOMAINS = [
  'bbc.com', 'bbc.co.uk', 'nytimes.com', 'cnn.com', 'theguardian.com',
  'reuters.com', 'apnews.com', 'aljazeera.com', 'dw.com', 'france24.com',
  'abc.net.au', 'scmp.com', 'straitstimes.com', 'channelnewsasia.com',
  'washingtonpost.com', 'wsj.com', 'bloomberg.com', 'ft.com',
  'thejakartapost.com', 'jakpost.id', 'coconuts.co', 'vice.com',
  'rappler.com', 'youtube.com', 'twitter.com', 'x.com', 'facebook.com',
];

function isIndonesianLocal(url) {
  const domain = extractDomain(url);
  // Block banned domains
  if (BANNED_DOMAINS.some(d => domain.includes(d) || domain.endsWith(d))) return false;
  // Allow whitelisted domains
  if (APPROVED_LOCAL_DOMAINS.some(d => domain.includes(d) || domain.endsWith(d))) return true;
  // Allow Indonesian TLDs
  const idTLDs = ['.co.id', '.or.id', '.go.id', '.ac.id', '.sch.id', '.web.id', '.my.id', '.biz.id'];
  if (idTLDs.some(tld => domain.endsWith(tld))) return true;
  if (domain.endsWith('.id') && !domain.includes('rapidapi') && !domain.includes('blogspot')) return true;
  return false;
}

// ===== TAVILY SEARCH =====

async function searchTavily(query, apiKey, opts = {}) {
  try {
    const body = {
      query,
      max_results: opts.maxResults || 10,
      search_depth: 'advanced',
      topic: 'news',
      include_answer: false,
      include_raw_content: true,
    };
    if (opts.startDate) body.start_date = opts.startDate;
    if (opts.endDate) body.end_date = opts.endDate;

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn(`[TAVILY] HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    return (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      summary: r.content || r.raw_content?.slice(0, 2000) || '',
      source: extractDomain(r.url),
      date: r.published_date ? r.published_date.slice(0, 10) : null,
      provider: 'tavily',
      raw_content: r.raw_content || '',
    }));
  } catch (err) {
    console.warn(`[TAVILY] Error: ${err.message}`);
    return null;
  }
}

// ===== EXA SEARCH =====

async function searchExa(query, apiKey, opts = {}) {
  try {
    const body = {
      query,
      numResults: opts.maxResults || 10,
      type: 'auto',
      contents: {
        text: true,
        highlights: { numSentences: 5 },
      },
    };
    if (opts.startDate) body.startPublishedDate = opts.startDate;
    if (opts.endDate) body.endPublishedDate = opts.endDate;

    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn(`[EXA] HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    return (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      summary: (r.text || '').slice(0, 2000) || (r.highlights || []).join(' '),
      source: extractDomain(r.url),
      date: r.publishedDate ? r.publishedDate.slice(0, 10) : null,
      provider: 'exa',
      raw_content: r.text || '',
    }));
  } catch (err) {
    console.warn(`[EXA] Error: ${err.message}`);
    return null;
  }
}

// ===== FIRECRAWL FULL CONTENT EXTRACTION =====

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

    // Extract date from metadata
    let date = null;
    if (meta.publishedTime) date = meta.publishedTime.slice(0, 10);
    else if (meta['article:published_time']) date = meta['article:published_time'].slice(0, 10);
    else if (meta.content_PublishedDate) date = meta.content_PublishedDate.slice(0, 10);

    return {
      title: meta.title || meta.ogTitle || '',
      content: content.slice(0, 5000),
      date,
      source: extractDomain(url),
      description: meta.description || meta.ogDescription || '',
    };
  } catch (err) {
    console.warn(`[FIRECRAWL] Error: ${err.message}`);
    return null;
  }
}

// ===== MAIN SEARCH FUNCTION =====

/**
 * Search for "keracunan MBG" articles across date ranges using Tavily/Exa.
 * Focuses ONLY on Indonesian local sources.
 * Returns deduplicated articles.
 */
export async function searchMBGArticles(env, queries) {
  const allArticles = [];
  const tavilyKey = env.TAVILY_API_KEY;
  const exaKey = env.EXA_API_KEY;

  for (const query of queries) {
    let results = null;
    if (tavilyKey) {
      results = await searchTavily(query, tavilyKey);
      if (results?.length) {
        console.log(`[SEARCH] Tavily "${query}": ${results.length}`);
        allArticles.push(...results);
        await delay(500);
        continue;
      }
    }
    if (exaKey) {
      results = await searchExa(query, exaKey);
      if (results?.length) {
        console.log(`[SEARCH] Exa "${query}": ${results.length}`);
        allArticles.push(...results);
        await delay(500);
        continue;
      }
    }
    await delay(500);
  }

  // Filter for Indonesian local sources only
  const local = allArticles.filter(a => isIndonesianLocal(a.url));
  console.log(`[SEARCH] ${local.length} local articles from ${allArticles.length} total`);

  return local;
}

/**
 * Deep search: search "keracunan MBG" across multiple date windows to get
 * comprehensive coverage from 2024 to present.
 * 
 * Splits the search into quarterly windows to maximize results per Tavily's limits.
 * Workers have CPU limits, so we yield between each search.
 */
export async function deepSearchKeracunanMBG(env) {
  const allArticles = [];
  const tavilyKey = env.TAVILY_API_KEY;
  const exaKey = env.EXA_API_KEY;

  if (!tavilyKey && !exaKey) {
    console.warn('[DEEP] WARNING: No Tavily or Exa API keys configured. Deep search will return empty results.');
    return [];
  }

  // Core keyword queries for keracunan MBG
  const queries = [
    'keracunan MBG',
    'keracunan makan bergizi gratis',
    'keracunan MBG siswa',
    'MBG keracunan korban',
    'keracunan makanan sekolah MBG',
    'sppg keracunan',
    'kasus keracunan makan bergizi gratis',
    'MBG sakit perut mual',
    'keracunan makanan sekolah diare',
    'MBG korban dirawat',
    'makan bergizi gratis keracunan',
  ];

  // Date windows: quarterly from 2024-01 to present
  const windows = [
    { start: '2024-01-01', end: '2024-03-31', label: 'Q1 2024' },
    { start: '2024-04-01', end: '2024-06-30', label: 'Q2 2024' },
    { start: '2024-07-01', end: '2024-09-30', label: 'Q3 2024' },
    { start: '2024-10-01', end: '2024-12-31', label: 'Q4 2024' },
    { start: '2025-01-01', end: '2025-03-31', label: 'Q1 2025' },
    { start: '2025-04-01', end: '2025-06-30', label: 'Q2 2025' },
    { start: '2025-07-01', end: '2025-09-30', label: 'Q3 2025' },
    { start: '2025-10-01', end: '2025-12-31', label: 'Q4 2025' },
    { start: '2026-01-01', end: '2026-03-31', label: 'Q1 2026' },
  ];

  for (const win of windows) {
    for (const query of queries) {
      try {
        if (tavilyKey) {
          const results = await searchTavily(query, tavilyKey, {
            startDate: win.start,
            endDate: win.end,
            maxResults: 10,
          });
          if (results?.length) {
            console.log(`[DEEP] Tavily "${query}" [${win.label}]: ${results.length}`);
            allArticles.push(...results);
          }
          await delay(400);
        }
      } catch (err) {
        console.warn(`[DEEP] Tavily error: ${err.message}`);
      }
    }
  }

  // Also do a broad search without date limits for recent articles
  for (const query of queries) {
    try {
      if (tavilyKey) {
        const results = await searchTavily(query, tavilyKey, {
          startDate: '2024-01-01',
          maxResults: 10,
        });
        if (results?.length) {
          console.log(`[DEEP] Tavily "${query}" [all time]: ${results.length}`);
          allArticles.push(...results);
        }
        await delay(400);
      }
    } catch (err) {
      console.warn(`[DEEP] Tavily error: ${err.message}`);
    }
  }

  // Filter for local sources and dedup
  const local = allArticles.filter(a => isIndonesianLocal(a.url));
  const seen = new Set();
  const unique = local.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  console.log(`[DEEP] Total: ${unique.length} unique local articles from ${allArticles.length} raw results`);
  return unique;
}

/**
 * Enrich articles with full content using Firecrawl.
 * Extracts actual victim counts from article body text.
 * Limited to top articles to stay within worker CPU limits.
 */
export async function enrichWithFirecrawl(articles, env, limit = 10) {
  const firecrawlKey = env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) return articles;

  const enriched = [];
  let count = 0;

  for (const article of articles) {
    if (count >= limit) {
      enriched.push(article);
      continue;
    }

    try {
      const fullContent = await scrapeWithFirecrawl(article.url, firecrawlKey);
      if (fullContent && fullContent.content) {
        // Use full content for better victim extraction
        article.full_content = fullContent.content;
        article.summary = fullContent.content.slice(0, 2000);
        if (fullContent.date && !article.date) article.date = fullContent.date;
        console.log(`[ENRICH] ${article.title.slice(0, 50)}... content=${fullContent.content.length} chars`);
        count++;
      }
      enriched.push(article);
      await delay(600);
    } catch (err) {
      console.warn(`[ENRICH] Error: ${err.message}`);
      enriched.push(article);
    }
  }

  console.log(`[ENRICH] Enriched ${count}/${limit} articles with full content`);
  return enriched;
}

export { scrapeWithFirecrawl, isIndonesianLocal };

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
