import { QueryClient } from '@tanstack/react-query';

/**
 * Server-cache client. Server is authoritative for scored/social state (D-003);
 * the cache is read-side only. Persistence to a local mirror is added later once
 * the local DB engine is chosen (D-007).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Writes go through the offline mutation queue, not raw mutations — see src/offline/queue.
      retry: 0,
    },
  },
});
