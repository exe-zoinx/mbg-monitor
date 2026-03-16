/**
 * MBG News Scraper
 *
 * Scrapes Indonesian news sites for MBG (Makan Bergizi Gratis) incidents.
 * Focus areas:
 *   - MBG poisoning / keracunan
 *   - MBG incidents (budget, quality, logistics)
 *   - SPPG open / close / temporary close
 *   - Student / journalist / parent reports
 *   - Government silencing MBG content
 * Uses direct HTML scraping of news site search pages.
 */

const MIN_DATE = '2024-01-01';

// Search queries — focused on specific topics (limited for Worker CPU limits)
const SEARCH_QUERIES = [
  'keracunan makanan sekolah',
  'keracunan mbg',
  'sppg ditutup',
  'sppg dibuka',
  'mbg makan bergizi gratis',
  'kritik mbg dibungkam',
  'laporan orang tua mbg',
];

/**
 * Scrape all sources — returns articles transformed into incident records
 */
export async function scrapeAll(env) {
  const allArticles = [];

  // Source: Antara
  for (const query of SEARCH_QUERIES) {
    try {
      const encoded = encodeURIComponent(query);
      const url = `https://www.antaranews.com/search?q=${encoded}`;
      const articles = await scrapeAntaraSearch(url, query);
      if (articles.length) console.log(`[SCRAPER] Antara "${query}": ${articles.length}`);
      allArticles.push(...articles);
      await delay(800);
    } catch (err) {
      console.warn(`[SCRAPER] Antara failed "${query}":`, err.message);
    }
  }

  // Source: Kompas
  for (const query of ['keracunan mbg', 'sppg ditutup', 'makan bergizi gratis']) {
    try {
      const encoded = encodeURIComponent(query);
      const url = `https://search.kompas.com/search/?q=${encoded}&sort=date`;
      const articles = await scrapeKompasSearch(url, query);
      if (articles.length) console.log(`[SCRAPER] Kompas "${query}": ${articles.length}`);
      allArticles.push(...articles);
      await delay(800);
    } catch (err) {
      console.warn(`[SCRAPER] Kompas failed:`, err.message);
    }
  }

  // Source: Detik
  for (const query of ['keracunan mbg', 'sppg ditutup', 'makan bergizi gratis']) {
    try {
      const encoded = encodeURIComponent(query);
      const url = `https://www.detik.com/search/searchall?query=${encoded}&sortby=time`;
      const articles = await scrapeDetikSearch(url, query);
      if (articles.length) console.log(`[SCRAPER] Detik "${query}": ${articles.length}`);
      allArticles.push(...articles);
      await delay(800);
    } catch (err) {
      console.warn(`[SCRAPER] Detik failed:`, err.message);
    }
  }

  // Deduplicate by URL and enforce mandatory URL + relevance
  const seen = new Set();
  const unique = allArticles.filter(a => {
    if (!a.url || !a.url.startsWith('http')) return false;
    if (seen.has(a.url)) return false;
    if (!isRelevantMBG(a.title, a.summary)) return false;
    seen.add(a.url);
    return true;
  });

  console.log(`[SCRAPER] Total: ${unique.length} relevant articles from ${allArticles.length} raw`);
  return unique;
}

/**
 * Check if article is relevant to MBG tracking scope
 */
function isRelevantMBG(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();

  // Must mention MBG or related terms
  const mbgTerms = ['mbg', 'makan bergizi gratis', 'sppg', 'dapur sekolah', 'makanan sekolah', 'program makan'];
  const hasMBG = mbgTerms.some(t => text.includes(t));
  if (!hasMBG) return false;

  // Check topic relevance
  const topics = [
    // Poisoning
    'keracunan', 'racun', 'sakit', 'dirawat', 'rawat inap', 'puskesmas', 'rumah sakit', 'korban',
    // SPPG ops
    'sppg', 'ditutup', 'dibuka', 'beroperasi', 'dihentikan', 'perizinan', 'sanksi',
    // Reports
    'laporan', 'keluhan', 'komplain', 'protes', 'demonstrasi', 'unjuk rasa', 'investigasi',
    'orang tua', 'siswa', 'murid', 'jurnalis', 'wartawan',
    // Silencing
    'dihapus', 'dibungkam', 'sensor', 'diblokir', 'ancaman', 'intimidasi', 'laporan polisi',
    // Quality / budget
    'kadaluarsa', 'basi', 'tidak layak', 'kotor', 'sanitasi', 'higienis', 'anggaran',
    'mark up', 'korupsi', 'suap', 'pengadaan', 'vendor',
    // Deaths
    'meninggal', 'tewas', 'korban jiwa', 'meninggal dunia',
  ];
  return topics.some(t => text.includes(t));
}

