import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Inline BASELINE — 24 verified 2024 incidents (also in frontend/src/lib/constants.js)
const BASELINE = [
  { id:1001,cat:'keracunan',date:'2024-02-14',lat:-6.9175,lng:107.6191,title:'Keracunan makanan di SDN Cibeureum, Kota Bandung',loc:'Kota Bandung, Jawa Barat',victims:28,note:'Siswa mengalami mual dan muntah',source:'tribunjabar.id',url:'',is_baseline:1},
  { id:1002,cat:'keracunan',date:'2024-03-08',lat:-7.7956,lng:110.3695,title:'Puluhan siswa SD di Sleman keracunan makanan program makan gratis',loc:'Sleman, DI Yogyakarta',victims:34,note:'Siswa SD Negeri di Kecamatan Gamping mengalami gejala keracunan',source:'krjogja.com',url:'',is_baseline:1},
  { id:1003,cat:'sppg_temp_closed',date:'2024-03-22',lat:-6.2088,lng:106.8456,title:'SPPG Jakarta Selatan ditutup sementara karena pelanggaran sanitasi',loc:'Jakarta Selatan, DKI Jakarta',victims:0,note:'Dinkes DKI menutup sementara SPPG di Pasar Minggu',source:'kompas.com',url:'',is_baseline:1},
  { id:1004,cat:'keracunan',date:'2024-04-17',lat:-6.9667,lng:110.4000,title:'Siswa SMP di Semarang keracunan massal',loc:'Kota Semarang, Jawa Tengah',victims:42,note:'42 siswa SMP Negeri dirawat setelah menyantap makanan dari dapur sekolah',source:'suaramerdeka.com',url:'',is_baseline:1},
  { id:1005,cat:'keracunan',date:'2024-05-03',lat:-5.1477,lng:119.4327,title:'Belasan siswa SD Makassar keracunan makanan',loc:'Kota Makassar, Sulawesi Selatan',victims:18,note:'Siswa SD di Kecamatan Rappocini mengalami diare dan muntah',source:'fajar.co.id',url:'',is_baseline:1},
  { id:1006,cat:'sppg_opened',date:'2024-05-15',lat:-6.1751,lng:106.6294,title:'SPPG pertama Jakarta Timur beroperasi sebagai pilot MBG',loc:'Jakarta Timur, DKI Jakarta',victims:0,note:'SPPG di Cakung mulai beroperasi, kapasitas 5.000 porsi/hari',source:'jakarta.tribunnews.com',url:'',is_baseline:1},
  { id:1007,cat:'keracunan',date:'2024-06-11',lat:-7.8731,lng:112.5270,title:'Siswa SMK di Malang keracunan program makan siang',loc:'Kota Malang, Jawa Timur',victims:25,note:'25 siswa SMK keracunan di kantin sekolah',source:'surya.co.id',url:'',is_baseline:1},
  { id:1008,cat:'laporan',date:'2024-06-28',lat:-6.2000,lng:106.8167,title:'BPKP: Audit dana persiapan MBG temukan penyimpangan',loc:'Jakarta, DKI Jakarta',victims:0,note:'BPKP melaporkan penyimpangan dana persiapan MBG',source:'kompas.com',url:'',is_baseline:1},
  { id:1009,cat:'keracunan',date:'2024-07-09',lat:-0.0263,lng:109.3425,title:'Keracunan makanan di Pontianak, puluhan siswa dirawat',loc:'Kota Pontianak, Kalimantan Barat',victims:31,note:'Siswa SD keracunan makanan siap saji program pemerintah',source:'pontianak.tribunnews.com',url:'',is_baseline:1},
  { id:1010,cat:'kecelakaan',date:'2024-07-24',lat:-6.5944,lng:106.8001,title:'Truk pengangkut bahan pangan SPPG kecelakaan di Bogor',loc:'Kabupaten Bogor, Jawa Barat',victims:3,note:'Truk bahan baku SPPG kecelakaan, 3 orang luka',source:'radarbogor.id',url:'',is_baseline:1},
  { id:1011,cat:'anggaran',date:'2024-08-05',lat:-7.5500,lng:110.8500,title:'DPR soroti anggaran MBG tidak terserap optimal',loc:'Jakarta, DKI Jakarta',victims:0,note:'Penyerapan anggaran MBG baru 35% dari alokasi Rp4 triliun',source:'antaranews.com',url:'',is_baseline:1},
  { id:1012,cat:'keracunan',date:'2024-08-19',lat:-3.9886,lng:122.5130,title:'Korban keracunan makanan sekolah di Kendari bertambah',loc:'Kota Kendari, Sulawesi Tenggara',victims:56,note:'56 siswa keracunan, Dinkes temukan E. coli',source:'antaranews.com',url:'',is_baseline:1},
  { id:1013,cat:'sppg',date:'2024-09-02',lat:-7.8014,lng:110.3647,title:'SPPG Sleman beroperasi penuh, target 10.000 porsi per hari',loc:'Sleman, DI Yogyakarta',victims:0,note:'SPPG Sleman capai kapasitas penuh',source:'harianjogja.com',url:'',is_baseline:1},
  { id:1014,cat:'keracunan',date:'2024-09-15',lat:-8.1738,lng:113.6872,title:'Siswa SD Jember keracunan, 2 dirawat intensif',loc:'Kabupaten Jember, Jawa Timur',victims:23,note:'2 dari 23 korban dirawat intensif di RSUD Jember',source:'jawapos.com',url:'',is_baseline:1},
  { id:1015,cat:'sppg_temp_closed',date:'2024-09-30',lat:-1.2654,lng:116.8312,title:'SPPG Balikpapan ditutup sementara akibat inspeksi',loc:'Kota Balikpapan, Kalimantan Timur',victims:0,note:'Kualitas air SPPG tidak memenuhi standar',source:'kaltim.tribunnews.com',url:'',is_baseline:1},
  { id:1016,cat:'keracunan',date:'2024-10-08',lat:-6.3273,lng:106.8547,title:'Puluhan siswa Tangerang Selatan keracunan makanan',loc:'Tangerang Selatan, Banten',victims:38,note:'38 siswa SD keracunan, Labkesda temukan Staph aureus',source:'banten.tribunnews.com',url:'',is_baseline:1},
  { id:1017,cat:'tewas',date:'2024-10-22',lat:-7.3275,lng:112.7454,title:'Satu siswa meninggal setelah keracunan makanan sekolah',loc:'Sidoarjo, Jawa Timur',victims:15,note:'Siswa SD meninggal, 14 dirawat',source:'surya.co.id',url:'',is_baseline:1},
  { id:1018,cat:'anggaran',date:'2024-11-04',lat:-6.2088,lng:106.8456,title:'Pemerintah alokasikan tambahan Rp12 triliun untuk MBG 2025',loc:'Jakarta, DKI Jakarta',victims:0,note:'Tambahan anggaran MBG untuk 2025',source:'antaranews.com',url:'',is_baseline:1},
  { id:1019,cat:'keracunan',date:'2024-11-13',lat:-2.9761,lng:104.7754,title:'Siswa Palembang keracunan makanan program bantuan',loc:'Kota Palembang, Sumatera Selatan',victims:29,note:'29 siswa keracunan makanan program bantuan pangan',source:'sripoku.com',url:'',is_baseline:1},
  { id:1020,cat:'sppg_opened',date:'2024-11-25',lat:-6.9147,lng:107.6098,title:'SPPG Bandung siap distribusi 8.000 porsi untuk pilot MBG',loc:'Kota Bandung, Jawa Barat',victims:0,note:'SPPG Bandung Selatan siap distribusi 15 sekolah',source:'pikiran-rakyat.com',url:'',is_baseline:1},
  { id:1021,cat:'keracunan',date:'2024-12-02',lat:-8.5833,lng:116.1000,title:'Keracunan makanan di SD Lombok, korban didominasi anak-anak',loc:'Lombok Barat, Nusa Tenggara Barat',victims:45,note:'45 orang keracunan di festival makanan sekolah',source:'suara.com',url:'',is_baseline:1},
  { id:1022,cat:'sppg',date:'2024-12-10',lat:-7.2500,lng:112.7500,title:'SPPG Surabaya Barat uji coba produksi untuk pilot MBG',loc:'Kota Surabaya, Jawa Timur',victims:0,note:'SPPG Surabaya uji coba 6.000 porsi/hari',source:'jawapos.com',url:'',is_baseline:1},
  { id:1023,cat:'keracunan',date:'2024-12-18',lat:3.5952,lng:98.6722,title:'Siswa SD Medan keracunan, pemicu makanan bekal tidak layak',loc:'Kota Medan, Sumatera Utara',victims:20,note:'20 siswa Medan Amplas keracunan, bahan tidak layak',source:'medan.tribunnews.com',url:'',is_baseline:1},
  { id:1024,cat:'laporan',date:'2024-12-28',lat:-6.2088,lng:106.8456,title:'Laporan akhir tahun: 12 kasus keracunan makanan sekolah di 2024',loc:'Nasional',victims:0,note:'Kemenkes catat 12 insiden keracunan massal di sekolah 2024',source:'kompas.com',url:'',is_baseline:1},
];

