'use client';

import { useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { Currency } from '@jcool/contracts';
import { cartApi, type AddToCartInput } from '../api/cart';
import { useCartStore } from '../store/cart-store';
import { getOrCreateGuestSession } from '../guest-session';

interface CartMutations {
  add: (input: AddToCartInput) => Promise<void>;
  updateQuantity: (skuId: string, quantity: number) => Promise<void>;
  remove: (skuId: string) => Promise<void>;
  clear: () => Promise<void>;
}

export function useCartMutations(): CartMutations {
  const { data: session } = useSession();
  const hydrate = useCartStore((s) => s.hydrate);
  const setStatus = useCartStore((s) => s.setStatus);
  const reset = useCartStore((s) => s.reset);

  const baseOptions = useCallback(
    () => ({
      accessToken: session?.accessToken,
      guestSessionId: session?.user?.id ? undefined : getOrCreateGuestSession(),
    }),
    [session?.accessToken, session?.user?.id],
  );

  const add = useCallback<CartMutations['add']>(
    async (input) => {
      try {
        const view = await cartApi.add(input, baseOptions());
        hydrate(view);
      } catch (error) {
        setStatus('error', error instanceof Error ? error.message : 'Add failed');
        throw error;
      }
    },
    [baseOptions, hydrate, setStatus],
  );

  const updateQuantity = useCallback<CartMutations['updateQuantity']>(
    async (skuId, quantity) => {
      const view = await cartApi.updateQuantity(skuId, quantity, baseOptions());
      hydrate(view);
    },
    [baseOptions, hydrate],
  );

  const remove = useCallback<CartMutations['remove']>(
    async (skuId) => {
      const view = await cartApi.remove(skuId, baseOptions());
      hydrate(view);
    },
    [baseOptions, hydrate],
  );

  const clear = useCallback<CartMutations['clear']>(async () => {
    await cartApi.clear(baseOptions());
    reset();
  }, [baseOptions, reset]);

  return { add, updateQuantity, remove, clear };
}

// Re-exported so consumers don't need to import the Currency type from the
// contracts package directly when only typing addToCart arguments.
export type { Currency };
