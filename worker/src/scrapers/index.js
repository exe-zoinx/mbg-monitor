/**
 * MBG News Scraper — "Keracunan MBG" Focus
 * 
 * Direct HTTP scraping for Indonesian local news sources:
 * - Antara (antaranews.com) — static HTML, card__post elements
 * - Kompas (kompas.com) — search HTML with /read/ URLs, fetch article pages for content
 * - Detik (detik.com) — search HTML with article elements
 * - Tempo (tempo.co) — search HTML with article links
 * - Liputan6 (liputan6.com) — search HTML with article links
 * - CNN Indonesia (cnnindonesia.com) — search HTML with article links
 * 
 * FOCUS: Track ALL keracunan MBG (MBG poisoning) incidents since program started (2024)
 * FILTER: Indonesian local news sources ONLY — international sources BANNED
 * 
 * KEY INSIGHT: Kompas search returns URLs but titles are JS-rendered.
 * We extract URLs from search HTML, then fetch each article page to get title/content.
 */

const TODAY = () => new Date().toISOString().slice(0, 10);
const MIN_DATE = '2024-01-01';

// Keracunan MBG search queries — focused set for Cloudflare Worker timeout limits
const KERACUNAN_QUERIES = [
  'keracunan MBG',
  'keracunan makan bergizi gratis',
  'keracunan MBG siswa',
  'MBG keracunan korban',
  'keracunan makanan sekolah',
  'sppg keracunan',
  'kasus keracunan MBG',
  'MBG korban dirawat',
  'MBG sakit perut mual',
  'keracunan makanan sekolah diare',
  'makan bergizi gratis keracunan',
];

const ANTARA_MAX_PAGES = 1;
const KOMPAS_MAX_PAGES = 1;
const MAX_ARTICLE_FETCHES = 5; // Max individual article page fetches per crawl

/**
 * Main scrape function — multi-source using direct HTTP fetch
 */
export { extractVictims, extractLocation };

export async function scrapeAll(env) {
  const allArticles = [];
  const seen = new Set();
  _articleFetches = 0; // Reset article fetch counter

  // SOURCE 1: Antara (antaranews.com) — static HTML scraping (primary source)
  console.log('[SCRAPE] Starting Antara scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const url1 = `https://www.antaranews.com/search?q=${encodeURIComponent(query)}`;
      const articles1 = await scrapeAntaraSearch(url1);
      if (articles1.length) console.log(`[Antara] "${query}" p1: ${articles1.length}`);
      for (const a of articles1) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);

      if (articles1.length >= 10) {
        for (let page = 2; page <= ANTARA_MAX_PAGES; page++) {
          try {
            const urlPage = `https://www.antaranews.com/search?q=${encodeURIComponent(query)}&page=${page}`;
            const articlesPage = await scrapeAntaraSearch(urlPage);
            if (!articlesPage.length) break;
            console.log(`[Antara] "${query}" p${page}: ${articlesPage.length}`);
            for (const a of articlesPage) {
              if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
            }
            await delay(400);
          } catch (err) { console.warn(`[Antara] "${query}" p${page}:`, err.message); break; }
        }
      }
    } catch (err) { console.warn(`[Antara] "${query}":`, err.message); }
  }

  // SOURCE 2: Kompas (kompas.com) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Kompas scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const urls = await extractKompasUrls(query);
      if (urls.length) console.log(`[Kompas] "${query}": ${urls.length} URLs found`);
      
      // Fetch article pages to get titles and content
      for (const url of urls.slice(0, 2)) {
        if (seen.has(url)) continue;
        try {
          const article = await fetchKompasArticle(url);
          if (article && article.title) {
            seen.add(url);
            allArticles.push(article);
          }
          await delay(400);
        } catch (err) { console.warn(`[Kompas] Article fetch error:`, err.message); }
      }
      await delay(300);
    } catch (err) { console.warn(`[Kompas] "${query}":`, err.message); }
  }

  // SOURCE 3: Detik (detik.com) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Detik scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeDetikSearch(query);
      if (articles.length) console.log(`[Detik] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[Detik] "${query}":`, err.message); }
  }

  // SOURCE 4: Tempo (tempo.co) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Tempo scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeTempoSearch(query);
      if (articles.length) console.log(`[Tempo] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[Tempo] "${query}":`, err.message); }
  }

  // SOURCE 5: Liputan6 (liputan6.com) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Liputan6 scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeLiputan6Search(query);
      if (articles.length) console.log(`[Liputan6] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[Liputan6] "${query}":`, err.message); }
  }

  // SOURCE 6: CNN Indonesia (cnnindonesia.com) — search HTML + article page fetching
  console.log('[SCRAPE] Starting CNN Indonesia scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeCNNIndonesiaSearch(query);
      if (articles.length) console.log(`[CNN Indonesia] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[CNN Indonesia] "${query}":`, err.message); }
  }

  // SOURCE 7: Tribun (tribunnews.com) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Tribun scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeTribunSearch(query);
      if (articles.length) console.log(`[Tribun] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[Tribun] "${query}":`, err.message); }
  }

  // SOURCE 8: Tirto (tirto.id) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Tirto scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeTirtoSearch(query);
      if (articles.length) console.log(`[Tirto] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[Tirto] "${query}":`, err.message); }
  }

  // SOURCE 9: Suara (suara.com) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Suara scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeSuaraSearch(query);
      if (articles.length) console.log(`[Suara] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[Suara] "${query}":`, err.message); }
  }

  // SOURCE 10: Okezone (okezone.com) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Okezone scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeOkezoneSearch(query);
      if (articles.length) console.log(`[Okezone] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[Okezone] "${query}":`, err.message); }
  }

  // SOURCE 11: Sindonews (sindonews.com) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Sindonews scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeSindoSearch(query);
      if (articles.length) console.log(`[Sindonews] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[Sindonews] "${query}":`, err.message); }
  }

  // SOURCE 12: Kumparan (kumparan.com) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Kumparan scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeKumparanSearch(query);
      if (articles.length) console.log(`[Kumparan] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[Kumparan] "${query}":`, err.message); }
  }

  // SOURCE 13: Republika (republika.co.id) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Republika scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeRepublikaSearch(query);
      if (articles.length) console.log(`[Republika] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[Republika] "${query}":`, err.message); }
  }

  // SOURCE 14: Viva (viva.co.id) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Viva scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeVivaSearch(query);
      if (articles.length) console.log(`[Viva] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[Viva] "${query}":`, err.message); }
  }

  // SOURCE 15: Merdeka (merdeka.com) — search HTML + article page fetching
  console.log('[SCRAPE] Starting Merdeka scrapers...');
  for (const query of KERACUNAN_QUERIES.slice(0, 5)) {
    try {
      const articles = await scrapeMerdekaSearch(query);
      if (articles.length) console.log(`[Merdeka] "${query}": ${articles.length}`);
      for (const a of articles) {
        if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
      }
      await delay(500);
    } catch (err) { console.warn(`[Merdeka] "${query}":`, err.message); }
  }

  console.log(`[TOTAL RAW] ${allArticles.length} articles from all sources`);

  // Final filtering
  const unique = allArticles.filter(a => {
    if (!a.url || !a.url.startsWith('http')) return false;
    if (!isIndonesianLocal(a.url)) return false;
    if (!isRelevantKeracunan(a.title, a.summary)) return false;
    return true;
  });

  for (const a of unique) {
    a.date = validateDate(a.date);
  }

  console.log(`[FINAL] ${unique.length} keracunan MBG articles from Indonesian local sources`);
  return unique;
}

