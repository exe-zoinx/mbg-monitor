import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));


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
        copyFileSync(resolve('_headers'), resolve('dist/_headers'));
        copyFileSync(resolve('_redirects'), resolve('dist/_redirects'));
      } catch (e) {
        console.warn('Could not copy Cloudflare files:', e.message);
      }
    },
  };
}

/**
 * Local dev: serve /api/data from wiki_incidents.json only.
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
            schools_list: inc.schools_list || [],
            is_baseline: 0,
          }));

          const merged = wikiIncidents;

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

      server.middlewares.use('/api/sppg', (_req, res) => {
        try {
          const raw = readFileSync(resolve(__dirname, 'data/sppg.json'), 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(raw);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'LOCAL_SPPG_ERROR', message: err.message }));
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
