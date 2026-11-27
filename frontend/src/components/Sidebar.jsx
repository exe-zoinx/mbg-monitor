import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Utensils, Search, MapPin, Zap, ExternalLink, Flame, AlertTriangle, Skull, Building2, Globe, TrendingUp, Database, Calendar, Share2 } from 'lucide-react';
import { COL, TLBL, fmtDate, fmtNum, safeUrl } from '../lib/constants';
import Insights from './Insights';
import { incidentKey, ownerFor, casesForSppg, operatorName } from '../lib/links';
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
  activeTab,
  setActiveTab,
  sppgData,
  linkIndex,
  onlyAccused,
  setOnlyAccused,
  activeMonth,
  onPickMonth,
  onPickProvince,
  newSinceVisit,
}) {

  const [localSearch, setLocalSearch] = useState(search);

  // Deep-link / province-click updates land on the prop; mirror them into the input.
  useEffect(() => { setLocalSearch(search); }, [search]);

  const handleSearch = useCallback(() => {
    setSearch(localSearch.trim());
  }, [localSearch, setSearch]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      setSearch(localSearch.trim());
    }
  }, [localSearch, setSearch]);

  const clearSearch = useCallback(() => {
    setLocalSearch('');
    setSearch('');
  }, [setSearch]);

  // Progressive rendering: rows are content-sized (owner + case chips wrap), so
  // fixed-height virtualization overlapped once those chips were added. Render a
  // page, append another when the list nears its end.
  const FEED_CHUNK = 150;
  const [feedLimit, setFeedLimit] = useState(FEED_CHUNK);
  useEffect(() => { setFeedLimit(FEED_CHUNK); }, [activeTab, search, filterCat, dateFrom, dateTo, onlyAccused]);
  const handleFeedScroll = useCallback((e) => {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) {
      setFeedLimit(n => n + FEED_CHUNK);
    }
  }, []);

  const activeCats = useMemo(() => {
    const set = new Set(incidents.map(i => i.cat).filter(Boolean));
    return ['meninggal', ...set];
  }, [incidents]);

  const accusedIncidentCount = useMemo(
    () => (linkIndex?.byIncident ? incidents.filter(i => linkIndex.byIncident.has(incidentKey(i))).length : 0),
    [incidents, linkIndex],
  );

  const hasFilter = filterCat !== 'all' || !!dateFrom || !!dateTo || !!onlyAccused;

  const sppgFiltered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return sppgData?.sppg || [];
    return (sppgData?.sppg || []).filter(s => {
      const owner = linkIndex?.bySppg?.get(String(s.id)) || linkIndex?.bySppg?.get(String(s.kode));
      const op = owner?.operators?.[0]?.name || '';
      return s.nama?.toLowerCase().includes(q) ||
        s.provinsi?.toLowerCase().includes(q) ||
        s.kabupaten?.toLowerCase().includes(q) ||
        s.kecamatan?.toLowerCase().includes(q) ||
        s.alamat?.toLowerCase().includes(q) ||
        op.toLowerCase().includes(q);
    });
  }, [sppgData, search, linkIndex]);

  const sppgStats = useMemo(() => {
    if (!sppgData?.sppg) return null;
    let risiko = 0;
    const provCounts = {};
    const kabs = new Set();
    for (const s of sppgData.sppg) {
      if (s.risiko) risiko++;
      if (s.provinsi) provCounts[s.provinsi] = (provCounts[s.provinsi] || 0) + 1;
      if (s.kabupaten) kabs.add(s.kabupaten);
    }
    const topProv = Object.entries(provCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      risiko,
      topProvName: topProv ? topProv[0] : '—',
      topProvCount: topProv ? topProv[1] : 0,
      kabupatens: kabs.size,
    };
  }, [sppgData]);

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

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--bd)',
        flexShrink: 0,
      }}
        role="tablist"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'incidents'}
          onClick={() => setActiveTab('incidents')}
          style={{
            flex: 1, fontFamily: 'var(--mo)', fontSize: 11, fontWeight: 600,
            padding: '10px 0', textAlign: 'center', cursor: 'pointer',
            transition: 'all 0.15s ease', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'incidents' ? '2px solid var(--red)' : '2px solid transparent',
            color: activeTab === 'incidents' ? 'var(--tx)' : 'var(--mu)',
          }}
        >
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: 'var(--red)', marginRight: 6, verticalAlign: 1,
          }} />
          Insiden
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'sppg'}
          onClick={() => setActiveTab('sppg')}
          style={{
            flex: 1, fontFamily: 'var(--mo)', fontSize: 11, fontWeight: 600,
            padding: '10px 0', textAlign: 'center', cursor: 'pointer',
            transition: 'all 0.15s ease', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'sppg' ? '2px solid var(--blu)' : '2px solid transparent',
            color: activeTab === 'sppg' ? 'var(--tx)' : 'var(--mu)',
          }}
        >
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: 'var(--blu)', marginRight: 6, verticalAlign: 1,
          }} />
          SPPG
        </button>
      </div>

      <StatsRow stats={stats} activeTab={activeTab} sppgData={sppgData} sppgStats={sppgStats} />

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <input
            id="mbg-search"
            type="text"
            placeholder={activeTab === 'sppg' ? 'Cari SPPG, provinsi' : 'Cari insiden, sekolah, lokasi'}
            autoComplete="off"
            spellCheck={false}
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              background: 'var(--sf2)',
              border: '1px solid var(--bd)',
              borderRadius: 7,
              padding: '11px 38px 11px 14px',
              fontFamily: 'var(--mo)',
              fontSize: 13,
              minHeight: 44,
              color: 'var(--tx)',
              outline: 'none',
            }}
          />
          {localSearch && (
            <button
              onClick={clearSearch}
              aria-label="Bersihkan pencarian"
              style={{
                position: 'absolute',
                right: 34,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--mu)',
                padding: 4,
                display: 'flex',
              }}
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
          <button
            onClick={handleSearch}
            aria-label="Cari"
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--mu)',
              padding: 4,
              display: 'flex',
            }}
          >
            <Search size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      {activeTab === 'incidents' && (
        <>

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
          aria-label="Tanggal dari"
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
          aria-label="Tanggal sampai"
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

      {/* Quick ranges */}
      <div style={{
        display: 'flex', gap: 4, padding: '0 14px 6px', flexShrink: 0,
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        {[
          { label: '7h', days: 7 }, { label: '30h', days: 30 },
          { label: '90h', days: 90 }, { label: '1th', days: 365 },
        ].map(p => (
          <button
            key={p.label}
            onClick={() => {
              const to = new Date();
              const from = new Date(Date.now() - p.days * 864e5);
              setDateFrom(from.toISOString().slice(0, 10));
              setDateTo(to.toISOString().slice(0, 10));
            }}
            style={{
              fontFamily: 'var(--mo)', fontSize: 9, padding: '3px 8px', borderRadius: 10,
              cursor: 'pointer', border: '1px solid var(--bd2)',
              background: 'var(--sf2)', color: 'var(--mu)',
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setOnlyAccused(v => !v)}
          title="Hanya insiden yang menyebut SPPG yang memasok makanan"
          style={{
            fontFamily: 'var(--mo)', fontSize: 9, padding: '3px 8px', borderRadius: 10,
            cursor: 'pointer', whiteSpace: 'nowrap',
            border: `1px solid ${onlyAccused ? 'var(--pur)' : 'var(--bd2)'}`,
            background: onlyAccused ? 'rgba(188,140,255,0.14)' : 'var(--sf2)',
            color: onlyAccused ? 'var(--pur)' : 'var(--mu)',
          }}
        >
          SPPG disebut{accusedIncidentCount ? ` (${accusedIncidentCount})` : ''}
        </button>
        {newSinceVisit > 0 && (
          <span
            title={`${newSinceVisit} insiden baru sejak kunjungan terakhir`}
            style={{
              marginLeft: 'auto', fontFamily: 'var(--mo)', fontSize: 9,
              color: 'var(--grn)', border: '1px solid var(--grn)44',
              background: '#3fb95012', borderRadius: 10, padding: '3px 8px',
              whiteSpace: 'nowrap',
            }}
          >
            +{newSinceVisit} baru
          </span>
        )}
      </div>

      <Insights
        incidents={incidents}
        activeMonth={activeMonth}
        onPickMonth={onPickMonth}
        onPickProvince={onPickProvince}
      />

      {/* Filter count */}
      {hasFilter && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          fontFamily: 'var(--mo)',
          fontSize: 9,
          color: 'var(--mu)',
          padding: '4px 14px 2px',
          flexShrink: 0,
        }}>
          <span>{filtered.length} dari {incidents.length} insiden</span>
          <button
            onClick={() => { setFilterCat('all'); setDateFrom(''); setDateTo(''); setOnlyAccused(false); onPickMonth && onPickMonth(''); }}
            style={{
              fontFamily: 'var(--mo)',
              fontSize: 9,
              padding: '2px 8px',
              borderRadius: 8,
              cursor: 'pointer',
              border: '1px solid var(--red)44',
              background: '#f8514912',
              color: 'var(--red)',
              whiteSpace: 'nowrap',
            }}
          >
            Reset filter
          </button>
        </div>
      )}
        </>
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

      {/* Feed — tab-conditional, virtualized */}
      <div
        style={{ flex: 1, overflowY: 'auto', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onScroll={handleFeedScroll}
      >
        {activeTab === 'incidents' ? (
          filtered.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--mu)', fontFamily: 'var(--mo)', fontSize: 11 }}>
              Tidak ada insiden ditemukan
            </div>
          ) : (
            <>
              {filtered.slice(0, feedLimit).map(inc => (
                <FeedItem
                  key={inc.id}
                  inc={inc}
                  isActive={activeId === inc.id}
                  focusInc={focusInc}
                  onClick={() => {}}
                  setSidebarOpen={setSidebarOpen}
                  accused={linkIndex?.byIncident?.get(incidentKey(inc)) || null}
                  linkIndex={linkIndex}
                />
              ))}
              {filtered.length > feedLimit && (
                <div style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'var(--mo)', fontSize: 10, color: 'var(--mu)' }}>
                  {fmtNum(feedLimit)} dari {fmtNum(filtered.length)} — gulir untuk memuat lagi
                </div>
              )}
            </>
          )
        ) : !sppgData ? (
          /* Loading skeleton */
          <div style={{ padding: '14px' }}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  height: 64, borderRadius: 6, marginBottom: 10,
                  background: 'var(--sf2)',
                  animation: 'lp 1.5s ease infinite',
                }}
              />
            ))}
          </div>
        ) : sppgFiltered.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--mu)', fontFamily: 'var(--mo)', fontSize: 11 }}>
            Tidak ada SPPG ditemukan
          </div>
        ) : (
          <>
            {sppgFiltered.slice(0, feedLimit).map(s => (
              <SppgItem key={s.id ?? s.kode} sppg={s} focusInc={focusInc} setSidebarOpen={setSidebarOpen} linkIndex={linkIndex} />
            ))}
            {sppgFiltered.length > feedLimit && (
              <div style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'var(--mo)', fontSize: 10, color: 'var(--mu)' }}>
                {fmtNum(feedLimit)} dari {fmtNum(sppgFiltered.length)} — gulir untuk memuat lagi
              </div>
            )}
          </>
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
              BPOM turun ke sejumlah dapur SPPG pasca laporan peristiwa kesehatan · evaluasi menyeluruh berlanjut ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              MBG diluncurkan 6 Jan 2025 · Rp 71T anggaran · Target 82,9 juta penerima ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              BGN belum publikasikan data insiden resmi · DPR minta evaluasi menyeluruh ·
            </span>
            <span style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'rgba(248,81,73,0.75)', paddingRight: 60 }}>
              BPOM turun ke sejumlah dapur SPPG pasca laporan peristiwa kesehatan · evaluasi menyeluruh berlanjut ·
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatsRow({ stats, activeTab, sppgData, sppgStats }) {
  const POP = 287666973;
  const pct = ((stats.victims / POP) * 100).toFixed(4);

  const isSppg = activeTab === 'sppg';
  const total = sppgData?.total || 0;
  const ratio = total > 0 ? Math.round(POP / total).toLocaleString('id-ID') : '—';
  const row1 = isSppg ? [
    { label: 'Total SPPG', value: total.toLocaleString('id-ID'), color: 'var(--blu)', sub: 'unit', bg: '#388bfd12', icon: Building2 },
    { label: 'Risiko Insiden', value: (sppgStats?.risiko ?? 0).toLocaleString('id-ID'), color: 'var(--red)', sub: 'dekat insiden', bg: '#f8514912', icon: AlertTriangle },
    { label: 'Populasi', value: POP.toLocaleString('id-ID'), color: 'var(--blu)', sub: 'penduduk', bg: '#388bfd10', icon: Globe },
  ] : [
    { label: 'Total Insiden', value: stats.total.toLocaleString('id-ID'), color: 'var(--grn)', sub: 'terpetakan', bg: '#3fb95015', icon: MapPin },
    { label: 'Korban Keracunan', value: stats.victims.toLocaleString('id-ID'), color: 'var(--red)', sub: 'orang terdampak', bg: '#f8514915', icon: AlertTriangle },
    { label: 'Korban Meninggal', value: stats.deaths.toLocaleString('id-ID'), color: 'var(--pur)', sub: 'jiwa', bg: '#bc8cff15', icon: Skull },
    { label: 'Kasus Keracunan', value: stats.keracunan_cases.toLocaleString('id-ID'), color: 'var(--amb)', sub: 'kasus', bg: '#d2992215', icon: Building2 },
  ];
  const row2 = isSppg ? [
    { label: 'Warga per SPPG', value: ratio, color: 'var(--grn)', sub: 'rasio', bg: '#3fb95010', icon: TrendingUp },
    { label: 'Provinsi Terbanyak', value: `${sppgStats?.topProvName || '—'} ${sppgStats?.topProvCount ? sppgStats.topProvCount.toLocaleString('id-ID') : ''}`, color: 'var(--amb)', sub: 'terbanyak', bg: '#d2992210', icon: MapPin },
    { label: 'Cakupan Kabupaten', value: `${(sppgStats?.kabupatens ?? 0).toLocaleString('id-ID')} dari 514`, color: 'var(--pur)', sub: 'kabupaten', bg: '#bc8cff10', icon: Globe },
  ] : [
    { label: 'Populasi Indonesia', value: POP.toLocaleString('id-ID'), color: 'var(--blu)', sub: 'Orang', bg: '#388bfd10', icon: Globe },
    { label: 'Korban vs Populasi', value: `${pct}%`, color: parseFloat(pct) < 0.05 ? 'var(--grn)' : 'var(--amb)', sub: 'masih aman', bg: parseFloat(pct) < 0.05 ? '#3fb95010' : '#d2992210', icon: TrendingUp },
  ];

  const cell = (item, i) => (
    <div key={i} style={{
      background: item.bg || 'var(--sf)',
      padding: '14px 12px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Watermark icon — large, outlined, bottom-right corner */}
      <item.icon
        size={44}
        strokeWidth={0.5}
        style={{
          color: item.color,
          opacity: 0.1,
          position: 'absolute',
          right: -4,
          bottom: -8,
          pointerEvents: 'none',
        }}
      />
      <div style={{ fontFamily: 'var(--mo)', fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: item.color, position: 'relative' }}>
        {item.value}
      </div>
      <div style={{ fontFamily: 'var(--mo)', fontSize: 8, color: 'var(--mu)', marginTop: 1, position: 'relative' }}>
        {item.sub}
      </div>
      <div style={{ fontFamily: 'var(--mo)', fontSize: 8, color: 'var(--mu)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4, position: 'relative' }}>
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

function FeedItem({ inc, isActive, onClick, focusInc, setSidebarOpen, accused, linkIndex }) {
  const c = COL[inc.cat] || COL.lainnya;
  const hasArticle = !!safeUrl(inc.url);
  const hasCoords = inc.lat && inc.lng;
  const a0 = accused?.[0] || null;
  const accusedOwner = a0?.sppg_id != null ? linkIndex?.bySppg?.get(String(a0.sppg_id)) || null : null;
  const accusedLabel = (a0?.operator || operatorName(accusedOwner) || a0?.sppg_nama || a0?.kitchen_label || '').replace(/^SPPG\s+/i, '');
  const accusedConf = a0?.link_confidence != null ? `${a0.link_confidence}%` : '';

  return (
    <div
      onClick={() => {
        if (inc.lat && inc.lng) {
          focusInc(inc.id);
          setSidebarOpen(false);
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
          {accused && accused.length > 0 && (
            <span
              title={accused.map(c => `${c.kitchen_label || ''}${c.link_confidence != null ? ` — keyakinan ${c.link_confidence}% (${c.link_basis || ''})` : ''}`).join('\n')}
              style={{
                fontFamily: 'var(--mo)', fontSize: 9, borderRadius: 3, padding: '1px 5px',
                letterSpacing: '0.03em', background: 'rgba(188,140,255,0.14)',
                color: 'var(--pur)', border: '1px solid rgba(188,140,255,0.4)', whiteSpace: 'nowrap',
              }}
            >
              SPPG: {accusedLabel.slice(0, 20)}{accusedConf ? ` · ${accusedConf}` : ''}
            </span>
          )}
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

function SppgItem({ sppg, focusInc, setSidebarOpen, linkIndex }) {
  const owner = ownerFor(linkIndex, sppg);
  const operator = owner?.operators?.[0]?.name || null;
  const accused = casesForSppg(linkIndex, sppg);
  const evidence = owner?.operators?.[0]?.sources?.[0]?.url || null;
  const maxConf = accused.reduce((m, c) => Math.max(m, c.link_confidence || 0), 0);
  return (
    <div
      onClick={() => {
        if (sppg.lat && sppg.lng) {
          focusInc(`sppg-${sppg.id ?? sppg.kode}`);
          setSidebarOpen(false);
        }
      }}
      style={{
        display: 'flex',
        gap: 10,
        padding: '11px 14px',
        borderBottom: '1px solid var(--bd)',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,139,253,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--blu)',
        marginTop: 3,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {sppg.nama}
          {sppg.risiko && <AlertTriangle size={9} strokeWidth={2} style={{ color: 'var(--red)', flexShrink: 0 }} />}
          {sppg.meninggal_terkait && <Skull size={9} strokeWidth={2} style={{ color: 'var(--pur)', flexShrink: 0 }} />}
        </div>
        <div style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>
          {[sppg.provinsi, sppg.kabupaten, sppg.kecamatan].filter(Boolean).join(' · ')}
        </div>
        {(operator || accused.length > 0) && (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
            {operator && (
              <span
                title={evidence ? `Sumber: ${evidence}` : 'Penyelenggara menurut pemberitaan'}
                style={{
                  fontFamily: 'var(--mo)', fontSize: 9, borderRadius: 3, padding: '1px 5px',
                  background: 'rgba(63,185,80,0.12)', color: 'var(--grn)',
                  border: '1px solid rgba(63,185,80,0.35)', maxWidth: '100%',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {operator}
              </span>
            )}
            {accused.length > 0 && (
              <span
                title={accused.map(c => `${c.event_date || ''} ${c.school_or_site || ''}${c.link_confidence != null ? ` — keyakinan ${c.link_confidence}% (${c.link_basis || ''})` : ''}`).join('\n')}
                style={{
                  fontFamily: 'var(--mo)', fontSize: 9, borderRadius: 3, padding: '1px 5px',
                  background: 'rgba(248,81,73,0.12)', color: 'var(--red)',
                  border: '1px solid rgba(248,81,73,0.35)', whiteSpace: 'nowrap',
                }}
              >
                {accused.length} kasus{maxConf ? ` · ${maxConf}%` : ''}
              </span>
            )}
          </div>
        )}
        {sppg.tanggal_pembangunan && (
          <div style={{ fontFamily: 'var(--mo)', fontSize: 9, color: 'var(--mu)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Calendar size={9} strokeWidth={2} />
            {sppg.tanggal_pembangunan}
          </div>
        )}
      </div>
    </div>
  );
}
