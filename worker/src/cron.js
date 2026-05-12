import { scrapeAll, scrapeDateRangeArchive } from './scrapers/index.js';
import { classifyArticlesBatch } from './ai-classify.js';

// Helper functions for AI summarization and filtering (from index.js)
function truncateNote(text, maxLen = 80) {
  if (!text) return '';
  // Remove HTML tags if any
  const clean = text.replace(/<[^>]*>/g, '').trim();
  if (clean.length <= maxLen) return clean;
  // Find last sentence boundary before maxLen
  const truncated = clean.slice(0, maxLen);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastSpace = truncated.lastIndexOf(' ');
  const cutAt = lastPeriod > maxLen * 0.5 ? lastPeriod + 1 : lastSpace;
  return truncated.slice(0, cutAt > 0 ? cutAt : maxLen).trim() + '...';
}

async function summarizeWithAI(text, env) {
  if (!env.KILO_API_KEY) {
    return truncateNote(text, 80);
  }

  try {
    const response = await fetch('https://api.kilo.chat/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.KILO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.KILO_MODEL || 'nemotron-3-super-120b-a12b',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes news articles in Indonesian.' },
          { role: 'user', content: `Summarize this article in 1-2 sentences: ${text}` },
        ],
        max_tokens: 100,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Kilo API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    if (summary) {
      return truncateNote(summary, 80);
    }
  } catch (err) {
    console.error(`[AI Summarization] Failed: ${err.message}`);
  }

  return truncateNote(text, 80);
}

/**
 * Check if article is a relevant MBG poisoning incident.
 * Applies negative filters to exclude prevention, positive health, and policy articles.
 * Only checks title + note (summary) — NOT the full article body which may have boilerplate.
 */
function isRelevantMBGPoisoning(article) {
  const title = (article.title || '').toLowerCase();
  const note = (article.summary || article.note || '').toLowerCase();
  const text = title + ' ' + note;

  // Exclude hoax/debunked articles
  if (/hoaks|tidak benar|disinformasi|klarifikasi|bantahan/.test(text)) return false;

  // Exclude tag/category pages
  if (/^tag\s*:/.test(title) || /^kategori\s*:/.test(title)) return false;

  // Exclude educational/how-to articles about poisoning without incident context
  if (/penyebab/.test(title) && /keracunan/.test(title) && !/korban|dirawat|siswa|murid|warga|orang/.test(text)) return false;
  if (/^cara\s/.test(title) && /keracunan/.test(title) && !/korban|dirawat|siswa|murid|warga|orang/.test(text)) return false;

  // Negative filter: reject clearly non-poisoning articles
  if (/cegah/.test(title) && /penyakit/.test(title)) return false;       // prevention article
  if (/tingkatkan/.test(title) && /kesehatan/.test(title)) return false; // positive health article

  // Negative filter: reject first aid, explanatory, and non-incident articles
  if (/pertolongan\s+pertama/.test(title)) return false;                  // first aid article
  if (/cara\s+penanganan/.test(title)) return false;                      // how-to-handle guide
  if (/keracunan/.test(title) && /kecubung|metanol|gas/.test(title)) return false; // not food poisoning
  if (/di\s+berbagai\s+negara/.test(text)) return false;                  // international comparison
  if (/^pembelajaran\s+dari/.test(title)) return false;                   // lessons-learned article

  // Require: poisoning keyword
  const hasPoisoning = /keracunan/.test(text);

  // MBG context: check BOTH title AND summary/body (many articles have MBG in body, not title)
  const hasMBGContext = /mbg|makan bergizi|makan bergizi gratis|sppg|program makan/i.test(text);

  // Incident indicator: victim keywords suggesting an actual event
  const hasIncidentIndicator = /korban|dirawat|siswa|murid|warga|orang|massal|sekolah|dilarikan|pasien|terdampak|rumah sakit|puskesmas|rawat inap/i.test(text);

  return hasPoisoning && hasMBGContext && hasIncidentIndicator;
}

function TODAY() {
  return new Date().toISOString().slice(0, 10);
}

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
 * Strips kabupaten/kota/kab prefixes and maps known aliases.
 */
