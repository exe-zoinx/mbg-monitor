/**
 * MBG News Scraper
 *
 * Scrapes Indonesian news sites for MBG (Makan Bergizi Gratis) incidents.
 * Uses direct HTML scraping of news site search pages.
 * Articles are transformed into incident records with category detection.
 */

const MIN_DATE = '2026-01-01';

// Search queries to try on news sites
const SEARCH_QUERIES = [
  'mbg makan bergizi gratis',
  'keracunan mbg',
  'sppg program mbg',
  'mbg sekolah keracunan',
  'makan bergizi gratis insiden',
];

/**
 * Scrape all sources — returns articles transformed into incident records
 */
export async function scrapeAll(env) {
  const allArticles = [];

  // Scrape Antara search pages (proven to work)
  for (const query of SEARCH_QUERIES) {
    try {
      const encoded = encodeURIComponent(query);
      const url = `https://www.antaranews.com/search?q=${encoded}`;
      const articles = await scrapeAntaraSearch(url, query);
      console.log(`[SCRAPER] Antara "${query}": ${articles.length} articles`);
      allArticles.push(...articles);
      await delay(1500);
    } catch (err) {
      console.warn(`[SCRAPER] Antara search failed for "${query}":`, err.message);
    }
  }

  // Also try Kompas search
  for (const query of ['mbg keracunan', 'makan bergizi gratis']) {
    try {
      const encoded = encodeURIComponent(query);
      const url = `https://search.kompas.com/search/?q=${encoded}&sort=date`;
      const articles = await scrapeKompasSearch(url, query);
      console.log(`[SCRAPER] Kompas "${query}": ${articles.length} articles`);
      allArticles.push(...articles);
      await delay(1500);
    } catch (err) {
      console.warn(`[SCRAPER] Kompas search failed:`, err.message);
    }
  }

  // Also try Detik search
  for (const query of ['mbg keracunan', 'makan bergizi gratis']) {
    try {
      const encoded = encodeURIComponent(query);
      const url = `https://www.detik.com/search/searchall?query=${encoded}&sortby=time`;
      const articles = await scrapeDetikSearch(url, query);
      console.log(`[SCRAPER] Detik "${query}": ${articles.length} articles`);
      allArticles.push(...articles);
      await delay(1500);
    } catch (err) {
      console.warn(`[SCRAPER] Detik search failed:`, err.message);
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  const unique = allArticles.filter(a => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  console.log(`[SCRAPER] Total: ${unique.length} unique articles from ${allArticles.length} raw`);
  return unique;
}

/**
 * Scrape Antara News search results
 */
async function scrapeAntaraSearch(url, query) {
  const articles = [];
  const html = await fetchHTML(url);
  if (!html) return articles;

  // Split into article card sections
  const cardRegex = /<div\s+class="card__post\s+card__post-list\s+card__post__transition\s+mt-30">([\s\S]*?)(?=<div\s+class="card__post\s+card__post-list\s+card__post__transition\s+mt-30">|<div\s+class="pagination-area">|<\/main>)/g;

  let cardMatch;
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const chunk = cardMatch[1];

    // URL from <h2> title link
    const urlMatch = chunk.match(/<h2\s+class="h5">\s*<a\s+href="(https:\/\/www\.antaranews\.com\/[^"]+)"/);
    const articleUrl = urlMatch ? urlMatch[1] : null;
    if (!articleUrl) continue;

    // Title from title attribute
    const titleMatch = chunk.match(/<h2\s+class="h5">\s*<a\s+href="[^"]+"\s+title="([^"]+)"/);
    const title = titleMatch ? decodeEntities(titleMatch[1]) : '';

    // Date text
    const dateMatch = chunk.match(/<span\s+class="text-dark\s+text-capitalize">([^<]+)<\/span>/);
    const dateText = dateMatch ? dateMatch[1].trim() : '';
    const parsedDate = parseRelativeDate(dateText);

    // Description
    const descMatch = chunk.match(/<div\s+class="card__post__author-info[\s\S]*?<\/div>\s*<p>([\s\S]*?)<\/p>/);
    const desc = descMatch ? decodeEntities(descMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

    // Filter by date
    if (parsedDate && parsedDate < MIN_DATE) continue;

    // Determine category
    const combined = (title + ' ' + desc).toLowerCase();
    const tag = detectTag(combined);
    const location = extractLocation(title, desc);

    articles.push({
      title: title.slice(0, 300),
      summary: desc.slice(0, 500),
      url: articleUrl,
      source: 'Antara',
      date: parsedDate || new Date().toISOString().slice(0, 10),
      tag,
      location,
    });
  }

  return articles;
}

/**
 * Scrape Kompas search results
 */
async function scrapeKompasSearch(url, query) {
  const articles = [];
  const html = await fetchHTML(url);
  if (!html) return articles;

  // Kompas search result articles - pattern: articleItem or article__list
  const articleRegex = /<div\s+class="article__list[^"]*">([\s\S]*?)(?=<div\s+class="article__list|<div\s+class="paging)/g;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const chunk = match[1];

    // URL and title
    const linkMatch = chunk.match(/<a\s+href="(https:\/\/[^"]*kompas\.com[^"]*)"[^>]*title="([^"]*)"/);
    if (!linkMatch) continue;

    const articleUrl = linkMatch[1];
    const title = decodeEntities(linkMatch[2]);

    // Date
    const dateMatch = chunk.match(/<div\s+class="article__date">([^<]+)/);
    const dateText = dateMatch ? dateMatch[1].trim() : '';
    const parsedDate = parseRelativeDate(dateText);

    // Summary
    const descMatch = chunk.match(/<div\s+class="article__subtitle">([\s\S]*?)<\/div>/);
    const desc = descMatch ? decodeEntities(descMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

    if (parsedDate && parsedDate < MIN_DATE) continue;

    const combined = (title + ' ' + desc).toLowerCase();
    const tag = detectTag(combined);
    const location = extractLocation(title, desc);

    articles.push({
      title: title.slice(0, 300),
      summary: desc.slice(0, 500),
      url: articleUrl,
      source: 'Kompas',
      date: parsedDate || new Date().toISOString().slice(0, 10),
      tag,
      location,
    });
  }

  return articles;
}

/**
 * Scrape Detik search results
 */
async function scrapeDetikSearch(url, query) {
  const articles = [];
  const html = await fetchHTML(url);
  if (!html) return articles;

  // Detik search results - pattern: article class
  const articleRegex = /<article[\s\S]*?<\/article>/g;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const chunk = match[1];

    // URL
    const urlMatch = chunk.match(/href="(https:\/\/[^"]*detik\.com[^"]*)"/);
    const articleUrl = urlMatch ? urlMatch[1] : null;
    if (!articleUrl) continue;

    // Title
    const titleMatch = chunk.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/);
    const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

    // Date
    const dateMatch = chunk.match(/<span\s+class="[^"]*date[^"]*">([\s\S]*?)<\/span>/);
    const dateText = dateMatch ? dateMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const parsedDate = parseRelativeDate(dateText);

    if (parsedDate && parsedDate < MIN_DATE) continue;

    const combined = title.toLowerCase();
    const tag = detectTag(combined);
    const location = extractLocation(title, '');

    articles.push({
      title: title.slice(0, 300),
      summary: '',
      url: articleUrl,
      source: 'Detik',
      date: parsedDate || new Date().toISOString().slice(0, 10),
      tag,
      location,
    });
  }

  return articles;
}

