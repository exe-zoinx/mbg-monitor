/**
 * Wikipedia table scraper for MBG poisoning incidents.
 * Uses MediaWiki API to fetch structured wikitext and parse the table.
 */

const WIKI_API = 'https://id.wikipedia.org/w/api.php';
const WIKI_PAGE = 'Daftar_kasus_keracunan_massal_program_Makan_Bergizi_Gratis';

// Indonesian city → (lat, lng)
const CITY_COORDS = {
  // Province defaults
  'jakarta': [-6.2088, 106.8456], 'dki jakarta': [-6.2088, 106.8456],
  'jawa timur': [-7.5, 112.5], 'jatim': [-7.5, 112.5],
  'jawa tengah': [-7.15, 110.14], 'jateng': [-7.15, 110.14],
  'jawa barat': [-6.9, 107.6], 'jabar': [-6.9, 107.6],
  'di yogyakarta': [-7.7955, 110.3695], 'yogyakarta': [-7.7972, 110.3615],
  'dki jakarta': [-6.2088, 106.8456], 'banten': [-6.12, 106.15],
  'sumatera utara': [3.6, 98.7], 'sumut': [3.6, 98.7],
  'sumatera barat': [-0.9, 100.4], 'sumbar': [-0.9, 100.4],
  'riau': [0.5, 101.5],
  'jambi': [-1.6, 103.6],
  'sumatera selatan': [-3.1, 104.0], 'sumsel': [-2.9908, 104.7558],
  'bengkulu': [-3.8, 102.3],
  'lampung': [-4.9956, 105.2836],
  'bali': [-8.34, 115.09],
  'nusa tenggara barat': [-8.65, 117.4], 'ntb': [-8.65, 117.4],
  'nusa tenggara timur': [-8.75, 121.5], 'ntt': [-8.75, 121.5],
  'kalimantan barat': [0.0, 109.3],
  'kalimantan tengah': [-1.5, 113.0],
  'kalimantan selatan': [-3.1, 115.2],
  'kalimantan timur': [1.0, 116.0],
  'kalimantan utara': [3.0, 117.0],
  'sulawesi selatan': [-4.0, 120.0],
  'sulawesi tengah': [-1.0, 121.0],
  'sulawesi utara': [1.0, 124.8],
  'sulawesi tenggara': [-4.0, 122.5],
  'sulawesi barat': [-2.8, 119.4],
  'gorontalo': [0.5, 123.0],
  'maluku': [-3.2, 129.5],
  'maluku utara': [1.5, 127.8],
  'papua': [-4.0, 136.0],
  'papua barat': [-1.5, 133.0],
  'papua tengah': [-3.5, 136.0],
  'papua pegunungan': [-4.0, 138.0],
  'papua selatan': [-6.0, 140.0],
  'papua barat daya': [-2.0, 130.0],
  'maluku utara': [1.5, 127.8], 'maluku Utara': [1.5, 127.8],
  // Jakarta
  'jakarta': [-6.2088, 106.8456], 'dki jakarta': [-6.2088, 106.8456],
  'jakarta pusat': [-6.1751, 106.8650], 'jakarta utara': [-6.1389, 106.8813],
  'jakarta timur': [-6.2250, 106.9010], 'jakarta selatan': [-6.2614, 106.8116],
  'jakarta barat': [-6.1686, 106.7588], 'kepulauan seribu': [-5.55, 106.55],
  'bandung': [-6.9175, 107.6191], 'bandung barat': [-6.93, 107.35],
  'bogor': [-6.6127, 106.8], 'sukoharjo': [-7.7149, 110.8258],
  'wonogiri': [-7.867, 110.907], 'boyolali': [-7.5321, 110.5274],
  'klaten': [-7.7055, 110.5911], 'yogyakarta': [-7.7972, 110.3615],
  'jogja': [-7.7972, 110.3615], 'sleman': [-7.7158, 110.3554],
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
  'banten': [-6.12, 106.15], 'serang': [-6.1156, 106.1842],
  'lebak': [-6.56, 106.22], 'pandeglang': [-6.36, 105.6],
  'cianjur': [-6.8176, 107.1457], 'bandung': [-6.9175, 107.6191],
  'subang': [-6.5597, 107.7593], 'karawang': [-6.3064, 107.3366],
  'purwakarta': [-6.5569, 107.4432], 'garut': [-7.2181, 107.9036],
  'tasikmalaya': [-7.3267, 108.2243], 'ciamis': [-7.32, 108.35],
  'kuningan': [-6.97, 108.5], 'majalengka': [-6.83, 108.2],
  'sumedang': [-6.83, 107.92],
  'cirebon': [-6.7328, 108.5527], 'indramayu': [-6.35, 108.05],
  'majene': [-3.54, 118.97], 'polewali mandar': [-3.42, 119.32],
  'mamuju': [-2.5, 119.4],
  'jawa': [-7.5, 110.5],
  'lampung': [-4.9956, 105.2836], 'bandar lampung': [-5.4299, 105.262],
  'lampung selatan': [-5.6, 105.4], 'lampung tengah': [-4.95, 105.2],
  'lampung timur': [-4.8, 105.7], 'lampung barat': [-5.0, 103.8],
  'pesawaran': [-5.24, 105.07], 'pringsewu': [-5.36, 104.97],
  'tulang bawang': [-4.3, 105.3],
  'sumatera utara': [3.6, 98.7], 'sumut': [3.6, 98.7],
  'medan': [3.5952, 98.6722], 'deli serdang': [3.5, 98.7],
  'langkat': [3.9, 98.3], 'serdang bedagai': [3.5, 99.0],
  'karo': [3.1, 98.5], 'simalungun': [2.9, 99.0],
  'dairi': [2.5, 98.1], ' Humbang': [2.5, 98.5],
  'tapanuli tengah': [1.8, 98.8], 'tapanuli utara': [2.0, 98.8],
  'nias': [1.1, 97.6],
  'sumatera barat': [-0.9, 100.4], 'padang': [-0.9489, 100.3613],
  'limapuluh kota': [-0.3, 100.5], 'solok': [-0.9, 100.6],
  'agAM': [-0.6, 100.5], 'pasaman': [-0.2, 100.0],
  'padang pariaman': [-0.7, 100.4], 'pesisir selatan': [-1.3, 100.7],
  'dharmasraya': [-1.3, 101.4], 'solok selatan': [-1.4, 101.2],
  'sijunjung': [-0.8, 101.1], 'mentawai': [-1.8, 99.3],
  'pekanbaru': [0.5071, 101.4478], 'riau': [0.5, 101.5],
  'siak': [1.0, 102.0], 'pelalawan': [0.8, 102.0],
  'kuansing': [0.3, 101.4], 'inhil': [-0.3, 102.7],
  'bengkalis': [1.5, 102.1], 'rohil': [2.3, 100.8],
  'kampar': [0.4, 101.1], 'meranti': [1.0, 102.4],
  'bengkulu': [-3.8, 102.3], 'lebang': [-3.74, 102.4],
  'lebang': [-3.74, 102.4],
  'bengkulu tengah': [-3.5, 102.2], 'bengkulu selatan': [-4.2, 102.3],
  'bengkulu utara': [-3.4, 101.9], 'kaur': [-4.3, 103.3],
  'seluma': [-3.9, 102.4], 'muko-muko': [-2.3, 101.1],
  'rejang lebat': [-3.4, 102.5], 'bengkulu utara': [-3.4, 101.9],
  'jambi': [-1.6, 103.6], 'palembang': [-2.9908, 104.7558],
  'sumsel': [-2.9908, 104.7558],
  'ogan ilir': [-3.5, 104.5], 'ogan komering ilir': [-3.4, 105.0],
  'muara enam': [-3.0, 104.2], 'lahat': [-3.8, 103.5],
  'palembang': [-2.9908, 104.7558],
  'bali': [-8.34, 115.09], 'denpasar': [-8.6525, 115.2192],
  'badung': [-8.6, 115.17], 'gianyar': [-8.47, 115.33],
  'tabanan': [-8.55, 115.07], 'buleleng': [-8.15, 115.0],
  'jembrana': [-8.3, 114.6], 'klungkung': [-8.53, 115.4],
  'ntb': [-8.65, 117.4], 'mataram': [-8.5833, 116.1167],
  'lombok barat': [-8.65, 116.1], 'lombok tengah': [-8.6, 116.3],
  'lombok timur': [-8.5, 116.5], 'lombok utara': [-8.35, 116.4],
  'sumbawa': [-8.7, 117.5], 'bima': [-8.5, 118.7],
  'dompu': [-8.55, 119.0], 'sumbawa barat': [-8.8, 116.8],
  'ntt': [-8.75, 121.5], 'kupang': [-10.1774, 123.6635],
  'flores': [-8.65, 121.3], 'sikka': [-8.6, 122.3],
  ' ende': [-8.6, 121.6], 'ngada': [-8.7, 121.1],
  'sumba': [-9.6, 119.9], 'timor': [-9.5, 124.2],
  'malaka': [-9.6, 124.9],
  'kalimantan selatan': [-3.1, 115.2], 'banjarmasin': [-3.318, 114.5912],
  'tabalong': [-1.9, 115.7], 'tanah bumbu': [-2.9, 115.9],
  'tanah laut': [-3.6, 114.7], 'barito kuala': [-3.2, 114.6],
  'hulu sungai selatan': [-2.7, 115.3], 'hulu sungai tengah': [-2.5, 115.4],
  'hulu sungai utara': [-2.3, 115.4], 'tapin': [-2.9, 115.0],
  'rantau': [-2.8, 115.3], 'balangan': [-2.4, 115.4],
  'batola': [-3.1, 114.8], 'banjar': [-3.5, 114.8],
  'kalimantan tengah': [-1.5, 113.0], 'palangka raya': [-2.2138, 113.9213],
  'katingan': [-1.5, 113.0], 'seruyan': [-2.3, 112.2],
  'sintang': [-0.2, 111.5], 'melawi': [-0.5, 111.8],
  'kapuas': [-1.5, 113.0], 'gunung mas': [-1.2, 113.0],
  'barito selatan': [-2.0, 113.5], 'barito utara': [-1.5, 114.8],
  'murung raya': [-0.5, 114.0], 'lamandau': [-1.8, 111.5],
  'katingan': [-1.5, 113.0],
  'kalimantan timur': [1.0, 116.0], 'samarinda': [-0.4943, 117.1488],
  'balikpapan': [-1.2671, 116.8286], 'bontang': [1.0, 117.5],
  'kutai kartanegara': [0.5, 117.0], 'kutai timur': [1.0, 117.8],
  'kutai barat': [-0.5, 116.5], 'berau': [2.0, 117.5],
  'penajam paser utara': [-1.3, 116.5], 'paser': [-1.5, 115.8],
  'kalimantan barat': [0.0, 109.3], 'pontianak': [-0.03, 109.33],
  'singkawang': [0.9, 108.9], 'sanggau': [0.1, 110.6],
  'ketapang': [-1.8, 110.0], 'sintang': [-0.2, 111.5],
  'melawi': [-0.5, 111.8], 'sekadau': [-0.1, 110.6],
  'mempawah': [-0.2, 108.9], 'landak': [-0.2, 109.4],
  'bengkayang': [0.8, 109.5], 'sambas': [1.4, 108.9],
  'sulawesi selatan': [-4.0, 120.0], 'makassar': [-5.1427, 119.4125],
  'parepare': [-3.8, 119.6], 'palopo': [-3.0, 120.2],
  'toraja': [-3.0, 119.9], 'luwu': [-3.0, 120.3],
  'luwu timur': [-2.5, 120.8], 'luwu utara': [-2.7, 120.4],
  'bombana': [-4.5, 122.0], 'kendari': [-3.9865, 122.5146],
  'buton': [-5.5, 122.6], 'muna': [-4.9, 122.5],
  'bau-bau': [-5.5, 122.6], 'wakatobi': [-5.2, 123.5],
  'kolaka': [-4.2, 121.6], 'kolaka timur': [-4.2, 122.0],
  'konawe': [-4.0, 122.0], 'konawe selatan': [-4.2, 122.5],
  'konawe utara': [-3.5, 122.0],
  'sulawesi tengah': [-1.0, 121.0], 'palu': [-0.9025, 119.87],
  'donggala': [-0.7, 119.7], 'parigi Moutong': [-0.8, 120.6],
  'poso': [-1.4, 120.7], 'tojo una-una': [-0.8, 121.6],
  'buol': [-1.2, 121.4], 'tolitoli': [-1.0, 120.8],
  'morowali': [-2.7, 121.5], 'banggai': [-1.8, 123.5],
  'banggai kepulauan': [-1.5, 123.0],
  'sulawesi utara': [1.0, 124.8], 'manado': [1.4741, 124.8412],
  'bitung': [1.4, 125.0], 'tomohon': [1.3, 124.8],
  'kotamobagu': [0.7, 124.3], 'minahasa': [1.2, 124.8],
  'minahasa selatan': [1.0, 124.8], 'minahasa utara': [1.3, 124.9],
  'minahasa tenggara': [1.0, 124.9], 'bolmong': [1.3, 124.4],
  'bolmong timur': [1.2, 124.6], 'bolsel': [0.9, 124.5],
  'sulawesi tenggara': [-4.0, 122.5], 'kendari': [-3.9865, 122.5146],
  'bau-bau': [-5.5, 122.6],
  'sulawesi barat': [-2.8, 119.4],
  'garut': [-7.2181, 107.9036],
  'blora': [-7.0231, 111.4029], 'grobogan': [-7.05, 110.9],
  // Additional from test-wiki.js
  'kota bandung': [-6.9175, 107.6191], 'kota bogor': [-6.6127, 106.8],
  'kota bekasi': [-6.2347, 106.9928], 'kota depok': [-6.4024, 106.7942],
  'kota cirebon': [-6.7328, 108.5527], 'kota sukabumi': [-6.92, 106.93],
  'kota tasikmalaya': [-7.3267, 108.2243], 'kota garut': [-7.2181, 107.9036],
  'kota cianjur': [-6.8176, 107.1457], 'kota subang': [-6.5597, 107.7593],
  'kota karawang': [-6.3064, 107.3366], 'kota purwakarta': [-6.5569, 107.4432],
  'kota sumedang': [-6.83, 107.92], 'kota majalengka': [-6.83, 108.2],
  'kota kuningan': [-6.97, 108.5], 'kota indramayu': [-6.35, 108.05],
  'kota banjarmasin': [-3.318, 114.5912], 'kota palangkaraya': [-2.21, 113.92],
  'kota balikpapan': [-1.2671, 116.8286], 'kota samarinda': [-0.4943, 117.1488],
  'kota mataram': [-8.5833, 116.1167], 'kota kupang': [-10.1774, 123.6635],
  'kota makassar': [-5.1427, 119.4125], 'kota pontianak': [-0.03, 109.33],
  'kota medan': [3.5952, 98.6722], 'kota padang': [-0.95, 100.36],
  'kota palembang': [-2.9908, 104.7558], 'kota batam': [1.05, 104.02],
  'kota metro': [-5.11, 105.31], 'kota serang': [-6.1156, 106.1842],
  'kota cilegon': [-5.9826, 106.0133], 'kota tangerang': [-6.1785, 106.6298],
  'kota jakarta': [-6.1751, 106.865],
  'kubu raya': [-0.1, 110.0], 'pangandaran': [-7.5, 108.65], 'cimahi': [-6.88, 107.55],
  'kota cimahi': [-6.88, 107.55], 'batang': [-6.9, 110.75],
  'karanganyar': [-7.6, 110.9], 'sragen': [-7.4, 111.0],
  'rembang': [-6.7, 111.35], 'temanggung': [-7.3, 110.0],
  'salatiga': [-7.35, 110.5], 'kota salatiga': [-7.35, 110.5],
  'pati': [-6.7, 111.0], 'jepara': [-6.5, 110.7], 'demak': [-6.9, 110.6],
  'brebes': [-6.87, 109.05], 'banyumas': [-7.51, 109.25],
  'banjarnegara': [-7.53, 109.68], 'kebumen': [-7.68, 109.65],
  'pekalongan': [-6.8886, 109.6755], 'ungaran': [-7.4, 110.4],
  'banyumas': [-7.51, 109.25],
  // More kabupatens
  'bandung regency': [-6.9175, 107.6191], 'bogor regency': [-6.6127, 106.8],
  'bekasi regency': [-6.2347, 106.9928], 'cirebon regency': [-6.7328, 108.5527],
  'sukabumi regency': [-6.92, 106.93], 'tasikmalaya regency': [-7.3267, 108.2243],
  'garut regency': [-7.2181, 107.9036], 'cianjur regency': [-6.8176, 107.1457],
  'subang regency': [-6.5597, 107.7593], 'karawang regency': [-6.3064, 107.3366],
  'purwakarta regency': [-6.5569, 107.4432],
  // Additional specific locations from Wikipedia
  'toba': [2.3, 99.15], 'samosir': [2.5, 98.9], 'toba': [2.3, 99.15],
  'labuhan batu': [2.0, 100.0], 'labuhanbatu': [2.0, 100.0], 'labuhanbatu utara': [2.0, 99.8],
  'labuhanbatu selatan': [2.0, 100.2], 'asahan': [2.0, 99.5],
  'tanjung balai': [3.0, 99.2], 'tanjungbalai': [3.0, 99.2],
  'pematang siantar': [2.96, 99.07], 'pematangsiantar': [2.96, 99.07],
  'binjai': [3.6, 98.5], 'tebing tinggi': [2.1, 99.1], 'tebingtinggi': [2.1, 99.1],
  'sibolga': [1.74, 98.78], 'padang sidempuan': [1.4, 99.3],
  'gunungsitoli': [1.3, 97.6], 'kota medan': [3.5952, 98.6722],
  'batang torpedo': [2.5, 98.5], 'batangtorop': [2.5, 98.5],
  'batang torpedo': [2.5, 98.5], 'mandailing natal': [1.2, 99.0],
  // Combined location patterns - try both parts
  'kabupaten': '', // Will use fallback
  'kota': '', // Will use fallback
  'kab': '', // Will use fallback
};

