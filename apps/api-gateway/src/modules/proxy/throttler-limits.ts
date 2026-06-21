/**
 * Per-route throttle overrides. We expose a SINGLE named throttler in the
 * module (`default`) and override its limit/ttl per route via @Throttle().
 *
 * Why one throttler, not many: @nestjs/throttler v6 applies *every* named
 * throttler to *every* route unless explicitly skipped. Declaring a `login`
 * throttler with limit 5/15min would silently cap every other route at 5/15min
 * too. Routing everything through `default` + per-route overrides avoids that
 * footgun entirely.
 *
 *  - login    : credential-stuffing window (5 attempts / 15 min / ip)
 *  - checkout : payment intent abuse / Stripe quota guard (5 / min / ip)
 *  - browse   : storefront catalog + search (100 / min / ip)
 *  - default  : everything else (60 / min / ip)
 */
export const THROTTLE_LIMIT_LOGIN = {
  default: { limit: 5, ttl: 15 * 60 * 1000 },
} as const;

export const THROTTLE_LIMIT_CHECKOUT = {
  default: { limit: 5, ttl: 60 * 1000 },
} as const;

export const THROTTLE_LIMIT_BROWSE = {
  default: { limit: 100, ttl: 60 * 1000 },
} as const;

export const THROTTLE_DEFAULT = { limit: 60, ttl: 60 * 1000 } as const;
