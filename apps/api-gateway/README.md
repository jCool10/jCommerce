# @jcool/api-gateway

NestJS reverse proxy gateway — single ingress for storefront + admin.

## Responsibilities

- Verify Bearer JWT (RS256, shared `AUTH_PUBLIC_KEY_B64`); reject 401 with unified envelope when invalid.
- Forward `/api/v1/{auth,catalog,products,orders,checkout,cart,search}/*` to the matching downstream service.
- Inject `x-user-id`, `x-user-role`, `x-request-id` on every downstream request.
- Enforce per-route rate limits backed by Redis (login 5/15min, checkout 5/min, browse 100/min, default 60/min).
- Generate / propagate `x-request-id` for end-to-end correlation in logs.
- Unified error envelope: `{ error: { code, message, details? } }`.
- `GET /health` aggregates downstream service health.

## Out-of-scope (intentional)

- Stripe webhook (`POST /webhooks/stripe`) — Stripe posts **directly to order-service**; gateway bypassed so signature verification stays in the service that owns the secret.
- Service discovery — env-driven URLs only (phase 15 maps to Cloud Run URLs).
- TLS termination — handled by Cloud Run / local dev (gateway speaks plain HTTP internally).

## Dev

```bash
pnpm --filter @jcool/api-gateway dev   # nest start --watch (port 3000)
pnpm --filter @jcool/api-gateway test  # vitest run
```

Boot order in dev: auth → catalog → search → order → gateway (use `wait-on` in `make dev`).
