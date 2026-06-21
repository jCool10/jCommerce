'use client';

import { useEffect, useRef, useState } from 'react';
import { orderApi } from '@/lib/api/orders';

// sessionStorage key pattern — session-scoped, tab-local, cleared on close.
// NOT localStorage (cross-tab risk) and NOT cookie (sensitivity).
const STORAGE_KEY_PREFIX = 'stripe:cs:';

// Statuses where the existing PaymentIntent is still usable.
// Once an order is CONFIRMED or CANCELLED, re-creating is correct.
const REUSABLE_STATUSES = new Set(['PENDING_PAYMENT', 'CHECKOUT']);

export interface PersistedCheckout {
  orderId: string;
  clientSecret: string;
}

// private-mode browsers throw on sessionStorage access, so fall back to this
// in-memory map (module-level so it survives strict-mode double mounts)
const memoryStore = new Map<string, string>();

function storageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    memoryStore.set(key, value);
  }
}

function storageRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    memoryStore.delete(key);
  }
}

export function buildStorageKey(orderId: string): string {
  return `${STORAGE_KEY_PREFIX}${orderId}`;
}

export function saveCheckoutSession(orderId: string, clientSecret: string): void {
  storageSet(buildStorageKey(orderId), JSON.stringify({ orderId, clientSecret }));
}

export function clearCheckoutSession(orderId: string): void {
  storageRemove(buildStorageKey(orderId));
}

// scans sessionStorage for a stripe:cs:* key and returns the persisted checkout
// only if its order is still payable; otherwise null. Called once on mount.
async function restoreCheckoutSession(
  accessToken: string | undefined,
): Promise<PersistedCheckout | null> {
  // Collect all stripe:cs:* keys — iterate to find any pending checkout.
  let candidateKey: string | null = null;
  let raw: string | null = null;

  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        candidateKey = key;
        raw = sessionStorage.getItem(key);
        break; // Only one checkout in-flight per session.
      }
    }
  } catch {
    // sessionStorage unavailable — check memory fallback.
    for (const [key, value] of memoryStore.entries()) {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        candidateKey = key;
        raw = value;
        break;
      }
    }
  }

  if (!raw) return null;

  let parsed: PersistedCheckout;
  try {
    parsed = JSON.parse(raw) as PersistedCheckout;
  } catch {
    // Corrupt entry — discard.
    if (candidateKey) storageRemove(candidateKey);
    return null;
  }

  if (!parsed.orderId || !parsed.clientSecret) {
    if (candidateKey) storageRemove(candidateKey);
    return null;
  }

  // Verify the order is still payable — use the existing GET /orders/:id
  // endpoint (no new endpoints). If the order has moved to a terminal state
  // the persisted clientSecret is stale and should be discarded.
  if (!accessToken) return null;

  try {
    const order = await orderApi.getById(parsed.orderId, { accessToken });
    if (!REUSABLE_STATUSES.has(order.status)) {
      // Order no longer payable — discard the stale entry.
      storageRemove(buildStorageKey(parsed.orderId));
      return null;
    }
  } catch {
    // Network error or 404 — don't block the user; fall back to showing
    // the address form so they can start a fresh checkout.
    storageRemove(buildStorageKey(parsed.orderId));
    return null;
  }

  return parsed;
}

interface UseCheckoutClientSecretResult {
  /** True while the mount-time probe is still running. */
  probing: boolean;
  /** A valid persisted checkout session, or null if none found. */
  restored: PersistedCheckout | null;
  /** Call after receiving POST /checkout response. */
  saveSession: (orderId: string, clientSecret: string) => void;
  /** Call after successful stripe.confirmPayment(). */
  clearSession: (orderId: string) => void;
}

export function useCheckoutClientSecret(
  accessToken: string | undefined,
): UseCheckoutClientSecretResult {
  const [probing, setProbing] = useState(true);
  const [restored, setRestored] = useState<PersistedCheckout | null>(null);
  // Guard against strict-mode double-invocation of the effect.
  const probedRef = useRef(false);

  useEffect(() => {
    // Hydration guard: only run in browser, only once per mount cycle.
    if (probedRef.current) return;
    probedRef.current = true;

    restoreCheckoutSession(accessToken)
      .then((session) => {
        setRestored(session);
      })
      .catch(() => {
        // Unexpected error — treat as no session.
        setRestored(null);
      })
      .finally(() => {
        setProbing(false);
      });
  }, [accessToken]);

  const saveSession = (orderId: string, clientSecret: string): void => {
    saveCheckoutSession(orderId, clientSecret);
  };

  const clearSession = (orderId: string): void => {
    clearCheckoutSession(orderId);
  };

  return { probing, restored, saveSession, clearSession };
}