function geoLookup(text) {
  const t = text.toLowerCase();
  
  // First, try exact matches for full location strings
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (typeof coords === 'string') continue; // Skip empty fallbacks
    if (t.includes(city)) return coords;
  }
  
  // If no match, try to extract the province from combined strings
  // e.g., "Kabupaten Toba, Sumatera Utara" -> try "sumatera utara"
  const parts = text.split(/[,\/]/);
  for (const part of parts) {
    const p = part.toLowerCase().trim();
    for (const [city, coords] of Object.entries(CITY_COORDS)) {
      if (typeof coords === 'string') continue;
      if (p.includes(city)) return coords;
    }
  }
  
  // Last resort: extract just the province name (usually last part after comma)
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim().toLowerCase();
    for (const [city, coords] of Object.entries(CITY_COORDS)) {
      if (typeof coords === 'string') continue;
      if (lastPart.includes(city)) return coords;
    }
  }
  
  return [null, null];
}

function parseNum(s) {
  // Extract first number from string
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function parseDate(raw) {
  // Try YYYY-MM-DD first
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // Indonesian format: 29 September 2025
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

function cleanCell(text) {
  // Remove wikitext markup: {| |} |- | || etc
  // Keep only the actual text content
  return text
    .replace(/\[\[|\]\]/g, '')  // Remove wiki links
    .replace(/\|[^|]+$/, '')     // Remove pipe-prefixed suffix
    .replace(/rowspan="\d+"/gi, '')  // Remove rowspan
    .replace(/colspan="\d+"/gi, '')  // Remove colspan
    .replace(/\s+/g, ' ')
    .trim();
}

export async function scrapeWikiTable(env) {
  console.log('[WIKI] Fetching Wikipedia via API...');

  // Use MediaWiki API to get the HTML (more reliable for tables)
  const apiUrl = `${WIKI_API}?action=parse&page=${WIKI_PAGE}&prop=text&format=json`;
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'mbg-monitor-worker/1.0 (mbg-monitor@github.com)' },
  });

  if (!res.ok) throw new Error(`MediaWiki API failed: ${res.status}`);

  const data = await res.json();
  if (!data.parse?.text?.['*']) throw new Error('No HTML content');

  const html = data.parse.text['*'];

  // Parse wikitable from HTML (more reliable than wikitext)
  const tableMatch = html.match(/<table[^>]*class="wikitable"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) throw new Error('No wikitable found in HTML');

  const tableHtml = tableMatch[1];
  // Parse rows using regex
  const rowMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  if (!rowMatches) throw new Error('No table rows');

  console.log(`[WIKI] Processing ${rowMatches.length} rows from HTML`);

  const incidents = [];

  // Skip header row (first row)
  for (const rowHtml of rowMatches.slice(1)) {
    // Get all cells in the row
    const cellMatches = rowHtml.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g);
    if (!cellMatches || cellMatches.length < 6) continue;

    // Extract cell contents
    const cells = cellMatches.slice(0, 7).map(c => {
      // Strip HTML tags, keep text
      return c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    });

    // Map columns:
    // Col 0: Tanggal (Date)
    // Col 1: Provinsi (Province)
    // Col 2: Kabupaten/Kota
    // Col 3: Tempat/Sekolah
    // Col 4: Jumlah Bergejala (victims)
    // Col 5: Jumlah Meninggal (deaths)
    // Col 6: Ref (references with URLs)

    const date = parseDate(cells[0] || '');
    const province = cells[1] || '';
    const kab = cells[2] || '';
    const school = cells[3] || '';
    const bergejala = parseNum(cells[4] || '0');
    const meninggal = parseNum(cells[5] || '0');

    // Extract URL from reference column
    const refCell = cellMatches[cellMatches.length - 1] || '';
    const urlMatch = refCell.match(/(https?:\/\/[^\s<>"']+)/);
    const refUrl = urlMatch ? urlMatch[1] : '';

    const [lat, lng] = geoLookup(`${province} ${kab} ${school}`);

    if (!lat || !lng) {
      // Try province alone
      const [lat2, lng2] = geoLookup(province);
      if (!lat2 || !lng2) {
        console.log(`[WIKI] Skipping: no coords for ${kab}, ${province}`);
        continue;
      }
      // Use province coords but note the specific location
      const location = `${kab}, ${province}`;
      const title = school
        ? `Keracunan MBG — ${kab} (${school})`
        : `Keracunan MBG — ${kab}`;

      incidents.push({
        title,
        date,
        lat: lat2,
        lng: lng2,
        province,
        kabupaten: kab,
        school,
        location,
        victims: bergejala,
        deaths: meninggal,
        source: 'Wikipedia',
        source_url: refUrl,
        url: refUrl,
        cat: 'keracunan',
        note: school ? `Sekolah: ${school}` : '',
      });
      continue;
    }

    const location = `${kab}, ${province}`;
    const title = school
      ? `Keracunan MBG — ${kab} (${school})`
      : `Keracunan MBG — ${kab}`;

    incidents.push({
      title,
      date,
      lat,
      lng,
      province,
      kabupaten: kab,
      school,
      location,
      victims: bergejala,
      deaths: meninggal,
      source: 'Wikipedia',
      source_url: refUrl,
      url: refUrl,
      cat: 'keracunan',
      note: school ? `Sekolah: ${school}` : '',
    });
  }

  console.log(`[WIKI] Parsed ${incidents.length} incidents with coordinates`);

  // Calculate totals
  const totalVictims = incidents.reduce((sum, inc) => sum + inc.victims, 0);
  const totalDeaths = incidents.reduce((sum, inc) => sum + inc.deaths, 0);
  console.log(`[WIKI] Total victims: ${totalVictims}, deaths: ${totalDeaths}`);

  return incidents;
}