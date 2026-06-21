# Deployment Guide: Local Development & Production Setup

**Purpose:** Get the system running locally in 5 minutes, understand environment configuration, and prepare for production deployment.

---

## Quick Start (5 Minutes)

### Prerequisites

- **Node.js:** ≥20.11.0 (check: `node --version`)
- **pnpm:** ≥9 (install: `npm install -g pnpm@10.30.3`)
- **Docker & Docker Compose:** Latest stable (check: `docker --version`, `docker-compose --version`)
- **Git:** For cloning (check: `git --version`)

### Setup Steps

```bash
# 1. Clone repository
git clone https://github.com/lochoang/jCool-ecommerce.git
cd jCool-ecommerce

# 2. Install dependencies
pnpm install

# 3. Start infrastructure (Postgres, Redis, RabbitMQ, Elasticsearch, Mailhog)
make infra-up

# 4. Run all services + frontends (watch mode, takes ~30s to start)
pnpm dev

# 5. In a new terminal, seed data
pnpm --filter @jcool/auth-service run seed:admin
pnpm --filter @jcool/catalog-service run seed:catalog

# 6. Access the system
#    Storefront:        http://localhost:3100
#    Admin:             http://localhost:3101 (login with seed admin)
#    API Gateway:       http://localhost:3000/api/v1
#    RabbitMQ UI:       http://localhost:15672 (guest:guest)
#    Mailhog:           http://localhost:8025 (view sent emails)
```

### Verify Setup

```bash
# Check if all services are running
curl http://localhost:3000/health

# Expected response (aggregated health check):
{
  "status": "ok",
  "services": {
    "auth-service": "ok",
    "catalog-service": "ok",
    "order-service": "ok",
    "search-service": "ok"
  }
}
```

### Seed Data Explained

**Admin User (auth-service seed):**
```bash
Email:    admin@example.com
Password: AdminPassword123
Role:     admin
```

**Catalog Products (catalog-service seed):**
```
- T-Shirt (3 colors, USD + VND pricing)
- Hoodie (2 colors)
- Cap (1 color)
- Sample inventory (100+ units per SKU)
```

---

## Environment Variables: Complete Reference

### Shared Variables

| Variable | Default | Purpose | Notes |
|----------|---------|---------|-------|
| `NODE_ENV` | development | Node.js environment | Set to `production` for prod deploys |
| `LOG_LEVEL` | info | Pino logging level | debug, info, warn, error |

### Auth Service (Port 3001)

| Variable | Default | Purpose | Required |
|----------|---------|---------|----------|
| `DATABASE_URL_AUTH` | postgres://postgres:postgres@localhost:5432/auth_db | Postgres connection string | ✅ |
| `AUTH_REDIS_URL` | redis://localhost:6379/0 | Redis connection (refresh token blocklist) | ✅ |
| `JWT_PRIVATE_KEY_B64` | (base64 PEM, see .env) | RS256 private key (sign tokens) | ✅ |
| `JWT_PUBLIC_KEY_B64` | (base64 PEM, see .env) | RS256 public key (verify tokens) | ✅ |
| `JWT_ISSUER` | jcool-auth | Token iss claim | ✅ |
| `JWT_AUDIENCE` | jcool-clients | Token aud claim | ✅ |
| `JWT_ACCESS_TTL_SECONDS` | 900 | Access token expiry (15 min) | ✅ |
| `JWT_REFRESH_TTL_SECONDS` | 604800 | Refresh token expiry (7 days) | ✅ |
| `AUTH_PORT` | 3001 | Listen port | ✅ |
| `BCRYPT_COST` | 12 | Password hash cost (higher = slower but more secure) | ✅ |
| `ADMIN_EMAIL` | admin@example.com | Seed admin email | ✅ |
| `ADMIN_PASSWORD` | AdminPassword123 | Seed admin password | ✅ |

### Catalog Service (Port 3002)

