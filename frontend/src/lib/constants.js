// Constants shared across components
export const COL = {
  keracunan: '#f85149',
  sppg: '#388bfd',
  kecelakaan: '#d29922',
  tewas: '#bc8cff',
  lainnya: '#7d8590',
};

export const TLBL = {
  keracunan: 'Keracunan',
  sppg: 'SPPG',
  kecelakaan: 'Kecelakaan',
  tewas: 'Korban Jiwa',
  lainnya: 'Lainnya',
};

export const CATEGORIES = ['all', 'keracunan', 'sppg', 'kecelakaan', 'tewas'];

export const CAT_SHORT = {
  all: 'Semua',
  keracunan: 'Racun',
  sppg: 'SPPG',
  kecelakaan: 'KLL',
  tewas: 'Tewas',
};

export function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

export function fmtAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}j`;
  return `${Math.floor(s / 86400)}hr`;
}

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeUrl(u) {
  if (!u || typeof u !== 'string') return '';
  const s = u.trim().slice(0, 512);
  return /^https?:\/\//i.test(s) ? s : '';
}

// Baseline incidents — always shown, even before first crawl
export const BASELINE = [
  { id: 1, cat: 'keracunan', date: '2025-01-13', lat: -7.545, lng: 110.847, title: 'Keracunan massal siswa SD Sukoharjo', loc: 'Sukoharjo, Jawa Tengah', victims: 47, note: '47 siswa SD dirawat, dugaan bakteri Salmonella pada menu telur. Vendor lokal tak bersertifikat BPOM.', source: 'Kompas.com' },
  { id: 2, cat: 'keracunan', date: '2025-01-17', lat: -6.820, lng: 107.135, title: 'Siswa SMP keracunan lauk telur & tempe', loc: 'Cianjur, Jawa Barat', victims: 38, note: 'Tempe dan telur diduga tidak layak konsumsi saat distribusi.', source: 'Detik.com' },
  { id: 3, cat: 'keracunan', date: '2025-01-23', lat: 0.540, lng: 123.062, title: 'Keracunan terbesar bulan pertama — 112 korban', loc: 'Kota Gorontalo, Gorontalo', victims: 112, note: '112 siswa SD dan SMP dilarikan ke RS Aloei Saboe. Pemda hentikan distribusi vendor terkait.', source: 'CNN Indonesia' },
  { id: 4, cat: 'keracunan', date: '2025-01-28', lat: -7.326, lng: 108.224, title: 'Kontaminasi E.coli pada menu ayam goreng', loc: 'Tasikmalaya, Jawa Barat', victims: 64, note: '64 siswa SD positif E.coli. BPOM turun ke dapur vendor, tidak ada prosedur sanitasi.', source: 'Tribun Jabar' },
  { id: 5, cat: 'keracunan', date: '2025-01-29', lat: -6.183, lng: 106.822, title: 'Balita meninggal pasca konsumsi MBG — DKI', loc: 'Jakarta Utara, DKI Jakarta', victims: 1, note: 'Balita meninggal setelah dirawat intensif. Kemenkes minta BPOM investigasi mendalam.', source: 'Kompas.com' },
  { id: 6, cat: 'keracunan', date: '2025-02-04', lat: -6.585, lng: 106.797, title: 'Siswa TK dan SD Bogor sakit massal', loc: 'Bogor, Jawa Barat', victims: 29, note: '29 anak usia TK–SD mual dan muntah. Kepala sekolah mengaku sudah komplain ke BGN sehari sebelumnya.', source: 'Radar Bogor' },
  { id: 7, cat: 'keracunan', date: '2025-02-08', lat: -0.903, lng: 119.870, title: 'Keracunan siswa SD Palu — dugaan sayur busuk', loc: 'Palu, Sulawesi Tengah', victims: 33, note: 'Dugaan kontaminasi bakteri pada menu sayur yang sudah layu.', source: 'Sulteng Raya' },
  { id: 8, cat: 'keracunan', date: '2025-02-11', lat: -7.154, lng: 112.655, title: '83 siswa SD Gresik dilarikan ke Puskesmas', loc: 'Gresik, Jawa Timur', victims: 83, note: 'Vendor lokal yang baru bergabung satu minggu sebelumnya.', source: 'Jawa Pos' },
  { id: 9, cat: 'keracunan', date: '2025-02-14', lat: -5.147, lng: 119.432, title: 'Ibu hamil & balita terdampak Makassar', loc: 'Makassar, Sulawesi Selatan', victims: 55, note: '55 terdampak termasuk 12 ibu hamil dan 8 balita. Pelanggaran penyimpanan ditemukan.', source: 'Tribun Timur' },
  { id: 10, cat: 'keracunan', date: '2025-02-19', lat: -6.121, lng: 106.152, title: 'Sanitasi dapur buruk picu keracunan Serang', loc: 'Serang, Banten', victims: 41, note: 'Dinkes Banten temukan fasilitas dapur tidak memenuhi standar sanitasi pangan.', source: 'Banten Raya' },
  { id: 11, cat: 'keracunan', date: '2025-02-22', lat: -8.409, lng: 115.189, title: 'Siswa Denpasar sakit setelah makan MBG', loc: 'Denpasar, Bali', victims: 19, note: 'Kasus pertama di Bali. Orang tua mulai enggan anaknya konsumsi MBG.', source: 'Bali Post' },
  { id: 12, cat: 'keracunan', date: '2025-02-26', lat: 3.595, lng: 98.672, title: '72 siswa SD Medan sakit pasca MBG', loc: 'Medan, Sumatera Utara', victims: 72, note: 'Sumber kontaminasi belum teridentifikasi dalam 3 hari investigasi.', source: 'Waspada Online' },
  { id: 13, cat: 'keracunan', date: '2025-03-02', lat: -3.318, lng: 114.591, title: 'Keracunan massal Banjarmasin — 56 siswa', loc: 'Banjarmasin, Kalimantan Selatan', victims: 56, note: 'Vendor baru mulai distribusi minggu sebelumnya tanpa orientasi higiene dari BGN.', source: 'Banjarmasin Post' },
  { id: 14, cat: 'keracunan', date: '2025-03-05', lat: -6.923, lng: 107.638, title: 'Vendor Bandung tanpa sertifikat BPOM', loc: 'Bandung, Jawa Barat', victims: 34, note: 'Investigasi temukan vendor baru tanpa sertifikat keamanan pangan sama sekali.', source: 'Pikiran Rakyat' },
  { id: 15, cat: 'keracunan', date: '2025-03-11', lat: -8.653, lng: 116.327, title: 'Kasus pertama NTB — dugaan ikan tidak segar', loc: 'Mataram, NTB', victims: 48, note: 'Cold chain distribusi tidak terjaga. Menu ikan laut diduga penyebab.', source: 'Lombok Post' },
  { id: 16, cat: 'keracunan', date: '2025-03-14', lat: -2.990, lng: 104.756, title: 'Keracunan Palembang — sedang diinvestigasi', loc: 'Palembang, Sumsel', victims: 27, note: 'BPOM Sumsel sedang ambil sampel makanan untuk uji laboratorium.', source: 'Sumsel Update' },
  { id: 17, cat: 'sppg', date: '2025-01-20', lat: -7.250, lng: 112.750, title: 'SPPG Surabaya tolak beroperasi, fasilitas minim', loc: 'Surabaya, Jawa Timur', victims: 0, note: 'Puluhan SPPG mengeluh tidak ada dapur layak. BGN hanya berikan kompor seadanya.', source: 'Jawa Pos' },
  { id: 18, cat: 'sppg', date: '2025-01-31', lat: -6.200, lng: 106.816, title: 'SPPG Jakarta Selatan kekurangan bahan baku', loc: 'Jakarta Selatan, DKI', victims: 0, note: '10 SPPG laporkan pasokan telat hingga 3 hari. Ratusan siswa tidak terima jatah.', source: 'Tempo.co' },
  { id: 19, cat: 'sppg', date: '2025-02-15', lat: -5.370, lng: 105.261, title: 'SPPG Bandar Lampung beroperasi tanpa izin', loc: 'Bandar Lampung, Lampung', victims: 0, note: 'ICW temukan SPPG beroperasi tanpa izin usaha dan sertifikasi pangan dari Dinkes.', source: 'ICW' },
  { id: 20, cat: 'sppg', date: '2025-02-28', lat: 1.483, lng: 124.841, title: 'SPPG Manado — logistik distribusi tidak sampai', loc: 'Manado, Sulawesi Utara', victims: 0, note: '300 siswa di 4 sekolah tidak dapat makan karena truk SPPG tidak datang.', source: 'Tribun Manado' },
  { id: 21, cat: 'sppg', date: '2025-03-07', lat: -0.501, lng: 117.154, title: 'SPPG Samarinda — 60% juru masak tidak terlatih', loc: 'Samarinda, Kalimantan Timur', victims: 0, note: 'BGN akui backlog pelatihan SDM nasional.', source: 'Kaltim Post' },
  { id: 22, cat: 'kecelakaan', date: '2025-01-25', lat: -7.557, lng: 110.827, title: 'Truk distribusi MBG terbalik di Tol Solo', loc: 'Boyolali, Jawa Tengah', victims: 2, note: 'Truk pengangkut MBG terguling di Tol Solo–Boyolali. 2 kru luka-luka. Kelebihan muatan.', source: 'Solopos' },
  { id: 23, cat: 'kecelakaan', date: '2025-02-09', lat: -6.960, lng: 107.644, title: 'Motor pengantar MBG tabrak pejalan kaki', loc: 'Bandung, Jawa Barat', victims: 1, note: 'Driver SPPG yang terburu mengantarkan makanan menabrak seorang ibu di trotoar.', source: 'Pikiran Rakyat' },
  { id: 24, cat: 'kecelakaan', date: '2025-03-01', lat: -8.174, lng: 113.965, title: 'Mobil SPPG masuk jurang di Situbondo', loc: 'Situbondo, Jawa Timur', victims: 3, note: 'Mobil distribusi MBG masuk jurang 8 meter. 1 kritis. Akses ke sekolah terpencil berbahaya.', source: 'Detik Jatim' },
  { id: 25, cat: 'tewas', date: '2025-01-29', lat: -6.183, lng: 106.822, title: 'Balita meninggal pasca keracunan MBG — Jakarta', loc: 'Jakarta Utara, DKI Jakarta', victims: 1, note: 'Balita meninggal setelah dirawat intensif akibat dugaan keracunan makanan MBG.', source: 'Kompas.com' },
  { id: 26, cat: 'tewas', date: '2025-02-17', lat: -3.986, lng: 122.514, title: 'Driver pengantar MBG tewas — Kendari', loc: 'Kendari, Sulawesi Tenggara', victims: 1, note: 'Driver pengantar MBG meninggal akibat kecelakaan tunggal saat pengiriman malam hari.', source: 'Kendari Pos' },
];
