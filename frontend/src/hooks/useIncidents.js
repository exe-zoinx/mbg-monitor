import { useState, useMemo, useCallback } from 'react';
import { BASELINE } from '../lib/constants';

export function useIncidents(data) {
  const [activeId, setActiveId] = useState(null);
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch] = useState('');

  const incidents = useMemo(() => {
    if (!data?.incidents?.length) return [...BASELINE];

    const existing = new Set(BASELINE.map(b => `${b.date}|${b.loc.slice(0, 8)}`));
    const newInc = data.incidents
      .filter(r => r.lat && r.lng && !existing.has(`${r.date}|${(r.loc || '').slice(0, 8)}`))
      .map((r, i) => ({ ...r, id: 9000 + i, victims: r.victims || 0 }));

    return [...BASELINE, ...newInc];
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return incidents
      .filter(i => {
        if (filterCat !== 'all' && i.cat !== filterCat) return false;
        if (!q) return true;
        return (
          i.title.toLowerCase().includes(q) ||
          i.loc.toLowerCase().includes(q) ||
          (i.note || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [incidents, filterCat, search]);

  const stats = useMemo(() => {
    const cats = {};
    let totalVictims = 0;
    for (const i of incidents) {
      cats[i.cat] = (cats[i.cat] || 0) + 1;
      totalVictims += i.victims || 0;
    }
    return {
      total: incidents.length,
      victims: totalVictims,
      keracunan: cats.keracunan || 0,
      other: (cats.sppg || 0) + (cats.kecelakaan || 0) + (cats.tewas || 0) + (cats.lainnya || 0),
      sppg: cats.sppg || 0,
      kecelakaan: cats.kecelakaan || 0,
      tewas: cats.tewas || 0,
    };
  }, [incidents]);

  const focusInc = useCallback((id) => {
    setActiveId(id);
  }, []);

  return {
    incidents,
    filtered,
    stats,
    activeId,
    filterCat,
    setFilterCat,
    search,
    setSearch,
    focusInc,
  };
}
