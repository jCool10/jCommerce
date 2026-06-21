import { cache } from 'react';
import { QueryClient } from '@tanstack/react-query';

// One QueryClient per server request — `cache()` memoizes within a request
// so Server Components share a cache, while different requests stay isolated
// (prevents response-data leaks across users when using React Query SSR).
export const getServerQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          // Disable refetch on every navigation; ISR + manual refresh handle
          // staleness for browse pages.
          staleTime: 60_000,
          retry: 1,
        },
      },
    }),
);

export function makeBrowserQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
