/**
 * MBG News Scraper
 * 
 * Priority: Indonesian local news sources (Antara, Kompas, Detik, Tempo, Liputan6)
 * Tavily/Exa for supplementary international coverage.
 * 
 * NO aggressive deduplication - only URL dedup. Each article is a separate incident.
 */

import { searchMBGArticles } from '../search-apis.js';

const TODAY = () => new Date().toISOString().slice(0, 10);
const MIN_DATE = '2024-01-01';

// Indonesian local search queries - broader for more coverage
const LOCAL_QUERIES = [
  'keracunan mbg',
  'makan bergizi gratis',
  'sppg ditutup',
  'keracunan makanan sekolah',
  'mbg anggaran',
];

// Tavily/Exa supplementary queries
const API_QUERIES = [
  'keracunan MBG siswa sekolah 2025',
  '4711 kasus keracunan MBG',
  'food poisoning Indonesia school meals',
];

export async function scrapeAll(env) {
  const allArticles = [];

  // Phase 1: Indonesian local HTML scraping (PRIORITY - most data here)
  
  // Antara (2 queries)
  for (const query of LOCAL_QUERIES.slice(0, 2)) {
    try {
      const url = `https://www.antaranews.com/search?q=${encodeURIComponent(query)}`;
      const articles = await scrapeAntaraSearch(url);
      if (articles.length) console.log(`[SCRAPER] Antara "${query}": ${articles.length}`);
      allArticles.push(...articles);
      await delay(600);
    } catch (err) { console.warn(`[SCRAPER] Antara:`, err.message); }
  }

  // Kompas (2 queries)
  for (const query of LOCAL_QUERIES.slice(0, 2)) {
    try {
      const url = `https://search.kompas.com/search/?q=${encodeURIComponent(query)}&sort=date`;
      const articles = await scrapeKompasSearch(url);
      if (articles.length) console.log(`[SCRAPER] Kompas "${query}": ${articles.length}`);
      allArticles.push(...articles);
      await delay(600);
    } catch (err) { console.warn(`[SCRAPER] Kompas:`, err.message); }
  }

  // Detik (2 queries)
  for (const query of LOCAL_QUERIES.slice(0, 2)) {
    try {
      const url = `https://www.detik.com/search/searchall?query=${encodeURIComponent(query)}&sortby=time`;
      const articles = await scrapeDetikSearch(url);
      if (articles.length) console.log(`[SCRAPER] Detik "${query}": ${articles.length}`);
      allArticles.push(...articles);
      await delay(600);
    } catch (err) { console.warn(`[SCRAPER] Detik:`, err.message); }
  }

  // Liputan6 (1 query)
  try {
    const url = `https://www.liputan6.com/search?q=${encodeURIComponent('keracunan mbg')}`;
    const articles = await scrapeLiputan6Search(url);
    if (articles.length) console.log(`[SCRAPER] Liputan6: ${articles.length}`);
    allArticles.push(...articles);
    await delay(600);
  } catch (err) { console.warn(`[SCRAPER] Liputan6:`, err.message); }

  console.log(`[SCRAPER] Phase 1 (Local HTML): ${allArticles.length} articles`);

  // Phase 2: Tavily/Exa API (supplementary, for international coverage)
  const apiArticles = await searchMBGArticles(env, API_QUERIES);
  for (const a of apiArticles) {
    allArticles.push({
      title: (a.title || '').slice(0, 300),
      summary: (a.summary || '').slice(0, 800),
      url: a.url,
      source: a.source || 'Web',
      date: validateDate(a.date),
      tag: detectTag(((a.title || '') + ' ' + (a.summary || '')).toLowerCase()),
      ...extractLocationAndCoords(a.title, a.summary),
    });
  }
  console.log(`[SCRAPER] Phase 2 (APIs): +${apiArticles.length} = ${allArticles.length} total`);

  // Dedup by URL only (no incident dedup - each article is separate)
  const seen = new Set();
  const unique = allArticles.filter(a => {
    if (!a.url || !a.url.startsWith('http')) return false;
    if (seen.has(a.url)) return false;
    if (!isRelevantMBG(a.title, a.summary)) return false;
    seen.add(a.url);
    return true;
  });

  // Ensure all dates are valid
  for (const a of unique) {
    a.date = validateDate(a.date);
  }

  console.log(`[SCRAPER] Final: ${unique.length} unique articles`);
  return unique;
}

