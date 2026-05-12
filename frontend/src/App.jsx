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
        />
        <button
          onClick={() => setSidebarOpen(o => !o)}
          style={{
            display: 'none',
            position: 'absolute',
            bottom: 76,
            left: 14,
            zIndex: 1001,
            background: 'var(--sf)',
            border: '1px solid var(--bd2)',
            borderRadius: 8,
            padding: '12px 16px',
            fontFamily: 'var(--mo)',
            fontSize: 13,
            color: 'var(--tx)',
            cursor: 'pointer',
          }}
          className="mobile-sidebar-btn touch-target"
        >
          <Menu size={14} strokeWidth={2} style={{ marginRight: 6 }} /> Daftar
        </button>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .mobile-sidebar-btn { display: block !important; }
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