/* ===== SOURCE FILTER — INDONESIAN LOCAL NEWS ONLY ===== */

const BANNED_DOMAINS = [
  'bbc.com', 'bbc.co.uk', 'nytimes.com', 'cnn.com', 'theguardian.com',
  'reuters.com', 'apnews.com', 'aljazeera.com', 'dw.com', 'france24.com',
  'abc.net.au', 'scmp.com', 'straitstimes.com', 'channelnewsasia.com',
  'washingtonpost.com', 'wsj.com', 'bloomberg.com', 'ft.com',
  'thejakartapost.com', 'jakpost.id', 'coconuts.co', 'vice.com',
  'rappler.com', 'youtube.com', 'twitter.com', 'x.com', 'facebook.com',
];

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

function isIndonesianLocal(url) {
  const domain = extractDomain(url);
  if (BANNED_DOMAINS.some(d => domain.includes(d) || domain.endsWith(d))) return false;
  if (APPROVED_LOCAL_DOMAINS.some(d => domain.includes(d) || domain.endsWith(d))) return true;
  const idTLDs = ['.co.id', '.or.id', '.go.id', '.ac.id', '.sch.id', '.web.id', '.my.id', '.biz.id'];
  if (idTLDs.some(tld => domain.endsWith(tld))) return true;
  if (domain.endsWith('.id') && !domain.includes('rapidapi') && !domain.includes('blogspot')) return true;
  return false;
}

/* ===== RELEVANCE — FOCUS ON MBG INCIDENTS ===== */

function isRelevantKeracunan(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  const mbgTerms = ['mbg', 'makan bergizi gratis', 'sppg', 'dapur sekolah', 'makanan sekolah'];
  return mbgTerms.some(t => text.includes(t));
}

/* ===== DATE ===== */

function validateDate(dateStr) {
  if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return TODAY();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr + 'T00:00:00Z');
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2024 && d.getFullYear() <= 2027) return dateStr;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return dateStr.slice(0, 10);
  }
  return TODAY();
}

/* ===== VICTIM EXTRACTION — FROM FULL ARTICLE CONTENT ===== */

function extractVictims(title, desc) {
  const text = title + ' ' + desc;
  let maxVictims = 0;
  const parseNum = s => parseInt(String(s).replace(/[.,]/g, ''), 10) || 0;

  // PRIORITY: If title has a number + keyword, use that first (body may have conflicting numbers)
  const titleOnly = title || '';
  const titleNumMatch = titleOnly.match(/([\d.,]+)\s*(?:santri|siswi|siswa|murid|anak|warga|pelajar|balita|orang|korban)/i);
  if (titleNumMatch) {
    const n = parseNum(titleNumMatch[1]);
    if (n > 0 && n < 50000) maxVictims = n;
  }

  // PATTERN 1: Explicit victim counts with context
  const explicitPatterns = [
    // "total X orang/korban/siswa/warga"
    /(?:total|jumlah|ada)\s+(?:sebanyak|sekitar|hingga|mencapai|berjumlah)?\s*([\d.,]+)\s*(?:orang|korban|siswa|murid|anak|pelajar|pasien|warga|terdampak)/i,
    // "X orang/korban/siswa ... dirawat/dilarikan/keracunan"
    /([\d.,]+)\s*(?:orang|korban|siswa|murid|anak|pelajar|santri|balita|warga|pasien|terdampak)\s*(?:dirawat|dilarikan|dibawa|sakit|keracunan|mengalami|meninggal|tewas|positif)/i,
    // "dirawat/dilarikan ... sebanyak X"
    /(?:dirawat|dilarikan|dibawa)\s*(?:ke\s*(?:rs|puskesmas|rumah sakit))?\s*(?:sebanyak|sekitar|hingga|mencapai|berjumlah)?\s*(?:sebanyak|sekitar)?\s*([\d.,]+)/i,
    // "menyebabkan/mengakibatkan X orang"
    /(?:menyebabkan|mengakibatkan|menimpa|meracuni|membuat)\s*([\d.,]+)\s*(?:orang|korban|siswa|murid|anak|warga|pelajar|pasien)/i,
    // "korban/terdampak ... mencapai/berjumlah X"
    /(?:korban|terdampak|pasien|kasus)\s*(?:mencapai|berjumlah|sebanyak|ada|tercatat|terdata)\s*([\d.,]+)/i,
    // "X korban/pasien/terdampak"
    /([\d.,]+)\s*(?:korban|pasien|terdampak|warga|orang)\s*(?:berhasil|sudah|telah|masih|dirawat|menjalani|dilarikan)/i,
    // "sebanyak X dari"
    /sebanyak\s+([\d.,]+)\s+dari/i,
    // "mencapai X orang"
    /mencapai\s+([\d.,]+)\s*(?:orang|korban|siswa|murid|anak)/i,
    // "X pelajar/siswa dirawat"
    /([\d.,]+)\s*(?:pelajar|siswa|murid|anak)\s*(?:dirawat|dilarikan|keracunan|sakit)/i,
    // TITLE PATTERN: "X Santri/Siswi/Siswa [optional words] [di Location] Keracunan" (common in titles)
    /([\d.,]+)\s*(?:santri|siswi|siswa|murid|anak|warga|pelajar|balita|orang|korban)\s+[\w\s]*?(?:keracunan|dirawat|dilarikan|sakit|diduga|mengalami)/i,
    // TITLE PATTERN: "Picu X [victims] Keracunan"
    /picu\s+([\d.,]+)\s*(?:santri|siswi|siswa|murid|anak|warga|pelajar|orang|korban)/i,
    // NEW: "bertambah jadi X" (increased to X)
    /bertambah\s+(?:menjadi|jadi)\s*(?:sebanyak|hingga|mencapai)?\s*([\d.,]+)/i,
    // NEW: "lebih dari X orang"
    /lebih\s+dari\s+([\d.,]+)\s*(?:orang|korban|siswa|murid|warga|pasien)/i,
    // NEW: "sedikitnya X orang" (at least X people)
    /sedikitnya\s+([\d.,]+)\s*(?:orang|korban|siswa|murid|warga|pasien)/i,
    // NEW: "hingga X orang" (up to X people)
    /hingga\s+([\d.,]+)\s*(?:orang|korban|siswa|murid|warga|pasien|terdampak)/i,
    // NEW: "sekitar X orang" (approximately X people)
    /sekitar\s+([\d.,]+)\s*(?:orang|korban|siswa|murid|warga|pasien|terdampak)/i,
    // NEW: "dari total X warga/orang" or "total X warga yang tercatat"
    /(?:dari\s+)?total\s+([\d.,]+)\s*(?:warga|orang|korban|siswa|murid|anak|pelajar|terdampak)/i,
    // NEW: "X pelajar/warga/siswa" followed by any context (not requiring action verb)
    /([\d.,]+)\s*(?:pelajar|warga|siswa|murid|anak|santri)\s+(?:kb|sd|smp|sma|di |dari |yang |usai )/i,
  ];
  for (const p of explicitPatterns) {
    const m = text.match(p);
    if (m) { const n = parseNum(m[1]); if (n > maxVictims && n < 50000) maxVictims = n; }
  }

  // PATTERN 2: "X kasus keracunan"
  if (maxVictims === 0) {
    const kasusMatch = text.match(/([\d.,]+)\s*kasus\s*(?:keracunan|korban|mbg|makan bergizi)/i);
    if (kasusMatch) { const n = parseNum(kasusMatch[1]); if (n > maxVictims && n < 50000) maxVictims = n; }
  }

  // PATTERN 3: BGN reporting format "X porsi ... menyebabkan"
  if (maxVictims === 0) {
    const porsiMatch = text.match(/([\d.,]+)\s*porsi\s*(?:makanan|makan)?\s*(?:yang\s+)?(?:menyebabkan|sebabkan|menimbulkan)/i);
    if (porsiMatch) { const n = parseNum(porsiMatch[1]); if (n > maxVictims && n < 50000) maxVictims = n; }
  }

  // PATTERN 4: Indonesian written numbers (tujuh orang, lima belas korban, etc.)
  if (maxVictims === 0) {
    const indonesianNumbers = {
      'satu': 1, 'dua': 2, 'tiga': 3, 'empat': 4, 'lima': 5,
      'enam': 6, 'tujuh': 7, 'delapan': 8, 'sembilan': 9, 'sepuluh': 10,
      'sebelas': 11, 'dua belas': 12, 'tiga belas': 13, 'empat belas': 14, 'lima belas': 15,
      'enam belas': 16, 'tujuh belas': 17, 'delapan belas': 18, 'sembilan belas': 19,
      'dua puluh': 20, 'tiga puluh': 30, 'empat puluh': 40, 'lima puluh': 50,
      'enam puluh': 60, 'tujuh puluh': 70, 'delapan puluh': 80, 'sembilan puluh': 90,
      'seratus': 100, 'dua ratus': 200, 'tiga ratus': 300, 'empat ratus': 400, 'lima ratus': 500,
      'enam ratus': 600, 'tujuh ratus': 700, 'delapan ratus': 800, 'sembilan ratus': 900,
      'seribu': 1000,
    };
    
    // Sort by length descending to match longer phrases first
    const sortedNums = Object.entries(indonesianNumbers).sort((a, b) => b[0].length - a[0].length);
    
    for (const [word, num] of sortedNums) {
      const regex = new RegExp(`\\b${word}\\s+(?:orang|korban|siswa|murid|anak|pelajar|warga|pasien|terdampak)\\b`, 'i');
      if (regex.test(text)) {
        maxVictims = num;
        break;
      }
    }
  }

  // PATTERN 5: Approximate fallback
  if (maxVictims === 0) {
    if (/ratusan\s*(?:siswa|murid|anak|korban|orang|pelajar|santri|warga|terdampak)/i.test(text)) maxVictims = 200;
    else if (/puluhan\s*(?:siswa|murid|anak|korban|orang|pelajar|santri|warga|terdampak)/i.test(text)) maxVictims = 50;
    else if (/belasan\s*(?:siswa|murid|anak|korban|pelajar|santri|warga|terdampak)/i.test(text)) maxVictims = 15;
  }

  return maxVictims;
}