/* ===== RELEVANCE CHECK ===== */

function isRelevantMBG(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  const mbgTerms = [
    'mbg', 'makan bergizi gratis', 'sppg', 'dapur sekolah', 'makanan sekolah',
    'program makan', 'free school meal', 'free meal program', 'school lunch',
    'food poisoning indonesia', 'prabowo meal',
  ];
  if (!mbgTerms.some(t => text.includes(t))) return false;
  const excludeTerms = ['trading', 'crypto', 'bitcoin', 'saham', 'stock', 'nasdaq', 'forex'];
  if (excludeTerms.some(t => text.includes(t))) return false;
  return true;
}

/* ===== DATE VALIDATION ===== */

function validateDate(dateStr) {
  if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return TODAY();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + 'T00:00:00Z');
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2024 && d.getFullYear() <= 2026) return dateStr;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return dateStr.slice(0, 10);
  }
  return TODAY();
}

/* ===== VICTIM EXTRACTION ===== */

function extractVictims(title, desc) {
  const text = title + ' ' + desc;
  let maxVictims = 0;
  const parseNum = s => parseInt(String(s).replace(/[.,]/g, ''), 10) || 0;

  // "4.711 kasus" / "1,000 cases"
  const kasusMatch = text.match(/([\d.,]+)\s*(?:kasus|cases|victims)/i);
  if (kasusMatch) { const n = parseNum(kasusMatch[1]); if (n > maxVictims && n < 50000) maxVictims = n; }

  // English patterns
  const engPatterns = [
    /(?:over|more than|above|nearly|almost|approximately)\s*([\d.,]+)\s*(?:children|students|kids|people|victims|fall ill|hospitalized)/i,
    /([\d.,]+)\s*(?:children|students|kids|people|victims)\s*(?:fall ill|fell ill|were|are|hospitalized|sickened|affected|poisoned)/i,
    /([\d.,]+)\s*(?:hospitalized|affected|poisoned|sick|ill)/i,
  ];
  for (const p of engPatterns) { const m = text.match(p); if (m) { const n = parseNum(m[1]); if (n > maxVictims && n < 50000) maxVictims = n; } }

  // Indonesian patterns
  const idPatterns = [
    /([\d.,]+)\s*(?:siswa|murid|anak|pelajar|korban|orang|pasien|warga)\s*(?:dirawat|dilarikan|sakit|keracunan|terdampak|mengalami)/i,
    /(?:sebanyak|sekitar|hingga|mencapai|lebih dari)\s*([\d.,]+)\s*(?:orang|korban|pasien|siswa|murid|anak)/i,
    /(?:korban|pasien|terdampak|kasus)\s*(?:mencapai|berjumlah|ada)\s*([\d.,]+)/i,
  ];
  for (const p of idPatterns) { const m = text.match(p); if (m) { const n = parseNum(m[1]); if (n > maxVictims && n < 50000) maxVictims = n; } }

  // Thousands
  if (maxVictims === 0) {
    const ribuMatch = text.match(/([\d.,]+)\s*(?:ribu|thousand)/i);
    if (ribuMatch) maxVictims = parseNum(ribuMatch[1]) * 1000;
  }

  // Approximate
  if (maxVictims === 0) {
    if (/hundreds\s*(?:of\s*)?(?:children|students|kids|people)/i.test(text)) maxVictims = 200;
    else if (/ratusan\s*(?:siswa|murid|anak)/i.test(text)) maxVictims = 200;
    else if (/dozens/i.test(text)) maxVictims = 50;
    else if (/puluhan/i.test(text)) maxVictims = 50;
  }

  return maxVictims;
}