function normalizeLocation(loc) {
  if (!loc || loc === 'Indonesia') return '';
  let normalized = loc.toLowerCase().trim();

  // Strip kabupaten/kota/kab prefixes to extract the base region name
  const stripped = normalized
    .replace(/^kabupaten\s+/, '')
    .replace(/^kab\.\s*/, '')
    .replace(/^kota\s+/, '')
    .trim();

  // Check full match against aliases first (original and stripped)
  if (LOCATION_ALIASES[normalized]) return LOCATION_ALIASES[normalized];
  if (LOCATION_ALIASES[stripped]) return LOCATION_ALIASES[stripped];

  // Check substring match — prefer stripped form for comparison
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (normalized.includes(alias) || stripped.includes(alias)) return canonical;
  }

  // Return stripped form so "Kab. Bandung" and "Kota Bandung" both become "bandung"
  return stripped || normalized;
}

/**
 * Extract the parent region from a location string.
 * e.g. "Jakarta Selatan" → "jakarta", "Kab. Bandung Barat" → "bandung"
 */
function extractParentRegion(loc) {
  if (!loc) return '';
  const normalized = loc.toLowerCase().trim();

  // Check if any alias key is a substring of the location
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (normalized.includes(alias)) return canonical;
  }

  // Strip administrative prefixes and return base
  const stripped = normalized
    .replace(/^kabupaten\s+/, '')
    .replace(/^kab\.\s*/, '')
    .replace(/^kota\s+/, '')
    .trim();

  return stripped;
}

/**
 * Parse a date string into a Date object (UTC midnight).
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Check if two articles describe the same incident using fuzzy matching.
 *
 * Two articles are fuzzy duplicates if ALL of these match:
 * 1. Date: |dateA - dateB| ≤ 2 days
 * 2. Victims: Both > 0 and within ±20%, OR both = 0
 * 3. Location: Normalized locations match, or one is parent/substring of the other
 */
function isFuzzyDuplicate(articleA, articleB) {
  // 1. Date check: within ±2 days
  const dateA = parseDate(articleA.date);
  const dateB = parseDate(articleB.date);
  if (!dateA || !dateB) return false;

  const diffMs = Math.abs(dateA.getTime() - dateB.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > 2) return false;

  // 2. Victim count check: within ±20%, or both zero
  const vA = articleA.victims || 0;
  const vB = articleB.victims || 0;

  if (vA === 0 && vB === 0) {
    // Both zero — can't use victim count as signal, pass through
  } else if (vA === 0 || vB === 0) {
    // One has victims, the other doesn't — not a confident match
    return false;
  } else {
    const maxV = Math.max(vA, vB);
    if (Math.abs(vA - vB) / maxV > 0.20) return false;
  }

  // 3. Location check: normalized match or parent/substring relationship
  const locA = normalizeLocation(articleA.location);
  const locB = normalizeLocation(articleB.location);

  if (!locA || !locB) return false;

  if (locA === locB) return true;

  // Check parent region relationship
  const parentA = extractParentRegion(articleA.location);
  const parentB = extractParentRegion(articleB.location);

  if (parentA && parentB && parentA === parentB) return true;

  // Check substring containment (e.g. "bandung barat" contains "bandung")
  if (locA.includes(locB) || locB.includes(locA)) return true;

  return false;
}

/**
 * Merge articleB into articleA, keeping the best content from each.
 */
function mergeArticles(articleA, articleB) {
  const merged = { ...articleA };

  // Keep the longer summary/note
  const noteA = articleA.summary || articleA.note || '';
  const noteB = articleB.summary || articleB.note || '';
  if (noteB.length > noteA.length) {
    if (articleB.summary) merged.summary = articleB.summary;
    if (articleB.note) merged.note = articleB.note;
  }

  // Keep URL from the article with more victim info
  const vA = articleA.victims || 0;
  const vB = articleB.victims || 0;
  if (vB > vA && articleB.url) {
    merged.url = articleB.url;
  }

  // Keep the higher victim count
  if (vB > vA) {
    merged.victims = vB;
  }

  // Combine sources if different
  const srcA = articleA.source || '';
  const srcB = articleB.source || '';
  if (srcB && srcB !== srcA) {
    merged.source = srcA ? `${srcA}, ${srcB}` : srcB;
  }

  return merged;
}

