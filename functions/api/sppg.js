/**
 * GET /api/sppg
 * Serves SPPG data for the SPPG tab.
 *
 * Primary: reads the bundled snapshot `data/sppg.json` (copied to dist by the
 * vite copy plugin) via the Pages ASSETS binding. No upstream dependency —
 * the government source site returns 403 to non-browser requests, so live
 * proxying is not viable.
 *
 * Local dev: served by vite.config.js serveLocalData() from data/sppg.json.
 */
const SOURCE = 'https://awr.ditjenpkh.pertanian.go.id/sppg/assets/js/geojson/sppg3.js';

const CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
  'Access-Control-Allow-Origin': '*',
};

export async function onRequestGet(ctx) {
  const cache = caches.default;
  const cacheKey = new Request('https://mbg-monitor.pages.dev/api/sppg-cache', ctx.request);

  // 1) Serve from edge cache
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, { headers: CACHE_HEADERS });
  }

  // 2) Serve from bundled snapshot via ASSETS binding
  try {
    const assetUrl = new URL('/data/sppg.json', ctx.request.url);
    const assetRes = await ctx.env.ASSETS.fetch(assetUrl);
    if (assetRes.ok) {
      const body = await assetRes.text();
      ctx.waitUntil(cache.put(cacheKey, new Response(body)));
      return new Response(body, { headers: CACHE_HEADERS });
    }
    throw new Error(`ASSETS ${assetRes.status}`);
  } catch (err) {
    // 3) Last resort: proxy the live source (may 403)
    try {
      const res = await fetch(SOURCE, {
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' },
      });
      if (!res.ok) throw new Error(`SOURCE ${res.status}`);
      const js = await res.text();
      const start = js.indexOf('{');
      const end = js.lastIndexOf('}');
      const geojson = JSON.parse(js.slice(start, end + 1));
      const sppg = (geojson.features || []).map(f => {
        const p = f.properties || {};
        const c = (f.geometry || {}).coordinates || [null, null];
        return {
          id: p.No,
          kode: p['Kode SPPG'],
          nama: p['Nama SPPG'],
          provinsi: p.Provinsi,
          kabupaten: p['Kab/Kota'],
          kecamatan: p.Kecamata,
          kelurahan: p.Kelurahan,
          alamat: p.Alamat,
          lat: c[1],
          lng: c[0],
          tanggal_pembangunan: p['Tanggal Operasional'],
          berita_url: 'https://www.google.com/search?q=' + encodeURIComponent(`${p['Nama SPPG'] || ''} berita pembangunan`),
        };
      });
      const body = JSON.stringify({
        sppg,
        total: sppg.length,
        scraped_at: new Date().toISOString(),
        source: SOURCE,
        source_note: 'Data per 30 September 2025 (snapshot di situs pemerintah)',
      });
      ctx.waitUntil(cache.put(cacheKey, new Response(body)));
      return new Response(body, { headers: CACHE_HEADERS });
    } catch (err2) {
      return new Response(JSON.stringify({ error: 'SPPG_SOURCE_ERROR', message: err2.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}
