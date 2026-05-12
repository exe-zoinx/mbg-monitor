/**
 * Wikipedia table scraper for MBG poisoning incidents.
 * Fetches the structured wikitable from id.wikipedia.org and parses it.
 */

const WIKI_URL = 'https://id.wikipedia.org/wiki/Daftar_kasus_keracunan_massal_program_Makan_Bergizi_Gratis';

// Indonesian city → (lat, lng)
const CITY_COORDS = {
  'jakarta': [-6.2088, 106.8456], 'dki jakarta': [-6.2088, 106.8456],
  'jawa timur': [-7.5, 112.5], 'jatim': [-7.5, 112.5],
  'jawa tengah': [-7.15, 110.14], 'jateng': [-7.15, 110.14],
  'jawa barat': [-6.9, 107.6],
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
};

function geoLookup(text) {
  const t = text.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (t.includes(city)) return coords;
  }
  return [null, null];
}

function parseRefCell(td) {
  const links = [];
  for (const a of td.querySelectorAll('a')) {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('http') && !href.includes('wikipedia.org')) {
      const text = a.textContent?.trim() || '';
      if (text) links.push({ url: href, text });
    }
  }
  return links;
}

function stripHtml(el) {
  return el ? (el.textContent || '').trim() : '';
}

function parseNum(s) {
  const m = String(s).replace(/[^\d]/g, '');
  return m ? parseInt(m, 10) : 0;
}

function parseDate(raw) {
  // Try YYYY-MM-DD first
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // Indonesian format: 5 Maret 2025
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

export async function scrapeWikiTable(env) {
  console.log('[WIKI] Fetching Wikipedia table...');
  const res = await fetch(WIKI_URL, {
    headers: { 'User-Agent': 'mbg-monitor-worker/1.0' },
  });
  if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status}`);

  const html = await res.text();

  // Parse wikitable manually (no DOM in Workers, use regex)
  const tableMatch = html.match(/<table[^>]*class="wikitable"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) throw new Error('No wikitable found');

  const tableHtml = tableMatch[1];
  const rowMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  if (!rowMatches) throw new Error('No table rows');

  console.log(`[WIKI] Processing ${rowMatches.length} rows`);
  const incidents = [];
  let id = 1000;

  for (const rowHtml of rowMatches.slice(1)) { // skip header
    const cellMatches = rowHtml.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g);
    if (!cellMatches || cellMatches.length < 6) continue;

    const cells = cellMatches.slice(0, 7).map(c =>
      c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );

    const date = parseDate(cells[0] || '');
    const province = cells[1] || '';
    const kab = cells[2] || '';
    const school = cells[3] || '';
    const bergejala = parseNum(cells[4] || '0');

    // Ref cell: last cell
    const refCell = cellMatches[cellMatches.length - 1] || '';
    const refMatches = refCell.match(/(https?:\/\/[^\s<>"']+)/g) || [];
    const refUrl = refMatches[0] || '';

    const [lat, lng] = geoLookup(`${province} ${kab} ${school}`);

    if (!lat || !lng) continue;

    const location = `${kab}, ${province}`;
    const title = school
      ? `Keracunan MBG — ${kab} (${school})`
      : `Keracunan MBG — ${kab} (${bergejala} korban)`;

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
      deaths: parseNum(cells[5] || '0'),
      source: 'Wikipedia',
      source_url: refUrl,
      url: refUrl,
      cat: 'keracunan',
      note: school ? `Sekolah: ${school}` : '',
    });
    id++;
  }

  console.log(`[WIKI] Parsed ${incidents.length} incidents with coordinates`);
  return incidents;
}