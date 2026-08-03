import { useQuery } from '@tanstack/react-query';

/**
 * Fetch SPPG (Satuan Pelayanan Pemenuhan Gizi) data.
 * Static government snapshot — cache 24h.
 */
export function useSppg() {
  return useQuery({
    queryKey: ['sppg'],
    queryFn: async () => {
      const res = await fetch('/api/sppg');
      if (!res.ok) throw new Error('SPPG fetch failed');
      return res.json();
    },
    staleTime: 86_400_000, // 24h
  });
}
