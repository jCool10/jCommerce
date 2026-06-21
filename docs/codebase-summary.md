# Codebase Summary & Architecture Map

**Generated from repomix analysis. Purpose: answer "where does X live?" and guide first-time code reviewers to the 6 most important patterns.**

---

## Repository Snapshot

| Metric | Value |
|--------|-------|
| **Total Files** | 563 (including tests, configs, infra) |
| **Source Files** | ~350 (src/ + app/) |
| **Total Tokens** | 441k (repomix analysis) |
| **Node.js Version** | ≥20.11.0 (CI: 22.14.0) |
| **pnpm Version** | ≥9 (managed: 10.30.3) |
| **Turborepo** | Workspace orchestrator, incremental build |

---

## Monorepo Structure

```
jCool-ecommerce/
├── apps/                        # 8 applications (6 NestJS + 2 Next.js)
│   ├── api-gateway/             # Port 3000 (only public ingress)
│   ├── auth-service/            # Port 3001 (JWT issuance, hexagonal)
│   ├── catalog-service/         # Port 3002 (products + inventory, hexagonal)
│   ├── order-service/           # Port 3004 (checkout saga + Stripe, hexagonal)
│   ├── search-service/          # Port 3003 (Elasticsearch indexer, flat NestJS)
│   ├── email-worker/            # No HTTP (BullMQ + RabbitMQ consumer, flat NestJS)
│   ├── admin/                   # Port 3101 (admin dashboard, Next.js 14)
│   └── storefront/              # Port 3100 (public site, Next.js 14)
├── packages/                    # 5 shared packages (@jcool/*)
│   ├── contracts/               # DTOs + event schemas (Zod), routing keys
│   ├── observability/           # Logger, tracing, metrics, NestJS integration
│   ├── nest-kit/                # Guards, pipes, types (61 LOC)
│   ├── eslint-config/           # base.js, nestjs.js, nextjs.js
│   └── tsconfig/                # base.json, nestjs.json, nextjs.json
├── infra/                       # Docker Compose + observability stack
│   ├── docker-compose.yml       # Main: Postgres, Redis, RabbitMQ, ES, Mailhog
│   ├── docker-compose.observability.yml  # Optional: Prometheus, Loki, Tempo, Grafana
│   ├── definitions.json         # RabbitMQ queue/exchange/binding config
│   └── init.sql                 # Database schema initialization
├── docs/                        # Documentation (this directory)
├── .claude/                     # AI agent rules + skills
├── .github/workflows/           # CI/CD (ESLint, TypeScript, build)
├── .husky/                      # Git hooks (commitlint, lint-staged)
├── .env.example                 # Environment variable template
├── Makefile                     # Dev convenience: infra-up, infra-down, o11y-up, stripe-listen
├── CLAUDE.md                    # Project guidance for AI agents
├── README.md                    # Quickstart (5 min setup)
├── package.json                 # Root workspace definition
├── turbo.json                   # Turborepo task definition + caching
└── pnpm-workspace.yaml          # pnpm monorepo globs
```

---

## Applications: Purpose, Ports, Responsibilities

### Backend Services (NestJS)

#### **api-gateway** (Port 3000)
**Purpose:** Only public ingress. JWT verification, reverse proxy, rate limiting.

**Key Files:**
- `src/main.ts` — NestJS bootstrap
- `src/modules/proxy/proxy.service.ts` — Reverse proxy via undici
- `src/modules/auth/jwt-verifier.service.ts` — JWT RS256 validation (jose)
- `src/modules/throttler/` — Redis-backed rate limiting (per-route, per-IP)
- `src/modules/errors/http-exception.filter.ts` — Centralized error formatting

**Responsibilities:**
- Validate JWT (RS256, from AUTH_PUBLIC_KEY_B64)
- Project user claims ({sub, email, role}) onto req.authUser
- Reverse-proxy to downstream services (auth, catalog, order, search)
- Rate limit: login 5/15min/IP, checkout 5/min/IP, browse 100/min/IP
- Aggregate health checks (GET /health → all downstream services)
- Inject correlation IDs, strip hop-by-hop headers

**Technologies:** NestJS, jose, undici, @nestjs/throttler, Redis
**LOC:** ~1k | **Files:** 19

---

#### **auth-service** (Port 3001, Hexagonal)
**Purpose:** JWT issuance, user registration/login, token refresh + rotation.

