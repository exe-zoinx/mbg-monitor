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

// No baseline data — all incidents come from live scraping
export const BASELINE = [];
