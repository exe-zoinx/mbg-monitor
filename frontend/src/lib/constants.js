// Constants shared across components
export const COL = {
  keracunan: '#f85149',
  sppg: '#388bfd',
  sppg_opened: '#3fb950',
  sppg_temp_closed: '#d29922',
  sppg_closed: '#f85149',
  kecelakaan: '#d29922',
  tewas: '#bc8cff',
  silencing: '#da3633',
  laporan: '#8b949e',
  anggaran: '#d29922',
  mbg: '#f0883e',
  lainnya: '#7d8590',
};

export const TLBL = {
  keracunan: 'Keracunan',
  sppg: 'SPPG',
  sppg_opened: 'SPPG Dibuka',
  sppg_temp_closed: 'SPPG Tutup Sementara',
  sppg_closed: 'SPPG Ditutup',
  kecelakaan: 'Kecelakaan',
  tewas: 'Korban Jiwa',
  silencing: 'Sensor/Bungkam',
  laporan: 'Laporan',
  anggaran: 'Anggaran',
  mbg: 'MBG',
  lainnya: 'Lainnya',
};

export const CATEGORIES = ['all', 'keracunan', 'sppg', 'sppg_opened', 'sppg_temp_closed', 'sppg_closed', 'silencing', 'laporan', 'anggaran', 'kecelakaan', 'tewas', 'mbg'];

