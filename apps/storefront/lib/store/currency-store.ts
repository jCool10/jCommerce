'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Currency } from '@jcool/contracts';
import { CURRENCY_COOKIE, DEFAULT_CURRENCY } from '../currency';

interface CurrencyState {
  currency: Currency;
  setCurrency: (next: Currency) => void;
}

const ONE_YEAR_S = 60 * 60 * 24 * 365;

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: DEFAULT_CURRENCY,
      setCurrency: (next) => {
        // Mirror to a cookie so Server Components can read the choice without
        // a client roundtrip — currency is needed for ISR fetches of prices.
        if (typeof document !== 'undefined') {
          document.cookie = `${CURRENCY_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_S}; SameSite=Lax`;
        }
        set({ currency: next });
      },
    }),
    {
      name: 'jcool.currency',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
