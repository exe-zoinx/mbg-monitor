import { useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { MapPin, AlertTriangle, Skull, Building2, ExternalLink, Menu, Globe, TrendingUp } from 'lucide-react';
import { COL, TLBL, fmtDate, fmtNum, esc, safeUrl } from '../lib/constants';

export default function MapView({ incidents, filtered, activeId, focusInc, stats, onMenuClick }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const clusterRef = useRef(null);
  const markersRef = useRef(new Map());

  // Initialize map once
  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [-2.5, 118],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    L.control.attribution({ prefix: '&copy; <a href="https://carto.com" style="color:#7d8590">CARTO</a>' }).addTo(map);

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 10,
    });
    map.addLayer(cluster);

    mapInstance.current = map;
    clusterRef.current = cluster;

    return () => {
      map.remove();
      mapInstance.current = null;
      clusterRef.current = null;
    };
  }, []);

  // Create/update markers when incidents change
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    cluster.clearLayers();
    markersRef.current.clear();

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

        const m = L.marker([lat, lng], { icon: mkIcon(inc.cat, inc.victims || 0) })
          .bindPopup(popHTML(inc), { maxWidth: 290, closeButton: true })
          .on('click', () => focusInc(inc.id));

        markersRef.current.set(inc.id, { marker: m, inc });
        if (filteredIds.has(inc.id)) {
          cluster.addLayer(m);
        }
      });
    }
  }, [incidents, filtered, focusInc]);
  // Handle activeId changes (fly to marker)
  useEffect(() => {
    if (!activeId) return;
    const entry = markersRef.current.get(activeId);
    const map = mapInstance.current;
    const cluster = clusterRef.current;
    if (!entry || !map || !cluster) return;

    const { marker, inc } = entry;
    map.flyTo([inc.lat, inc.lng], Math.max(map.getZoom(), 9), { duration: 0.7 });
    setTimeout(() => {
      cluster.zoomToShowLayer(marker, () => marker.openPopup());
    }, 450);
  }, [activeId]);

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

function popHTML(inc) {
  const c = COL[inc.cat] || COL.lainnya;
  const url = safeUrl(inc.url || '');
  const WIKI_URL = 'https://id.wikipedia.org/wiki/Daftar_kasus_keracunan_massal_makan_siang_gratis#Makan_Bergizi_Gratis';
  const srcUrl = url || WIKI_URL;
  const srcLabel = url ? 'Baca &rarr;' : 'Wiki &rarr;';
  const srcColor = url ? 'var(--blu)' : 'var(--mu)';
  return `<div style="padding:13px 15px">
    <span style="font-family:var(--mo);font-size:9px;text-transform:uppercase;letter-spacing:.06em;border-radius:3px;padding:2px 7px;margin-bottom:8px;display:inline-block;background:${c}22;color:${c};border:1px solid ${c}44">${esc(TLBL[inc.cat] || inc.cat)}</span>
    <div style="font-size:13px;font-weight:600;line-height:1.4;margin-bottom:7px;color:var(--tx)">${esc(inc.title)}</div>
    <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px;font-family:var(--mo);font-size:10px;color:var(--mu)"><span style="color:var(--tx)">${esc(inc.loc)}</span></div>
    <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px;font-family:var(--mo);font-size:10px;color:var(--mu)"><span style="color:var(--tx)">${fmtDate(inc.date)}</span></div>
    ${(inc.victims || 0) > 0 ? `<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px;font-family:var(--mo);font-size:10px;color:var(--mu)"><span style="color:${c};font-weight:700">${esc(fmtNum(inc.victims))} korban</span></div>` : ''}
    <div style="font-size:11px;color:var(--mu);line-height:1.55;border-top:1px solid var(--bd);padding-top:8px;margin-top:8px">${esc((inc.note || '').slice(0, 150))}${(inc.note || '').length > 150 ? '...' : ''}</div>
    ${(inc.schools_list && inc.schools_list.length) ? `<div style="border-top:1px solid var(--bd);padding-top:6px;margin-top:6px;font-family:var(--mo);font-size:10px;color:var(--mu)"><div style="margin-bottom:3px;color:var(--tx)">${fmtNum(inc.schools_list.length)} sekolah terdampak:</div>${inc.schools_list.slice(0, 8).map(s => `&middot; ${esc(s)}`).join('<br/>')}${inc.schools_list.length > 8 ? `<br/>&middot; +${fmtNum(inc.schools_list.length - 8)} lainnya` : ''}</div>` : ''}
    <div style="font-family:var(--mo);font-size:9px;color:var(--mu);margin-top:6px">${esc(inc.source || 'Wikipedia')} &middot; <a href="${esc(srcUrl)}" target="_blank" rel="noopener noreferrer" style="color:${srcColor}">${srcLabel}</a></div>
  </div>`;
}
