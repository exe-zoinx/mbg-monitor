import { useState, useMemo, useCallback } from 'react';
import { incidentKey } from '../lib/links';

export function useIncidents(data, linkIndex = null, onlyAccused = false) {
  const accusedKeys = linkIndex?.byIncident || new Map();
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
        if (onlyAccused && !accusedKeys.has(incidentKey(i))) return false;
        if (filterCat === 'meninggal') {
          if (!i.deaths) return false;
        } else if (filterCat !== 'all' && i.cat !== filterCat) {
          return false;
        }
        if (dateFrom && i.date < dateFrom) return false;
        if (dateTo && i.date > dateTo) return false;
        if (!q) return true;
        return (
          (i.title || '').toLowerCase().includes(q) ||
          (i.loc || '').toLowerCase().includes(q) ||
          (i.province || '').toLowerCase().includes(q) ||
          (i.kabupaten || '').toLowerCase().includes(q) ||
          (i.school || '').toLowerCase().includes(q) ||
          (i.note || '').toLowerCase().includes(q) ||
          (i.schools_list || []).some(s => String(s).toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        // ISO dates sort descending (newest first); non-ISO dates ("Tidak Disebutkan",
        // "September 2025", etc.) sort to the bottom
        const aDate = /^\d{4}-\d{2}-\d{2}/.test(a.date) ? a.date : '0000-00-00';
        const bDate = /^\d{4}-\d{2}-\d{2}/.test(b.date) ? b.date : '0000-00-00';
        return bDate.localeCompare(aDate);
      });
  }, [incidents, filterCat, search, dateFrom, dateTo, onlyAccused, accusedKeys]);

  const stats = useMemo(() => {
    const cats = {};
    let totalVictims = 0;
    let keracunanVictims = 0;
    let totalDeaths = 0;
    let schools = 0;
    for (const i of incidents) {
      cats[i.cat] = (cats[i.cat] || 0) + 1;
      totalVictims += i.victims || 0;
      schools += (i.schools_list?.length) || 1;
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
      schools,                        // school venues affected (multi-school rows expanded)
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