| Variable | Default | Purpose | Required |
|----------|---------|---------|----------|
| `DATABASE_URL_CATALOG` | postgres://postgres:postgres@localhost:5432/catalog_db | Postgres connection | ✅ |
| `RABBITMQ_URL` | amqp://guest:guest@localhost:5672 | RabbitMQ connection | ✅ |
| `REDIS_URL` | redis://localhost:6379/1 | Redis (optional cache) | ❌ |
| `JWT_PUBLIC_KEY_B64` | (base64 PEM) | Verify JWT from gateway | ✅ |
| `CATALOG_PORT` | 3002 | Listen port | ✅ |
| `OUTBOX_BATCH_SIZE` | 100 | Events per poller cycle | ✅ |

### Order Service (Port 3004)

| Variable | Default | Purpose | Required |
|----------|---------|---------|----------|
| `DATABASE_URL_ORDER` | postgres://postgres:postgres@localhost:5432/order_db | Postgres connection | ✅ |
| `ORDER_REDIS_URL` | redis://localhost:6379/2 | Redis (shopping cart) | ✅ |
| `RABBITMQ_URL` | amqp://guest:guest@localhost:5672 | RabbitMQ connection | ✅ |
| `STRIPE_SECRET_KEY` | sk_test_... (see .env) | Stripe API key (secret) | ✅ |
| `STRIPE_WEBHOOK_SECRET` | whsec_test_... (see .env) | Stripe webhook signing secret | ✅ |
| `JWT_PUBLIC_KEY_B64` | (base64 PEM) | Verify JWT from gateway | ✅ |
| `CATALOG_SERVICE_URL` | http://localhost:3002/api/v1 | Catalog service endpoint (reserve inventory) | ✅ |
| `ORDER_PORT` | 3004 | Listen port | ✅ |
| `OUTBOX_BATCH_SIZE` | 100 | Events per poller cycle | ✅ |
| `STRIPE_TIMEOUT_MS` | 30000 | PaymentIntent creation timeout | ✅ |

### Search Service (Port 3003)

| Variable | Default | Purpose | Required |
|----------|---------|---------|----------|
| `ELASTICSEARCH_URL` | http://localhost:9200 | Elasticsearch connection | ✅ |
| `RABBITMQ_URL` | amqp://guest:guest@localhost:5672 | RabbitMQ connection | ✅ |
| `CATALOG_SERVICE_URL` | http://localhost:3002/api/v1 | Catalog endpoint (reindex) | ✅ |
| `JWT_PUBLIC_KEY_B64` | (base64 PEM) | Verify JWT (admin reindex) | ✅ |
| `SEARCH_PORT` | 3003 | Listen port | ✅ |
| `ES_INDEX_ALIAS` | products | ES alias (blue-green swap) | ✅ |
| `ES_INDEX_VERSION` | 1 | Index version (products-1) | ✅ |
| `REINDEX_BATCH_SIZE` | 500 | ES bulk batch size | ✅ |
| `REINDEX_FETCH_PAGE_SIZE` | 50 | Catalog pagination size | ✅ |
| `DEFAULT_CURRENCY` | USD | Default currency for search | ✅ |
| `SEARCH_REDIS_URL` | redis://localhost:6379/1 | Redis cache (optional) | ❌ |

### API Gateway (Port 3000)

| Variable | Default | Purpose | Required |
|----------|---------|---------|----------|
| `GATEWAY_PORT` | 3000 | Listen port | ✅ |
| `GATEWAY_REDIS_URL` | redis://localhost:6379/4 | Redis (rate limit storage) | ✅ |
| `AUTH_SERVICE_URL` | http://localhost:3001/api/v1 | Auth service endpoint | ✅ |
| `CATALOG_SERVICE_URL` | http://localhost:3002/api/v1 | Catalog service endpoint | ✅ |
| `ORDER_SERVICE_URL` | http://localhost:3004/api/v1 | Order service endpoint | ✅ |
| `SEARCH_SERVICE_URL` | http://localhost:3003/api/v1 | Search service endpoint | ✅ |
| `JWT_PUBLIC_KEY_B64` | (base64 PEM) | Verify JWT | ✅ |
| `CORS_ORIGINS` | http://localhost:3100,http://localhost:3101 | Allowed origins | ✅ |
| `PROXY_HEADERS_TIMEOUT_MS` | 30000 | Downstream request timeout | ✅ |
| `PROXY_BODY_TIMEOUT_MS` | 60000 | Downstream body timeout | ✅ |

