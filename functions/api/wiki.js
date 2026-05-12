/**
 * GET /api/wiki
 * Fetch MBG poisoning incidents from Indonesian Wikipedia and store in D1.
 * Uses MediaWiki API (action=parse, prop=text) to get the incident table.
 */

const WIKI_API = 'https://id.wikipedia.org/w/api.php';
const WIKI_PAGE = 'Daftar_kasus_keracunan_massal_program_Makan_Bergizi_Gratis';

// Indonesian city → (lat, lng) - Expanded coordinates
const CITY_COORDS = {
  // Province defaults
  'jakarta': [-6.2088, 106.8456], 'dki jakarta': [-6.2088, 106.8456],
  'jawa timur': [-7.5, 112.5], 'jatim': [-7.5, 112.5],
  'jawa tengah': [-7.15, 110.14], 'jateng': [-7.15, 110.14],
  'jawa barat': [-6.9, 107.6], 'jabar': [-6.9, 107.6],
  'di yogyakarta': [-7.7955, 110.3695], 'yogyakarta': [-7.7972, 110.3615],
  'jogja': [-7.7972, 110.3615],
  'banten': [-6.12, 106.15], 'serang': [-6.1156, 106.1842],
  'tangerang': [-6.1785, 106.6298], 'cilegon': [-5.9826, 106.0133],
  'lebak': [-6.56, 106.22], 'pandeglang': [-6.36, 105.6],
  'sumatera utara': [3.6, 98.7], 'sumut': [3.6, 98.7],
  'sumatera barat': [-0.9, 100.4], 'sumbar': [-0.9, 100.4],
  'riau': [0.5, 101.5], 'pekanbaru': [0.5071, 101.4478],
  'jambi': [-1.6, 103.6],
  'sumatera selatan': [-3.1, 104.0], 'sumsel': [-2.9908, 104.7558],
  'palembang': [-2.9908, 104.7558],
  'bengkulu': [-3.8, 102.3],
  'lampung': [-4.9956, 105.2836], 'bandar lampung': [-5.4299, 105.262],
  'lampung selatan': [-5.6, 105.4], 'lampung tengah': [-4.95, 105.2],
  'lampung timur': [-4.8, 105.7], 'lampung barat': [-5.0, 103.8],
  'bali': [-8.34, 115.09], 'denpasar': [-8.6525, 115.2192],
  'nusa tenggara barat': [-8.65, 117.4], 'ntb': [-8.65, 117.4],
  'nusa tenggara timur': [-8.75, 121.5], 'ntt': [-8.75, 121.5],
  'kalimantan barat': [0.0, 109.3], 'pontianak': [-0.03, 109.33],
  'kalimantan tengah': [-1.5, 113.0], 'palangka raya': [-2.2138, 113.9213],
  'kalimantan selatan': [-3.1, 115.2], 'banjarmasin': [-3.318, 114.5912],
  'kalimantan timur': [1.0, 116.0], 'samarinda': [-0.4943, 117.1488],
  'kalimantan utara': [3.0, 117.0],
  'sulawesi selatan': [-4.0, 120.0], 'makassar': [-5.1427, 119.4125],
  'sulawesi tengah': [-1.0, 121.0], 'palu': [-0.9025, 119.87],
  'sulawesi utara': [1.0, 124.8], 'manado': [1.4741, 124.8412],
  'sulawesi tenggara': [-4.0, 122.5], 'kendari': [-3.9865, 122.5146],
  'sulawesi barat': [-2.8, 119.4],
  'gorontalo': [0.5, 123.0],
  'maluku': [-3.2, 129.5], 'ambon': [-3.695, 128.181],
  'maluku utara': [1.5, 127.8],
  'papua': [-4.0, 136.0], 'jayapura': [-2.53, 140.72],
  // Cities
  'bandung': [-6.9175, 107.6191], 'bandung barat': [-6.93, 107.35],
  'bogor': [-6.6127, 106.8], 'sukoharjo': [-7.7149, 110.8258],
  'wonogiri': [-7.867, 110.907], 'boyolali': [-7.5321, 110.5274],
  'klaten': [-7.7055, 110.5911], 'sleman': [-7.7158, 110.3554],
  'bantul': [-7.8885, 110.3275], 'gunung kidul': [-7.9997, 110.5985],
  'kulon progo': [-7.6667, 110.15],
  'semarang': [-6.9667, 110.4204], 'kudus': [-6.8042, 110.8416],
  'pekalongan': [-6.8886, 109.6755], 'tegal': [-6.8741, 109.1402],
  'cirebon': [-6.7328, 108.5527], 'gresik': [-7.1583, 112.6512],
  'surabaya': [-7.2571, 112.7521], 'sidoarjo': [-7.4542, 112.7178],
  'mojokerto': [-7.5215, 112.4188], 'kediri': [-7.8483, 112.0169],
  'blitar': [-8.0892, 112.0489], 'malang': [-7.9784, 112.6311],
  'pasuruan': [-7.76, 112.9078], 'probolinggo': [-7.7551, 113.1547],
  'banyuwangi': [-8.2192, 114.3695], 'situbondo': [-7.7069, 114.0104],
  'jember': [-8.1853, 113.6825], 'lumajang': [-8.1321, 113.2214],
  'ponorogo': [-7.8672, 111.4719], 'nganjuk': [-7.6038, 111.9017],
  'tuban': [-6.898, 112.0486], 'lamongan': [-7.1176, 112.4173],
  'cianjur': [-6.8176, 107.1457], 'subang': [-6.5597, 107.7593],
  'karawang': [-6.3064, 107.3366], 'purwakarta': [-6.5569, 107.4432],
  'garut': [-7.2181, 107.9036], 'tasikmalaya': [-7.3267, 108.2243],
  'ciamis': [-7.32, 108.35], 'kuningan': [-6.97, 108.5],
  'majalengka': [-6.83, 108.2], 'sumedang': [-6.83, 107.92],
  'indramayu': [-6.35, 108.05], 'bekasi': [-6.2347, 106.9928],
  'depok': [-6.4024, 106.7942],
  // Sumatra Utara
  'medan': [3.5952, 98.6722], 'deli serdang': [3.5, 98.7],
  'langkat': [3.9, 98.3], 'serdang bedagai': [3.5, 99.0],
  'karo': [3.1, 98.5], 'simalungun': [2.9, 99.0],
  'dairi': [2.5, 98.1], 'humbang': [2.5, 98.5],
  'tapanuli tengah': [1.8, 98.8], 'tapanuli utara': [2.0, 98.8],
  'nias': [1.1, 97.6],
  // Toba/Samosir
  'toba': [2.3, 99.15], 'samosir': [2.5, 98.9],
  'labuhan batu': [2.0, 100.0], 'labuhanbatu': [2.0, 100.0],
  'labuhanbatu utara': [2.0, 99.8], 'labuhanbatu selatan': [2.0, 100.2],
  'asahan': [2.0, 99.5], 'tanjung balai': [3.0, 99.2],
  'pematang siantar': [2.96, 99.07], 'pematangsiantar': [2.96, 99.07],
  'binjai': [3.6, 98.5], 'sibolga': [1.74, 98.78],
  'padang sidempuan': [1.4, 99.3], 'gunungsitoli': [1.3, 97.6],
  // NTT
  'kupang': [-10.1774, 123.6635], 'flores': [-8.65, 121.3],
  'sikka': [-8.6, 122.3], 'ende': [-8.6, 121.6],
  'sumba': [-9.6, 119.9], 'malaka': [-9.6, 124.9],
  // NT
  'mataram': [-8.5833, 116.1167], 'lombok': [-8.5, 116.5],
  'lombok barat': [-8.65, 116.1], 'lombok timur': [-8.5, 116.5],
  'sumbawa': [-8.7, 117.5], 'bima': [-8.5, 118.7],
  // Kalimantan
  'tabalong': [-1.9, 115.7], 'tanah bumbu': [-2.9, 115.9],
  'balikpapan': [-1.2671, 116.8286], 'bontang': [1.0, 117.5],
  // Sulawesi
  'parepare': [-3.8, 119.6], 'palopo': [-3.0, 120.2],
  'bombana': [-4.5, 122.0], 'buton': [-5.5, 122.6],
  'muna': [-4.9, 122.5], 'bau-bau': [-5.5, 122.6],
  'kolaka': [-4.2, 121.6], 'donggala': [-0.7, 119.7],
  'bitung': [1.4, 125.0], 'tomohon': [1.3, 124.8],
};

