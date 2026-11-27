import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { MapPin, AlertTriangle, Skull, Building2, ExternalLink, Menu, Globe, TrendingUp, Moon, Sun, Satellite } from 'lucide-react';
import { COL, TLBL, fmtDate, fmtNum, esc, safeUrl } from '../lib/constants';
import { BASEMAPS, FALLBACK_TILES } from '../lib/basemaps';
import { incidentKey, ownerFor, casesForSppg, operatorName } from '../lib/links';

export default function MapView({ incidents, filtered, activeId, focusInc, stats, onMenuClick, activeTab, sppgData, layers, setLayers, linkIndex }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const clusterRef = useRef(null);
  const sppgClusterRef = useRef(null);
  const meninggalClusterRef = useRef(null);
  const linkLayerRef = useRef(null);
  const markersRef = useRef(new Map());
  const baseRef = useRef(null);
  const labelRef = useRef(null);
  const attrRef = useRef(null);
  const tileErrRef = useRef(0);
  const [mapReady, setMapReady] = useState(0);
  // Bumped once incident markers are (re)built, so a deep-linked ?id= can fly
  // to a marker that did not exist yet when activeId first arrived.
  const [markersVersion, setMarkersVersion] = useState(0);
  const focusedRef = useRef(null);
  const [basemap, setBasemap] = useState(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('mbg_basemap') : null;
    return BASEMAPS[saved] ? saved : 'dark';
  });

  // Initialize map once
  useEffect(() => {
    if (mapInstance.current || mapRef.current?._leaflet_id) return;

    const map = L.map(mapRef.current, {
      center: [-2.5, 118],
      zoom: 5,
      maxZoom: 18, // markerClusterGroup needs a map maxZoom before tiles load
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true, // 7.6k SPPG circleMarkers render on one canvas
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    // Attribution prefix is set per basemap below; Esri and OSM are keyless.
    attrRef.current = L.control.attribution({ prefix: false }).addTo(map);
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 10,
      iconCreateFunction(cl) {
        const n = cl.getChildCount();
        const cls = n > 20 ? 'large' : n > 5 ? 'medium' : 'small';
        return L.divIcon({
          html: `<div><span>${n}</span></div>`,
          className: `marker-cluster marker-cluster-keracunan marker-cluster-${cls}`,
          iconSize: L.point(36, 36),
        });
      },
    });
    const sppgCluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 10,
      chunkedLoading: true, // process 7.6k SPPG markers in async batches
      iconCreateFunction(cl) {
        const n = cl.getChildCount();
        const cls = n > 50 ? 'large' : n > 15 ? 'medium' : 'small';
        return L.divIcon({
          html: `<div><span>${n}</span></div>`,
          className: `marker-cluster marker-cluster-sppg marker-cluster-${cls}`,
          iconSize: L.point(36, 36),
        });
      },
    });
    const meninggalCluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 10,
      iconCreateFunction(cl) {
        const n = cl.getChildCount();
        const cls = n > 20 ? 'large' : n > 5 ? 'medium' : 'small';
        return L.divIcon({
          html: `<div><span>${n}</span></div>`,
          className: `marker-cluster marker-cluster-meninggal marker-cluster-${cls}`,
          iconSize: L.point(38, 38),
        });
      },
    });
    const linkLayer = L.layerGroup();
    map.addLayer(linkLayer);         // bottom — incident→accused-SPPG connectors
    map.addLayer(sppgCluster);       // back
    map.addLayer(cluster);           // middle — all incidents
    map.addLayer(meninggalCluster);  // top — deaths only

    mapInstance.current = map;
    clusterRef.current = cluster;
    sppgClusterRef.current = sppgCluster;
    meninggalClusterRef.current = meninggalCluster;
    linkLayerRef.current = linkLayer;
    setMapReady(v => v + 1);
    map.invalidateSize();

    return () => {
      map.remove();
      mapInstance.current = null;
      clusterRef.current = null;
      sppgClusterRef.current = null;
      meninggalClusterRef.current = null;
      linkLayerRef.current = null;
    };
  }, []);

  // Basemap swap — keyless Esri layers, OSM as last-resort fallback.
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const bm = BASEMAPS[basemap] || BASEMAPS.dark;

    for (const r of [baseRef, labelRef]) {
      if (r.current) { map.removeLayer(r.current); r.current = null; }
    }
    tileErrRef.current = 0;

    const base = L.tileLayer(bm.base, { maxZoom: bm.maxZoom, crossOrigin: true });
    base.on('tileerror', () => {
      // Esri unreachable/blocked → drop to keyless OSM instead of blank map
      if (++tileErrRef.current < 4 || baseRef.current !== base) return;
      map.removeLayer(base);
      const fb = L.tileLayer(FALLBACK_TILES, { maxZoom: 19 }).addTo(map);
      fb.bringToBack();
      baseRef.current = fb;
      if (attrRef.current) attrRef.current.setPrefix('&copy; OpenStreetMap contributors');
    });
    base.addTo(map);
    base.bringToBack();
    baseRef.current = base;

    if (bm.labels) {
      labelRef.current = L.tileLayer(bm.labels, { maxZoom: bm.maxZoom }).addTo(map);
    }
    if (attrRef.current) attrRef.current.setPrefix(bm.attribution);
    try { localStorage.setItem('mbg_basemap', basemap); } catch { /* private mode */ }
  }, [basemap, mapReady]);


  // Incident markers — keracunan layer
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    cluster.clearLayers();
    if (layers?.keracunan === false) return;

    const filteredIds = new Set(filtered.map(i => i.id));

    // ── Group by exact lat/lng ────────────────────────────────────────────────
    const byLoc = new Map(); // key "lat,lng" → [inc, inc, ...]
    for (const inc of incidents) {
      if (!inc.lat || !inc.lng) continue;
      const key = `${inc.lat},${inc.lng}`;
      if (!byLoc.has(key)) byLoc.set(key, []);
      byLoc.get(key).push(inc);
    }

    // ── Spiral offset so overlapping pins fan out ──────────────────────────────
    // Returns [dLat, dLng] in degrees (~67m per 0.001 at equator)
    const spiralOffsets = (index) => {
      if (index === 0) return [0, 0];
      const GA = Math.PI * (3 - Math.sqrt(5)); // golden angle ≈ 2.399 rad
      const radius = Math.sqrt(index) * 0.0012; // ~134m per step at equator
      const angle = index * GA;
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    };

    // ── Add markers ───────────────────────────────────────────────────────────
    for (const [, incs] of byLoc) {
      incs.forEach((inc, idx) => {
        const [dLat, dLng] = spiralOffsets(idx);
        const lat = inc.lat + dLat;
        const lng = inc.lng + dLng;

        const m = L.marker([lat, lng], { icon: mkIcon(inc.cat, inc.victims || 0), title: inc.title || 'Insiden' })
          .bindPopup(popHTML(inc, linkIndex?.byIncident), { maxWidth: 290, closeButton: true })
          .on('click', () => focusInc(inc.id));

        markersRef.current.set(inc.id, { marker: m, inc });
        if (filteredIds.has(inc.id)) {
          cluster.addLayer(m);
        }
      });
    }
    setMarkersVersion(v => v + 1);
  }, [incidents, filtered, focusInc, layers?.keracunan, linkIndex]);

  // Meninggal layer — deaths > 0, purple, on top
  useEffect(() => {
    const cluster = meninggalClusterRef.current;
    if (!cluster) return;

    cluster.clearLayers();
    if (layers?.meninggal === false) return;

    incidents.forEach(inc => {
      if (!inc.lat || !inc.lng) return;
      if (!inc.deaths) return;
      const m = L.circleMarker([inc.lat, inc.lng], {
        radius: 7,
        color: '#bc8cff66',
        weight: 1,
        fillColor: '#bc8cff',
        fillOpacity: 0.85,
      })
        .bindPopup(popHTML(inc, linkIndex?.byIncident), { maxWidth: 290, closeButton: true })
        .on('click', () => focusInc(inc.id));
      markersRef.current.set(`meninggal-${inc.id}`, { marker: m, inc });
      cluster.addLayer(m);
    });
  }, [incidents, layers?.meninggal, focusInc, linkIndex]);

  // SPPG markers — sppg layer (behind incidents)
  // Time-sliced: 7.6k markers built in chunks so the main thread
  // never blocks long (pins appear progressively in the background).
  useEffect(() => {
    const cluster = sppgClusterRef.current;
    if (!cluster) return;

    cluster.clearLayers();
    if (layers?.sppg === false) return;
    if (!sppgData?.sppg?.length) return;

    let cancelled = false;
    let i = 0;
    const CHUNK = 100;

    const processChunk = () => {
      if (cancelled) return;
      const end = Math.min(i + CHUNK, sppgData.sppg.length);
      for (; i < end; i++) {
        const s = sppgData.sppg[i];
        if (!s.lat || !s.lng) continue;
        // All SPPG use blue; risiko/meninggal flags are shown in the sidebar list only
        const m = L.circleMarker([s.lat, s.lng], {
          radius: 4,
          color: '#388bfd55',
          weight: 1,
          fillColor: '#388bfd',
          fillOpacity: 0.45,
        })
          .bindPopup(sppgPopHTML(s, linkIndex), { maxWidth: 280, closeButton: true });
        markersRef.current.set(`sppg-${s.id ?? s.kode}`, { marker: m, inc: s });
        cluster.addLayer(m);
      }
      if (i < sppgData.sppg.length) setTimeout(processChunk, 16);
    };

    processChunk();
    return () => { cancelled = true; };
  }, [sppgData, layers?.sppg, linkIndex]);
  // Incident → accused SPPG connectors (JejakMBG cases). Dashed, non-interactive,
  // drawn on their own layer so the 7.6k SPPG markers stay untouched.
  useEffect(() => {
    const layer = linkLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (layers?.links === false) return;
    if (!linkIndex?.cases?.length) return;

    for (const c of linkIndex.cases) {
      const from = c.incident_lat != null && c.incident_lng != null
        ? [c.incident_lat, c.incident_lng]
        : (c.lat != null && c.lng != null ? [c.lat, c.lng] : null);
      const to = c.sppg_lat != null && c.sppg_lng != null ? [c.sppg_lat, c.sppg_lng] : null;
      if (!from || !to) continue;
      if (Math.abs(from[0] - to[0]) < 1e-6 && Math.abs(from[1] - to[1]) < 1e-6) continue;
      L.polyline([from, to], {
        color: '#bc8cff',
        weight: 1.2,
        opacity: 0.45,
        dashArray: '3 4',
        interactive: false,
      }).addTo(layer);
    }
  }, [linkIndex, layers?.links, mapReady]);

  // Handle activeId changes (fly to marker)
  useEffect(() => {
    if (!activeId || focusedRef.current === activeId) return;
    const entry = markersRef.current.get(activeId);
    const map = mapInstance.current;
    if (!entry || !map) return;
    focusedRef.current = activeId;

    const { marker, inc } = entry;
    // SPPG markers live in sppgClusterRef, incidents in clusterRef.
    // Incident ids are numbers; SPPG ids are `sppg-<id>` strings.
    const isSppg = typeof activeId === 'string' && activeId.startsWith('sppg-');
    const cluster = isSppg ? sppgClusterRef.current : clusterRef.current;

    map.flyTo([inc.lat, inc.lng], isSppg ? Math.max(map.getZoom(), 13) : Math.max(map.getZoom(), 9), { duration: 0.7 });
    if (cluster) {
      setTimeout(() => {
        cluster.zoomToShowLayer(marker, () => marker.openPopup());
      }, 500);
    } else {
      marker.openPopup();
    }
  }, [activeId, markersVersion]);

  return (
    <>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {/* Map title overlay */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: 14,
        right: 14,
        zIndex: 500,
        background: 'rgba(9,12,16,0.88)',
        border: '1px solid var(--bd2)',
        borderRadius: 8,
        padding: '9px 14px',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
        className="map-title"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onMenuClick}
            style={{
              display: 'none',
              background: 'var(--red)',
              border: 'none',
              borderRadius: 6,
              padding: '6px 10px',
              fontFamily: 'var(--mo)',
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              cursor: 'pointer',
              alignItems: 'center',
              gap: 4,
              boxShadow: '0 2px 8px rgba(248,81,73,0.4)',
            }}
            className="mobile-sidebar-btn"
          >
            <Menu size={12} strokeWidth={2} /> Menu
          </button>
          <div style={{ flexShrink: 0 }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '-0.2px' }}>
              <span style={{ fontSize: 14 }}>ID</span> Peta Insiden MBG — Indonesia
            </h2>
            <p style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)', marginTop: 2 }}>
              {fmtNum(stats.total)} insiden · terakhir: {filtered[0] ? fmtDate(filtered[0].date) : '—'}
            </p>
          </div>
        </div>
        {/* Stat chips — row below title on mobile */}
        <div className="map-title-stats" style={{
          display: 'none',
          gap: 6,
          flexWrap: 'wrap',
        }}>
          {[{ icon: MapPin, value: fmtNum(stats.total), color: 'var(--grn)', label: 'insiden' },
            { icon: AlertTriangle, value: fmtNum(stats.victims), color: 'var(--red)', label: 'korban' },
            { icon: Skull, value: fmtNum(stats.deaths), color: 'var(--pur)', label: 'meninggal' },
            { icon: Building2, value: fmtNum(stats.keracunan_cases), color: 'var(--amb)', label: 'kasus' },
            { icon: Globe, value: '287.666.973', color: 'var(--blu)', label: 'populasi' },
            { icon: TrendingUp, value: `${((stats.victims / 287666973) * 100).toFixed(4)}%`, color: (stats.victims / 287666973) < 0.0005 ? 'var(--grn)' : 'var(--amb)', label: 'vs pop' },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: '#ffffff08', borderRadius: 5, padding: '4px 8px',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              <s.icon size={12} strokeWidth={2} style={{ color: s.color, opacity: 0.6 }} />
              <span style={{ fontFamily: 'var(--mo)', fontSize: 11, fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontFamily: 'var(--mo)', fontSize: 8, color: 'var(--mu)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Basemap switcher — all keyless (Esri / OSM) */}
      <div
        className="map-basemap-toggle"
        role="group"
        aria-label="Gaya peta"
        style={{
          position: 'absolute',
          top: 84,
          right: 14,
          zIndex: 500,
          display: 'flex',
          gap: 2,
          background: 'rgba(13,17,23,0.92)',
          border: '1px solid var(--bd2)',
          borderRadius: 8,
          padding: 3,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {[
          { id: 'dark', icon: Moon, label: 'Gelap' },
          { id: 'light', icon: Sun, label: 'Terang' },
          { id: 'sat', icon: Satellite, label: 'Satelit' },
        ].map((b) => {
          const on = basemap === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setBasemap(b.id)}
              aria-pressed={on}
              title={`Peta ${b.label}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: on ? 'rgba(56,139,253,0.18)' : 'transparent',
                border: on ? '1px solid rgba(56,139,253,0.5)' : '1px solid transparent',
                color: on ? 'var(--blu)' : 'var(--mu)',
                borderRadius: 6, padding: '4px 7px', cursor: 'pointer',
                fontFamily: 'var(--mo)', fontSize: 10, fontWeight: on ? 700 : 400,
              }}
            >
              <b.icon size={12} strokeWidth={2} />
              <span className="bm-label">{b.label}</span>
            </button>
          );
        })}
      </div>

      {/* Layer toggle control */}
      <div style={{
        position: 'absolute',
        bottom: 30,
        right: 14,
        zIndex: 500,
        background: 'rgba(13,17,23,0.92)',
        border: '1px solid var(--bd2)',
        borderRadius: 8,
        padding: '8px 10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        fontFamily: 'var(--mo)',
        fontSize: 11,
        backdropFilter: 'blur(6px)',
      }}
        className="map-layer-toggle"
      >
        {[
          { key: 'keracunan', label: 'Keracunan', color: 'var(--red)' },
          { key: 'meninggal', label: 'Meninggal', color: 'var(--pur)' },
          { key: 'sppg', label: 'SPPG', color: 'var(--blu)' },
          { key: 'links', label: 'SPPG dituduh', color: 'var(--pur)' },
        ].map(row => (
          <label
            key={row.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
              cursor: 'pointer',
              color: 'var(--tx)',
              whiteSpace: 'nowrap',
            }}
          >
            <input
              type="checkbox"
              checked={!!layers[row.key]}
              onChange={() => setLayers(prev => ({ ...prev, [row.key]: !prev[row.key] }))}
              style={{ accentColor: row.color, cursor: 'pointer', width: 16, height: 16 }}
            />
            <span style={{ color: row.color, fontWeight: layers[row.key] ? 700 : 400 }}>
              {row.label}
            </span>
          </label>
        ))}
      </div>

    </>
  );
}



function mkIcon(cat, v) {
  const c = COL[cat] || COL.lainnya;
  const sz = cat === 'keracunan' || cat === 'tewas'
    ? (v > 80 ? 19 : v > 40 ? 16 : 13)
    : 11;
  const tot = sz + 14;
  return L.divIcon({
    html: `<div style="position:relative;width:${tot}px;height:${tot}px;display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;width:${sz + 6}px;height:${sz + 6}px;border-radius:50%;background:${c};animation:mp 2.2s infinite;top:${(tot - sz - 6) / 2}px;left:${(tot - sz - 6) / 2}px;pointer-events:none"></div>
      <div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${c};border:2px solid rgba(255,255,255,.22);position:relative;z-index:1;box-shadow:0 0 10px ${c}99,0 2px 6px rgba(0,0,0,.5)"></div>
    </div>`,
    className: '',
    iconSize: [tot, tot],
    iconAnchor: [tot / 2, tot / 2],
  });
}

function accusedBlock(cases) {
  if (!cases?.length) return '';
  return cases.slice(0, 2).map(c => {
    const op = c.operator || '';
    const src = (c.operator_sources && c.operator_sources[0]) || (c.sources && c.sources[0]) || null;
    const srcLink = src?.url
      ? ` <a href="${esc(safeUrl(src.url))}" target="_blank" rel="noopener noreferrer" style="color:var(--blu)">bukti &rarr;</a>`
      : '';
    const match = c.sppg_nama
      ? `<div style="font-size:10px;color:var(--mu);font-family:var(--mo)">&#8594; ${esc(c.sppg_nama)}${c.sppg_distance_km != null ? ` &middot; ${c.sppg_distance_km} km` : ''}${c.match_confidence ? ` &middot; ${c.match_confidence}` : ''}</div>`
      : '';
    return `<div style="border-top:1px dashed var(--pur)55;padding-top:6px;margin-top:6px">
      <div style="font-family:var(--mo);font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--pur)">SPPG disebut</div>
      <div style="font-size:11px;color:var(--tx);line-height:1.45;margin-top:2px">${esc(c.kitchen_label || '')}</div>
      ${match}
      ${op ? `<div style="font-size:11px;color:var(--tx);margin-top:3px">Penyelenggara: <strong>${esc(op)}</strong>${srcLink}</div>` : ''}
    </div>`;
  }).join('');
}


function sppgPopHTML(s, linkIndex) {
  const owner = ownerFor(linkIndex, s);
  const accused = casesForSppg(linkIndex, s);
  const op = operatorName(owner);
  const opSrc = owner?.operators?.[0]?.sources?.[0];
  const opLink = opSrc?.url
    ? `<div style="font-family:var(--mo);font-size:9px;margin-top:2px"><a href="${esc(safeUrl(opSrc.url))}" target="_blank" rel="noopener noreferrer" style="color:var(--blu)">Sumber: ${esc(opSrc.outlet || 'berita')} &rarr;</a></div>`
    : '';
  const accusedHtml = accused.length
    ? `<div style="border-top:1px solid var(--red)44;margin-top:6px;padding-top:6px">
        <div style="font-family:var(--mo);font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--red)">${accused.length} kasus keracunan terkait</div>
        ${accused.slice(0, 3).map(c => `<div style="font-size:10px;color:var(--mu);line-height:1.5">&middot; ${esc(c.event_date || '')} ${esc(c.school_or_site || '')}</div>`).join('')}
      </div>`
    : '';
  return `<div style="font-family:var(--fn);font-size:12px;color:var(--tx);min-width:190px">
      <div style="font-weight:700;font-size:12px;line-height:1.4;margin-bottom:6px">${esc(s.nama || 'SPPG')}</div>
      <div style="font-family:var(--mo);font-size:10px;color:var(--mu);margin-bottom:4px">${esc([s.provinsi, s.kabupaten, s.kecamatan].filter(Boolean).join(' · '))}</div>
      ${s.alamat ? `<div style="font-size:11px;color:var(--mu);line-height:1.5;margin-bottom:4px">${esc(s.alamat)}</div>` : ''}
      ${op ? `<div style="font-size:11px;color:var(--tx);margin-top:4px">Yayasan/penyelenggara: <strong>${esc(op)}</strong></div>${opLink}` : ''}
      ${accusedHtml}
      ${s.tanggal_pembangunan ? `<div style="font-family:var(--mo);font-size:9px;color:var(--mu);margin-top:4px">${esc(s.tanggal_pembangunan)}</div>` : ''}
    </div>`;
}


function popHTML(inc, byIncident) {
  const c = COL[inc.cat] || COL.lainnya;
  const url = safeUrl(inc.url || '');
  const WIKI_URL = 'https://id.wikipedia.org/wiki/Daftar_kasus_keracunan_massal_makan_siang_gratis#Makan_Bergizi_Gratis';
  const srcUrl = url || WIKI_URL;
  const srcLabel = url ? 'Baca &rarr;' : 'Wiki &rarr;';
  const srcColor = url ? 'var(--blu)' : 'var(--mu)';
  const accused = byIncident?.get(incidentKey(inc)) || null;
  return `<div>
    <span style="font-family:var(--mo);font-size:9px;text-transform:uppercase;letter-spacing:.06em;border-radius:3px;padding:2px 7px;margin-bottom:8px;display:inline-block;background:${c}22;color:${c};border:1px solid ${c}44">${esc(TLBL[inc.cat] || inc.cat)}</span>
    <div style="font-size:13px;font-weight:600;line-height:1.4;margin-bottom:7px;color:var(--tx)">${esc(inc.title)}</div>
    <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px;font-family:var(--mo);font-size:10px;color:var(--mu)"><span style="color:var(--tx)">${esc(inc.loc)}</span></div>
    <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px;font-family:var(--mo);font-size:10px;color:var(--mu)"><span style="color:var(--tx)">${fmtDate(inc.date)}</span></div>
    ${(inc.victims || 0) > 0 ? `<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px;font-family:var(--mo);font-size:10px;color:var(--mu)"><span style="color:${c};font-weight:700">${esc(fmtNum(inc.victims))} korban</span></div>` : ''}
    <div style="font-size:11px;color:var(--mu);line-height:1.55;border-top:1px solid var(--bd);padding-top:8px;margin-top:8px">${esc((inc.note || '').slice(0, 150))}${(inc.note || '').length > 150 ? '...' : ''}</div>
    ${(inc.schools_list && inc.schools_list.length) ? `<div style="border-top:1px solid var(--bd);padding-top:6px;margin-top:6px;font-family:var(--mo);font-size:10px;color:var(--mu)"><div style="margin-bottom:3px;color:var(--tx)">${fmtNum(inc.schools_list.length)} sekolah terdampak:</div>${inc.schools_list.slice(0, 8).map(s => `&middot; ${esc(s)}`).join('<br/>')}${inc.schools_list.length > 8 ? `<br/>&middot; +${fmtNum(inc.schools_list.length - 8)} lainnya` : ''}</div>` : ''}
    ${accusedBlock(accused)}
    <div style="font-family:var(--mo);font-size:9px;color:var(--mu);margin-top:6px">${esc(inc.source || 'Wikipedia')} &middot; <a href="${esc(srcUrl)}" target="_blank" rel="noopener noreferrer" style="color:${srcColor}">${srcLabel}</a></div>
  </div>`;
}