/* ===== CATEGORY ===== */

function detectTag(text) {
  if (text.includes('tewas') || text.includes('meninggal dunia') || text.includes('korban jiwa')) return 'tewas';
  if (text.includes('keracunan') || text.includes('racun')) return 'keracunan';
  if (text.includes('ditutup sementara') || text.includes('dihentikan sementara')) return 'sppg_temp_closed';
  if (text.includes('ditutup') || text.includes('dihentikan') || text.includes('dicabut')) return 'sppg_closed';
  if (text.includes('dibuka') || text.includes('beroperasi') || text.includes('diresmikan')) return 'sppg_opened';
  if (text.includes('sppg') || text.includes('dapur sekolah')) return 'sppg';
  if (text.includes('dihapus') || text.includes('dibungkam') || text.includes('sensor')) return 'silencing';
  if (text.includes('laporan') || text.includes('keluhan') || text.includes('protes') || text.includes('demonstrasi')) return 'laporan';
  if (text.includes('kecelakaan') || text.includes('tabrak')) return 'kecelakaan';
  if (text.includes('korupsi') || text.includes('mark up') || text.includes('anggaran')) return 'anggaran';
  return 'mbg';
}

/* ===== LOCATION ===== */

const CITY_COORDS = {
  'jakarta': [-6.2088, 106.8456], 'surabaya': [-7.2575, 112.7521],
  'bandung': [-6.9175, 107.6191], 'medan': [3.5952, 98.6722],
  'semarang': [-6.9666, 110.4196], 'makassar': [-5.1477, 119.4327],
  'palembang': [-2.9761, 104.7754], 'bogor': [-6.5971, 106.8060],
  'malang': [-7.9666, 112.6326], 'yogyakarta': [-7.7956, 110.3695],
  'solo': [-7.5698, 110.8285], 'denpasar': [-8.6705, 115.2126],
  'bekasi': [-6.2383, 106.9756], 'depok': [-6.4025, 106.7942],
  'tangerang': [-6.1783, 106.6319], 'balikpapan': [-1.2654, 116.8312],
  'samarinda': [-0.4948, 117.1436], 'banjarmasin': [-3.3186, 114.5944],
  'manado': [1.4748, 124.8421], 'padang': [-0.9471, 100.4172],
  'pekanbaru': [0.5071, 101.4478], 'lampung': [-5.4531, 105.2618],
  'serang': [-6.1103, 106.1639], 'tasikmalaya': [-7.3279, 108.2203],
  'gorontalo': [0.5435, 123.0568], 'palu': [-0.8917, 119.8707],
  'kendari': [-3.9675, 122.5156], 'mataram': [-8.5833, 116.1167],
  'gresik': [-7.1539, 112.6561], 'sidoarjo': [-7.4478, 112.7183],
  'magetan': [-7.6502, 111.3607], 'sukoharjo': [-7.6833, 110.8333],
  'situbondo': [-7.7066, 114.0096], 'cianjur': [-6.8193, 107.1399],
  'lombok': [-8.5653, 116.3515], 'aceh': [5.5483, 95.3238],
  'bireuen': [5.0833, 96.7000], 'nabire': [-3.3667, 135.5000],
  'brebes': [-6.8800, 109.0500], 'ngawi': [-7.4000, 111.4500],
  'bojonegoro': [-7.1500, 111.8833], 'tulungagung': [-8.0667, 111.9000],
  'kediri': [-7.8167, 112.0167], 'blitar': [-8.1000, 112.1500],
  'madiun': [-7.6333, 111.5333], 'ponorogo': [-7.8667, 111.4833],
  'jombang': [-7.5453, 112.2300], 'mojokerto': [-7.4722, 112.4336],
  'lamongan': [-7.1167, 112.4167], 'tuban': [-6.9000, 112.0500],
  'jawa timur': [-7.5361, 112.2384], 'jawa barat': [-6.9175, 107.6191],
  'jawa tengah': [-7.1510, 110.1403], 'bengkulu': [-3.8000, 102.2667],
  'bangka': [-2.0000, 106.0000], 'ntb': [-8.5653, 116.3515],
  'bali': [-8.4095, 115.1889], 'papua': [-4.0000, 138.0000],
  'sulsel': [-3.6688, 119.9741], 'kalimantan timur': [0.5333, 116.4167],
  'ntt': [-10.1772, 123.6070], 'sumatera utara': [2.1154, 99.5451],
  'karanganyar': [-7.6000, 110.9500], 'sleman': [-7.7500, 110.3500],
  'kulon progo': [-7.8500, 110.1667], 'pandeglang': [-6.3100, 106.1000],
  'indramayu': [-6.3264, 108.3200], 'karawang': [-6.3067, 107.3100],
  'kuningan': [-6.9833, 108.4833], 'garut': [-7.2167, 107.9000],
  'wonogiri': [-7.8167, 110.9167], 'sragen': [-7.4333, 111.0167],
  'batang': [-6.9167, 109.7333], 'lebong': [-3.1667, 102.2500],
  'empat lawang': [-3.7250, 103.0000], 'pali': [-3.2167, 103.8333],
  'indragiri hilir': [-0.3333, 103.1667], 'nunukan': [4.1333, 117.6667],
  'bulukumba': [-5.5500, 120.2000], 'pangkajene': [-4.8500, 119.5500],
  'bombana': [-4.5500, 121.9000], 'kupang': [-10.1772, 123.6070],
  'manokwari': [-0.8614, 134.0620], 'lombok tengah': [-8.7000, 116.2833],
  'sumbawa': [-8.6500, 117.4167], 'banggai': [-1.1167, 122.8833],
  'pamekasan': [-7.1569, 113.4746],
  'tomohon': [1.3333, 124.8333], 'kudus': [-6.8050, 110.8400],
  'ketapang': [-1.8500, 109.9833], 'grobogan': [-7.0300, 110.9300],
  'cimahi': [-6.8722, 107.5420], 'agam': [-0.2500, 100.1667],
  'polman': [-3.1000, 119.1500], 'menggala': [-4.4667, 105.2333],
  'muaro bungo': [-1.5000, 101.8667], 'banggai kepulauan': [-1.7000, 123.5000],
  'majene': [-3.5500, 118.9667], 'simpenan': [-7.0167, 106.5500],
  'sengeti': [-1.6167, 103.5667], 'cikalongkulon': [-6.7167, 107.1500],
  'timor tengah utara': [-9.4500, 124.5000], 'ttu': [-9.4500, 124.5000],
  'enrekang': [-3.5667, 119.7833], 'sukabumi': [-6.9175, 106.9300],
  'manggarai barat': [-8.6500, 119.8833], 'aceh selatan': [-3.1500, 97.3500],
  'pemalang': [-6.9000, 109.3833],
  'cangkringan': [-7.6667, 110.4500], 'cilodong': [-6.4025, 106.7942],
  'cilimus': [-6.9833, 108.4833], 'koja': [-6.1149, 106.8787],
  'kalibata': [-6.2530, 106.8540], 'coblong': [-6.8950, 107.6100],
};

