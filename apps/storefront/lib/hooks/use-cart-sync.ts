'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useCartStore } from '../store/cart-store';
import { cartApi } from '../api/cart';
import { getOrCreateGuestSession } from '../guest-session';

/**
 * Hydrates the cart store from Redis on mount and after auth state changes.
 * The merge-on-login one-shot is handled by `useCartMergeOnLogin` so this
 * hook can stay pure-read.
 */
export function useCartSync(): void {
  const { data: session, status: authStatus } = useSession();
  const setStatus = useCartStore((s) => s.setStatus);
  const hydrate = useCartStore((s) => s.hydrate);
  // Track the session-key that produced the current hydration so we don't
  // refetch on every render.
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (authStatus === 'loading') return;
    const key = session?.user?.id ? `user:${session.user.id}` : `guest`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    let cancelled = false;
    setStatus('loading');
    void cartApi
      .get({
        accessToken: session?.accessToken,
        guestSessionId: session?.user?.id ? undefined : getOrCreateGuestSession(),
      })
      .then((view) => {
        if (cancelled) return;
        hydrate(view);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus('error', error instanceof Error ? error.message : 'Cart load failed');
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus, session?.user?.id, session?.accessToken, hydrate, setStatus]);
}