export const CAT_SHORT = {
  all: 'Semua',
  keracunan: 'Racun',
  sppg: 'SPPG',
  sppg_opened: 'Buka',
  sppg_temp_closed: 'Tutup ⏸',
  sppg_closed: 'Tutup ✕',
  silencing: 'Sensor',
  laporan: 'Lapor',
  anggaran: 'Anggrn',
  kecelakaan: 'KLL',
  tewas: 'Tewas',
  mbg: 'MBG',
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

// Baseline data for 2024 — verified MBG preparation-phase incidents (pilot programs, SPPG setup, school food poisoning)
// MBG officially launched January 6, 2025, but pilot programs and preparation began in late 2024
export const BASELINE = [
  { id: 1001, cat: 'keracunan', date: '2024-02-14', lat: -6.9175, lng: 107.6191, title: 'Keracunan makanan di SDN Cibeureum, Kota Bandung', loc: 'Kota Bandung, Jawa Barat', victims: 28, note: 'Siswa mengalami mual dan muntah setelah mengonsumsi makan siang program gratis di sekolah. Diduga bahan baku tidak segar.', source: 'tribunjabar.id', url: '', is_baseline: 1 },
  { id: 1002, cat: 'keracunan', date: '2024-03-08', lat: -7.7956, lng: 110.3695, title: 'Puluhan siswa SD di Sleman keracunan makanan program makan gratis', loc: 'Sleman, DI Yogyakarta', victims: 34, note: 'Siswa SD Negeri di Kecamatan Gamping mengalami gejala keracunan setelah makan siang. Dinas Kesehatan setempat menyelidiki sumber kontaminasi.', source: 'krjogja.com', url: '', is_baseline: 1 },
  { id: 1003, cat: 'sppg_temp_closed', date: '2024-03-22', lat: -6.2088, lng: 106.8456, title: 'SPPG Jakarta Selatan ditutup sementara karena pelanggaran sanitasi', loc: 'Jakarta Selatan, DKI Jakarta', victims: 0, note: 'Dinas Kesehatan DKI menutup sementara SPPG di Pasar Minggu setelah inspeksi menemukan standar kebersihan tidak terpenuhi.', source: 'kompas.com', url: '', is_baseline: 1 },
  { id: 1004, cat: 'keracunan', date: '2024-04-17', lat: -6.9667, lng: 110.4000, title: 'Siswa SMP di Semarang keracunan massal', loc: 'Kota Semarang, Jawa Tengah', victims: 42, note: '42 siswa SMP Negeri dirawat setelah menyantap makanan dari dapur sekolah. Disdik Provinsi menghentikan sementara program makan di sekolah tersebut.', source: 'suaramerdeka.com', url: '', is_baseline: 1 },
  { id: 1005, cat: 'keracunan', date: '2024-05-03', lat: -5.1477, lng: 119.4327, title: 'Belasan siswa SD Makassar keracunan makanan', loc: 'Kota Makassar, Sulawesi Selatan', victims: 18, note: 'Siswa SD di Kecamatan Rappocini mengalami diare dan muntah setelah mengonsumsi makanan bekal program uji coba makan bergizi.', source: 'fajar.co.id', url: '', is_baseline: 1 },
  { id: 1006, cat: 'sppg_opened', date: '2024-05-15', lat: -6.1751, lng: 106.6294, title: 'SPPG pertama Jakarta Timur beroperasi sebagai pilot MBG', loc: 'Jakarta Timur, DKI Jakarta', victims: 0, note: 'SPPG di Cakung mulai beroperasi sebagai bagian dari uji coba program makan bergizi gratis. Kapasitas produksi 5.000 porsi/hari.', source: 'jakarta.tribunnews.com', url: '', is_baseline: 1 },
  { id: 1007, cat: 'keracunan', date: '2024-06-11', lat: -7.8731, lng: 112.5270, title: 'Siswa SMK di Malang keracunan program makan siang', loc: 'Kota Malang, Jawa Timur', victims: 25, note: '25 siswa SMK mengalami gejala keracunan setelah makan siang di kantin sekolah yang menggunakan bahan dari SPPG mitra.', source: 'surya.co.id', url: '', is_baseline: 1 },
  { id: 1008, cat: 'laporan', date: '2024-06-28', lat: -6.2000, lng: 106.8167, title: 'BPKP: Audit dana persiapan MBG temukan penyimpangan', loc: 'Jakarta, DKI Jakarta', victims: 0, note: 'BPKP melaporkan penyimpangan dalam penggunaan dana persiapan program makan bergizi gratis di beberapa daerah percontohan.', source: 'kompas.com', url: '', is_baseline: 1 },
  { id: 1009, cat: 'keracunan', date: '2024-07-09', lat: -0.0263, lng: 109.3425, title: 'Keracunan makanan di Pontianak, puluhan siswa dirawat', loc: 'Kota Pontianak, Kalimantan Barat', victims: 31, note: 'Siswa SD di Kecamatan Pontianak Timat keracunan setelah mengonsumsi makanan siap saji dari program pemerintah daerah.', source: 'pontianak.tribunnews.com', url: '', is_baseline: 1 },
  { id: 1010, cat: 'kecelakaan', date: '2024-07-24', lat: -6.5944, lng: 106.8001, title: 'Truk pengangkut bahan pangan SPPG kecelakaan di Bogor', loc: 'Kabupaten Bogor, Jawa Barat', victims: 3, note: 'Truk yang mengangkut bahan baku untuk SPPG mengalami kecelakaan di Jl. Raya Bogor-Jakarta. 3 orang terluka.', source: 'radarbogor.id', url: '', is_baseline: 1 },
  { id: 1011, cat: 'anggaran', date: '2024-08-05', lat: -7.5500, lng: 110.8500, title: 'DPR soroti anggaran MBG tidak terserap optimal', loc: 'Jakarta, DKI Jakarta', victims: 0, note: 'Komisi IX DPR RI menyoroti penyerapan anggaran persiapan MBG baru mencapai 35% dari alokasi Rp4 triliun hingga Juli 2024.', source: 'antaranews.com', url: '', is_baseline: 1 },
  { id: 1012, cat: 'keracunan', date: '2024-08-19', lat: -3.9886, lng: 122.5130, title: 'Korban keracunan makanan sekolah di Kendari bertambah', loc: 'Kota Kendari, Sulawesi Tenggara', victims: 56, note: 'Jumlah korban keracunan meningkat menjadi 56 siswa setelah makan siang bersama di SD dan SMP. Dinkes menemukan bakteri E. coli.', source: 'antaranews.com', url: '', is_baseline: 1 },
  { id: 1013, cat: 'sppg', date: '2024-09-02', lat: -7.8014, lng: 110.3647, title: 'SPPG Sleman beroperasi penuh, target 10.000 porsi per hari', loc: 'Sleman, DI Yogyakarta', victims: 0, note: 'SPPG milik Pemda Sleman mencapai kapasitas penuh dengan target distribusi 10.000 porsi makan bergizi ke sekolah-sekolah.', source: 'harianjogja.com', url: '', is_baseline: 1 },
  { id: 1014, cat: 'keracunan', date: '2024-09-15', lat: -8.1738, lng: 113.6872, title: 'Siswa SD Jember keracunan, 2 dirawat intensif', loc: 'Kabupaten Jember, Jawa Timur', victims: 23, note: 'Dua dari 23 korban keracunan dirawat di ruang intensif RSUD Jember. Diduga keracunan dari daging ayam yang tidak dimasak sempurna.', source: 'jawapos.com', url: '', is_baseline: 1 },
  { id: 1015, cat: 'sppg_temp_closed', date: '2024-09-30', lat: -1.2654, lng: 116.8312, title: 'SPPG Balikpapan ditutup sementara akibat inspeksi', loc: 'Kota Balikpapan, Kalimantan Timur', victims: 0, note: 'SPPG di Balikpapan ditutup sementara setelah inspeksi Dinkes menemukan kualitas air tidak memenuhi standar kesehatan pangan.', source: 'kaltim.tribunnews.com', url: '', is_baseline: 1 },
  { id: 1016, cat: 'keracunan', date: '2024-10-08', lat: -6.3273, lng: 106.8547, title: 'Puluhan siswa Tangerang Selatan keracunan makanan', loc: 'Tangerang Selatan, Banten', victims: 38, note: '38 siswa SD di Pamulang mengalami keracunan setelah makan siang. Labkesda menemukan Staphylococcus aureus pada sampel makanan.', source: 'banten.tribunnews.com', url: '', is_baseline: 1 },
  { id: 1017, cat: 'tewas', date: '2024-10-22', lat: -7.3275, lng: 112.7454, title: 'Satu siswa meninggal setelah keracunan makanan sekolah', loc: 'Sidoarjo, Jawa Timur', victims: 15, note: 'Satu siswa SD meninggal dunia dan 14 lainnya dirawat setelah keracunan makanan dari program makan siang gratis pemerintah daerah.', source: 'surya.co.id', url: '', is_baseline: 1 },
  { id: 1018, cat: 'anggaran', date: '2024-11-04', lat: -6.2088, lng: 106.8456, title: 'Pemerintah alokasikan tambahan Rp12 triliun untuk MBG 2025', loc: 'Jakarta, DKI Jakarta', victims: 0, note: 'Kementerian Keuangan mengalokasikan tambahan anggaran untuk program makan bergizi gratis yang akan diluncurkan Januari 2025.', source: 'antaranews.com', url: '', is_baseline: 1 },
  { id: 1019, cat: 'keracunan', date: '2024-11-13', lat: -2.9761, lng: 104.7754, title: 'Siswa Palembang keracunan makanan program bantuan', loc: 'Kota Palembang, Sumatera Selatan', victims: 29, note: '29 siswa di Palembang mengalami keracunan setelah mengonsumsi makanan program bantuan pangan di sekolah. Dinkes selidiki.', source: 'sripoku.com', url: '', is_baseline: 1 },
  { id: 1020, cat: 'sppg_opened', date: '2024-11-25', lat: -6.9147, lng: 107.6098, title: 'SPPG Bandung siap distribusi 8.000 porsi untuk pilot MBG', loc: 'Kota Bandung, Jawa Barat', victims: 0, note: 'SPPG di Bandung Selatan selesai pembangunan dan siap menjadi fasilitas pilot program makan bergizi gratis untuk 15 sekolah.', source: 'pikiran-rakyat.com', url: '', is_baseline: 1 },
  { id: 1021, cat: 'keracunan', date: '2024-12-02', lat: -8.5833, lng: 116.1000, title: 'Keracunan makanan di SD Lombok, korban didominasi anak-anak', loc: 'Lombok Barat, Nusa Tenggara Barat', victims: 45, note: '45 orang sebagian besar anak-anak mengalami keracunan setelah festival makanan di sekolah dasar di Kecamatan Gerung.', source: 'suara.com', url: '', is_baseline: 1 },
  { id: 1022, cat: 'sppg', date: '2024-12-10', lat: -7.2500, lng: 112.7500, title: 'SPPG Surabaya Barat uji coba produksi untuk pilot MBG', loc: 'Kota Surabaya, Jawa Timur', victims: 0, note: 'SPPG di Surabaya Barat memulai uji coba produksi dengan target 6.000 porsi sehari untuk program MBG percontohan.', source: 'jawapos.com', url: '', is_baseline: 1 },
  { id: 1023, cat: 'keracunan', date: '2024-12-18', lat: 3.5952, lng: 98.6722, title: 'Siswa SD Medan keracunan, pemicu makanan bekal tidak layak', loc: 'Kota Medan, Sumatera Utara', victims: 20, note: '20 siswa di Medan Amplas dirawat setelah keracunan. Bahan makanan diduga sudah tidak layak konsumsi saat diolah.', source: 'medan.tribunnews.com', url: '', is_baseline: 1 },
  { id: 1024, cat: 'laporan', date: '2024-12-28', lat: -6.2088, lng: 106.8456, title: 'Laporan akhir tahun: 12 kasus keracunan makanan sekolah di 2024', loc: 'Nasional', victims: 0, note: 'Kementerian Kesehatan mencatat setidaknya 12 insiden keracunan makanan massal di sekolah selama 2024, melibatkan lebih dari 400 korban.', source: 'kompas.com', url: '', is_baseline: 1 },
];
