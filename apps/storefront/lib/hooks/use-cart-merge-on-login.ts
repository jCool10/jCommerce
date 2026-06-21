'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { cartApi } from '../api/cart';
import { useCartStore } from '../store/cart-store';
import { getOrCreateGuestSession } from '../guest-session';

/**
 * Fires once per session immediately after sign-in to merge the guest cart
 * into the user cart. Idempotent — `hasMergedOnLogin` flag persists in
 * localStorage so refreshes don't re-trigger.
 */
export function useCartMergeOnLogin(): void {
  const { data: session, status } = useSession();
  const hasMerged = useCartStore((s) => s.hasMergedOnLogin);
  const markMerged = useCartStore((s) => s.markMerged);
  const hydrate = useCartStore((s) => s.hydrate);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken || hasMerged) return;
    const guestSessionId = getOrCreateGuestSession();
    if (!guestSessionId) return;

    let cancelled = false;
    void cartApi
      .merge(guestSessionId, { accessToken: session.accessToken })
      .then((result) => {
        if (cancelled) return;
        hydrate(result);
        markMerged();
      })
      .catch(() => {
        // Soft-fail: cart sync hook will retry. Mark merged anyway so we
        // don't spam the endpoint on every visit when the guest cart was
        // empty (merge returns 200 even on empty).
        if (!cancelled) markMerged();
      });
    return () => {
      cancelled = true;
    };
  }, [status, session?.accessToken, hasMerged, hydrate, markMerged]);
}