function extractLocation(title, desc) {
  const titleLower = (title || '').toLowerCase();
  const text = (title + ' ' + desc).toLowerCase();
  const sortedKeys = Object.keys(CITY_COORDS).sort((a, b) => b.length - a.length);

  // PRIORITY: Check title first — title locations are more reliable than body locations
  // (body may mention unrelated cities like "Bali" or "Pamekasan" in boilerplate)
  for (const city of sortedKeys) {
    if (titleLower.includes(city)) {
      const [lat, lng] = CITY_COORDS[city];
      const name = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return { city: name, lat, lng };
    }
  }

  // Fallback: check full text
  for (const city of sortedKeys) {
    if (text.includes(city)) {
      const [lat, lng] = CITY_COORDS[city];
      const name = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return { city: name, lat, lng };
    }
  }
  return { city: 'Indonesia', lat: null, lng: null };
}

/* ===== HTML HELPERS ===== */

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      },
      cf: { cacheTtl: 300, cacheEverything: true },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    if (err.name === 'AbortError') console.log('[FETCH] Timeout:', url);
    else console.log('[FETCH] Error:', url, err.message);
    return null;
  }
}

function extractDomain(url) { try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; } }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
const log = (msg) => console.log(msg);

function dateInRange(dateStr, startDate, endDate) {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= startDate && d <= endDate;
}

function generateQuarterlyWindows(startDate, endDate) {
  const quarters = [];
  const sd = new Date(startDate + 'T00:00:00Z');
  const ed = new Date(endDate + 'T00:00:00Z');

  let cursor = new Date(sd);
  const qStartMonth = Math.floor(cursor.getUTCMonth() / 3) * 3;
  cursor.setUTCMonth(qStartMonth, 1);

  while (cursor <= ed) {
    const qStart = new Date(cursor);
    const qEnd = new Date(cursor);
    qEnd.setUTCMonth(qEnd.getUTCMonth() + 3);
    qEnd.setUTCDate(0);

    const start = qStart < sd ? sd : qStart;
    const end = qEnd > ed ? ed : qEnd;

    const qNum = Math.floor(qStart.getUTCMonth() / 3) + 1;
    const year = qStart.getUTCFullYear();

    quarters.push({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      label: `Q${qNum} ${year}`,
    });

    cursor.setUTCMonth(cursor.getUTCMonth() + 3, 1);
  }

  return quarters;
}

function makeArticle(title, summary, url, source, dateText, extraDesc) {
  const combined = (title + ' ' + summary + ' ' + (extraDesc || '')).toLowerCase();
  const loc = extractLocation(title, summary + ' ' + (extraDesc || ''));
  return {
    title: title.slice(0, 300),
    summary: (summary || extraDesc || '').slice(0, 2000),
    url,
    source,
    date: parseRelativeDate(dateText) || TODAY(),
    tag: detectTag(combined),
    location: loc.city,
    lat: loc.lat,
    lng: loc.lng,
    victims: extractVictims(title, summary + ' ' + (extraDesc || '')),
  };
}

/* ===== ARTICLE BODY EXTRACTION ===== */