**Key Files:** `src/domain/user.entity.ts`, `src/application/use-cases/register-user.use-case.ts`, `src/application/use-cases/login.use-case.ts`, `src/infrastructure/crypto/jose-token-signer.adapter.ts`, `src/interfaces/http/auth.controller.ts`

**Responsibilities:** User registration (Credentials), login, JWT issuance (RS256), token refresh with JTI rotation, password hashing (bcrypt cost 12), session revocation via Redis blocklist.

**Technologies:** NestJS, Prisma, bcrypt, jose, Redis | **LOC:** ~7.2k | **Files:** 35 | **Tests:** ~6 vitest

---

#### **catalog-service** (Port 3002, Hexagonal)
**Purpose:** Product catalog, SKU pricing, inventory reservation (sync RPC).

**Key Files:** `src/domain/product.entity.ts`, `src/application/use-cases/reserve-inventory.use-case.ts` (⭐ deadlock-free), `src/infrastructure/persistence/prisma-inventory.repository.ts`, `src/infrastructure/messaging/outbox-poller.cron.ts`, `src/interfaces/http/products.controller.ts`, `src/interfaces/http/inventory.controller.ts`

**Responsibilities:** CRUD products/SKUs (integer subunit pricing), reserve inventory (atomic SELECT FOR UPDATE + idempotent inserts), publish product.indexed/inventory.reserved/inventory.failed events.

**Technologies:** NestJS, Prisma, RabbitMQ, Zod | **LOC:** ~17.8k | **Files:** 55 | **Tests:** ~9 vitest
**⭐ #1:** [Deadlock-Free Reservation](./codebase-highlights.md#1-deadlock-free-concurrent-reservation)

---

#### **order-service** (Port 3004, Hexagonal)
**Purpose:** Checkout saga orchestration, Stripe integration, cart management.

**Key Files:** `src/application/use-cases/saga/start-checkout.use-case.ts` (⭐ saga), `src/domain/order.entity.ts`, `src/application/use-cases/payment/handle-stripe-webhook.use-case.ts` (⭐ idempotency), `src/infrastructure/persistence/redis-cart.repository.ts`, `src/interfaces/http/orders.controller.ts`, `src/interfaces/http/stripe-webhooks.controller.ts`

**Responsibilities:** Cart management (Redis), checkout saga (10 steps + 3 compensation paths), Stripe webhook idempotency (UNIQUE constraint + advisory locks), publish order.*/payment.* events.

**Technologies:** NestJS, Prisma, Stripe SDK, Redis, RabbitMQ, Zod | **LOC:** ~16.2k | **Files:** 68 | **Tests:** ~12 vitest
**⭐ #2:** [Saga Orchestration](./codebase-highlights.md#2-saga-orchestration--compensation-paths)
**⭐ #3:** [Webhook Idempotency](./codebase-highlights.md#3-stripe-webhook-idempotency--advisory-locks)

---

#### **search-service** (Port 3003, Flat NestJS)
**Purpose:** Elasticsearch full-text search, facets, autocomplete (event-driven indexing).

**Key Files:** `src/modules/elasticsearch/elasticsearch.service.ts`, `src/modules/consumer/product-indexed.consumer.ts`, `src/modules/search/search.service.ts`

**Responsibilities:** Index products (blue-green alias swap), consume product.indexed events, search endpoint (full-text + facets), autocomplete, reindex CLI.

**Technologies:** NestJS, Elasticsearch, RabbitMQ | **LOC:** ~1.4k | **Files:** 29

---

#### **email-worker** (No HTTP port, Flat NestJS)
**Purpose:** Consume RabbitMQ order.confirmed → BullMQ → MJML render → SMTP.

**Key Files:** `src/modules/consumer/order-confirmed.consumer.ts`, `src/modules/worker/email.worker.ts`, `src/modules/templates/order-confirmation.mjml.ts`

**Responsibilities:** Consume order.confirmed events, enqueue BullMQ jobs, render MJML + Handlebars, send via SMTP (Mailhog dev, SES prod deferred).

**Technologies:** NestJS, RabbitMQ, BullMQ, nodemailer, MJML | **LOC:** ~0.8k | **Files:** 17

---

### Frontend Applications (Next.js 14)

#### **storefront** (Port 3100, Public)
**Purpose:** Customer-facing e-commerce (product browse, search, checkout, account).

