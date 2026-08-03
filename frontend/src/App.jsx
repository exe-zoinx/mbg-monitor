import { useState, useEffect } from 'react';
import { Menu, Download, Database, X, Info, AlertTriangle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import { useData } from './hooks/useData';
import { useIncidents } from './hooks/useIncidents';
import { useSppg } from './hooks/useSppg';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('incidents'); // 'incidents' | 'sppg'
  const { data, isLoading, error } = useData();
  const sppgQuery = useSppg();
  const sppgData = sppgQuery.data;
  const {
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
  } = useIncidents(data);

  const connectionStatus = (() => {
    if (error) return { cls: '', text: error.message?.slice(0, 24) || 'Error' };
    if (!data) return { cls: '', text: isLoading ? 'Menghubungi…' : 'Baseline only' };
    const hrs = data.meta?.refreshed_at
      ? (Date.now() - new Date(data.meta.refreshed_at)) / 36e5
      : 999;
    const lastSync = data.meta?.refreshed_at
      ? new Date(data.meta.refreshed_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
      : null;
    if (hrs < 12) return { cls: 'g', text: lastSync || 'OK' };
    if (hrs < 48) return { cls: 'a', text: lastSync || 'Stale' };
    if (data.meta?.refreshed_at) return { cls: 'r', text: lastSync || 'Lama' };
    return { cls: '', text: 'DB live' };
  })();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem('mbg_disclaimer_seen')) setShowDisclaimer(true);
  }, []);
  const [showDataModal, setShowDataModal] = useState(false);

  const downloadCSV = () => {
    const headers = ['date', 'title', 'loc', 'province', 'kabupaten', 'cat', 'victims', 'deaths', 'source', 'source_url', 'school', 'note'];
    const rows = incidents.map(i => headers.map(h => `"${String(i[h] || '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mbg_monitor_incidents.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSppgCsv = () => {
    if (!sppgData?.sppg?.length) return;
    const headers = ['kode', 'nama', 'provinsi', 'kabupaten', 'kecamatan', 'kelurahan', 'alamat', 'lat', 'lng', 'tanggal_pembangunan', 'berita_url'];
    const rows = sppgData.sppg.map(s => headers.map(h => `"${String(s[h] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sppg-indonesia.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', height: '100dvh', width: '100vw', overflow: 'hidden' }}>
      {/* Mobile backdrop */}
      <div
        className="mobile-backdrop"
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 999,
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease'
        }}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar
        incidents={incidents}
        filtered={filtered}
        stats={stats}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sppgData={sppgData}
        activeId={activeId}
        search={search}
        setSearch={setSearch}
        focusInc={focusInc}
        filterCat={filterCat}
        setFilterCat={setFilterCat}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        connectionStatus={connectionStatus}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onShowData={() => setShowDataModal(true)}
      />
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <MapView
          incidents={incidents}
          filtered={filtered}
          activeId={activeId}
          focusInc={focusInc}
          stats={stats}
          onMenuClick={() => setSidebarOpen(o => !o)}
          activeTab={activeTab}
          sppgData={sppgData}
        />
        <button
          onClick={() => setShowDataModal(true)}
          className="mobile-sidebar-btn"
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            zIndex: 1001,
            display: 'none',
            background: 'var(--blu)',
            border: 'none',
            borderRadius: 16,
            padding: '8px 14px',
            fontFamily: 'var(--mo)',
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            cursor: 'pointer',
            alignItems: 'center',
            gap: 4,
            boxShadow: '0 2px 8px rgba(56,139,253,0.4)',
          }}
        >
          <Download size={12} /> Data
        </button>
      </div>

      {showDisclaimer && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            maxWidth: 460, width: '100%', background: 'var(--sf)',
            border: '1px solid var(--bd2)', borderRadius: 12,
            padding: 24, boxShadow: '0 18px 48px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontFamily: 'var(--mo)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>
              Perhatian
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--tx)', marginBottom: 20 }}>
              Seluruh data di situs ini murni hasil scraping otomatis dari pemberitaan
              media Indonesia dan Wikipedia. Angka korban adalah estimasi dari laporan
              berita dan dapat berubah; verifikasi silang dengan sumber berita asli.
            </div>
            <button
              onClick={() => { localStorage.setItem('mbg_disclaimer_seen', '1'); setShowDisclaimer(false); }}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 8, cursor: 'pointer',
                background: 'var(--red)', color: '#fff', border: 'none',
                fontFamily: 'var(--mo)', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
              }}
            >
              MENGERTI
            </button>
          </div>
        </div>
      )}

      {showDataModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}
          onClick={() => setShowDataModal(false)}
        >
          <div style={{
            maxWidth: 460, width: '100%', background: 'var(--sf)',
            border: '1px solid var(--bd2)', borderRadius: 12,
            padding: 24, boxShadow: '0 18px 48px rgba(0,0,0,0.6)',
          }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--mo)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)' }}>
                <Database size={12} style={{ marginRight: 6, verticalAlign: -2 }} /> Tentang &amp; Data
              </div>
              <button
                onClick={() => setShowDataModal(false)}
                aria-label="Tutup"
                style={{ background: 'none', border: 'none', color: 'var(--mu)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--tx)', marginBottom: 12 }}>
              <strong>MBG Monitor</strong> — peta insiden program Makan Bergizi Gratis di Indonesia.
              Seluruh data murni hasil scraping otomatis dari pemberitaan media Indonesia
              dan Wikipedia (<span style={{ color: 'var(--mu)' }}>Daftar kasus keracunan massal makan siang gratis</span>).
              Angka korban adalah estimasi dari laporan berita dan dapat berubah.
            </div>
            <div style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'var(--mu)', marginBottom: 16 }}>
              {stats.total} insiden · {stats.victims} korban · {stats.deaths} meninggal
              {sppgData?.sppg?.length ? ` · ${sppgData.total} unit SPPG` : ''}
            </div>
            <button
              onClick={downloadCSV}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 8, cursor: 'pointer',
                background: 'var(--blu)', color: '#fff', border: 'none',
                fontFamily: 'var(--mo)', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Download size={14} /> Download CSV
            </button>
            <button
              onClick={downloadSppgCsv}
              disabled={!sppgData?.sppg?.length}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 8, cursor: sppgData?.sppg?.length ? 'pointer' : 'not-allowed',
                background: 'transparent', color: 'var(--blu)', border: '1px solid var(--blu)44',
                fontFamily: 'var(--mo)', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                marginTop: 8, opacity: sppgData?.sppg?.length ? 1 : 0.5,
              }}
            >
              <Download size={14} /> Download CSV SPPG
            </button>
            <div style={{
              marginTop: 16, background: 'var(--sf2)', borderRadius: 8,
              padding: '12px 14px', border: '1px solid var(--bd)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'var(--mo)', fontSize: 11, fontWeight: 600,
                color: 'var(--tx)', marginBottom: 8,
              }}>
                <Info size={12} /> Sumber Data
              </div>
              <div style={{ fontFamily: 'var(--mo)', fontSize: 10, color: 'var(--mu)', lineHeight: 1.6 }}>
                Insiden keracunan dikumpulkan dari media massa Indonesia dan Wikipedia.
                <br /><br />
                Data SPPG diambil dari Peta Sebaran SPPG Kementerian Pertanian
                (<a href="https://awr.ditjenpkh.pertanian.go.id/sppg/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blu)' }}>
                  awr.ditjenpkh.pertanian.go.id
                </a>). Data per 30 September 2025.
                <br /><br />
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--amb)' }}>
                  <AlertTriangle size={10} /> Data ini bukan saran medis. Verifikasi sebelum dikutip.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .touch-target {
            min-height: 44px;
            min-width: 44px;
          }
        }
      `}</style>
    </div>
  );
}

function fmtAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}j`;
  return `${Math.floor(s / 86400)}hr`;
}