/* ===== CATEGORY DETECTION ===== */

function detectTag(text) {
  if (text.includes('tewas') || text.includes('meninggal dunia') || text.includes('korban jiwa')) return 'tewas';
  if (text.includes('keracunan') || text.includes('racun') || text.includes('poisoning')) return 'keracunan';
  if (text.includes('ditutup sementara') || text.includes('dihentikan sementara') || text.includes('tutup sementara')) return 'sppg_temp_closed';
  if (text.includes('ditutup') || text.includes('dihentikan') || text.includes('dicabut izin')) return 'sppg_closed';
  if (text.includes('dibuka') || text.includes('beroperasi baru') || text.includes('diresmikan')) return 'sppg_opened';
  if (text.includes('sppg') || text.includes('dapur sekolah') || text.includes('dapur mbg')) return 'sppg';
  if (text.includes('dihapus') || text.includes('dibungkam') || text.includes('sensor') || text.includes('intimidasi')) return 'silencing';
  if (text.includes('laporan') || text.includes('keluhan') || text.includes('komplain') || text.includes('protes') || text.includes('demonstrasi')) return 'laporan';
  if (text.includes('kecelakaan') || text.includes('tabrak') || text.includes('terbalik')) return 'kecelakaan';
  if (text.includes('korupsi') || text.includes('mark up') || text.includes('suap') || text.includes('anggaran')) return 'anggaran';
  return 'mbg';
}

/* ===== LOCATION EXTRACTION ===== */

const CITY_COORDS = {
  'jakarta': [-6.2088, 106.8456], 'surabaya': [-7.2575, 112.7521],
  'bandung': [-6.9175, 107.6191], 'medan': [3.5952, 98.6722],
  'semarang': [-6.9666, 110.4196], 'makassar': [-5.1477, 119.4327],
  'palembang': [-2.9761, 104.7754], 'bogor': [-6.5971, 106.8060],
  'malang': [-7.9666, 112.6326], 'yogyakarta': [-7.7956, 110.3695],
  'solo': [-7.5698, 110.8285], 'denpasar': [-8.6705, 115.2126],
  'bekasi': [-6.2383, 106.9756], 'depok': [-6.4025, 106.7942],
  'tangerang': [-6.1783, 106.6319], 'balikpapan': [-1.2654, 116.8312],
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
  'lombok': [-8.5653, 116.3515], 'aceh': [5.5483, 95.3238],
  'bireuen': [5.0833, 96.7000], 'nabire': [-3.3667, 135.5000],
  'ppu': [-1.3167, 116.5000], 'penajam': [-1.3167, 116.5000],
  'sulsel': [-3.6688, 119.9741], 'sulawesi selatan': [-3.6688, 119.9741],
  'jawa timur': [-7.5361, 112.2384], 'jawa barat': [-6.9175, 107.6191],
  'jawa tengah': [-7.1510, 110.1403], 'sumatera utara': [2.1154, 99.5451],
  'bali': [-8.4095, 115.1889], 'ntb': [-8.5653, 116.3515],
  'kalimantan timur': [0.5333, 116.4167], 'papua': [-4.0000, 138.0000],
  'ntt': [-10.1772, 123.6070], 'lombok tengah': [-8.7000, 116.2667],
  'banggai': [-1.0833, 122.7167], 'brebes': [-6.8800, 109.0500],
  'ngawi': [-7.4000, 111.4500], 'bojonegoro': [-7.1500, 111.8833],
};

