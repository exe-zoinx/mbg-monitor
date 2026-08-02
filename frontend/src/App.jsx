import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import { useData } from './hooks/useData';
import { useIncidents } from './hooks/useIncidents';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data, isLoading, error } = useData();
  const {
    incidents,
    filtered,
    stats,
    activeId,
    search,
    setSearch,
    focusInc,
  } = useIncidents(data);

  const connectionStatus = (() => {
    if (error) return { cls: '', text: error.message?.slice(0, 24) || 'Error' };
    if (!data) return { cls: '', text: isLoading ? 'Menghubungi…' : 'Baseline only' };
    const hrs = data.meta?.refreshed_at
      ? (Date.now() - new Date(data.meta.refreshed_at)) / 36e5
      : 999;
    const lastSync = data.meta?.refreshed_at
      ? new Date(data.meta.refreshed_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
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
        activeId={activeId}
        search={search}
        setSearch={setSearch}
        focusInc={focusInc}
        connectionStatus={connectionStatus}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <MapView
          incidents={incidents}
          filtered={filtered}
          activeId={activeId}
          focusInc={focusInc}
          stats={stats}
          onMenuClick={() => setSidebarOpen(o => !o)}
        />
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
