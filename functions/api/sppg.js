/**
 * GET /api/sppg
 * Serves SPPG data for the SPPG tab.
 * Production: proxies the static GeoJSON from the government map site
 * (https://awr.ditjenpkh.pertanian.go.id/sppg/) and caches it at the edge.
 * Local dev: served by vite.config.js serveLocalData() from data/sppg.json.
 */
const SOURCE = 'https://awr.ditjenpkh.pertanian.go.id/sppg/assets/js/geojson/sppg3.js';

export async function onRequestGet(ctx) {
  const cache = caches.default;
  const cacheKey = new Request('https://mbg-monitor.pages.dev/api/sppg-cache', ctx.request);

  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    const res = await fetch(SOURCE, { headers: { 'User-Agent': 'mbg-monitor' } });
    if (!res.ok) throw new Error(`SOURCE ${res.status}`);
    const js = await res.text();

    // Strip `var sppg = ` prefix and trailing `;`, parse as JSON
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
        tanggal_operasional: p['Tanggal Operasional'],
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

    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'SPPG_SOURCE_ERROR', message: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