function extractLocation(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  const sortedKeys = Object.keys(CITY_COORDS).sort((a, b) => b.length - a.length);
  for (const city of sortedKeys) {
    if (text.includes(city)) {
      const [lat, lng] = CITY_COORDS[city];
      const name = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return { city: name, lat, lng };
    }
  }
  const locMatch = text.match(/(?:di|di kota|di kabupaten)\s+([a-z][a-z ]+)/i);
  if (locMatch) {
    const name = locMatch[1].trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { city: name, lat: null, lng: null };
  }
  return { city: 'Indonesia', lat: null, lng: null };
}

function extractLocationAndCoords(title, desc) {
  const loc = extractLocation(title, desc);
  return { location: loc.city, lat: loc.lat, lng: loc.lng, victims: extractVictims(title, desc) };
}

/* ===== HTML SCRAPERS ===== */

function decodeEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n))).trim();
}

function parseRelativeDate(text) {
  if (!text) return null;
  text = text.toLowerCase().trim();
  if (text.match(/(\d+)\s*jam\s*lalu/) || text.includes('menit lalu')) return TODAY();
  if (text.includes('kemarin')) { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
  const months = { 'januari': '01', 'jan': '01', 'februari': '02', 'feb': '02', 'maret': '03', 'mar': '03',
    'april': '04', 'apr': '04', 'mei': '05', 'juni': '06', 'jun': '06', 'juli': '07', 'jul': '07',
    'agustus': '08', 'agu': '08', 'september': '09', 'sep': '09', 'oktober': '10', 'okt': '10',
    'november': '11', 'nov': '11', 'desember': '12', 'des': '12' };
  const absMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (absMatch) {
    const month = months[absMatch[2].toLowerCase()];
    if (month) return `${absMatch[3]}-${month}-${absMatch[1].padStart(2, '0')}`;
  }
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  return null;
}

async function fetchHTML(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html', 'Accept-Language': 'id-ID,id;q=0.9' },
      cf: { cacheTtl: 300 }, redirect: 'follow',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) { console.warn(`[FETCH] ${err.message}`); return null; }
}

async function scrapeAntaraSearch(url) {
  const articles = [];
  const html = await fetchHTML(url);
  if (!html) return articles;
  const cardRegex = /<div\s+class="card__post\s+card__post-list\s+card__post__transition\s+mt-30">([\s\S]*?)(?=<div\s+class="card__post\s+card__post-list\s+card__post__transition\s+mt-30">|<div\s+class="pagination-area">|<\/main>)/g;
  let m;
  while ((m = cardRegex.exec(html)) !== null) {
    const chunk = m[1];
    const urlMatch = chunk.match(/<h2\s+class="h5">\s*<a\s+href="(https:\/\/www\.antaranews\.com\/[^"]+)"/);
    const articleUrl = urlMatch ? urlMatch[1] : null;
    if (!articleUrl) continue;
    const titleMatch = chunk.match(/<h2\s+class="h5">\s*<a\s+href="[^"]+"\s+title="([^"]+)"/);
    const title = titleMatch ? decodeEntities(titleMatch[1]) : '';
    const dateMatch = chunk.match(/<span\s+class="text-dark\s+text-capitalize">([^<]+)<\/span>/);
    const parsedDate = parseRelativeDate(dateMatch?.[1]?.trim());
    const descMatch = chunk.match(/<div\s+class="card__post__author-info[\s\S]*?<\/div>\s*<p>([\s\S]*?)<\/p>/);
    const desc = descMatch ? decodeEntities(descMatch[1].replace(/<[^>]+>/g, '').trim()) : '';
    if (parsedDate && parsedDate < MIN_DATE) continue;
    const combined = (title + ' ' + desc).toLowerCase();
    const loc = extractLocation(title, desc);
    articles.push({ title: title.slice(0, 300), summary: desc.slice(0, 800), url: articleUrl, source: 'Antara', date: parsedDate || TODAY(), tag: detectTag(combined), location: loc.city, lat: loc.lat, lng: loc.lng, victims: extractVictims(title, desc) });
  }
  return articles;
}

async function scrapeKompasSearch(url) {
  const articles = [];
  const html = await fetchHTML(url);
  if (!html) return articles;
  const articleRegex = /<div\s+class="article__list[^"]*">([\s\S]*?)(?=<div\s+class="article__list|<div\s+class="paging)/g;
  let m;
  while ((m = articleRegex.exec(html)) !== null) {
    const chunk = m[1];
    const linkMatch = chunk.match(/<a\s+href="(https:\/\/[^"]*kompas\.com[^"]*)"[^>]*title="([^"]*)"/);
    if (!linkMatch) continue;
    const dateMatch = chunk.match(/<div\s+class="article__date">([^<]+)/);
    const parsedDate = parseRelativeDate(dateMatch?.[1]?.trim());
    const descMatch = chunk.match(/<div\s+class="article__subtitle">([\s\S]*?)<\/div>/);
    const desc = descMatch ? decodeEntities(descMatch[1].replace(/<[^>]+>/g, '').trim()) : '';
    if (parsedDate && parsedDate < MIN_DATE) continue;
    const title = decodeEntities(linkMatch[2]);
    const combined = (title + ' ' + desc).toLowerCase();
    const loc = extractLocation(title, desc);
    articles.push({ title: title.slice(0, 300), summary: desc.slice(0, 800), url: linkMatch[1], source: 'Kompas', date: parsedDate || TODAY(), tag: detectTag(combined), location: loc.city, lat: loc.lat, lng: loc.lng, victims: extractVictims(title, desc) });
  }
  return articles;
}

