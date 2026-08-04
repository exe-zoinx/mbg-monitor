import { useQuery } from '@tanstack/react-query';

/**
 * Fetch SPPG (Satuan Pelayanan Pemenuhan Gizi) data.
 * Static government snapshot — cache 24h.
 * Fetch + JSON.parse run in a Web Worker so the 3.6MB payload never
 * blocks the main thread (was the dominant TBT source).
 */
export function useSppg() {
  return useQuery({
    queryKey: ['sppg'],
    queryFn: () =>
      new Promise((resolve, reject) => {
        const worker = new Worker(new URL('../workers/sppgWorker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => {
          worker.terminate();
          if (e.data?.ok) resolve(e.data.data);
          else reject(new Error(e.data?.error || 'SPPG fetch failed'));
        };
        worker.onerror = (e) => {
          worker.terminate();
          reject(new Error(e.message || 'SPPG worker error'));
        };
      }),
    staleTime: 86_400_000, // 24h
  });
}