function extractArticleBody(html, source) {
  const patterns = {
    'Antara': [
      // wrap__article-detail-content post-content (main article content)
      /<div\s+class="wrap__article-detail-content post-content">([\s\S]*?)<\/div>\s*(?:<div\s+class="(?:widget|sidebar|related|wrap__article-detail-tag|mt-40)">|<\/article)/,
      // post-content class anywhere
      /<div\s+class="[^"]*post-content[^"]*">([\s\S]*?)<\/div>\s*(?:<div\s+class="(?:widget|sidebar|related|tag)">|<\/article)/,
      // Generic article__content
      /<div\s+class="article__content">([\s\S]*?)<\/div>\s*(?:<div|<\/article)/,
      // Paragraph extraction from article detail
      /<div\s+class="wrap__article-detail[^"]*">([\s\S]*?)<\/div>\s*(?:<div\s+class="(?:widget|sidebar)">|<\/article)/,
    ],
    'Kompas': [
      /<div\s+class="[^"]*read__content[^"]*">([\s\S]*?)<\/div>\s*(?:<div\s+class="[^"]*tag|<\/article)/,
      /<div\s+class="[^"]*article__body[^"]*">([\s\S]*?)<\/div>/,
      /<div\s+class="[^"]*content-article[^"]*">([\s\S]*?)<\/div>/,
    ],
    'Detik': [
      /<div\s+class="[^"]*detail__body[^"]*">([\s\S]*?)<\/div>/,
      /<div\s+class="[^"]*itp_bodycontent[^"]*">([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
    'Tempo': [
      /<div\s+class="[^"]*article-content[^"]*">([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
    'Liputan6': [
      /<div\s+class="[^"]*article-content-body[^"]*">([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
    'CNN Indonesia': [
      /<div\s+class="[^"]*detail_text[^"]*">([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
    'Tribun': [
      /<div\s+class="[^"]*article-body[^"]*">([\s\S]*?)<\/div>/,
      /<div\s+class="[^"]*txt-article[^"]*">([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
    'Tirto': [
      /<div\s+class="[^"]*article-body[^"]*">([\s\S]*?)<\/div>/,
      /<div\s+class="[^"]*art-content[^"]*">([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
    'Suara': [
      /<div\s+class="[^"]*detail-desc[^"]*">([\s\S]*?)<\/div>/,
      /<div\s+class="[^"]*read__content[^"]*">([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
    'Okezone': [
      /<div\s+class="[^"]*read__content[^"]*">([\s\S]*?)<\/div>/,
      /<div\s+class="[^"]*detail-content[^"]*">([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
    'Sindonews': [
      /<div\s+class="[^"]*detail-desc[^"]*">([\s\S]*?)<\/div>/,
      /<div\s+class="[^"]*read__content[^"]*">([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
    'Kumparan': [
      /<div\s+class="[^"]*qa-story-content[^"]*">([\s\S]*?)<\/div>/,
      /<div\s+data-qa-id="story-body"[^>]*>([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
    'Republika': [
      /<div\s+class="[^"]*read-artikel[^"]*">([\s\S]*?)<\/div>/,
      /<div\s+class="[^"]*artikel-body[^"]*">([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
    'Viva': [
      /<div\s+class="[^"]*news-content[^"]*">([\s\S]*?)<\/div>/,
      /<div\s+class="[^"]*detail-content[^"]*">([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
    'Merdeka': [
      /<div\s+class="[^"]*mdk-body-content[^"]*">([\s\S]*?)<\/div>/,
      /<div\s+class="[^"]*col-md-8[^"]*">([\s\S]*?)<\/div>/,
      /<article[^>]*>([\s\S]*?)<\/article>/,
    ],
  };

  const sourcePatterns = patterns[source] || [];
  
  for (const pattern of sourcePatterns) {
    const match = html.match(pattern);
    if (match) {
      const text = match[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 100) return decodeEntities(text);
    }
  }

  // Generic fallback: extract all paragraph text
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(html)) !== null) {
    const text = pMatch[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 30 && !text.includes('Copyright') && !text.includes('cookie') && !text.includes('Terms of Use')) {
      paragraphs.push(text);
    }
  }
  return paragraphs.length > 0 ? decodeEntities(paragraphs.join(' ')) : '';
}

/* ===== ARTICLE PAGE FETCHERS ===== */

/**
 * Fetch Kompas article page and extract title + content
 */
async function fetchKompasArticle(url) {
  const html = await fetchHTML(url);
  if (!html) return null;

  // Extract title from <title> tag or h1
  let title = '';
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*\|\s*Kompas\.com.*$/i, '').trim());
  
  // Extract content from read__content div
  let content = extractArticleBody(html, 'Kompas');
  
  // Extract date
  let dateText = null;
  const dateMatch = html.match(/<div\s+class="[^"]*read__time[^"]*">([^<]+)/);
  if (dateMatch) dateText = dateMatch[1].trim();
  if (!dateText) {
    const isoDateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoDateMatch) dateText = isoDateMatch[1];
  }

  if (!title && !content) return null;
  
  const combined = (title + ' ' + content).toLowerCase();
  const loc = extractLocation(title, content);
  
  return {
    title: (title || url.split('/').pop().replace(/-/g, ' ')).slice(0, 300),
    summary: content.slice(0, 3000),
    url,
    source: 'Kompas',
    date: parseRelativeDate(dateText) || TODAY(),
    tag: detectTag(combined),
    location: loc.city,
    lat: loc.lat,
    lng: loc.lng,
    victims: extractVictims(title, content),
  };
}

/**
 * Fetch Antara article page and extract content
 */
async function fetchAntaraArticle(url) {
  const html = await fetchHTML(url);
  if (!html) return null;

  let title = '';
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*Antara.*$/i, '').trim());

  let content = extractArticleBody(html, 'Antara');
  
  let dateText = null;
  const dateMatch = html.match(/<span\s+class="[^"]*text-dark[^"]*">([^<]+)/);
  if (dateMatch) dateText = dateMatch[1].trim();

  if (!title && !content) return null;

  const combined = (title + ' ' + content).toLowerCase();
  const loc = extractLocation(title, content);

  return {
    title: title.slice(0, 300),
    summary: content.slice(0, 3000),
    url,
    source: 'Antara',
    date: parseRelativeDate(dateText) || TODAY(),
    tag: detectTag(combined),
    location: loc.city,
    lat: loc.lat,
    lng: loc.lng,
    victims: extractVictims(title, content),
  };
}

/* ===== KOMPAS — URL EXTRACTION + ARTICLE FETCHING ===== */

async function extractKompasUrls(query, opts = {}) {
  const urls = [];
  const seen = new Set();
  
  for (let page = 1; page <= KOMPAS_MAX_PAGES; page++) {
    try {
      let searchUrl = `https://search.kompas.com/search/?q=${encodeURIComponent(query)}&sort=date${page > 1 ? '&page=' + page : ''}`;
      if (opts.startDate && opts.endDate) {
        searchUrl += `&date=${opts.startDate},${opts.endDate}`;
      }
      const html = await fetchHTML(searchUrl);
      if (!html) break;

      // Extract /read/ URLs from Kompas search HTML
      const urlRegex = /href="(https?:\/\/[^"]*kompas\.com\/read\/[^"]+)"/g;
      let m;
      while ((m = urlRegex.exec(html)) !== null) {
        const url = m[1].split('?')[0].split('#')[0];
        if (!seen.has(url)) {
          seen.add(url);
          urls.push(url);
        }
      }

      if (urls.length < 5) break; // Not enough results, stop paginating
      await delay(400);
    } catch (err) {
      console.warn(`[Kompas URLs] page ${page}:`, err.message);
      break;
    }
  }
  
  return urls;
}

/* ===== DETIK — SEARCH + ARTICLE FETCHING ===== */

async function scrapeDetikSearch(query, opts = {}) {
  const articles = [];
  let searchUrl = `https://www.detik.com/search/searchall?query=${encodeURIComponent(query)}&sortby=time`;
  if (opts.startDate && opts.endDate) {
    searchUrl += `&fromdate=${opts.startDate}&todate=${opts.endDate}`;
  }
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  // Extract article URLs from Detik search
  const urlRegex = /href="(https?:\/\/(?:www\.)?detik\.com\/(?:news|edu|finance|hot|inet|oto|sport|travel|health|food|wolipop|jabar|jateng|jatim|bali|sumut|sulsel)\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url)) {
      seen.add(url);
      // Fetch article page for title + content
      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;
        
        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*detik.*$/i, '').trim());
        
        if (!title || title.length < 10) continue;
        
        const content = extractArticleBody(articleHtml, 'Detik');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);
        
        // Extract date
        let dateText = null;
        const dateMatch = articleHtml.match(/<div\s+class="[^"]*date[^"]*">([^<]+)/) || 
                          articleHtml.match(/<time[^>]*>([^<]+)<\/time>/);
        if (dateMatch) dateText = dateMatch[1].trim();
        
        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'Detik',
          date: parseRelativeDate(dateText) || TODAY(),
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });
        
        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }
  
  return articles;
}

/* ===== TEMPO — SEARCH + ARTICLE FETCHING ===== */

async function scrapeTempoSearch(query, opts = {}) {
  const articles = [];
  let searchUrl = `https://www.tempo.co/search?q=${encodeURIComponent(query)}`;
  if (opts.startDate && opts.endDate) {
    searchUrl += `&datestart=${opts.startDate}&dateend=${opts.endDate}`;
  }
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  // Extract article URLs from Tempo search
  const urlRegex = /href="(https?:\/\/(?:www\.)?tempo\.co\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url) && !url.includes('/tag/') && !url.includes('/topic/') && !url.includes('/search')) {
      seen.add(url);
      
      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;
        
        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*Tempo\.co.*$/i, '').trim());
        
        if (!title || title.length < 10) continue;
        
        const content = extractArticleBody(articleHtml, 'Tempo');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);
        
        let dateText = null;
        const dateMatch = articleHtml.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        if (dateMatch) dateText = dateMatch[1];
        
        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'Tempo',
          date: parseRelativeDate(dateText) || TODAY(),
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });
        
        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }
  
  return articles;
}

/* ===== LIPUTAN6 — SEARCH + ARTICLE FETCHING ===== */

async function scrapeLiputan6Search(query, opts = {}) {
  const articles = [];
  const searchUrl = `https://www.liputan6.com/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  const urlRegex = /href="(https?:\/\/(?:www\.)?liputan6\.com\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url) && !url.includes('/tag/') && !url.includes('/topic/')) {
      seen.add(url);
      
      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;
        
        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*Liputan6.*$/i, '').trim());
        
        if (!title || title.length < 10) continue;
        
        const content = extractArticleBody(articleHtml, 'Liputan6');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);

        let dateText = null;
        const dateMatch = articleHtml.match(/<time[^>]*>([^<]+)<\/time>/) || articleHtml.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        if (dateMatch) dateText = dateMatch[1].trim();
        const articleDate = parseRelativeDate(dateText) || TODAY();

        if (opts.startDate && opts.endDate && !dateInRange(articleDate, opts.startDate, opts.endDate)) continue;

        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'Liputan6',
          date: articleDate,
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });
        
        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }
  
  return articles;
}

/* ===== CNN INDONESIA — SEARCH + ARTICLE FETCHING ===== */

async function scrapeCNNIndonesiaSearch(query, opts = {}) {
  const articles = [];
  let searchUrl = `https://www.cnnindonesia.com/search?query=${encodeURIComponent(query)}&sort=date`;
  if (opts.startDate && opts.endDate) {
    searchUrl += `&date_from=${opts.startDate}&date_to=${opts.endDate}`;
  }
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  const urlRegex = /href="(https?:\/\/(?:www\.)?cnnindonesia\.com\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url) && !url.includes('/tag/') && !url.includes('/topic/') && !url.includes('/search')) {
      seen.add(url);
      
      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;
        
        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*CNN.*$/i, '').trim());
        
        if (!title || title.length < 10) continue;
        
        const content = extractArticleBody(articleHtml, 'CNN Indonesia');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);
        
        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'CNN Indonesia',
          date: TODAY(),
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });
        
        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }
  
  return articles;
}

/* ===== TRIBUN — SEARCH + ARTICLE FETCHING ===== */

async function scrapeTribunSearch(query, opts = {}) {
  const articles = [];
  const searchUrl = `https://www.tribunnews.com/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  const urlRegex = /href="(https?:\/\/(?:[\w-]+\.)?tribunnews\.com\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url)) {
      seen.add(url);

      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;

        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*Tribunnews.*$/i, '').replace(/\s*\|\s*Tribun.*$/i, '').trim());

        if (!title || title.length < 10) continue;

        const content = extractArticleBody(articleHtml, 'Tribun');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);

        let dateText = null;
        const dateMatch = articleHtml.match(/<time[^>]*>([^<]+)<\/time>/) || articleHtml.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        if (dateMatch) dateText = dateMatch[1].trim();
        const articleDate = parseRelativeDate(dateText) || TODAY();

        if (opts.startDate && opts.endDate && !dateInRange(articleDate, opts.startDate, opts.endDate)) continue;

        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'Tribun',
          date: articleDate,
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });

        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }

  return articles;
}

/* ===== TIRTO — SEARCH + ARTICLE FETCHING ===== */

async function scrapeTirtoSearch(query, opts = {}) {
  const articles = [];
  const searchUrl = `https://tirto.id/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  const urlRegex = /href="(https?:\/\/(?:www\.)?tirto\.id\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url) && !url.includes('/search') && !url.includes('/tag/')) {
      seen.add(url);

      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;

        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*Tirto\.id.*$/i, '').replace(/\s*\|\s*Tirto.*$/i, '').trim());

        if (!title || title.length < 10) continue;

        const content = extractArticleBody(articleHtml, 'Tirto');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);

        let dateText = null;
        const dateMatch = articleHtml.match(/<time[^>]*>([^<]+)<\/time>/) || articleHtml.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        if (dateMatch) dateText = dateMatch[1].trim();
        const articleDate = parseRelativeDate(dateText) || TODAY();

        if (opts.startDate && opts.endDate && !dateInRange(articleDate, opts.startDate, opts.endDate)) continue;

        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'Tirto',
          date: articleDate,
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });

        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }

  return articles;
}

/* ===== SUARA — SEARCH + ARTICLE FETCHING ===== */

async function scrapeSuaraSearch(query, opts = {}) {
  const articles = [];
  const searchUrl = `https://www.suara.com/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  const urlRegex = /href="(https?:\/\/(?:www\.)?suara\.com\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url) && !url.includes('/tag/') && !url.includes('/search') && !url.includes('/topic/')) {
      seen.add(url);

      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;

        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*Suara\.com.*$/i, '').trim());

        if (!title || title.length < 10) continue;

        const content = extractArticleBody(articleHtml, 'Suara');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);

        let dateText = null;
        const dateMatch = articleHtml.match(/<time[^>]*>([^<]+)<\/time>/) || articleHtml.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        if (dateMatch) dateText = dateMatch[1].trim();
        const articleDate = parseRelativeDate(dateText) || TODAY();

        if (opts.startDate && opts.endDate && !dateInRange(articleDate, opts.startDate, opts.endDate)) continue;

        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'Suara',
          date: articleDate,
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });

        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }

  return articles;
}

/* ===== OKEZONE — SEARCH + ARTICLE FETCHING ===== */

async function scrapeOkezoneSearch(query, opts = {}) {
  const articles = [];
  const searchUrl = `https://search.okezone.com/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  const urlRegex = /href="(https?:\/\/(?:www\.)?okezone\.com\/read\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url)) {
      seen.add(url);

      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;

        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*Okezone.*$/i, '').trim());

        if (!title || title.length < 10) continue;

        const content = extractArticleBody(articleHtml, 'Okezone');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);

        let dateText = null;
        const dateMatch = articleHtml.match(/<time[^>]*>([^<]+)<\/time>/) || articleHtml.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        if (dateMatch) dateText = dateMatch[1].trim();
        const articleDate = parseRelativeDate(dateText) || TODAY();

        if (opts.startDate && opts.endDate && !dateInRange(articleDate, opts.startDate, opts.endDate)) continue;

        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'Okezone',
          date: articleDate,
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });

        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }

  return articles;
}