/**
 * Fuzzy deduplication — filters articles that describe incidents already
 * in the database or that duplicate other articles in the same batch.
 *
 * Uses pairwise comparison with tolerances:
 * - Date window: ±2 days
 * - Victim count: ±20%
 * - Location: normalized/parent region matching
 *
 * When two articles match, merges them (keeps longer summary, combines sources).
 */
export function deduplicateArticles(articles, existingIncidents) {
  // Normalize existing incidents into article-like objects for comparison
  const existingAsArticles = (existingIncidents || []).map(inc => ({
    date: inc.date,
    victims: inc.victims || 0,
    location: inc.loc || inc.location || '',
  }));

  // Build accepted list with pairwise fuzzy comparison
  const accepted = [];
  let fuzzyDupesRemoved = 0;

  for (const article of articles) {
    let isDuplicate = false;

    for (let j = 0; j < accepted.length; j++) {
      if (isFuzzyDuplicate(article, accepted[j])) {
        accepted[j] = mergeArticles(accepted[j], article);
        isDuplicate = true;
        fuzzyDupesRemoved++;
        break;
      }
    }

    if (isDuplicate) continue;

    // Check against existing incidents in DB
    let matchesExisting = false;
    for (const existing of existingAsArticles) {
      if (isFuzzyDuplicate(article, existing)) {
        matchesExisting = true;
        fuzzyDupesRemoved++;
        break;
      }
    }

    if (!matchesExisting) {
      accepted.push(article);
    }
  }

  if (fuzzyDupesRemoved > 0) {
    console.log(`[CRON] Fuzzy dedup removed ${fuzzyDupesRemoved} duplicate(s)`);
  }

  return accepted;
}

export async function handleCron(env) {
  const start = Date.now();
  let incidentsAdded = 0;

  try {
    console.log('[CRON] Starting Wikipedia-only crawl...');

    // Scrape Wikipedia table only
    let wikiIncidents = [];
    try {
      wikiIncidents = await scrapeWikiTable(env);
      console.log(`[CRON] Wikipedia: ${wikiIncidents.length} incidents`);
    } catch (e) {
      console.warn('[CRON] Wikipedia scrape failed:', e.message);
    }

    // Dedup + insert Wikipedia incidents
    if (wikiIncidents.length > 0) {
      const existingWikiUrls = new Set();
      try {
        const rows = await env.DB.prepare('SELECT url FROM incidents').all();
        for (const row of rows.results || []) existingWikiUrls.add(row.url);
      } catch (e) {}

      const existingByDateLoc = new Set();
      try {
        const rows = await env.DB.prepare('SELECT date, loc FROM incidents').all();
        for (const row of rows.results || []) {
          if (row.date && row.loc) existingByDateLoc.add(`${row.date}|${row.loc.slice(0,8)}`);
        }
      } catch (e) {}

      const newWikiInc = wikiIncidents.filter(w =>
        (w.url && !existingWikiUrls.has(w.url)) ||
        (!existingByDateLoc.has(`${w.date}|${w.location.slice(0,8)}`))
      );

      console.log(`[CRON] ${newWikiInc.length} new wiki incidents to insert`);
      let wikiInserted = 0;
      for (const w of newWikiInc) {
        try {
          await env.DB.prepare(`
            INSERT INTO incidents (cat, date, lat, lng, title, loc, victims, deaths, note, source, url, is_baseline)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            'keracunan', w.date, w.lat, w.lng,
            w.title, w.location, w.victims || 0, w.deaths || 0, w.note || '', 'Wikipedia', w.url || '', 0
          ).run();
          wikiInserted++;
          incidentsAdded++;
        } catch (e) {
          // likely duplicate, skip
        }
      }
      console.log(`[CRON] Wiki inserted: ${wikiInserted}`);
    }

    await logCrawl(env, start, incidentsAdded, 0, true, 'wikipedia-only');
  } catch (e) {
    console.error('[CRON] Fatal:', e.message);
    await logCrawl(env, start, 0, 0, false, 'error');
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
