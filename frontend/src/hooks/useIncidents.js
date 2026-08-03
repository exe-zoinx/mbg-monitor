import { useState, useMemo, useCallback } from 'react';

export function useIncidents(data) {
  const [activeId, setActiveId] = useState(null);
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const incidents = useMemo(() => {
    if (!data?.incidents?.length) return [];
    return data.incidents.map((r, i) => ({
      ...r,
      id: r.id || 9000 + i,
      victims: r.victims || 0,
      // ponytail: D1 stores schools_list as JSON text, parse it
      schools_list: typeof r.schools_list === 'string' ? (() => { try { return JSON.parse(r.schools_list); } catch { return []; } })() : (r.schools_list || []),
    }));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return incidents
      .filter(i => {
        if (filterCat === 'meninggal') {
          if (!i.deaths) return false;
        } else if (filterCat !== 'all' && i.cat !== filterCat) {
          return false;
        }
        if (dateFrom && i.date < dateFrom) return false;
        if (dateTo && i.date > dateTo) return false;
        if (!q) return true;
        return (
          i.title.toLowerCase().includes(q) ||
          (i.loc || '').toLowerCase().includes(q) ||
          (i.note || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [incidents, filterCat, search, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const cats = {};
    let totalVictims = 0;
    let keracunanVictims = 0;
    let totalDeaths = 0;
    for (const i of incidents) {
      cats[i.cat] = (cats[i.cat] || 0) + 1;
      totalVictims += i.victims || 0;
      if (i.cat === 'keracunan') {
        keracunanVictims += i.victims || 0;
        totalDeaths += i.deaths || 0;
      }
    }
    return {
      total: incidents.length,
      victims: totalVictims,
      keracunan: keracunanVictims,   // total poisoned victims (not incident count)
      deaths: totalDeaths,            // total death victims
      keracunan_cases: cats.keracunan || 0,
      sppg: (cats.sppg || 0) + (cats.sppg_opened || 0) + (cats.sppg_temp_closed || 0) + (cats.sppg_closed || 0),
      sppg_opened: cats.sppg_opened || 0,
      sppg_temp_closed: cats.sppg_temp_closed || 0,
      sppg_closed: cats.sppg_closed || 0,
      kecelakaan: cats.kecelakaan || 0,
      tewas: cats.tewas || 0,
      mbg: cats.mbg || 0,
      other: (cats.lainnya || 0),
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
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    search,
    setSearch,
    focusInc,
  };
}
