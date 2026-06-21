# @jcool/storefront — Next.js 14 storefront

Public-facing storefront. App Router + Server Components for browse/PDP/ISR,
NextAuth v5 for sessions, Stripe Payment Element for checkout, Zustand+Redis
hybrid for cart, Tailwind + next-themes for dark mode.

## Local dev

```bash
cp apps/storefront/.env.example apps/storefront/.env.local
# fill NEXTAUTH_SECRET (openssl rand -base64 32) + STRIPE keys
pnpm install
pnpm --filter @jcool/storefront dev
# http://localhost:3100
```

Requires the api-gateway (phase 10, port 3000) up; gateway routes traffic to
auth/catalog/order/search services.

## Layout

```
app/             # App Router pages + layouts + Server Components
  api/auth/[...nextauth]/route.ts    # NextAuth v5 catch-all
  products/[id]/page.tsx             # PDP — ISR revalidate 60s + JSON-LD
  search/page.tsx                    # Dynamic search + facets
  checkout/                          # Stripe Payment Element + poll loop
  orders/                            # Protected by middleware.ts
  account/                           # Protected by middleware.ts
components/      # UI primitives + composed widgets (header, cart drawer …)
lib/
  api-client.ts                      # fetch wrapper (auth/correlation/currency)
  api/                               # Per-service typed surfaces
  auth-config.ts                     # NextAuth + exchange with auth-service
  store/                             # Zustand stores: cart, currency
  hooks/                             # use-cart-sync, use-cart-merge-on-login …
```

## Notes

- LCP target <2.5s on PDP assumes warm Cloud Run instance; cold starts are
  documented as acceptable for the portfolio scope.
- Cart sync: localStorage owns the optimistic view; Redis (via order-service)
  owns the canonical state. `useCartSync` re-hydrates on mount/auth change;
  `useCartMergeOnLogin` runs once per session after sign-in.
- Currency switch with non-empty cart prompts a confirm dialog and clears the
  cart before switching — order-service rejects mixed-currency carts.