/**
 * Extract victim count from article text
 */
function extractVictims(title, desc) {
  const text = title + ' ' + desc;

  // Exact numbers: "45 siswa", "112 orang", "28 murid"
  const patterns = [
    [ /(\d+)\s*(?:siswa|murid|anak|pelajar|santri|korban|pasien|terdampak|dirawat|dilarikan)/i, 1 ],
    [ /(\d+)\s*(?:orang|warga|ibu hamil|balita)/i, 1 ],
    [ /(?:sebanyak|lebih dari|sedikitnya|sekitar|hingga)\s*(\d+)/i, 1 ],
  ];

  let maxVictims = 0;
  for (const [p, group] of patterns) {
    const m = text.match(p);
    if (m) {
      const n = parseInt(m[group]);
      if (n > maxVictims && n < 10000) maxVictims = n;
    }
  }

  // Approximate counts from Indonesian
  if (maxVictims === 0) {
    const approx = [
      [ /ratusan\s*(?:siswa|murid|anak|korban|orang|pasien)/i, 200 ],
      [ /puluhan\s*(?:siswa|murid|anak|korban|orang|pasien)/i, 50 ],
      [ /belasan\s*(?:siswa|murid|anak|korban|orang|pasien)/i, 15 ],
      [ /beberapa\s*(?:siswa|murid|anak|korban|orang)/i, 5 ],
      [ /massal/i, 30 ],
    ];
    for (const [p, est] of approx) {
      if (p.test(text)) {
        maxVictims = est;
        break;
      }
    }
  }

  return maxVictims;
}

/**
 * Scrape Antara News search results
 */
