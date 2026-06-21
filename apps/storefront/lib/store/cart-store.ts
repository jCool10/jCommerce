'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Currency } from '@jcool/contracts';
import type { CartLineView, CartView } from '../api/cart';

interface CartState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  items: CartLineView[];
  subtotalAmount: number;
  currency: Currency | null;
  // wall-clock ms of the last successful sync; used for last-write-wins when
  // the user has two tabs open
  lastSyncedAt: number | null;
  hasMergedOnLogin: boolean;
}

interface CartActions {
  hydrate: (view: CartView) => void;
  setStatus: (status: CartState['status'], error?: string | null) => void;
  markMerged: () => void;
  reset: () => void;
}

export type CartStore = CartState & CartActions;

const INITIAL_STATE: CartState = {
  status: 'idle',
  error: null,
  items: [],
  subtotalAmount: 0,
  currency: null,
  lastSyncedAt: null,
  hasMergedOnLogin: false,
};

// Persisted slice (localStorage): keep items + currency for instant render on
// page load; server is the source of truth, hydration call replaces them.
export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      hydrate: (view) =>
        set({
          status: 'ready',
          error: null,
          items: view.items,
          subtotalAmount: view.subtotalAmount,
          currency: view.currency,
          lastSyncedAt: Date.now(),
        }),
      setStatus: (status, error = null) => set({ status, error }),
      markMerged: () => set({ hasMergedOnLogin: true }),
      reset: () => set({ ...INITIAL_STATE }),
    }),
    {
      name: 'jcool.cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        subtotalAmount: state.subtotalAmount,
        currency: state.currency,
        lastSyncedAt: state.lastSyncedAt,
        hasMergedOnLogin: state.hasMergedOnLogin,
      }),
      version: 1,
    },
  ),
);
