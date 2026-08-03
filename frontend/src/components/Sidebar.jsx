import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X, Utensils, Search, MapPin, Zap, ExternalLink, Flame, AlertTriangle, Skull, Building2, Globe, TrendingUp, Database } from 'lucide-react';
import { COL, TLBL, fmtDate, fmtNum, safeUrl } from '../lib/constants';

export default function Sidebar({
  incidents,
  filtered,
  stats,
  activeId,
  search,
  setSearch,
  focusInc,
  filterCat,
  setFilterCat,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  connectionStatus,
  onShowData,
  sidebarOpen,
  setSidebarOpen,
}) {
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const timerRef = useRef(null);

  const handleSearch = useCallback((e) => {
    const val = e.target.value;

    setDebouncedSearch(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSearch(val), 200);
  }, [setSearch]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const activeCats = useMemo(() => {
    const set = new Set(incidents.map(i => i.cat).filter(Boolean));
    return ['meninggal', ...set];
  }, [incidents]);

  const hasFilter = filterCat !== 'all' || !!dateFrom || !!dateTo;

  return (
    <aside
      className="sidebar-root"
      style={{
        width: '100vw',
        minWidth: '100vw',
        height: '100vh',
        background: 'var(--sf)',
        borderRight: '1px solid var(--bd)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2000,
        overflow: 'hidden',
        position: 'absolute',
        top: 0,
        left: 0,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.24s',
      }}
    >
      {/* Topbar */}
      <div style={{
        height: 50,
        background: 'var(--sf)',
        borderBottom: '1px solid var(--bd)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <button
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen && setSidebarOpen(false)}
            aria-label="Tutup sidebar"
            style={{
              display: 'none',
              width: 36,
              height: 36,
              minWidth: 36,
              minHeight: 36,
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--red)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(248,81,73,0.3)',
            }}
          >
            <X size={20} strokeWidth={2} />
          </button>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: 'linear-gradient(135deg, #f85149, #c0392b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            boxShadow: '0 2px 8px rgba(248,81,73,0.4)',
            flexShrink: 0,
          }}>
            <Flame size={14} strokeWidth={2} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>
              <span style={{ color: 'var(--red)' }}>MBG</span> Monitor
            </div>
            <div style={{ fontFamily: 'var(--mo)', fontSize: 8, color: 'var(--mu)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>
              Peta Insiden Nasional
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        </div>
      </div>

      {/* Stats */}
      <StatsRow stats={stats} />

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Cari insiden, lokasi"
          autoComplete="off"
          spellCheck={false}
          value={debouncedSearch}
          onChange={handleSearch}
          style={{
            width: '100%',
            background: 'var(--sf2)',
            border: '1px solid var(--bd)',
            borderRadius: 7,
            padding: '11px 14px',
            fontFamily: 'var(--mo)',
            fontSize: 13,
            minHeight: 44,
            color: 'var(--tx)',
            outline: 'none',
          }}
        />
      </div>

      {/* Tag pills */}
      <div style={{
        display: 'flex',
        gap: 4,
        overflowX: 'auto',
        flexShrink: 0,
        padding: '6px 14px',
        borderBottom: '1px solid var(--bd)',
        scrollbarWidth: 'none',
      }}>
        {activeCats.map(cat => {
          const active = filterCat === cat;
          const color = cat === 'meninggal' ? 'var(--pur)' : (COL[cat] || 'var(--mu)');
          const label = cat === 'meninggal' ? 'Meninggal' : (TLBL[cat] || cat);
          return (
            <button
              key={cat}
              onClick={() => setFilterCat(active ? 'all' : cat)}
              style={{
                fontFamily: 'var(--mo)',
                fontSize: 10,
                padding: '4px 9px',
                borderRadius: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                border: `1px solid ${color}40`,
                background: active ? `${color}22` : `${color}10`,
                color,
                opacity: active ? 1 : 0.65,
                fontWeight: active ? 700 : 400,
                flexShrink: 0,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Date range */}
      <div style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        padding: '4px 14px 6px',
        borderBottom: '1px solid var(--bd)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)' }}>Dari</span>
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--sf2)',
            border: '1px solid var(--bd)',
            borderRadius: 6,
            padding: '4px 6px',
            fontFamily: 'var(--mo)',
            fontSize: 11,
            color: 'var(--tx)',
            colorScheme: 'dark',
          }}
        />
        <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)' }}>Sampai</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--sf2)',
            border: '1px solid var(--bd)',
            borderRadius: 6,
            padding: '4px 6px',
            fontFamily: 'var(--mo)',
            fontSize: 11,
            color: 'var(--tx)',
            colorScheme: 'dark',
          }}
        />
      </div>

      {/* Filter count */}
      {hasFilter && (
        <div style={{
          fontFamily: 'var(--mo)',
          fontSize: 9,
          color: 'var(--mu)',
          padding: '4px 14px 2px',
          flexShrink: 0,
        }}>
          {filtered.length} dari {incidents.length} insiden
        </div>
      )}

      <div style={{ padding: '4px 14px 6px', borderBottom: '1px solid var(--bd)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {connectionStatus?.text && (
          <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)' }}>
            Update terakhir: {connectionStatus.text}
          </span>
        )}
        <button
          onClick={onShowData}
          style={{
            fontFamily: 'var(--mo)', fontSize: 9, padding: '3px 8px', borderRadius: 8,
            border: '1px solid var(--blu)44', background: '#388bfd12', color: 'var(--blu)',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <Database size={10} /> Tentang &amp; Data
        </button>
      </div>

      {/* Feed — single unified list of all incidents */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--mu)', fontFamily: 'var(--mo)', fontSize: 11 }}>
            Tidak ada insiden ditemukan
          </div>
        ) : (
          filtered.map(inc => (
            <FeedItem
              key={inc.id}
              inc={inc}
              isActive={activeId === inc.id}
              focusInc={focusInc}
              onClick={() => {}}
            />
          ))
        )}
      </div>

      {/* Ticker */}
      <div style={{
        height: 26,
        background: 'rgba(248,81,73,0.07)',
        borderTop: '1px solid rgba(248,81,73,0.18)',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: 'var(--mo)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--red)',
          padding: '0 10px',
          textTransform: 'uppercase',
          flexShrink: 0,
          borderRight: '1px solid rgba(248,81,73,0.2)',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}>
          <Zap size={10} strokeWidth={2} />
        </div>
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{ display: 'flex', animation: 'sc 42s linear infinite', whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              MBG diluncurkan 6 Jan 2025 · Rp 71T anggaran · Target 82,9 juta penerima ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              BGN belum publikasikan data insiden resmi · DPR minta evaluasi menyeluruh ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              BPOM turun ke sejumlah dapur SPPG pasca keracunan massal · ICW pantau vendor ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              MBG diluncurkan 6 Jan 2025 · Rp 71T anggaran · Target 82,9 juta penerima ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              BGN belum publikasikan data insiden resmi · DPR minta evaluasi menyeluruh ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              BPOM turun ke sejumlah dapur SPPG pasca keracunan massal · ICW pantau vendor ·
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatsRow({ stats }) {
  const POP = 287666973;
  const pct = ((stats.victims / POP) * 100).toFixed(4);
  const row1 = [
    { label: 'Total Insiden', value: stats.total.toLocaleString('id-ID'), color: 'var(--grn)', sub: 'terpetakan', bg: '#3fb95015', icon: MapPin },
    { label: 'Korban Keracunan', value: stats.victims.toLocaleString('id-ID'), color: 'var(--red)', sub: 'orang terdampak', bg: '#f8514915', icon: AlertTriangle },
    { label: 'Korban Meninggal', value: stats.deaths.toLocaleString('id-ID'), color: 'var(--pur)', sub: 'jiwa', bg: '#bc8cff15', icon: Skull },
    { label: 'Kasus Keracunan', value: stats.keracunan_cases.toLocaleString('id-ID'), color: 'var(--amb)', sub: 'kasus', bg: '#d2992215', icon: Building2 },
  ];
  const row2 = [
    { label: 'Populasi Indonesia', value: POP.toLocaleString('id-ID'), color: 'var(--blu)', sub: 'Orang', bg: '#388bfd10', icon: Globe },
    { label: 'Korban vs Populasi', value: `${pct}%`, color: parseFloat(pct) < 0.05 ? 'var(--grn)' : 'var(--amb)', sub: 'masih aman', bg: parseFloat(pct) < 0.05 ? '#3fb95010' : '#d2992210', icon: TrendingUp },
  ];

  const cell = (item, i) => (
    <div key={i} style={{ background: item.bg || 'var(--sf)', padding: '10px 12px' }}>
      <item.icon size={16} strokeWidth={1.8} style={{ color: item.color, opacity: 0.6, marginBottom: 4 }} />
      <div style={{ fontFamily: 'var(--mo)', fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: item.color }}>
        {item.value}
      </div>
      <div style={{ fontFamily: 'var(--mo)', fontSize: 8, color: 'var(--mu)', marginTop: 1 }}>
        {item.sub}
      </div>
      <div style={{ fontFamily: 'var(--mo)', fontSize: 8, color: 'var(--mu)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
        {item.label}
      </div>
    </div>
  );

  return (
    <div style={{ flexShrink: 0 }}>
      <div className="stats-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 1,
        background: 'var(--bd)',
        borderBottom: '1px solid var(--bd)',
      }}>
        {[...row1, ...row2].map(cell)}
      </div>
    </div>
  );
}

function FeedItem({ inc, isActive, onClick, focusInc }) {
  const c = COL[inc.cat] || COL.lainnya;
  const hasArticle = !!safeUrl(inc.url);
  const hasCoords = inc.lat && inc.lng;

  return (
    <div
      onClick={() => {
        if (inc.lat && inc.lng) {
          focusInc(inc.id);
        }
      }}
      style={{
        display: 'flex',
        gap: 10,
        padding: isActive ? '11px 12px' : '11px 14px',
        paddingLeft: isActive ? 12 : 14,
        borderBottom: '1px solid var(--bd)',
        cursor: 'pointer',
        background: isActive ? 'rgba(248,81,73,0.06)' : undefined,
        borderLeft: isActive ? '2px solid var(--red)' : '2px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{
        width: 8,
        height: 8,
        borderRadius: hasCoords ? '50%' : '2px',
        background: c,
        marginTop: 3,
        flexShrink: 0,
        transform: hasCoords ? 'none' : 'rotate(45deg)',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, color: 'var(--tx)' }}>
          {inc.title}
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: 'var(--mo)',
            fontSize: 10,
            borderRadius: 3,
            padding: '1px 5px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            background: `${c}22`,
            color: c,
            border: `1px solid ${c}44`,
          }}>
            {TLBL[inc.cat] || inc.cat}
          </span>
          {inc.schools_list && inc.schools_list.length > 0 && (
            <span style={{
              fontFamily: 'var(--mo)',
              fontSize: 10,
              borderRadius: 3,
              padding: '1px 5px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              background: `${c}22`,
              color: c,
              border: `1px solid ${c}44`,
            }}>
              {inc.schools_list.length} sekolah
            </span>
          )}
          <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'var(--mu)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <MapPin size={9} strokeWidth={2} />
            {(inc.loc || 'Indonesia').split(',')[0]}
          </span>
          <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'var(--mu)' }}>
            {fmtDate(inc.date)}
          </span>
          {(inc.victims || 0) > 0 && (
            <span style={{
              fontFamily: 'var(--mo)',
              fontSize: 10,
              fontWeight: 700,
              color: (inc.victims || 0) > 40 ? 'var(--red)' : 'var(--amb)',
            }}>
              +{fmtNum(inc.victims)}
            </span>
          )}
          {inc.source && (
            <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)', fontStyle: 'italic' }}>
              {inc.source}
            </span>
          )}
          {hasArticle ? (
            <button
              onClick={(e) => { e.stopPropagation(); window.open(safeUrl(inc.url), '_blank', 'noopener,noreferrer'); }}
              style={{
                fontFamily: 'var(--mo)', fontSize: 10, padding: '4px 8px', borderRadius: 12,
                border: '1px solid #388bfd33', background: '#388bfd12', color: 'var(--blu)',
                cursor: 'pointer', lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: 4,
                whiteSpace: 'nowrap', transition: 'background 0.15s', minHeight: 22,
              }}
            >
              <ExternalLink size={10} /> Buka
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); window.open('https://id.wikipedia.org/wiki/Daftar_kasus_keracunan_massal_makan_siang_gratis#Makan_Bergizi_Gratis', '_blank', 'noopener,noreferrer'); }}
              style={{
                fontFamily: 'var(--mo)', fontSize: 10, padding: '4px 8px', borderRadius: 12,
                border: '1px solid #7d859033', background: '#7d859012', color: 'var(--mu)',
                cursor: 'pointer', lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: 4,
                whiteSpace: 'nowrap', transition: 'background 0.15s', minHeight: 22,
              }}
            >
              <ExternalLink size={10} /> Wiki
            </button>
          )}
        </div>
        {/* Show note/summary for incidents without coordinates (from news) */}
        {inc.note && !hasCoords && (
          <div style={{
            fontSize: 10,
            color: 'var(--mu)',
            lineHeight: 1.4,
            marginTop: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {inc.note}
          </div>
        )}
      </div>
    </div>
  );
}