async function scrapeDetikSearch(url) {
  const articles = [];
  const html = await fetchHTML(url);
  if (!html) return articles;
  const articleRegex = /<article[\s\S]*?<\/article>/g;
  let m;
  while ((m = articleRegex.exec(html)) !== null) {
    const chunk = m[0];
    const urlMatch = chunk.match(/href="(https:\/\/[^"]*detik\.com[^"]*)"/);
    const articleUrl = urlMatch ? urlMatch[1] : null;
    if (!articleUrl) continue;
    const titleMatch = chunk.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/);
    const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '';
    if (!title || title.length < 10) continue;
    const dateMatch = chunk.match(/<span\s+class="[^"]*date[^"]*">([\s\S]*?)<\/span>/);
    const parsedDate = parseRelativeDate(dateMatch?.[1]?.replace(/<[^>]+>/g, '').trim());
    if (parsedDate && parsedDate < MIN_DATE) continue;
    const combined = title.toLowerCase();
    const loc = extractLocation(title, '');
    articles.push({ title: title.slice(0, 300), summary: '', url: articleUrl, source: 'Detik', date: parsedDate || TODAY(), tag: detectTag(combined), location: loc.city, lat: loc.lat, lng: loc.lng, victims: extractVictims(title, '') });
  }
  return articles;
}

async function scrapeLiputan6Search(url) {
  const articles = [];
  const html = await fetchHTML(url);
  if (!html) return articles;
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = articleRegex.exec(html)) !== null) {
    const chunk = m[0];
    const linkMatch = chunk.match(/<a\s+[^>]*href="(https:\/\/www\.liputan6\.com\/[^"]*)"[^>]*>/);
    if (!linkMatch) continue;
    const titleMatch = chunk.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/);
    const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '';
    if (!title || title.length < 10) continue;
    const dateMatch = chunk.match(/<time[^>]*>([^<]+)<\/time>/);
    const parsedDate = parseRelativeDate(dateMatch?.[1]?.trim());
    if (parsedDate && parsedDate < MIN_DATE) continue;
    const combined = title.toLowerCase();
    const loc = extractLocation(title, '');
    articles.push({ title: title.slice(0, 300), summary: '', url: linkMatch[1], source: 'Liputan6', date: parsedDate || TODAY(), tag: detectTag(combined), location: loc.city, lat: loc.lat, lng: loc.lng, victims: extractVictims(title, '') });
  }
  return articles;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
