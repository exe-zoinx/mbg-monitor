import { useQuery } from '@tanstack/react-query';

// Map Indonesian month names to numbers
const IND_MONTHS = {
  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
  'mei': '05', 'jun': '06', 'jul': '07', 'agt': '08',
  'sep': '09', 'okt': '10', 'nov': '11', 'des': '12',
};

/**
 * Convert Wikipedia date "29 Sep 2025" → "2025-09-29"
 */
function toISODate(raw) {
  if (!raw) return '';
  const parts = String(raw).trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = IND_MONTHS[parts[1].toLowerCase()] || parts[1];
    const year = parts[2];
    if (month && /^\d{4}$/.test(year)) {
      return `${year}-${month}-${day}`;
    }
  }
  return raw;
}

/**
 * Transform a Wikipedia incident to the app's expected shape.
 */
function transformWiki(wiki) {
  return {
    id: wiki.id || Math.random(),
    cat: wiki.cat || 'keracunan',
    date: toISODate(wiki.date),
    date_raw: wiki.date || '',
    lat: wiki.lat ?? null,
    lng: wiki.lng ?? null,
    title: wiki.title || wiki.school || wiki.loc || 'Tidak disebutkan',
    loc: wiki.loc || wiki.kabupaten || wiki.province || '',
    victims: wiki.victims ?? 0,
    deaths: wiki.deaths ?? 0,
    note: wiki.note || '',
    source: wiki.source || 'Wikipedia',
    source_url: wiki.source_url || wiki.url || '',
    url: wiki.source_url || wiki.url || '',
    school: wiki.school || '',
    province: wiki.province || '',
    kabupaten: wiki.kabupaten || '',
    schools_list: wiki.schools_list || [],
  };
}

export function useData() {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('API fetch failed');
      const data = await res.json();
      return data;
    },
    staleTime: 86_400_000, // 24h — data changes rarely
    refetchInterval: false,
  });
}
