import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { CATEGORIES, CAT_SHORT, COL, TLBL, fmtDate, safeUrl } from '../lib/constants';

export default function Sidebar({
  incidents,
  filtered,
  stats,
  activeId,
  filterCat,
  setFilterCat,
  search,
  setSearch,
  focusInc,
  connectionStatus,
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

  return (
    <aside
      style={{
        width: 'var(--sw)',
        minWidth: 'var(--sw)',
        height: '100vh',
        background: 'var(--sf)',
        borderRight: '1px solid var(--bd)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        overflow: 'hidden',
        ...(typeof window !== 'undefined' && window.innerWidth <= 640
          ? {
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 2000,
              transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.24s',
            }
          : {}),
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
          }}>
            🍱
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(248,81,73,0.1)',
            border: '1px solid rgba(248,81,73,0.25)',
            borderRadius: 20,
            padding: '3px 9px',
            fontFamily: 'var(--mo)',
            fontSize: 9,
            color: 'var(--red)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            <div style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--red)',
              animation: 'lp 1.6s infinite',
            }} />
            LIVE
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            border: '1px solid var(--bd)',
            borderRadius: 20,
            padding: '3px 9px',
            fontFamily: 'var(--mo)',
            fontSize: 9,
            color: 'var(--mu)',
          }}>
            <div style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: connectionStatus.cls === 'g' ? 'var(--grn)' : connectionStatus.cls === 'a' ? 'var(--amb)' : connectionStatus.cls === 'r' ? 'var(--red)' : 'var(--mu)',
              ...(connectionStatus.cls === 'r' ? { animation: 'lp 1.6s infinite' } : {}),
            }} />
            <span style={{ fontFamily: 'var(--mo)', fontSize: 9 }}>{connectionStatus.text}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatsRow stats={stats} />

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="🔍  Cari insiden, lokasi…"
          autoComplete="off"
          spellCheck={false}
          value={debouncedSearch}
          onChange={handleSearch}
          style={{
            width: '100%',
            background: 'var(--sf2)',
            border: '1px solid var(--bd)',
            borderRadius: 7,
            padding: '7px 11px',
            fontFamily: 'var(--mo)',
            fontSize: 11,
            color: 'var(--tx)',
            outline: 'none',
          }}
        />
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--bd)',
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            style={{
              flex: 1,
              minWidth: 50,
              padding: '8px 3px',
              fontFamily: 'var(--mo)',
              fontSize: 8,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: filterCat === cat ? 'var(--tx)' : 'var(--mu)',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              borderBottomWidth: 2,
              borderBottomStyle: 'solid',
              borderBottomColor: filterCat === cat ? 'var(--red)' : 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {CAT_SHORT[cat]}{' '}
            <span style={{
              display: 'inline-block',
              background: filterCat === cat ? 'var(--red)' : 'var(--sf2)',
              border: `1px solid ${filterCat === cat ? 'var(--red)' : 'var(--bd)'}`,
              borderRadius: 6,
              padding: '0 4px',
              fontSize: 8,
              marginLeft: 2,
              lineHeight: 1.4,
              color: filterCat === cat ? '#fff' : undefined,
            }}>
              {cat === 'all' ? stats.total : stats[cat] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Feed — single unified list of all incidents */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
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
          fontSize: 8,
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
          ⚡
        </div>
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{ display: 'flex', animation: 'sc 42s linear infinite', whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              MBG diluncurkan 6 Jan 2025 · Rp 71T anggaran · Target 82,9 juta penerima ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              BGN belum publikasikan data insiden resmi · DPR minta evaluasi menyeluruh ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              BPOM turun ke sejumlah dapur SPPG pasca keracunan massal · ICW pantau vendor ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              MBG diluncurkan 6 Jan 2025 · Rp 71T anggaran · Target 82,9 juta penerima ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              BGN belum publikasikan data insiden resmi · DPR minta evaluasi menyeluruh ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              BPOM turun ke sejumlah dapur SPPG pasca keracunan massal · ICW pantau vendor ·
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatsRow({ stats }) {
  const items = [
    { label: 'Total Insiden', value: stats.total, color: 'var(--red)', sub: 'terpetakan' },
    { label: 'Total Korban', value: stats.victims.toLocaleString('id-ID'), color: 'var(--amb)', sub: 'orang terdampak' },
    { label: 'Keracunan', value: stats.keracunan, color: 'var(--red)', sub: 'kasus' },
    { label: 'SPPG / Lain', value: stats.other, color: 'var(--blu)', sub: 'laporan' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 1,
      background: 'var(--bd)',
      borderBottom: '1px solid var(--bd)',
      flexShrink: 0,
    }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: 'var(--sf)', padding: '10px 14px' }}>
          <div style={{ fontFamily: 'var(--mo)', fontSize: 8, color: 'var(--mu)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
            {item.label}
          </div>
          <div style={{ fontFamily: 'var(--mo)', fontSize: 24, fontWeight: 700, lineHeight: 1, color: item.color }}>
            {item.value}
          </div>
          <div style={{ fontFamily: 'var(--mo)', fontSize: 8, color: 'var(--mu)', marginTop: 2 }}>
            {item.sub}
          </div>
        </div>
      ))}
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
        if (typeof window !== 'undefined' && window.innerWidth <= 640) {
          // handled by parent
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
            fontSize: 8,
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
          <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'var(--mu)' }}>
            📍 {(inc.loc || 'Indonesia').split(',')[0]}
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
              +{inc.victims}
            </span>
          )}
          {inc.source && (
            <span style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)', fontStyle: 'italic' }}>
              {inc.source}
            </span>
          )}
          {hasArticle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(safeUrl(inc.url), '_blank', 'noopener,noreferrer');
              }}
              style={{
                fontFamily: 'var(--mo)',
                fontSize: 9,
                padding: '1px 6px',
                borderRadius: 3,
                border: '1px solid var(--bd)',
                background: 'var(--sf2)',
                color: 'var(--blu)',
                cursor: 'pointer',
                lineHeight: 1.4,
              }}
            >
              ↗ Buka
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
