const WIKI_API = 'https://id.wikipedia.org/w/api.php';
const WIKI_PAGE = 'Daftar_kasus_keracunan_massal_program_Makan_Bergizi_Gratis';

// Extensive Indonesia coordinates
const CITY_COORDS = {
  // Provinces - all 34 provinces
  'aceh': [4.7, 95.3], 'nanggroe aceh': [4.7, 95.3], 'nanggroe aceh darussalam': [4.7, 95.3],
  'sumatera utara': [3.6, 98.7], 'sumut': [3.6, 98.7],
  'sumatera barat': [-0.9, 100.4], 'sumbar': [-0.9, 100.4],
  'riau': [0.5, 101.5],
  'jambi': [-1.6, 103.6],
  'sumatera selatan': [-3.1, 104.0], 'sumsel': [-3.1, 104.0],
  'bengkulu': [-3.8, 102.3],
  'lampung': [-4.9956, 105.2836],
  'banten': [-6.12, 106.15],
  'jawa barat': [-6.9, 107.6], 'jabar': [-6.9, 107.6],
  'jawa tengah': [-7.15, 110.14], 'jateng': [-7.15, 110.14],
  'jawa timur': [-7.5, 112.5], 'jatim': [-7.5, 112.5],
  'di yogyakarta': [-7.7955, 110.3695], 'yogyakarta': [-7.7972, 110.3615],
  'bali': [-8.34, 115.09],
  'nusa tenggara barat': [-8.65, 117.4], 'ntb': [-8.65, 117.4],
  'nusa tenggara timur': [-8.75, 121.5], 'ntt': [-8.75, 121.5],
  'kalimantan barat': [0.0, 109.3],
  'kalimantan tengah': [-1.5, 113.0],
  'kalimantan selatan': [-3.1, 115.2],
  'kalimantan timur': [1.0, 116.0],
  'kalimantan utara': [3.0, 117.0],
  'sulawesi utara': [1.0, 124.8],
  'sulawesi tengah': [-1.0, 121.0],
  'sulawesi selatan': [-4.0, 120.0],
  'sulawesi tenggara': [-4.0, 122.5],
  'sulawesi barat': [-2.8, 119.4],
  'gorontalo': [0.5, 123.0],
  'maluku': [-3.2, 129.5],
  'maluku utara': [1.5, 127.8],
  'papua': [-4.0, 136.0],
  'papua barat': [-1.5, 133.0],
  'papua tengah': [-3.5, 136.0],
  'papua selatan': [-6.0, 140.0],
  // Aceh
  'kota banda aceh': [5.55, 95.32], 'banda aceh': [5.55, 95.32],
  'aceh utara': [4.9, 97.0], 'aceh timur': [4.6, 97.6], 'aceh tengah': [4.5, 96.5],
  'aceh besar': [5.4, 95.5], 'aceh bireuen': [4.3, 96.4],
  'pidie': [5.2, 95.8], 'pidie jaya': [5.0, 96.1],
  'aceh jaya': [4.7, 95.5], 'gayo lues': [4.0, 97.0],
  'bener meriah': [4.9, 96.7], 'aceh tenggara': [4.6, 98.0],
  // Sumatra Utara
  'medan': [3.5952, 98.6722], 'kota medan': [3.5952, 98.6722],
  'deli serdang': [3.5, 98.7], 'langkat': [3.9, 98.3],
  'serdang bedagai': [3.5, 99.0], 'karo': [3.1, 98.5],
  'simalungun': [2.9, 99.0], 'dairi': [2.5, 98.1],
  'humbia': [2.5, 98.5], 'tapanuli tengah': [1.8, 98.8],
  'tapanuli utara': [2.0, 98.8], 'nias': [1.1, 97.6],
  'toba': [2.3, 99.15], 'samosir': [2.5, 98.9],
  'labuhan batu': [2.0, 100.0], 'asahan': [2.0, 99.5],
  'batu bara': [3.0, 99.5], 'tanjung balai': [3.0, 99.2],
  'pematang siantar': [2.96, 99.07], 'tebing tinggi': [2.1, 99.1],
  'binjai': [3.6, 98.5], 'sibolga': [1.74, 98.78],
  'padang sidempuan': [1.4, 99.3], 'gunungsitoli': [1.3, 97.6],
  'mandailing natal': [1.2, 99.0],
  // Jawa Barat
  'bandung': [-6.9175, 107.6191], 'bandung barat': [-6.93, 107.35],
  'bogor': [-6.6127, 106.8], 'cianjur': [-6.8176, 107.1457],
  'subang': [-6.5597, 107.7593], 'karawang': [-6.3064, 107.3366],
  'purwakarta': [-6.5569, 107.4432], 'garut': [-7.2181, 107.9036],
  'tasikmalaya': [-7.3267, 108.2243], 'ciamis': [-7.32, 108.35],
  'kuningan': [-6.97, 108.5], 'majalengka': [-6.83, 108.2],
  'sumedang': [-6.83, 107.92], 'indramayu': [-6.35, 108.05],
  'cirebon': [-6.7328, 108.5527], 'bekasi': [-6.2347, 106.9928],
  'depok': [-6.4024, 106.7942],
  // Jawa Tengah
  'semarang': [-6.9667, 110.4204], 'kudus': [-6.8042, 110.8416],
  'pekalongan': [-6.8886, 109.6755], 'tegal': [-6.8741, 109.1402],
  'brebes': [-6.87, 109.05], 'banyumas': [-7.51, 109.25],
  'banjarnegara': [-7.53, 109.68], 'kebumen': [-7.68, 109.65],
  'wonogiri': [-7.867, 110.907], 'boyolali': [-7.5321, 110.5274],
  'klaten': [-7.7055, 110.5911], 'sleman': [-7.7158, 110.3554],
  // Jawa Timur
  'surabaya': [-7.2571, 112.7521], 'sidoarjo': [-7.4542, 112.7178],
  'gresik': [-7.1583, 112.6512], 'malang': [-7.9784, 112.6311],
  'kediri': [-7.8483, 112.0169], 'blitar': [-8.0892, 112.0489],
  'jember': [-8.1853, 113.6825], 'banyuwangi': [-8.2192, 114.3695],
  'probolinggo': [-7.7551, 113.1547], 'pasuruan': [-7.76, 112.9078],
  'lamongan': [-7.1176, 112.4173], 'tuban': [-6.898, 112.0486],
  'bojonegoro': [-7.15, 111.88], 'nganjuk': [-7.6038, 111.9017],
  'ponorogo': [-7.8672, 111.4719], 'jombang': [-7.6, 112.23],
  // Sulawesi Selatan
  'makassar': [-5.1427, 119.4125], 'parepare': [-3.8, 119.6],
  'palopo': [-3.0, 120.2], 'maros': [-4.9, 119.6],
  'pangkajene': [-4.8, 119.5], 'barru': [-4.0, 119.6],
  'bone': [-4.2, 120.0], 'soppeng': [-4.3, 119.9],
  'wajo': [-4.0, 120.0], 'sidrap': [-3.9, 119.8],
  'pinrang': [-3.8, 119.6], 'enrekang': [-3.5, 119.8],
  'luwu': [-3.0, 120.3], 'luwu utara': [-2.7, 120.4],
  'luwu timur': [-2.5, 120.8],
  // NTT
  'kupang': [-10.1774, 123.6635], 'flores': [-8.65, 121.3],
  'sikka': [-8.6, 122.3], 'ende': [-8.6, 121.6],
  'nagekeo': [-8.7, 121.0], 'manggarai': [-8.6, 120.5],
  'sumba': [-9.6, 119.9], 'timor': [-9.5, 124.2],
  'malaka': [-9.6, 124.9], 'alor': [-8.25, 124.5],
  // NT
  'mataram': [-8.5833, 116.1167], 'lombok': [-8.5, 116.5],
  'lombok barat': [-8.65, 116.1], 'lombok timur': [-8.5, 116.5],
  'sumbawa': [-8.7, 117.5], 'bima': [-8.5, 118.7],
  // Kalimantan
  'banjarmasin': [-3.318, 114.5912], 'balikpapan': [-1.2671, 116.8286],
  'samarinda': [-0.4943, 117.1488], 'pontianak': [-0.03, 109.33],
  // Lampung
  'bandar lampung': [-5.4299, 105.262], 'lampung selatan': [-5.6, 105.4],
  'lampung tengah': [-4.95, 105.2], 'lampung timur': [-4.8, 105.7],
  // Sumatra more
  'bireuen': [4.3, 96.4], 'humbang': [2.0, 98.5], 'humbang hasundu': [2.0, 98.5],
  'padang panjang': [-0.45, 100.4], 'dharmasraya': [-1.3, 101.4],
  'penukal': [-3.0, 104.2], 'penukal abab': [-3.0, 104.2],
  'ogan komering': [-3.0, 104.0], 'ogan komering ilir': [-3.4, 105.0],
  'ogan komering ulu': [-4.0, 104.0], 'musi banyuasin': [-3.0, 104.2],
  'musi rawas': [-2.5, 103.5], 'palembang': [-2.9908, 104.7558],
  'ogan ilir': [-3.5, 104.5], 'muara enim': [-3.5, 103.5],
  'lahat': [-3.8, 103.5], 'lubuk linggau': [-3.3, 102.9],
  // Riau & Kep
  'kampar': [0.4, 101.1], 'siak': [1.0, 102.0],
  'batam': [1.05, 104.02], 'kota batam': [1.05, 104.02],
  'kepulauan riau': [1.0, 104.5], 'kepulauan anambas': [3.0, 106.0],
  // Babel
  'belitung': [-2.9, 107.6], 'belitung timur': [-2.85, 107.9],
  'bangka': [-2.5, 106.0], 'bangka selatan': [-2.8, 105.8],
  'bangka tengah': [-2.5, 106.0], 'bangka barat': [-2.4, 106.0],
  'bangka utara': [-2.3, 106.1],
  // More Lampung
  'tanggamus': [-5.1, 104.9], 'metro': [-5.11, 105.31],
  'tulang bawang': [-4.3, 105.3], 'tulang bawbar': [-4.5, 105.3],
  'tulang bawang barat': [-4.5, 105.3], 'tulang bawang timur': [-4.2, 105.5],
  'way kanan': [-4.8, 104.8], 'mesuji': [-4.5, 105.5],
  // Kalimantan
  'kubu raya': [-0.1, 110.0], 'ketapang': [-1.8, 110.0],
  'sanggau': [0.1, 110.6], 'kayong utara': [-0.8, 110.0],
  'kapuas hulu': [0.8, 112.0], 'landak': [-0.2, 109.4],
  'singkawang': [0.9, 108.9], 'kota singkawang': [0.9, 108.9],
  'bulungan': [3.0, 116.5], 'tanjung selor': [3.0, 116.5],
  'penajam': [-1.3, 116.5], 'penajam paser': [-1.3, 116.5],
  'penajam paser utara': [-1.3, 116.5], 'hulu sungai': [-2.5, 115.0],
  'hulu sungai utara': [-2.3, 115.4], 'hulu sungai tengah': [-2.5, 115.4],
  'hulu sungai selatan': [-2.7, 115.3], 'banjar': [-3.5, 114.8],
  'tabalong': [-1.9, 115.7], 'balangan': [-2.4, 115.4],
  // Banten
  'serang': [-6.1156, 106.1842], 'cilegon': [-5.9826, 106.0133],
  'tangerang': [-6.1785, 106.6298],
  // DKI Jakarta
  'dki jakarta': [-6.2088, 106.8456], 'jakarta': [-6.1751, 106.865],
  'jakarta pusat': [-6.175, 106.83], 'jakarta utara': [-6.14, 106.88],
  'jakarta timur': [-6.225, 106.9], 'jakarta barat': [-6.17, 106.73],
  'jakarta selatan': [-6.26, 106.81],
  'kota jakarta': [-6.1751, 106.865],
  // Kota di Jawa Barat
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
  // More Kota
  'kota mataram': [-8.5833, 116.1167], 'kota kupang': [-10.1774, 123.6635],
  'kota makassar': [-5.1427, 119.4125], 'kota pontianak': [-0.03, 109.33],
  'kota medan': [3.5952, 98.6722], 'kota padang': [-0.95, 100.36],
  'kota palembang': [-2.9908, 104.7558], 'kota batam': [1.05, 104.02],
  'kota tanjung pinang': [0.9, 104.45], 'kota pangkal pinang': [-2.13, 106.13],
  'kota metro': [-5.11, 105.31], 'kota Bandar lampung': [-5.4299, 105.262],
  'kota serang': [-6.1156, 106.1842], 'kota cilegon': [-5.9826, 106.0133],
  'kota tangerang': [-6.1785, 106.6298],
  // More Kabupaten Jawa Barat
  'bandung regency': [-6.9175, 107.6191], 'bogor regency': [-6.6127, 106.8],
  'bekasi regency': [-6.2347, 106.9928], 'cirebon regency': [-6.7328, 108.5527],
  'sukabumi regency': [-6.92, 106.93], 'tasikmalaya regency': [-7.3267, 108.2243],
  'garut regency': [-7.2181, 107.9036], 'cianjur regency': [-6.8176, 107.1457],
  'subang regency': [-6.5597, 107.7593], 'karawang regency': [-6.3064, 107.3366],
  'purwakarta regency': [-6.5569, 107.4432],
  // Remaining locations from skipped list
  'kubu raya': [-0.1, 110.0], 'pangandaran': [-7.5, 108.65], 'cimahi': [-6.88, 107.55],
  'kota cimahi': [-6.88, 107.55], 'batang': [-6.9, 110.75],
  'karanganyar': [-7.6, 110.9], 'sragen': [-7.4, 111.0],
  'rembang': [-6.7, 111.35], 'temanggung': [-7.3, 110.0],
  'salatiga': [-7.35, 110.5], 'kota salatiga': [-7.35, 110.5],
  'wonogiri': [-7.867, 110.907], 'grobogan': [-7.0, 110.9],
  'blora': [-7.0, 111.4], 'pati': [-6.7, 111.0],
  'kudus': [-6.8042, 110.8416], 'jepara': [-6.5, 110.7],
  'demak': [-6.9, 110.6], 'ungaran': [-7.4, 110.4],
  'salatiga': [-7.35, 110.5], 'pangkal pinang': [-2.13, 106.13],
  'sukabumi': [-6.92, 106.93], 'sukabumi kota': [-6.92, 106.93],
};