### Email Worker (No HTTP)

| Variable | Default | Purpose | Required |
|----------|---------|---------|----------|
| `EMAIL_WORKER_REDIS_URL` | redis://localhost:6379/3 | Redis (BullMQ queue) | ✅ |
| `RABBITMQ_URL` | amqp://guest:guest@localhost:5672 | RabbitMQ connection | ✅ |
| `EMAIL_QUEUE_NAME` | email | BullMQ queue name | ✅ |
| `EMAIL_QUEUE_CONCURRENCY` | 4 | Concurrent email jobs | ✅ |
| `SMTP_HOST` | localhost | SMTP server | ✅ |
| `SMTP_PORT` | 1025 | SMTP port | ✅ |
| `SMTP_USER` | (empty for Mailhog) | SMTP authentication | ❌ (dev) |
| `SMTP_PASS` | (empty for Mailhog) | SMTP authentication | ❌ (dev) |
| `SMTP_FROM` | noreply@jcool.com | Email from address | ✅ |
| `SMTP_FROM_NAME` | jCool | Email from name | ✅ |

### Frontends

**Storefront (Port 3100):**
| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | http://localhost:3000/api/v1 | API endpoint (public) |
| `INTERNAL_API_URL` | http://localhost:3000/api/v1 | API endpoint (server-side) |
| `NEXTAUTH_SECRET` | (random, see .env) | NextAuth.js signing secret |
| `NEXTAUTH_URL` | http://localhost:3100 | NextAuth callback URL |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | pk_test_... (see .env) | Stripe publishable key |

**Admin (Port 3101):**
| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | http://localhost:3000/api/v1 | API endpoint |
| `NEXTAUTH_SECRET` | (random, see .env) | NextAuth.js signing secret |
| `NEXTAUTH_URL` | http://localhost:3101 | NextAuth callback URL |
| `NEXT_PUBLIC_STOREFRONT_URL` | http://localhost:3100 | Redirect for non-admins |
| `ADMIN_ALLOWED_ROLES` | admin | CSV of allowed roles |

### Observability (Optional)

| Variable | Default | Purpose | Required |
|----------|---------|---------|----------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | http://localhost:4318 | Tempo OTLP/HTTP endpoint | ❌ |
| `OTEL_EXPORTER_OTLP_HEADERS` | (none) | Custom headers for OTLP | ❌ |
| `SENTRY_DSN` | (none, set in prod) | Sentry.io error tracking | ❌ |

---

## Makefile Targets: Local Development

```bash
# Infrastructure
make infra-up              # Start Docker Compose (Postgres, Redis, RabbitMQ, ES, Mailhog)
make infra-down            # Stop containers (keep volumes)
make infra-reset           # Stop + remove volumes (wipe data)
make infra-logs            # Tail logs (last 200 lines, -f follow)
make infra-ps              # Show running containers

# Observability (optional)
make o11y-up               # Start full stack (Prometheus, Loki, Tempo, Grafana, ~1.5GB RAM)
make o11y-up-lite          # Skip Tempo (save ~500MB RAM)
make o11y-down             # Stop observability stack
make o11y-reset            # Stop + remove volumes
make o11y-logs             # Tail observability logs
make o11y-ps               # Show observability containers

# Services
make email-worker          # Start email worker in watch mode
make stripe-listen         # Forward Stripe webhooks to order-service

# Utilities
make grafana               # Open Grafana (http://localhost:3001) in browser
make mailhog               # Open Mailhog (http://localhost:8025) in browser
```

---

## Pnpm Workspace Commands

### All Services (Root)

```bash
pnpm dev                   # Watch all services (Turborepo persistent)
pnpm build                 # Incremental build (respects ^build deps)
pnpm lint                  # ESLint + Prettier check
pnpm format                # Auto-format all files
pnpm format:check          # Check formatting (CI)
pnpm typecheck             # TypeScript strict (depends on ^build)
pnpm test                  # Vitest run (services with test script)
pnpm clean                 # Remove dist/ + .next/ + node_modules/.turbo
```

### Single Service