async function scrapeAntaraSearch(url, query) {
  const articles = [];
  const html = await fetchHTML(url);
  if (!html) return articles;

  const cardRegex = /<div\s+class="card__post\s+card__post-list\s+card__post__transition\s+mt-30">([\s\S]*?)(?=<div\s+class="card__post\s+card__post-list\s+card__post__transition\s+mt-30">|<div\s+class="pagination-area">|<\/main>)/g;

  let cardMatch;
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const chunk = cardMatch[1];

    const urlMatch = chunk.match(/<h2\s+class="h5">\s*<a\s+href="(https:\/\/www\.antaranews\.com\/[^"]+)"/);
    const articleUrl = urlMatch ? urlMatch[1] : null;
    if (!articleUrl) continue;

    const titleMatch = chunk.match(/<h2\s+class="h5">\s*<a\s+href="[^"]+"\s+title="([^"]+)"/);
    const title = titleMatch ? decodeEntities(titleMatch[1]) : '';

    const dateMatch = chunk.match(/<span\s+class="text-dark\s+text-capitalize">([^<]+)<\/span>/);
    const dateText = dateMatch ? dateMatch[1].trim() : '';
    const parsedDate = parseRelativeDate(dateText);

    const descMatch = chunk.match(/<div\s+class="card__post__author-info[\s\S]*?<\/div>\s*<p>([\s\S]*?)<\/p>/);
    const desc = descMatch ? decodeEntities(descMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

    if (parsedDate && parsedDate < MIN_DATE) continue;

    const combined = (title + ' ' + desc).toLowerCase();
    const tag = detectTag(combined);
    const loc = extractLocation(title, desc);
    const victims = extractVictims(title, desc);

    articles.push({
      title: title.slice(0, 300),
      summary: desc.slice(0, 500),
      url: articleUrl,
      source: 'Antara',
      date: parsedDate || new Date().toISOString().slice(0, 10),
      tag,
      location: loc.city,
      lat: loc.lat,
      lng: loc.lng,
      victims,
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

  const articleRegex = /<div\s+class="article__list[^"]*">([\s\S]*?)(?=<div\s+class="article__list|<div\s+class="paging)/g;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const chunk = match[1];

    const linkMatch = chunk.match(/<a\s+href="(https:\/\/[^"]*kompas\.com[^"]*)"[^>]*title="([^"]*)"/);
    if (!linkMatch) continue;

    const articleUrl = linkMatch[1];
    const title = decodeEntities(linkMatch[2]);

    const dateMatch = chunk.match(/<div\s+class="article__date">([^<]+)/);
    const dateText = dateMatch ? dateMatch[1].trim() : '';
    const parsedDate = parseRelativeDate(dateText);

    const descMatch = chunk.match(/<div\s+class="article__subtitle">([\s\S]*?)<\/div>/);
    const desc = descMatch ? decodeEntities(descMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

    if (parsedDate && parsedDate < MIN_DATE) continue;

    const combined = (title + ' ' + desc).toLowerCase();
    const tag = detectTag(combined);
    const loc = extractLocation(title, desc);
    const victims = extractVictims(title, desc);

    articles.push({
      title: title.slice(0, 300),
      summary: desc.slice(0, 500),
      url: articleUrl,
      source: 'Kompas',
      date: parsedDate || new Date().toISOString().slice(0, 10),
      tag,
      location: loc.city,
      lat: loc.lat,
      lng: loc.lng,
      victims,
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

  const articleRegex = /<article[\s\S]*?<\/article>/g;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const chunk = match[0];

    const urlMatch = chunk.match(/href="(https:\/\/[^"]*detik\.com[^"]*)"/);
    const articleUrl = urlMatch ? urlMatch[1] : null;
    if (!articleUrl) continue;

    const titleMatch = chunk.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/);
    const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

    const dateMatch = chunk.match(/<span\s+class="[^"]*date[^"]*">([\s\S]*?)<\/span>/);
    const dateText = dateMatch ? dateMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const parsedDate = parseRelativeDate(dateText);

    if (parsedDate && parsedDate < MIN_DATE) continue;

    const combined = title.toLowerCase();
    const tag = detectTag(combined);
    const loc = extractLocation(title, '');
    const victims = extractVictims(title, '');

    articles.push({
      title: title.slice(0, 300),
      summary: '',
      url: articleUrl,
      source: 'Detik',
      date: parsedDate || new Date().toISOString().slice(0, 10),
      tag,
      location: loc.city,
      lat: loc.lat,
      lng: loc.lng,
      victims,
    });
  }
  return articles;
}

/**
 * Scrape Tribun News search results
 */
async function scrapeTribunSearch(url, query) {
  const articles = [];
  const html = await fetchHTML(url);
  if (!html) return articles;

  // Tribun search results - pattern: li with class containing 'news'
  const articleRegex = /<li[^>]*class="[^"]*art-list[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const chunk = match[1];

    const linkMatch = chunk.match(/<a\s+href="(https:\/\/[^"]*tribunnews\.com[^"]*)"[^>]*>/);
    if (!linkMatch) continue;
    const articleUrl = linkMatch[1];

    const titleMatch = chunk.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/);
    const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '';
    if (!title) continue;

    const dateMatch = chunk.match(/(\d{1,2}\s+\w+\s+\d{4})/);
    const parsedDate = dateMatch ? parseRelativeDate(dateMatch[1]) : null;
    if (parsedDate && parsedDate < MIN_DATE) continue;

    const combined = title.toLowerCase();
    const tag = detectTag(combined);
    const loc = extractLocation(title, '');
    const victims = extractVictims(title, '');

    articles.push({
      title: title.slice(0, 300),
      summary: '',
      url: articleUrl,
      source: 'Tribun',
      date: parsedDate || new Date().toISOString().slice(0, 10),
      tag,
      location: loc.city,
      lat: loc.lat,
      lng: loc.lng,
      victims,
    });
  }
  return articles;
}

/**
 * Scrape Tempo search results
 */
async function scrapeTempoSearch(url, query) {
  const articles = [];
  const html = await fetchHTML(url);
  if (!html) return articles;

  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/g;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const chunk = match[1];

    const linkMatch = chunk.match(/<a\s+href="(https:\/\/[^"]*tempo\.co[^"]*)"[^>]*>/);
    if (!linkMatch) continue;
    const articleUrl = linkMatch[1];

    const titleMatch = chunk.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/);
    const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '';
    if (!title) continue;

    const dateMatch = chunk.match(/(\d{1,2}\s+\w+\s+\d{4})/);
    const parsedDate = dateMatch ? parseRelativeDate(dateMatch[1]) : null;
    if (parsedDate && parsedDate < MIN_DATE) continue;

    const descMatch = chunk.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const desc = descMatch ? decodeEntities(descMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

    const combined = (title + ' ' + desc).toLowerCase();
    const tag = detectTag(combined);
    const loc = extractLocation(title, desc);
    const victims = extractVictims(title, desc);

    articles.push({
      title: title.slice(0, 300),
      summary: desc.slice(0, 500),
      url: articleUrl,
      source: 'Tempo',
      date: parsedDate || new Date().toISOString().slice(0, 10),
      tag,
      location: loc.city,
      lat: loc.lat,
      lng: loc.lng,
      victims,
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

  if (text.match(/(\d+)\s*jam\s*lalu/)) return new Date().toISOString().slice(0, 10);
  if (text.includes('menit lalu')) return new Date().toISOString().slice(0, 10);

  if (text.includes('kemarin')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  const months = {
    'januari': '01', 'jan': '01', 'februari': '02', 'feb': '02',
    'maret': '03', 'mar': '03', 'april': '04', 'apr': '04',
    'mei': '05', 'may': '05', 'juni': '06', 'jun': '06',
    'juli': '07', 'jul': '07', 'agustus': '08', 'agu': '08', 'aug': '08',
    'september': '09', 'sep': '09', 'oktober': '10', 'okt': '10', 'oct': '10',
    'november': '11', 'nov': '11', 'desember': '12', 'des': '12', 'dec': '12',
  };

  const absMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (absMatch) {
    const day = absMatch[1].padStart(2, '0');
    const month = months[absMatch[2].toLowerCase()];
    const year = absMatch[3];
    if (month) return `${year}-${month}-${day}`;
  }

  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  return null;
}

/**
 * Detect incident category from article text
 */
function detectTag(text) {
  // Deaths first (most severe)
  if (text.includes('tewas') || text.includes('meninggal dunia') || text.includes('korban jiwa')) return 'tewas';
  // Poisoning
  if (text.includes('keracunan') || text.includes('racun')) return 'keracunan';
  // SPPG temporary close
  if (text.includes('ditutup sementara') || text.includes('dihentikan sementara') || text.includes('tutup sementara') || text.includes('berhenti sementara')) return 'sppg_temp_closed';
  // SPPG permanent close
  if (text.includes('ditutup') || text.includes('dihentikan') || text.includes('tutup permanen') || text.includes('dicabut izin') || text.includes('dicabut')) return 'sppg_closed';
  // SPPG opened
  if (text.includes('dibuka') || text.includes('beroperasi baru') || text.includes('diresmikan') || text.includes('dioperasikan') || text.includes('peresmian')) return 'sppg_opened';
  // SPPG general
  if (text.includes('sppg') || text.includes('dapur sekolah') || text.includes('dapur mbg')) return 'sppg';
  // Silencing
  if (text.includes('dihapus') || text.includes('dibungkam') || text.includes('sensor') || text.includes('diblokir') || text.includes('intimidasi')) return 'silencing';
  // Reports
  if (text.includes('laporan') || text.includes('keluhan') || text.includes('komplain') || text.includes('protes') || text.includes('unjuk rasa') || text.includes('demonstrasi')) return 'laporan';
  // Accidents
  if (text.includes('kecelakaan') || text.includes('tabrak') || text.includes('terbalik') || text.includes('terguling')) return 'kecelakaan';
  // Budget/corruption
  if (text.includes('korupsi') || text.includes('mark up') || text.includes('suap') || text.includes('anggaran')) return 'anggaran';
  return 'mbg';
}

/**
 * City coordinates lookup for Indonesian cities
 */
const CITY_COORDS = {
  'jakarta': [-6.2088, 106.8456], 'surabaya': [-7.2575, 112.7521],
  'bandung': [-6.9175, 107.6191], 'medan': [3.5952, 98.6722],
  'semarang': [-6.9666, 110.4196], 'makassar': [-5.1477, 119.4327],
  'palembang': [-2.9761, 104.7754], 'depok': [-6.4025, 106.7942],
  'tangerang': [-6.1783, 106.6319], 'bekasi': [-6.2383, 106.9756],
  'bogor': [-6.5971, 106.8060], 'malang': [-7.9666, 112.6326],
  'yogyakarta': [-7.7956, 110.3695], 'solo': [-7.5698, 110.8285],
  'denpasar': [-8.6705, 115.2126], 'balikpapan': [-1.2654, 116.8312],
  'samarinda': [-0.4948, 117.1436], 'pontianak': [-0.0263, 109.3425],
  'banjarmasin': [-3.3186, 114.5944], 'manado': [1.4748, 124.8421],
  'padang': [-0.9471, 100.4172], 'pekanbaru': [0.5071, 101.4478],
  'jambi': [-1.6101, 103.6131], 'lampung': [-5.4531, 105.2618],
  'serang': [-6.1103, 106.1639], 'cirebon': [-6.7320, 108.5523],
  'tasikmalaya': [-7.3279, 108.2203], 'gorontalo': [0.5435, 123.0568],
  'palu': [-0.8917, 119.8707], 'kendari': [-3.9675, 122.5156],
  'mataram': [-8.5833, 116.1167], 'kupang': [-10.1772, 123.6070],
  'ambon': [-3.6954, 128.1814], 'jayapura': [-2.5489, 140.7134],
  'magetan': [-7.6502, 111.3607], 'sukoharjo': [-7.6833, 110.8333],
  'gresik': [-7.1539, 112.6561], 'situbondo': [-7.7066, 114.0096],
  'cianjur': [-6.8193, 107.1399], 'sidoarjo': [-7.4478, 112.7183],
  'lombok': [-8.5653, 116.3515], 'sulawesi selatan': [-3.6688, 119.9741],
  'sulsel': [-3.6688, 119.9741], 'jawa timur': [-7.5361, 112.2384],
  'jawa barat': [-6.9175, 107.6191], 'jawa tengah': [-7.1510, 110.1403],
  'sumatera utara': [2.1154, 99.5451], 'sumut': [2.1154, 99.5451],
  'bali': [-8.4095, 115.1889], 'ntb': [-8.5653, 116.3515],
  'kalimantan timur': [0.5333, 116.4167], 'kaltim': [0.5333, 116.4167],
  'sulawesi tenggara': [-3.9675, 122.5156], 'sultra': [-3.9675, 122.5156],
  'ntt': [-10.1772, 123.6070], 'aceh': [5.5483, 95.3238],
  'sumatera barat': [-0.7399, 100.8000], 'sumbar': [-0.7399, 100.8000],
  'riau': [0.5071, 101.4478], 'kalimantan selatan': [-3.0926, 115.2838],
  'kalsel': [-3.0926, 115.2838], 'maluku': [-3.6954, 128.1814],
  'papua': [-4.0000, 138.0000], 'sulawesi utara': [1.4748, 124.8421],
  'sulut': [1.4748, 124.8421], 'lebak': [-6.5644, 106.2522],
  'cilegon': [-6.0025, 106.0131], 'brebes': [-6.8800, 109.0500],
  'tegal': [-6.8694, 109.1402], 'purwokerto': [-7.4248, 109.2344],
  'wonogiri': [-7.8167, 110.9333], 'karanganyar': [-7.6000, 110.9500],
  'boyolali': [-7.5333, 110.6000], 'klaten': [-7.7000, 110.6000],
  'kudus': [-6.8000, 110.8333], 'pati': [-6.7500, 111.0333],
  'tuban': [-6.9000, 112.0500], 'lamongan': [-7.1167, 112.4167],
  'mojokerto': [-7.4722, 112.4336], 'jombang': [-7.5453, 112.2300],
  'kediri': [-7.8167, 112.0167], 'blitar': [-8.1000, 112.1500],
  'tulungagung': [-8.0667, 111.9000], 'trenggalek': [-8.0500, 111.7167],
  'ponorogo': [-7.8667, 111.4833], 'pacitan': [-8.2000, 111.1000],
  'madiun': [-7.6333, 111.5333], 'ngawi': [-7.4000, 111.4500],
  'bojonegoro': [-7.1500, 111.8833], 'nganjuk': [-7.6000, 111.9000],
  'lombok tengah': [-8.7000, 116.2667], 'lombok timur': [-8.5500, 116.5500],
  'lombok barat': [-8.6500, 116.1000], 'sumbawa': [-8.5000, 117.5000],
};

/**
 * Extract location from article text - returns { city, lat, lng }
 */
function extractLocation(title, desc) {
  const text = title + ' ' + desc;
  const textLower = text.toLowerCase();

  const sortedKeys = Object.keys(CITY_COORDS).sort((a, b) => b.length - a.length);
  for (const city of sortedKeys) {
    if (textLower.includes(city)) {
      const [lat, lng] = CITY_COORDS[city];
      const name = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return { city: name, lat, lng };
    }
  }

  const locMatch = text.match(/(?:di|di Kota|di Kabupaten)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (locMatch) {
    const name = locMatch[1];
    const key = name.toLowerCase();
    if (CITY_COORDS[key]) {
      return { city: name, lat: CITY_COORDS[key][0], lng: CITY_COORDS[key][1] };
    }
    return { city: name, lat: null, lng: null };
  }

  return { city: 'Indonesia', lat: null, lng: null };
}

/**
 * Decode HTML entities
 */
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .trim();
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