/* ===== SINDONEWS — SEARCH + ARTICLE FETCHING ===== */

async function scrapeSindoSearch(query, opts = {}) {
  const articles = [];
  const searchUrl = `https://search.sindonews.com/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  const urlRegex = /href="(https?:\/\/(?:www\.)?sindonews\.com\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url) && !url.includes('/tag/') && !url.includes('/search')) {
      seen.add(url);

      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;

        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*SINDOnews.*$/i, '').trim());

        if (!title || title.length < 10) continue;

        const content = extractArticleBody(articleHtml, 'Sindonews');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);

        let dateText = null;
        const dateMatch = articleHtml.match(/<time[^>]*>([^<]+)<\/time>/) || articleHtml.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        if (dateMatch) dateText = dateMatch[1].trim();
        const articleDate = parseRelativeDate(dateText) || TODAY();

        if (opts.startDate && opts.endDate && !dateInRange(articleDate, opts.startDate, opts.endDate)) continue;

        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'Sindonews',
          date: articleDate,
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });

        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }

  return articles;
}

/* ===== KUMPARAN — SEARCH + ARTICLE FETCHING ===== */

async function scrapeKumparanSearch(query, opts = {}) {
  const articles = [];
  const searchUrl = `https://kumparan.com/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  const urlRegex = /href="(https?:\/\/(?:www\.)?kumparan\.com\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url) && !url.includes('/search') && !url.includes('/tag/') && !url.includes('/topic/')) {
      seen.add(url);

      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;

        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*\|\s*Kumparan.*$/i, '').trim());

        if (!title || title.length < 10) continue;

        const content = extractArticleBody(articleHtml, 'Kumparan');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);

        let dateText = null;
        const dateMatch = articleHtml.match(/<time[^>]*>([^<]+)<\/time>/) || articleHtml.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        if (dateMatch) dateText = dateMatch[1].trim();
        const articleDate = parseRelativeDate(dateText) || TODAY();

        if (opts.startDate && opts.endDate && !dateInRange(articleDate, opts.startDate, opts.endDate)) continue;

        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'Kumparan',
          date: articleDate,
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });

        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }

  return articles;
}

