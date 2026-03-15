import { useState, useEffect } from 'react';
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
    filterCat,
    setFilterCat,
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
    if (hrs < 12) return { cls: 'g', text: fmtAgo(data.meta.refreshed_at) };
    if (hrs < 48) return { cls: 'a', text: fmtAgo(data.meta.refreshed_at) };
    if (data.meta?.refreshed_at) return { cls: 'r', text: fmtAgo(data.meta.refreshed_at) };
    return { cls: '', text: 'DB live' };
  })();

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar
        incidents={incidents}
        filtered={filtered}
        stats={stats}
        activeId={activeId}
        filterCat={filterCat}
        setFilterCat={setFilterCat}
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
            zIndex: 600,
            background: 'var(--sf)',
            border: '1px solid var(--bd2)',
            borderRadius: 8,
            padding: '8px 12px',
            fontFamily: 'var(--mo)',
            fontSize: 11,
            color: 'var(--tx)',
            cursor: 'pointer',
          }}
          className="mobile-sidebar-btn"
        >
          ☰ Daftar
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
