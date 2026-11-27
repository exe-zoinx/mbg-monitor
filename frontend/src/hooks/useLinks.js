import { useQuery } from '@tanstack/react-query';
import { buildLinkIndex } from '../lib/links';

/**
 * Incident ↔ accused-SPPG links (306 KB static asset, built offline by
 * scripts/build_sppg_links.py). Static per deploy → cache 24h.
 */
export function useLinks() {
  return useQuery({
    queryKey: ['sppg-links'],
    queryFn: async () => {
      const res = await fetch('/data/sppg_links.json');
      if (!res.ok) throw new Error('link data fetch failed');
      return buildLinkIndex(await res.json());
    },
    staleTime: 86_400_000,
    refetchInterval: false,
  });
}