/* ===== REPUBLIKA — SEARCH + ARTICLE FETCHING ===== */

async function scrapeRepublikaSearch(query, opts = {}) {
  const articles = [];
  const searchUrl = `https://republika.co.id/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  const urlRegex = /href="(https?:\/\/(?:www\.)?republika\.co\.id\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url) && !url.includes('/search') && !url.includes('/tag/')) {
      seen.add(url);

      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;

        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*Republika.*$/i, '').trim());

        if (!title || title.length < 10) continue;

        const content = extractArticleBody(articleHtml, 'Republika');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);

        let dateText = null;
        const dateMatch = articleHtml.match(/<time[^>]*>([^<]+)<\/time>/) || articleHtml.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        if (dateMatch) dateText = dateMatch[1].trim();
        const articleDate = parseRelativeDate(dateText) || TODAY();

        if (opts.startDate && opts.endDate && !dateInRange(articleDate, opts.startDate, opts.endDate)) continue;

        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'Republika',
          date: articleDate,
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });

        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }

  return articles;
}

/* ===== VIVA — SEARCH + ARTICLE FETCHING ===== */

async function scrapeVivaSearch(query, opts = {}) {
  const articles = [];
  const searchUrl = `https://www.viva.co.id/search?q=${encodeURIComponent(query)}`;
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  const urlRegex = /href="(https?:\/\/(?:www\.)?viva\.co\.id\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url) && !url.includes('/search') && !url.includes('/tag/')) {
      seen.add(url);

      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;

        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*VIVA.*$/i, '').trim());

        if (!title || title.length < 10) continue;

        const content = extractArticleBody(articleHtml, 'Viva');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);

        let dateText = null;
        const dateMatch = articleHtml.match(/<time[^>]*>([^<]+)<\/time>/) || articleHtml.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        if (dateMatch) dateText = dateMatch[1].trim();
        const articleDate = parseRelativeDate(dateText) || TODAY();

        if (opts.startDate && opts.endDate && !dateInRange(articleDate, opts.startDate, opts.endDate)) continue;

        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'Viva',
          date: articleDate,
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });

        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }

  return articles;
}

/* ===== MERDEKA — SEARCH + ARTICLE FETCHING ===== */

async function scrapeMerdekaSearch(query, opts = {}) {
  const articles = [];
  const searchUrl = `https://www.merdeka.com/search/?q=${encodeURIComponent(query)}`;
  const html = await fetchHTML(searchUrl);
  if (!html) return articles;

  const urlRegex = /href="(https?:\/\/(?:www\.)?merdeka\.com\/[^"]+)"/g;
  const seen = new Set();
  let m;
  while ((m = urlRegex.exec(html)) !== null) {
    const url = m[1].split('?')[0].split('#')[0];
    if (!seen.has(url) && !url.includes('/search') && !url.includes('/tag/')) {
      seen.add(url);

      try {
        const articleHtml = await fetchHTML(url);
        if (!articleHtml) continue;

        let title = '';
        const titleMatch = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i) || articleHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) title = decodeEntities(titleMatch[1].replace(/\s*-\s*Merdeka\.com.*$/i, '').trim());

        if (!title || title.length < 10) continue;

        const content = extractArticleBody(articleHtml, 'Merdeka');
        const combined = (title + ' ' + content).toLowerCase();
        const loc = extractLocation(title, content);

        let dateText = null;
        const dateMatch = articleHtml.match(/<time[^>]*>([^<]+)<\/time>/) || articleHtml.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        if (dateMatch) dateText = dateMatch[1].trim();
        const articleDate = parseRelativeDate(dateText) || TODAY();

        if (opts.startDate && opts.endDate && !dateInRange(articleDate, opts.startDate, opts.endDate)) continue;

        articles.push({
          title: title.slice(0, 300),
          summary: content.slice(0, 3000),
          url,
          source: 'Merdeka',
          date: articleDate,
          tag: detectTag(combined),
          location: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          victims: extractVictims(title, content),
        });

        await delay(400);
      } catch (err) { /* skip failed article */ }
    }
  }

  return articles;
}

/* ===== ANTARA — SEARCH + ARTICLE PAGE FETCHING ===== */

// Global counter to limit article page fetches across all queries
let _articleFetches = 0;

