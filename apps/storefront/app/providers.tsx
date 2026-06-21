'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { makeBrowserQueryClient } from '@/lib/query-client';

interface ProvidersProps {
  children: ReactNode;
}

// Per Next.js + React Query SSR guidance, browser must own ONE singleton
// QueryClient across renders. useState lazy-init avoids new client on every
// render; the singleton inside makeBrowserQueryClient is intentional.
let browserQueryClient: ReturnType<typeof makeBrowserQueryClient> | undefined;

function getBrowserClient(): ReturnType<typeof makeBrowserQueryClient> {
  if (!browserQueryClient) browserQueryClient = makeBrowserQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: ProvidersProps): JSX.Element {
  const [queryClient] = useState(getBrowserClient);

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