**Key Files:** `app/(landing)/page.tsx`, `app/products/[id]/page.tsx`, `app/(protected)/checkout/page.tsx`, `lib/api-client.ts`, `lib/auth-config.ts`, `lib/store/cart-store.ts`

**Responsibilities:** Browse products (SSR/ISR), full-text search + facets, cart (Zustand + localStorage), checkout (Stripe Elements), order history, account management, JWT refresh.

**Design:** Swiss Modernism (monochrome Zinc + accent #FF4D2D), sharp corners, CSS variables.

**Technologies:** Next.js 14, NextAuth v5, Zustand, TailwindCSS, Stripe.js | **LOC:** ~6.4k | **Files:** ~60

---

#### **admin** (Port 3101, Internal)
**Purpose:** Admin dashboard (products/orders CRUD, analytics, KPIs).

**Key Files:** `app/(dashboard)/layout.tsx`, `app/(dashboard)/dashboard/page.tsx`, `app/(dashboard)/products/page.tsx`, `app/(dashboard)/orders/page.tsx`, `lib/store/store.ts`, `middleware.ts`

**Responsibilities:** View KPIs (orders, revenue, users), manage products/SKUs, manage orders (status updates, fulfillment), view users, admin-only auth enforced.

**Design:** shadcn/ui + Radix (rounded corners, HSL vars), Recharts for KPIs, Redux Toolkit (UI state) + React Query (server state).

**Technologies:** Next.js 14, NextAuth v5, Redux Toolkit, React Query, shadcn/ui, Recharts | **LOC:** ~5.2k | **Files:** ~50

---

## Shared Packages

### **@jcool/contracts**
**Purpose:** Single source of truth for inter-service shapes (DTOs + event schemas).

**Exports:** DTOs (auth, catalog, order, search, money), event schemas (order/payment/product/inventory events, all versioned V1/V2), routing keys.

**Key:** Zod-based, every event has `version: z.literal(1)`, side-by-side versioning (V2 alongside V1, never mutate).

**Technologies:** Zod | **LOC:** ~0.36k

---

### **@jcool/observability**
**Purpose:** Shared logging, tracing, metrics, NestJS middleware.

**Exports:** Pino logger (PII redaction: email/secret/token → ***), OpenTelemetry spans, prom-client metrics (HTTP/DB/RabbitMQ/business), NestJS interceptors (correlation IDs, metrics), Sentry integration.

**Key:** Services MUST import from this package (never roll own logger), PII redaction built-in, correlation IDs via AsyncLocalStorage.

**Technologies:** Pino, OpenTelemetry, prom-client, Sentry | **LOC:** ~1.5k

---

### **@jcool/nest-kit**
**Exports:** AdminRoleGuard, ZodValidationPipe, RequestWithAuthUser type.

**Technologies:** NestJS, Zod | **LOC:** 61

### **@jcool/eslint-config**
ESLint configurations (base.js, nestjs.js, nextjs.js).

### **@jcool/tsconfig**
TypeScript configurations (base.json, nestjs.json, nextjs.json).

---

## Senior-Judgment Highlights

**Six patterns demonstrating expertise in distributed systems, error handling, and resilience.**

See **[Codebase Highlights](./codebase-highlights.md#senior-judgment-code-highlights)** for detailed walkthroughs (deadlock-free reservation, saga + compensation, webhook idempotency, versioned events, transactional outbox, hexagonal layering).

Quick reference:
- ⭐ #1: [Deadlock-Free Concurrent Reservation](./codebase-highlights.md#1-deadlock-free-concurrent-reservation) — `apps/catalog-service/src/infrastructure/persistence/prisma-inventory.repository.ts`
- ⭐ #2: [Saga Orchestration](./codebase-highlights.md#2-saga-orchestration--compensation-paths) — `apps/order-service/src/application/use-cases/saga/start-checkout.use-case.ts`
- ⭐ #3: [Webhook Idempotency](./codebase-highlights.md#3-stripe-webhook-idempotency--advisory-locks) — `apps/order-service/src/application/use-cases/payment/handle-stripe-webhook.use-case.ts`
- ⭐ #4: [Transactional Outbox](./codebase-highlights.md#4-transactional-outbox--poller) — `apps/{catalog,order}-service/src/infrastructure/messaging/outbox-poller.cron.ts`
- ⭐ #5: [Event Versioning](./codebase-highlights.md#5-event-versioning-v1v2-side-by-side) — `packages/contracts/src/events/`
- ⭐ #6: [Hexagonal Layering](./codebase-highlights.md#6-hexagonal-layering-domain--application--infrastructure) — `apps/auth-service/src/`

---

## Technology Stack

### Backend
| Layer | Tech | Purpose |
|-------|------|---------|
| **Framework** | NestJS | Opinionated, DI-ready, module system |
| **Database** | PostgreSQL 16 | ACID, advisory locks, JSON columns |
| **Cache** | Redis 7 | Cart, rate limiting, blocklist |
| **Message Queue** | RabbitMQ 3.13 | Async events, topic exchange + DLX |
| **Search** | Elasticsearch 8.13 | Full-text, facets, autocomplete |
| **Payment** | Stripe API | PCI-compliant, webhooks |
| **Job Queue** | BullMQ | Email dispatch (background jobs) |
| **Logging** | Pino | Structured, fast, PII redaction |
| **Tracing** | OpenTelemetry + Tempo | Distributed traces, spans |
| **Metrics** | Prometheus | Time-series metrics collection |
| **Observability UI** | Grafana | Dashboards + Loki logs + Tempo traces |

### Frontend
| Layer | Tech | Purpose |
|-------|------|---------|
| **Framework** | Next.js 14 | App Router, RSC, ISR |
| **Auth** | NextAuth v5 | Credentials + JWT strategy |
| **State** | Zustand (Storefront) | Cart persistence |
| **State** | Redux Toolkit (Admin) | UI filters, modals |
| **Server State** | React Query (Admin) | Server cache, refetching |
| **Forms** | react-hook-form + Zod (Admin) | Validation, performance |
| **UI (Storefront)** | Custom Tailwind | Swiss Modernism (monochrome + accent) |
| **UI (Admin)** | shadcn/ui + Radix | Component library, accessible |
| **Charts** | Recharts | Visualizations |

### DevOps
| Layer | Tech | Purpose |
|-------|------|---------|
| **Container Orchestration** | Docker Compose (dev) | Local infra (Postgres, Redis, RabbitMQ, ES, Mailhog) |
| **CI/CD** | GitHub Actions | ESLint, TypeScript, build on PR |
| **Monorepo** | Turborepo + pnpm | Workspaces, incremental builds, caching |
| **Database Migrations** | Prisma Migrate | Schema versioning |
| **Linting** | ESLint + Prettier | Code quality |
| **Git Hooks** | Husky + commitlint | Conventional commits |

---

## Backend Hexagonal Layout (domain → application → infrastructure → interfaces)

Backend services (auth, catalog, order) follow hexagonal architecture. See [Code Standards](./code-standards.md#layering-strategy) for detailed structure. Flat services (search, email-worker, api-gateway) use modular NestJS.

---

## Environment Variables: Complete Map

All services read from root `.env` (committed: `.env.example`, secret: `.env`).

### Shared
```
NODE_ENV                         # development|production
LOG_LEVEL                        # debug|info|warn|error
```

### Auth Service
```
DATABASE_URL_AUTH                # postgres://user:pass@host/auth_db
AUTH_REDIS_URL                   # redis://localhost:6379/0
JWT_PRIVATE_KEY_B64              # Base64-encoded PEM (RS256 private key)
JWT_PUBLIC_KEY_B64               # Base64-encoded PEM (RS256 public key)
JWT_ISSUER                       # jcool-auth
JWT_AUDIENCE                     # jcool-clients
JWT_ACCESS_TTL_SECONDS           # 900 (15 min)
JWT_REFRESH_TTL_SECONDS          # 604800 (7 days)
AUTH_PORT                        # 3001
BCRYPT_COST                      # 12
ADMIN_EMAIL                      # seed user (auth-service seed)
ADMIN_PASSWORD                   # seed password
```

### Catalog Service
```
DATABASE_URL_CATALOG             # postgres://user:pass@host/catalog_db
RABBITMQ_URL                     # amqp://localhost:5672
REDIS_URL                        # redis://localhost:6379/1 (optional cache)
JWT_PUBLIC_KEY_B64 / AUTH_PUBLIC_KEY_B64  # RS256 public key (verify)
CATALOG_PORT                     # 3002
OUTBOX_BATCH_SIZE                # 100 (events per poll)
```

### Order Service
```
DATABASE_URL_ORDER               # postgres://user:pass@host/order_db
ORDER_REDIS_URL                  # redis://localhost:6379/2 (cart)
RABBITMQ_URL                     # amqp://localhost:5672
STRIPE_SECRET_KEY                # sk_test_...
STRIPE_WEBHOOK_SECRET            # whsec_test_...
AUTH_PUBLIC_KEY_B64              # RS256 public key
CATALOG_SERVICE_URL              # http://localhost:3002/api/v1
ORDER_PORT                       # 3004
OUTBOX_BATCH_SIZE                # 100
STRIPE_TIMEOUT_MS                # 30000
STRIPE_IDEMPOTENCY_KEY_TTL       # 86400 (24h)
```

### Search Service
```
ELASTICSEARCH_URL                # http://localhost:9200
RABBITMQ_URL                     # amqp://localhost:5672
CATALOG_SERVICE_URL              # http://localhost:3002/api/v1
AUTH_PUBLIC_KEY_B64              # RS256 public key
SEARCH_PORT                      # 3003
ES_INDEX_ALIAS                   # products (blue-green alias)
ES_INDEX_VERSION                 # 1 (index version)
REINDEX_BATCH_SIZE               # 500 (ES bulk size)
REINDEX_FETCH_PAGE_SIZE          # 50 (catalog pagination)
DEFAULT_CURRENCY                 # USD
SEARCH_REDIS_URL                 # redis://localhost:6379/1
```

### API Gateway
```
GATEWAY_PORT                     # 3000
GATEWAY_REDIS_URL                # redis://localhost:6379/4 (rate limit)
AUTH_SERVICE_URL                 # http://localhost:3001/api/v1
CATALOG_SERVICE_URL              # http://localhost:3002/api/v1
ORDER_SERVICE_URL                # http://localhost:3004/api/v1
SEARCH_SERVICE_URL               # http://localhost:3003/api/v1
AUTH_PUBLIC_KEY_B64              # RS256 public key
CORS_ORIGINS                     # http://localhost:3100,http://localhost:3101
PROXY_HEADERS_TIMEOUT_MS         # 30000
PROXY_BODY_TIMEOUT_MS            # 60000
```

### Email Worker
```
EMAIL_WORKER_REDIS_URL           # redis://localhost:6379/3 (BullMQ)
RABBITMQ_URL                     # amqp://localhost:5672
EMAIL_QUEUE_NAME                 # email
EMAIL_QUEUE_CONCURRENCY          # 4
SMTP_HOST                        # localhost (Mailhog dev), smtp.amazonaws.com (SES prod)
SMTP_PORT                        # 1025 (dev), 587 (prod)
SMTP_USER                        # dev: (none), prod: AWS SES user
SMTP_PASS                        # dev: (none), prod: AWS SES password
SMTP_FROM                        # noreply@jcool.com
SMTP_FROM_NAME                   # jCool
```

### Frontends (Storefront / Admin)
```
NEXT_PUBLIC_API_URL              # http://localhost:3000/api/v1 (external)
INTERNAL_API_URL                 # http://localhost:3000/api/v1 (server-side)
NEXTAUTH_SECRET                  # Random secret (NextAuth.js signing)
NEXTAUTH_URL                     # http://localhost:3100 (storefront) or 3101 (admin)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  # pk_test_... (storefront only)
NEXT_PUBLIC_STOREFRONT_URL       # http://localhost:3100 (admin redirect)
ADMIN_ALLOWED_ROLES              # admin (CSV)
NEXT_PUBLIC_API_BASE_URL         # http://localhost:3000/api/v1 (admin)
```

### Observability (Optional)
```
OTEL_EXPORTER_OTLP_ENDPOINT      # http://localhost:4318 (Tempo HTTP)
OTEL_EXPORTER_OTLP_HEADERS       # (none for local dev)
SENTRY_DSN                       # https://sentry.io/... (prod)
PROMETHEUS_SCRAPE_INTERVAL       # 15s
```

---

## Testing Strategy

### Unit Tests (Domain Logic)
- **Framework:** Vitest (in-memory, fast)
- **Approach:** Test domain entities + use cases with in-memory fakes (no Prisma mocks)
- **Example:** `apps/auth-service/test/application/use-cases/register-user.use-case.test.ts` — fake PasswordHasher, fake TokenSigner
- **Files per service:** ~6–12 test files
- **Coverage target:** Domain + critical application layer

### Integration Tests (Planned)
- Framework: Testcontainers (spin up real Postgres, Redis, RabbitMQ in Docker)
- Scope: Full saga (catalog reserve + Stripe mock + order persistence + outbox publish)
- Status: Reconciliation cron implemented; full suite planned

### E2E Tests (Planned)
- Framework: Playwright (browser automation)
- Scope: User journey (browse → add to cart → checkout → payment → email)
- Status: Deferred (full test suite planned)

---

## Build & Deployment Pipeline

### Local Development
```bash
pnpm install              # Install monorepo dependencies
make infra-up             # Docker Compose: Postgres, Redis, RabbitMQ, ES, Mailhog
pnpm dev                  # Turborepo: all services + frontends (watch mode)
pnpm seed                 # (Custom: seed auth-service + catalog-service)
```

### CI Pipeline (.github/workflows/ci.yml)
```
On: push/PR to main
Steps:
  1. Checkout (fetch-depth 2)
  2. Setup pnpm 10.30.3
  3. Setup Node from .nvmrc (cache pnpm)
  4. pnpm install --frozen-lockfile
  5. pnpm lint (ESLint + Prettier)
  6. pnpm typecheck (tsc --noEmit per service)
  7. pnpm build (Turborepo incremental)
  ✅ No tests in CI (yet)
  Timeout: 15 min
```

### Build Process
- **Turborepo:** Respects task dependencies (build → typecheck/test)
- **Incremental:** Only rebuilds changed packages + downstream dependents
- **Outputs:** dist/ (NestJS), .next/ (Next.js)
- **Caching:** turbo.json defines outputs + globalDependencies

### Dockerization
- **Dev:** Dockerfile.dev in each app (node:20-alpine or 22-alpine, corepack pnpm, copy+install+build)
- **Prod:** Deferred (multi-stage distroless per app planned for production deployment)
- **Compose:** infra/docker-compose.yml (services only), infra/docker-compose.observability.yml (optional o11y stack)

---

## Communication & Event Patterns

### Sync Communication
- **REST API:** HTTP/1.1 via undici (gateway → downstream services)
- **Example:** Order service calls catalog POST /inventory/reserve during checkout saga
- **Timeout:** 30s (PROXY_HEADERS_TIMEOUT_MS)

### Async Communication
- **Message Broker:** RabbitMQ topic exchange `events`, DLX `events.dlx`
- **Pattern:** Transactional outbox + poller
- **Guarantee:** At-least-once delivery (subscriber idempotency required)
- **Queues:**
  - `order-created` (order-service publishes, search/email consume)
  - `inventory-reserved` (catalog publishes)
  - `inventory-failed` (catalog publishes)
  - `payment-succeeded` (order-service publishes)
  - `payment-failed` (order-service publishes)
  - `order-confirmed` (order-service publishes, email-worker consumes)
  - `order-cancelled` (order-service publishes)
  - `order-shipped` (order-service publishes)
  - `product-indexed` (catalog publishes, search-service consumes)

### Error Handling
- **HTTP:** NestJS exception filter → 4xx/5xx + structured error body
- **Async:** Nack + DLQ (Poison messages sent to `{queue}.dlq` for manual inspection)
- **Saga Compensation:** Domain use case returns Result<T, E> → controller maps to HTTP status

---

## Running the Full System

### Prerequisites
- Node.js 20.11.0+ (or 22.14.0 from .nvmrc)
- Docker + Docker Compose
- pnpm ≥9

### 5-Minute Quickstart
```bash
# Clone, install
cd jCool-ecommerce
pnpm install

# Spin up infra (Postgres, Redis, RabbitMQ, ES, Mailhog)
make infra-up

# Watch all services + frontends
pnpm dev

# (In another terminal) Seed data
pnpm --filter @jcool/auth-service run seed:admin
pnpm --filter @jcool/catalog-service run seed:catalog

# Access:
# - Storefront: http://localhost:3100
# - Admin: http://localhost:3101 (login with seed admin)
# - API Gateway: http://localhost:3000/api/v1
# - RabbitMQ UI: http://localhost:15672
# - Mailhog: http://localhost:8025 (emails)
```

### Optional: Observability Stack
```bash
make o11y-up     # Prometheus + Loki + Tempo + Grafana (~1.5GB RAM)
# Access Grafana: http://localhost:3001

make o11y-up-lite  # Skip Tempo (~save 500MB)
make o11y-down
```

### Stripe Webhook Testing (Prod)
```bash
stripe listen --forward-to localhost:3004/api/v1/webhooks/stripe
```

---

## Open Questions

None identified at this documentation time. All services, patterns, and env vars have been mapped.
