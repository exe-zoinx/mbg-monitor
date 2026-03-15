import { useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { COL, TLBL, fmtDate, esc, safeUrl } from '../lib/constants';

export default function MapView({ incidents, filtered, activeId, focusInc, stats }) {
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
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    L.control.attribution({ prefix: '© <a href="https://carto.com" style="color:#7d8590">CARTO</a>' }).addTo(map);

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

    incidents.forEach(inc => {
      const m = L.marker([inc.lat, inc.lng], { icon: mkIcon(inc.cat, inc.victims || 0) })
        .bindPopup(popHTML(inc), { maxWidth: 290, closeButton: true })
        .on('click', () => focusInc(inc.id));

      markersRef.current.set(inc.id, { marker: m, inc });

      if (filteredIds.has(inc.id)) {
        cluster.addLayer(m);
      }
    });
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
        zIndex: 500,
        background: 'rgba(9,12,16,0.88)',
        border: '1px solid var(--bd2)',
        borderRadius: 8,
        padding: '9px 14px',
        backdropFilter: 'blur(10px)',
      }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '-0.2px' }}>
          🇮🇩 Peta Insiden MBG — Indonesia
        </h2>
        <p style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)', marginTop: 2 }}>
          {stats.total} insiden · terakhir: {filtered[0] ? fmtDate(filtered[0].date) : '—'}
        </p>
      </div>
      {/* Map overlays */}
      <div style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
      }}
        className="map-overlays"
      >
        <OverlayPanel color="var(--red)" value={stats.total} label={['insiden', 'dipetakan']} />
        <OverlayPanel color="var(--amb)" value={stats.victims.toLocaleString('id-ID')} label={['total', 'korban']} />
      </div>
      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        right: 14,
        zIndex: 500,
        background: 'rgba(9,12,16,0.88)',
        border: '1px solid var(--bd2)',
        borderRadius: 8,
        padding: '10px 13px',
        backdropFilter: 'blur(10px)',
      }}
        className="map-legend"
      >
        <div style={{ fontFamily: 'var(--mo)', fontSize: 8, color: 'var(--mu)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          Jenis Insiden
        </div>
        {Object.entries(TLBL).filter(([k]) => k !== 'lainnya').map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, fontFamily: 'var(--mo)', fontSize: 10, color: 'var(--tx)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: COL[key], flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .map-overlays { display: none !important; }
          .map-legend { display: none !important; }
        }
      `}</style>
    </>
  );
}

function OverlayPanel({ color, value, label }) {
  return (
    <div style={{
      background: 'rgba(9,12,16,0.88)',
      border: '1px solid var(--bd2)',
      borderRadius: 7,
      padding: '7px 12px',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <div>
        <div style={{ fontFamily: 'var(--mo)', fontSize: 16, fontWeight: 700, color }}>{value}</div>
        <div style={{ fontFamily: 'var(--mo)', fontSize: 8, color: 'var(--mu)', lineHeight: 1.3 }}>
          {label.map((l, i) => <span key={i}>{l}<br /></span>)}
        </div>
      </div>
    </div>
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
  return `<div style="padding:13px 15px">
    <span style="font-family:var(--mo);font-size:9px;text-transform:uppercase;letter-spacing:.06em;border-radius:3px;padding:2px 7px;margin-bottom:8px;display:inline-block;background:${c}22;color:${c};border:1px solid ${c}44">${esc(TLBL[inc.cat] || inc.cat)}</span>
    <div style="font-size:13px;font-weight:600;line-height:1.4;margin-bottom:7px;color:var(--tx)">${esc(inc.title)}</div>
    <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px;font-family:var(--mo);font-size:10px;color:var(--mu)"><span>📍</span><span style="color:var(--tx)">${esc(inc.loc)}</span></div>
    <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px;font-family:var(--mo);font-size:10px;color:var(--mu)"><span>📅</span><span style="color:var(--tx)">${fmtDate(inc.date)}</span></div>
    ${(inc.victims || 0) > 0 ? `<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px;font-family:var(--mo);font-size:10px;color:var(--mu)"><span>🚑</span><span style="color:${c};font-weight:700">${esc(String(inc.victims))} korban</span></div>` : ''}
    <div style="font-size:11px;color:var(--mu);line-height:1.55;border-top:1px solid var(--bd);padding-top:8px;margin-top:8px">${esc(inc.note || '')}</div>
    <div style="font-family:var(--mo);font-size:9px;color:var(--mu);margin-top:6px">📰 ${esc(inc.source || '')}${url ? ` · <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="color:var(--blu)">Baca ↗</a>` : ''}</div>
  </div>`;
}