```bash
# Auth service example
pnpm --filter @jcool/auth-service dev
pnpm --filter @jcool/auth-service build
pnpm --filter @jcool/auth-service test
pnpm --filter @jcool/auth-service test:watch
pnpm --filter @jcool/auth-service test -- -t "register user"  # Pattern match
pnpm --filter @jcool/auth-service run seed:admin              # Custom script

# Replace @jcool/auth-service with:
#   @jcool/catalog-service, @jcool/order-service, @jcool/search-service,
#   @jcool/email-worker, @jcool/api-gateway, @jcool/storefront, @jcool/admin
```

---

## Stripe Webhook Testing (Local)

### Setup Stripe CLI

```bash
# Install Stripe CLI (https://stripe.com/docs/stripe-cli)
# macOS:
brew install stripe/stripe-cli/stripe

# Verify installation
stripe --version
```

### Forward Webhooks

```bash
# Start forwarding Stripe webhooks to order-service
make stripe-listen

# Or manually:
stripe listen --forward-to localhost:3004/api/v1/webhooks/stripe

# Output:
# > Ready! Your webhook signing secret is: whsec_test_...
# Copy this to STRIPE_WEBHOOK_SECRET in .env and restart order-service

# In another terminal, trigger test events:
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed

# Check mailhog for confirmation emails:
# http://localhost:8025
```

---

## Database Management

### Prisma Migrations

```bash
# Create new migration (auth-service example)
pnpm --filter @jcool/auth-service exec prisma migrate dev --name add_user_phone

# Apply pending migrations
pnpm --filter @jcool/auth-service exec prisma migrate deploy

# View migration status
pnpm --filter @jcool/auth-service exec prisma migrate status

# Reset database (⚠️ destructive)
pnpm --filter @jcool/auth-service exec prisma migrate reset
```

### Direct Database Access

```bash
# Connect to auth_db
psql postgres://postgres:postgres@localhost:5432/auth_db

# Common queries:
# List tables: \dt
# View schema: \d users
# Exit: \q

# Example: Query users
SELECT id, email, role FROM users;
```

---

## Observability Setup

### Full Observability Stack (o11y-up)

```bash
make o11y-up

# Access dashboards:
# - Grafana:     http://localhost:3001 (username: admin, password: admin)
# - Prometheus:  http://localhost:9090
# - Loki:        http://localhost:3100 (via Grafana)
# - Tempo:       http://localhost:4317 (gRPC endpoint, no UI)
```

### View Traces (Grafana Explore)

1. Open http://localhost:3001
2. Click **Explore** (left sidebar)
3. Select **Tempo** data source
4. Search by **Trace ID** or **Service Name**:
   - Service: order-service, catalog-service, auth-service, etc.
   - Tags: http.method, http.status_code
5. View full trace waterfall (gateway → service → DB)

### View Logs (Grafana Explore)

1. Open http://localhost:3001
2. Click **Explore**
3. Select **Loki** data source
4. Query:
   ```
   {service="order-service"}
   ```
5. Filter by correlation_id, log level, etc.

### View Metrics (Grafana Dashboards)

1. Open http://localhost:3001
2. Click **Dashboards** (left sidebar)
3. Pre-configured dashboards:
   - **jCool Orders**: Order volume, revenue, saga compensations
   - **jCool Infrastructure**: CPU, memory, network per service
   - **RabbitMQ**: Queue depth, publish/consume rates
   - **Postgres**: Connection pool, query latency

---

## Troubleshooting

### "Services won't start" (pnpm dev hangs)

**Symptom:** `pnpm dev` runs but services don't appear on ports

**Fix:**
```bash
# Kill any lingering processes
lsof -ti:3000,3001,3002,3003,3004 | xargs kill -9

# Restart services
pnpm dev
```

### "Postgres connection refused"

**Symptom:** Error: `ECONNREFUSED 127.0.0.1:5432`

**Fix:**
```bash
# Check if container is running
docker ps | grep postgres

# If missing, start infra:
make infra-up

# Wait 5s for Postgres to initialize:
sleep 5

# Verify connection:
docker exec postgres_container pg_isready -U postgres
```

### "RabbitMQ connection refused"

**Symptom:** Error: `connect ECONNREFUSED 127.0.0.1:5672`

