// RSS feed URLs for Indonesian news sources
const SOURCES = [
  { name: 'Kompas', feedUrl: 'https://rss.kompas.com/', searchTerms: ['mbg', 'makan bergizi gratis', 'keracunan', 'sppg'] },
  { name: 'Detik', feedUrl: 'https://rss.detik.com/index.php/detikcom', searchTerms: ['mbg', 'makan bergizi gratis', 'keracunan makanan'] },
  { name: 'Tempo', feedUrl: 'https://rss.tempo.co/', searchTerms: ['mbg', 'makan bergizi gratis', 'keracunan'] },
  { name: 'CNN Indonesia', feedUrl: 'https://www.cnnindonesia.com/nasional/rss', searchTerms: ['mbg', 'makan bergizi gratis', 'keracunan'] },
  { name: 'Tribun', feedUrl: 'https://www.tribunnews.com/rss', searchTerms: ['mbg', 'makan bergizi gratis', 'keracunan'] },
  { name: 'Antara', feedUrl: 'https://www.antaranews.com/rss/terkini.xml', searchTerms: ['mbg', 'makan bergizi gratis', 'keracunan'] },
];

/**
 * Scrape all sources — returns deduplicated articles
 */
export async function scrapeAll(env) {
  const allArticles = [];

  // Scrape sources with staggered delays to avoid rate limits
  for (const source of SOURCES) {
    try {
      const articles = await scrapeSource(source);
      allArticles.push(...articles);

      // Stagger requests by 1 second
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.warn(`[SCRAPER] Failed to scrape ${source.name}:`, err.message);
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  return allArticles.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

/**
 * Scrape a single RSS source
 */
async function scrapeSource(source) {
  const articles = [];

  try {
    const res = await fetch(source.feedUrl, {
      headers: {
        'User-Agent': 'MBG-Monitor/1.0 (news aggregator)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    if (!res.ok) {
      console.warn(`[SCRAPER] ${source.name} returned ${res.status}`);
      return articles;
    }

    const xml = await res.text();

    // Parse RSS using HTMLRewriter-style XML parsing
    const items = extractRSSItems(xml);

    for (const item of items) {
      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const combined = title + ' ' + desc;

      // Filter for MBG-related content
      const isRelevant = source.searchTerms.some(term => combined.includes(term));
      if (!isRelevant) continue;

      // Extract tag from title/content
      const tag = detectTag(combined);

      articles.push({
        title: cleanText(item.title || ''),
        summary: cleanText(item.description || '').slice(0, 500),
        url: item.link || '',
        source: source.name,
        date: parseRSSDate(item.pubDate) || new Date().toISOString().slice(0, 19).replace('T', ' '),
        tag,
      });
    }
  } catch (err) {
    console.warn(`[SCRAPER] Error scraping ${source.name}:`, err.message);
  }

  return articles;
}

/**
 * Extract RSS items from XML string
 * Simple XML parsing without DOM — safe for Workers environment
 */
function extractRSSItems(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    items.push({
      title: extractTag(itemXml, 'title'),
      link: extractTag(itemXml, 'link'),
      description: extractTag(itemXml, 'description'),
      pubDate: extractTag(itemXml, 'pubDate'),
    });
  }

  // Also try Atom format
  if (items.length === 0) {
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const linkMatch = entryXml.match(/<link[^>]*href="([^"]*)"/);
      items.push({
        title: extractTag(entryXml, 'title'),
        link: linkMatch ? linkMatch[1] : '',
        description: extractTag(entryXml, 'summary') || extractTag(entryXml, 'content'),
        pubDate: extractTag(entryXml, 'published') || extractTag(entryXml, 'updated'),
      });
    }
  }

  return items;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';

  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function cleanText(str) {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function parseRSSDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return null;
  }
}

function detectTag(text) {
  if (text.includes('keracunan') || text.includes('racun') || text.includes('keranjingan')) return 'keracunan';
  if (text.includes('sppg') || text.includes('dapur')) return 'sppg';
  if (text.includes('kecelakaan') || text.includes('tabrak') || text.includes('terbalik')) return 'kecelakaan';
  if (text.includes('tewas') || text.includes('meninggal') || text.includes('korban jiwa')) return 'tewas';
  if (text.includes('mbg') || text.includes('makan bergizi gratis')) return 'mbg';
  return 'lainnya';
}