async function scrapeAntaraSearch(url, fetchContent = true, opts = {}) {
  const articles = [];
  const html = await fetchHTML(url);
  if (!html) return articles;
  
  // Collect URLs and metadata from search results
  const searchResults = [];
  const regex = /<div\s+class="card__post\s+card__post-list\s+card__post__transition\s+mt-30">([\s\S]*?)(?=<div\s+class="card__post\s+card__post-list\s+card__post__transition\s+mt-30">|<div\s+class="pagination-area">|<\/main>)/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const chunk = m[1];
    const urlMatch = chunk.match(/<h2\s+class="h5">\s*<a\s+href="(https:\/\/www\.antaranews\.com\/[^"]+)"/);
    if (!urlMatch) continue;
    const titleMatch = chunk.match(/<h2\s+class="h5">\s*<a\s+href="[^"]+"\s+title="([^"]+)"/);
    const title = titleMatch ? decodeEntities(titleMatch[1]) : '';
    const dateMatch = chunk.match(/<span\s+class="text-dark\s+text-capitalize">([^<]+)<\/span>/);
    const descMatch = chunk.match(/<div\s+class="card__post__author-info[\s\S]*?<\/div>\s*<p>([\s\S]*?)<\/p>/);
    const desc = descMatch ? decodeEntities(descMatch[1].replace(/<[^>]+>/g, '').trim()) : '';
    const parsedDate = parseRelativeDate(dateMatch?.[1]?.trim());
    if (parsedDate && parsedDate < MIN_DATE) continue;
    if (opts.startDate && opts.endDate && parsedDate && !dateInRange(parsedDate, opts.startDate, opts.endDate)) continue;
    searchResults.push({ url: urlMatch[1], title, desc, dateText: dateMatch?.[1]?.trim() });
  }

  // For keracunan-related articles, fetch full article page for victim extraction (if under limit)
  for (const result of searchResults) {
    const combined = (result.title + ' ' + result.desc).toLowerCase();
    const isKeracunan = combined.includes('keracunan') || combined.includes('korban') || 
                        combined.includes('dirawat') || combined.includes('racun') ||
                        combined.includes('tewas') || combined.includes('meninggal');
    
    if (fetchContent && isKeracunan && _articleFetches < MAX_ARTICLE_FETCHES) {
      _articleFetches++;
      try {
        const articleData = await fetchAntaraArticle(result.url);
        if (articleData) {
          // Merge with search result data
          if (!articleData.title && result.title) articleData.title = result.title;
          if (!articleData.date || articleData.date === TODAY()) articleData.date = parseRelativeDate(result.dateText) || TODAY();
          articles.push(articleData);
          await delay(300);
          continue;
        }
      } catch (err) {
        console.warn(`[Antara] Article fetch error: ${err.message}`);
      }
    }
    
    // Fallback: use search result data only
    articles.push(makeArticle(result.title, result.desc, result.url, 'Antara', result.dateText));
  }
  
  return articles;
}

/* ===== DATE-RANGE ARCHIVE SEARCH ===== */

const ARCHIVE_QUERIES = [
  'keracunan MBG',
  'keracunan makan bergizi gratis',
  'keracunan MBG siswa',
  'keracunan makanan sekolah',
];

export async function scrapeDateRangeArchive(env, startDate, endDate) {
  const allArticles = [];
  const seen = new Set();
  _articleFetches = 0;

  // 6 targeted quarters — only periods likely to have MBG incidents
  const quarters = [
    { start: '2024-10-01', end: '2024-12-31', label: 'Q4 2024 (pilot)' },
    { start: '2025-01-01', end: '2025-03-31', label: 'Q1 2025 (launch)' },
    { start: '2025-04-01', end: '2025-06-30', label: 'Q2 2025' },
    { start: '2025-07-01', end: '2025-09-30', label: 'Q3 2025' },
    { start: '2025-10-01', end: '2025-12-31', label: 'Q4 2025' },
    { start: '2026-01-01', end: '2026-03-31', label: 'Q1 2026' },
    { start: '2026-04-01', end: '2026-06-30', label: 'Q2 2026' },
  ];

  // Only sources that support date-range URL parameters
  for (const quarter of quarters) {
    log(`[Archive] Searching ${quarter.label}: ${quarter.start} to ${quarter.end}`);

    for (const query of ARCHIVE_QUERIES) {
      const qOpts = { startDate: quarter.start, endDate: quarter.end };

      // Antara — search URL with start/end params
      try {
        const antaraUrl = `https://www.antaranews.com/search?q=${encodeURIComponent(query)}&start=${quarter.start}&end=${quarter.end}`;
        const articles = await scrapeAntaraSearch(antaraUrl, true, qOpts);
        if (articles.length) log(`[Archive][Antara] "${query}" ${quarter.label}: ${articles.length}`);
        for (const a of articles) {
          if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
        }
        await delay(300);
      } catch (err) { console.warn(`[Archive][Antara] "${query}" ${quarter.label}:`, err.message); }

      // Kompas — date param in URL
      try {
        const urls = await extractKompasUrls(query, qOpts);
        if (urls.length) log(`[Archive][Kompas] "${query}" ${quarter.label}: ${urls.length} URLs`);
        for (const url of urls.slice(0, 5)) {
          if (seen.has(url)) continue;
          try {
            const article = await fetchKompasArticle(url);
            if (article && article.title && dateInRange(article.date, quarter.start, quarter.end)) {
              seen.add(url);
              allArticles.push(article);
            }
            await delay(300);
          } catch (err) { /* skip */ }
        }
        await delay(300);
      } catch (err) { console.warn(`[Archive][Kompas] "${query}" ${quarter.label}:`, err.message); }

      // Detik — fromdate/todate params
      try {
        const articles = await scrapeDetikSearch(query, qOpts);
        if (articles.length) log(`[Archive][Detik] "${query}" ${quarter.label}: ${articles.length}`);
        for (const a of articles) {
          if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
        }
        await delay(300);
      } catch (err) { console.warn(`[Archive][Detik] "${query}" ${quarter.label}:`, err.message); }

      // Tempo — datestart/dateend params
      try {
        const articles = await scrapeTempoSearch(query, qOpts);
        if (articles.length) log(`[Archive][Tempo] "${query}" ${quarter.label}: ${articles.length}`);
        for (const a of articles) {
          if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
        }
        await delay(300);
      } catch (err) { console.warn(`[Archive][Tempo] "${query}" ${quarter.label}:`, err.message); }

      // CNN Indonesia — date_from/date_to params
      try {
        const articles = await scrapeCNNIndonesiaSearch(query, qOpts);
        if (articles.length) log(`[Archive][CNN Indonesia] "${query}" ${quarter.label}: ${articles.length}`);
        for (const a of articles) {
          if (!seen.has(a.url)) { seen.add(a.url); allArticles.push(a); }
        }
        await delay(300);
      } catch (err) { console.warn(`[Archive][CNN Indonesia] "${query}" ${quarter.label}:`, err.message); }

      await delay(300);
    }
  }

  log(`[Archive] Total raw: ${allArticles.length} articles from all quarters`);

  const unique = allArticles.filter(a => {
    if (!a.url || !a.url.startsWith('http')) return false;
    if (!isIndonesianLocal(a.url)) return false;
    if (!isRelevantKeracunan(a.title, a.summary)) return false;
    return true;
  });

  for (const a of unique) {
    a.date = validateDate(a.date);
  }

  log(`[Archive] Final: ${unique.length} keracunan MBG articles from date range ${startDate} to ${endDate}`);
  return unique;
}
