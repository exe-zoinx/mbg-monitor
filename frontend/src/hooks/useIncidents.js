import { useState, useMemo, useCallback } from 'react';
import { MBG_KEYWORDS } from '../lib/constants';

// Check if an incident is related to MBG (Makan Bergizi Gratis) program
function isMBGRelated(incident) {
  const text = `${incident.title} ${incident.note || ''} ${incident.loc || ''}`.toLowerCase();
  return MBG_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

export function useIncidents(data) {
  const [activeId, setActiveId] = useState(null);
  const [filterCat, setFilterCat] = useState('all');
  const [search, setSearch] = useState('');

  const incidents = useMemo(() => {
    if (!data?.incidents?.length) return [];
    return data.incidents.map((r, i) => ({ ...r, id: r.id || 9000 + i, victims: r.victims || 0 }));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return incidents
      .filter(i => {
        if (filterCat !== 'all' && i.cat !== filterCat) return false;
        if (!q) return true;
        return (
          i.title.toLowerCase().includes(q) ||
          (i.loc || '').toLowerCase().includes(q) ||
          (i.note || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Prioritize MBG poisoning: keracunan with MBG/school context comes first
        const aIsMBGPoisoning = a.cat === 'keracunan' && isMBGRelated(a);
        const bIsMBGPoisoning = b.cat === 'keracunan' && isMBGRelated(b);
        if (aIsMBGPoisoning && !bIsMBGPoisoning) return -1;
        if (!aIsMBGPoisoning && bIsMBGPoisoning) return 1;
        return b.date.localeCompare(a.date);
      });
  }, [incidents, filterCat, search]);

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
    search,
    setSearch,
    focusInc,
  };
}