**Fix:**
```bash
# Restart RabbitMQ
make infra-down
make infra-up

# Check management UI: http://localhost:15672
# Default credentials: guest/guest
```

### "Elasticsearch security_exception"

**Symptom:** Error: `security_exception [security_exception]: missing authentication credentials`

**Fix:** This is expected in dev (Elasticsearch runs with security off). Restart:
```bash
make infra-reset
make infra-up
```

### "JWT verification failed"

**Symptom:** Error: `JwtVerifyError: invalid signature`

**Fix:**
- Check `JWT_PRIVATE_KEY_B64` and `JWT_PUBLIC_KEY_B64` match in `.env`
- Regenerate keypair if corrupted:
  ```bash
  # Generate new RS256 keypair
  openssl genrsa -out private.pem 2048
  openssl rsa -in private.pem -pubout -out public.pem
  
  # Encode to base64
  base64 < private.pem > private.b64
  base64 < public.pem > public.b64
  
  # Update .env with values from *.b64 files
  ```

### "Cannot find module @jcool/contracts"

**Symptom:** Error during `pnpm install` or `pnpm build`

**Fix:**
```bash
# Reinstall dependencies
pnpm install

# Rebuild shared packages
pnpm build --filter="@jcool/*"

# Restart dev server
pnpm dev
```

---

## Production Deployment (Planned)

### Architecture

**Production Topology:**
```
Client
  ↓
Cloud Run (API Gateway)
  ↓
Cloud Run Services (Auth, Catalog, Order, Search, Email Worker)
  ↓
Cloud SQL (Postgres)
Cloud Memory (Redis)
Cloud Pub/Sub (RabbitMQ alternative, deferred)
Cloud Storage (images)
Cloud Trace (Tempo alternative)
```

### Planned Production Work

- [ ] Multi-stage production Dockerfile per app (distroless base image)
- [ ] Cloud SQL setup (managed Postgres 16, SSL, automated backups)
- [ ] Secret Manager (rotate JWT keys, Stripe secrets, DB passwords)
- [ ] Cloud Run deployment (services, auto-scaling, traffic splitting)
- [ ] Health check tuning (liveness vs readiness distinction)
- [ ] Monitoring & alerting (Ops Agent, Cloud Monitoring)
- [ ] Gradual rollout strategy (canary, auto-rollback)

### Current Status

Production Dockerfile not yet implemented. Use `Dockerfile.dev` for building images (not recommended for prod due to dev dependencies included).

---

## Performance Tuning (Optional)

### Connection Pool Sizing (Postgres)

```env
# In DATABASE_URL_* (Prisma connection string)
# Default: ?connection_limit=5&pool_timeout=10

DATABASE_URL_ORDER="postgresql://...?connection_limit=20&pool_timeout=20"
```

### Redis Memory Limits

```bash
# Set max memory eviction policy (docker-compose)
redis-cli CONFIG SET maxmemory 512mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### RabbitMQ Prefetch Limit

```bash
# Per consumer (order-service), prefetch 10 messages at a time
# Configured in infrastructure/messaging/rabbitmq-event-publisher.ts
```

---

## Monitoring & Alerts

### Recommended Alerts

1. **5xx Errors:** If error rate > 1% for 5 min
2. **Payment Failures:** If payment failure rate > 10% for 1 min
3. **DLQ Backlog:** If dead-letter queue depth > 100 messages
4. **DB Connection Pool:** If active connections > 18/20
5. **Outbox Lag:** If unpublished events > 1000 for 5 min

### Grafana Alert Setup

1. Open http://localhost:3001
2. Click **Alerts** (left sidebar)
3. Click **+ New Alert Rule**
4. Select metric (e.g., `http_request_total` with `status=~"5.."}`)
5. Set threshold + duration
6. Assign notification channel (email, Slack, etc.)

---

## Open Questions

- **Production timeline?** Contingent on project priority and MVP validation
- **Cloud provider preference?** GCP (Cloud Run) vs AWS (ECS) vs Azure (Container Instances) — not yet decided
- **Data backup strategy?** Cloud SQL automated snapshots vs manual exports — deferred to production deployment

