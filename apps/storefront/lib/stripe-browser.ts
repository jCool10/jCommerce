'use client';

import { loadStripe, type Stripe } from '@stripe/stripe-js';

// Lazy singleton — Stripe.js is ~50KB so we only load it when the user lands
// on /checkout, not on every page.
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      // Return a never-resolving stub in dev so missing env doesn't crash
      // unrelated pages — Checkout UI surfaces a friendlier message.
      stripePromise = Promise.resolve(null);
    } else {
      stripePromise = loadStripe(key);
    }
  }
  return stripePromise;
}