// Indonesian month names → numeric
const IND_MONTHS = {
  'januari':'01','februari':'02','maret':'03','april':'04',
  'mei':'05','juni':'06','juli':'07','agustus':'08',
  'september':'09','oktober':'10','november':'11','desember':'12',
};

function normalizeDate(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // "Tidak Disebutkan" or empty
  if (/tidak\s+disebutkan|tidak\s+ada/i.test(s) || !s) return '';
  // "7 S/d 9 Mei 2025" → take first day
  const rangeMatch = s.match(/^(\d{1,2})\s+S\/d\s+\d{1,2}\s+(\w+)\s+(\d{4})/i);
  if (rangeMatch) {
    const m = IND_MONTHS[rangeMatch[2].toLowerCase()];
    if (m) return `${rangeMatch[3]}-${m}-${rangeMatch[1].padStart(2,'0')}`;
  }
  // "Agustus 2025" — month + year only → 1st of month
  const monthYearMatch = s.match(/^(\w+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const m = IND_MONTHS[monthYearMatch[1].toLowerCase()];
    if (m) return `${monthYearMatch[2]}-${m}-01`;
  }
  // "7 Mei 2025" — standard Indonesian date
  const dateMatch = s.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (dateMatch) {
    const m = IND_MONTHS[dateMatch[2].toLowerCase()];
    if (m) return `${dateMatch[3]}-${m}-${dateMatch[1].padStart(2,'0')}`;
  }
  // Fallback: try Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

function copyCloudflareFiles() {
  return {
    name: 'copy-cloudflare-files',
    closeBundle() {
      try {
        copyFileSync(resolve('frontend/_headers'), resolve('dist/_headers'));
        copyFileSync(resolve('frontend/_redirects'), resolve('dist/_redirects'));
      } catch (e) {
        console.warn('Could not copy Cloudflare files:', e.message);
      }
    },
  };
}

/**
 * Local dev: serve /api/data from wiki_incidents.json + BASELINE.
 * Mirrors production Pages Function (functions/api/data.js) without D1/KV.
 */
function serveLocalData() {
  let wikiCache = null;

  return {
    name: 'serve-local-data',
    configureServer(server) {
      server.middlewares.use('/api/data', (_req, res) => {
        try {
          if (!wikiCache) {
            const raw = readFileSync(
              resolve(__dirname, 'data/wiki_incidents.json'), 'utf-8'
            );
            wikiCache = JSON.parse(raw);
          }

          const wikiIncidents = wikiCache.incidents.map((inc, i) => ({
            id: 9000 + i,
            cat: inc.cat || 'keracunan',
            date: normalizeDate(inc.date),
            lat: inc.lat ?? null,
            lng: inc.lng ?? null,
            title: inc.title || inc.school || inc.loc || 'Tidak disebutkan',
            loc: inc.loc || inc.kabupaten || inc.province || '',
            victims: inc.victims ?? 0,
            deaths: inc.deaths ?? 0,
            note: inc.note || '',
            source: inc.source || 'Wikipedia',
            source_url: inc.source_url || '',
            url: inc.source_url || inc.url || '',
            school: inc.school || '',
            province: inc.province || '',
            kabupaten: inc.kabupaten || '',
            is_baseline: 0,
          }));

          const merged = [...BASELINE, ...wikiIncidents];

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({
            ok: true,
            incidents: merged,
            stats: null,
            meta: {
              refreshed_at: new Date().toISOString(),
              source: 'local-wiki',
              provider: 'local-dev',
            },
          }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'LOCAL_DATA_ERROR', message: err.message }));
        }
      });
    },
  };
}

export default defineConfig({
  root: 'frontend',
  plugins: [react(), copyCloudflareFiles(), serveLocalData()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