/**
 * Fetch HTML with proper headers
 */
async function fetchHTML(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      },
      cf: { cacheTtl: 300 },
      redirect: 'follow',
    });

    if (!res.ok) {
      console.warn(`[SCRAPER] HTTP ${res.status} from ${url}`);
      return null;
    }

    return await res.text();
  } catch (err) {
    console.warn(`[SCRAPER] Fetch error for ${url}:`, err.message);
    return null;
  }
}

/**
 * Parse relative Indonesian dates to YYYY-MM-DD
 */
function parseRelativeDate(text) {
  if (!text) return null;

  text = text.toLowerCase().trim();

  // "X jam lalu" → today
  const hoursMatch = text.match(/(\d+)\s*jam\s*lalu/);
  if (hoursMatch) {
    return new Date().toISOString().slice(0, 10);
  }

  // "X menit lalu" → today
  if (text.includes('menit lalu')) {
    return new Date().toISOString().slice(0, 10);
  }

  // "Kemarin" → yesterday
  if (text.includes('kemarin')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  // "13 Maret 2026" or "13 Mar 2026"
  const months = {
    'januari': '01', 'jan': '01',
    'februari': '02', 'feb': '02',
    'maret': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'mei': '05', 'may': '05',
    'juni': '06', 'jun': '06',
    'juli': '07', 'jul': '07',
    'agustus': '08', 'agu': '08', 'aug': '08',
    'september': '09', 'sep': '09',
    'oktober': '10', 'okt': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'desember': '12', 'des': '12', 'dec': '12',
  };

  const absMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (absMatch) {
    const day = absMatch[1].padStart(2, '0');
    const month = months[absMatch[2].toLowerCase()];
    const year = absMatch[3];
    if (month) return `${year}-${month}-${day}`;
  }

  // "13/03/2026" or "2026-03-13"
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  return null;
}

/**
 * Detect incident category from article text
 */
function detectTag(text) {
  if (text.includes('keracunan') || text.includes('racun') || text.includes('keranjingan')) return 'keracunan';
  if (text.includes('sppg') || text.includes('dapur sekolah') || text.includes('dapur mbg')) return 'sppg';
  if (text.includes('kecelakaan') || text.includes('tabrak') || text.includes('terbalik') || text.includes('terguling')) return 'kecelakaan';
  if (text.includes('tewas') || text.includes('meninggal') || text.includes('korban jiwa')) return 'tewas';
  return 'mbg';
}

/**
 * Extract location from article text
 */
function extractLocation(title, desc) {
  const text = title + ' ' + desc;

  const cities = [
    'Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar',
    'Palembang', 'Depok', 'Tangerang', 'Bekasi', 'Bogor', 'Malang',
    'Yogyakarta', 'Solo', 'Denpasar', 'Balikpapan', 'Samarinda',
    'Pontianak', 'Banjarmasin', 'Manado', 'Padang', 'Pekanbaru',
    'Jambi', 'Lampung', 'Serang', 'Cirebon', 'Tasikmalaya', 'Gorontalo',
    'Palu', 'Kendari', 'Mataram', 'Kupang', 'Ambon', 'Jayapura',
    'Magetan', 'Sukoharjo', 'Gresik', 'Situbondo', 'Cianjur', 'Sidoarjo',
  ];

  for (const city of cities) {
    if (text.includes(city)) return city;
  }

  // Try "di [City]" pattern
  const locMatch = text.match(/(?:di|di Kota|di Kabupaten)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (locMatch) return locMatch[1];

  return 'Indonesia';
}

/**
 * Decode HTML entities
 */
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .trim();
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
