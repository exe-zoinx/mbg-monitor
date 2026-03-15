import { useQuery } from '@tanstack/react-query';

export function useData() {
  return useQuery({
    queryKey: ['data'],
    queryFn: async () => {
      const res = await fetch('/api/data');
      if (res.status === 404 || res.status === 503) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    retry: 1,
    staleTime: 180_000,
    refetchInterval: 300_000,
  });
}