function geoLookup(text) {
  if (!text) return [null, null];
  const t = text.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (Array.isArray(coords) && t.includes(city)) return coords;
  }
  const parts = text.split(/[,\/]/);
  for (const part of parts) {
    const p = part.toLowerCase().trim();
    for (const [city, coords] of Object.entries(CITY_COORDS)) {
      if (Array.isArray(coords) && p.includes(city)) return coords;
    }
  }
  if (parts.length > 1) {
    const last = parts[parts.length - 1].trim().toLowerCase();
    for (const [city, coords] of Object.entries(CITY_COORDS)) {
      if (Array.isArray(coords) && last.includes(city)) return coords;
    }
  }
  return [null, null];
}

async function test() {
  console.log('Fetching Wikipedia...');
  const res = await fetch(WIKI_API + '?action=parse&page=' + WIKI_PAGE + '&prop=text&format=json');
  const data = await res.json();
  const html = data.parse.text['*'];
  const tableMatch = html.match(/<table[^>]*class="wikitable"[^>]*>([\s\S]*?)<\/table>/);
  const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  console.log('Total rows: ' + rows.length);
  
  let incidents = 0, skipped = 0, victims = 0, deaths = 0;
  const skippedLocs = [];
  for (const row of rows.slice(1)) {
    const cells = row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g);
    if (!cells || cells.length < 6) continue;
    const province = cells[1].replace(/<[^>]+>/g,' ').trim();
    const kab = cells[2].replace(/<[^>]+>/g,' ').trim();
    const bergejala = parseInt(cells[4].match(/\d+/)?.[0] || '0');
    const meninggal = parseInt(cells[5].match(/\d+/)?.[0] || '0');
    const [lat, lng] = geoLookup(province + ' ' + kab);
    if (lat) { 
      incidents++; 
      victims += bergejala; 
      deaths += meninggal;
    } else { 
      skipped++; 
      if (skippedLocs.length < 10) skippedLocs.push(kab.substring(0,35) + '|' + province.substring(0,25));
    }
  }
  console.log('\n=== RESULT ===');
  console.log('Total rows: ' + rows.length);
  console.log('Matched: ' + incidents + ', Skipped: ' + skipped);
  console.log('Victims: ' + victims + ', Deaths: ' + deaths);
  console.log('Success: ' + Math.round(incidents/(incidents+skipped)*100) + '%');
  console.log('\nSample skipped locations:');
  skippedLocs.forEach(x => console.log('  ' + x));
}
test();