function geoLookup(text) {
  if (!text) return [null, null];
  const t = text.toLowerCase();
  
  // First try exact matches
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (t.includes(city)) return coords;
  }
  
  // Try splitting by comma
  const parts = text.split(/[,\/]/);
  for (const part of parts) {
    const p = part.toLowerCase().trim();
    for (const [city, coords] of Object.entries(CITY_COORDS)) {
      if (p.includes(city)) return coords;
    }
  }
  
  // Last resort - try the last part (usually province)
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim().toLowerCase();
    for (const [city, coords] of Object.entries(CITY_COORDS)) {
      if (lastPart.includes(city)) return coords;
    }
  }
  
  return [null, null];
}

function parseNum(s) {
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function parseDate(raw) {
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const indMonths = {
    'januari':'01','februari':'02','maret':'03','april':'04',
    'mei':'05','juni':'06','juli':'07','agustus':'08',
    'september':'09','oktober':'10','november':'11','desember':'12',
  };
  const m = raw.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (m) {
    const month = indMonths[m[2].toLowerCase()];
    if (month) return `${m[3]}-${month}-${m[1].padStart(2,'0')}`;
  }
  return raw.slice(0, 10);
}

async function scrapeWikiTable() {
  console.log('[WIKI] Fetching Wikipedia via API...');

  const apiUrl = `${WIKI_API}?action=parse&page=${WIKI_PAGE}&prop=text&format=json`;
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'mbg-monitor-api/1.0' },
  });

  if (!res.ok) throw new Error(`MediaWiki API failed: ${res.status}`);

  const data = await res.json();
  if (!data.parse?.text?.['*']) throw new Error('No HTML content');

  const html = data.parse.text['*'];

  // Parse wikitable from HTML
  const tableMatch = html.match(/<table[^>]*class="wikitable"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) throw new Error('No wikitable found in HTML');

  const tableHtml = tableMatch[1];
  const rowMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  if (!rowMatches) throw new Error('No table rows');

  console.log(`[WIKI] Processing ${rowMatches.length} rows from HTML`);

  const incidents = [];

  // Skip header row
  for (const rowHtml of rowMatches.slice(1)) {
    const cellMatches = rowHtml.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g);
    if (!cellMatches || cellMatches.length < 6) continue;

    const cells = cellMatches.slice(0, 7).map(c => {
      return c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    });

    const date = parseDate(cells[0] || '');
    const province = cells[1] || '';
    const kab = cells[2] || '';
    const school = cells[3] || '';
    const bergejala = parseNum(cells[4] || '0');
    const meninggal = parseNum(cells[5] || '0');

    // Extract URL from ref column
    const refCell = cellMatches[cellMatches.length - 1] || '';
    const urlMatch = refCell.match(/(https?:\/\/[^\s<>"']+)/);
    const refUrl = urlMatch ? urlMatch[1] : '';

    const [lat, lng] = geoLookup(`${province} ${kab}`);

    if (!lat || !lng) {
      // Try province alone
      const [lat2, lng2] = geoLookup(province);
      if (!lat2 || !lng2) {
        console.log(`[WIKI] Skipping: no coords for ${kab}, ${province}`);
        continue;
      }
      incidents.push({
        date,
        lat: lat2,
        lng: lng2,
        province,
        kab,
        school,
        victims: bergejala,
        deaths: meninggal,
        url: refUrl,
      });
      continue;
    }

    incidents.push({
      date,
      lat,
      lng,
      province,
      kab,
      school,
      victims: bergejala,
      deaths: meninggal,
      url: refUrl,
    });
  }

  console.log(`[WIKI] Parsed ${incidents.length} incidents with coordinates`);
  return incidents;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(ctx) {
  const { DB } = ctx.env;
  
  if (!DB) {
    return json({ error: 'D1_NOT_BOUND', message: 'D1 not configured' }, 503);
  }

  try {
    console.log('[WIKI] Starting Wikipedia scrape...');
    const incidents = await scrapeWikiTable();
    
    // Calculate totals
    const totalVictims = incidents.reduce((sum, inc) => sum + inc.victims, 0);
    const totalDeaths = incidents.reduce((sum, inc) => sum + inc.deaths, 0);
    
    console.log(`[WIKI] Total: ${incidents.length} incidents, ${totalVictims} victims, ${totalDeaths} deaths`);
    
    return json({
      ok: true,
      scraped: incidents.length,
      total_victims: totalVictims,
      total_deaths: totalDeaths,
      sample: incidents.slice(0, 5),
    });
  } catch (err) {
    console.error('[WIKI] Error:', err.message);
    return json({ error: 'SCRAPE_ERROR', message: err.message }, 500);
  }
}