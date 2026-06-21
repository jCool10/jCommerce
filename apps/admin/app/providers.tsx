'use client';

import React, { useRef } from 'react';
import { SessionProvider } from 'next-auth/react';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeStore, type AppStore } from '@/lib/store';
import { ThemeProvider } from '@/components/theme-provider';

export function Providers({ children }: { children: React.ReactNode }): React.JSX.Element {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) storeRef.current = makeStore();

  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        mutations: { retry: 0 },
      },
    });
  }

  return (
    <ThemeProvider>
      <SessionProvider>
        <ReduxProvider store={storeRef.current}>
          <QueryClientProvider client={queryClientRef.current}>{children}</QueryClientProvider>
        </ReduxProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
