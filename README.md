# jCool E-commerce Platform

**A portfolio-grade NestJS + Next.js microservices e-commerce platform** with scalable architecture, observability, and multi-currency support (USD + VND).

---

## Quick Start

### Prerequisites

- Node.js ≥20.11.0, pnpm ≥9
- Docker & Docker Compose
- Stripe CLI (optional, for webhook testing)

### Local Setup (5 min)

```bash
# Install dependencies
pnpm install

# Start infrastructure (Postgres, Redis, RabbitMQ, Elasticsearch, Mailhog)
make infra-up

# Run all services + frontends
pnpm dev

# Seed (in another terminal)
pnpm --filter @jcool/auth-service run seed:admin
pnpm --filter @jcool/catalog-service run seed:catalog
```

**Services:** API Gateway (3000) | Auth (3001) | Catalog (3002) | Search (3003) | Order (3004) | Storefront (3100) | Admin (3101)

**Management:** RabbitMQ (15672) | Mailhog (8025)

## Architecture Essentials

### Services

| Service          | Port | Purpose                                                |
| ---------------- | ---- | ------------------------------------------------------ |
| **Auth**         | 3001 | JWT issuance, user registration/login, token refresh   |
| **Catalog**      | 3002 | Products, inventory, outbox → search indexing          |
| **Search**       | 3003 | Elasticsearch full-text + facets (event-driven)        |
| **Order**        | 3004 | Saga orchestration, Stripe integration, outbox → email |
| **API Gateway**  | 3000 | JWT verification, reverse proxy, rate limiting         |
| **Email Worker** | —    | BullMQ + MJML/Handlebars (consumes order.confirmed)    |

### Key Patterns

- **Hexagonal Architecture:** Domain → Application → Infrastructure (Auth, Catalog, Order)
- **Result<T, E>:** Discriminated union error handling (no exceptions)
- **Transactional Outbox:** Durably published every 1s, batch size configurable
- **Idempotency:** Stripe webhooks deduped via Postgres UNIQUE constraint
- **Multi-Currency:** Integer subunits (USD cents + VND đồng), no FX

Full architecture: [System Architecture](./docs/system-architecture.md)

## Development Commands

```bash
pnpm dev           # All services + frontends
pnpm lint          # ESLint + Prettier
pnpm typecheck     # TypeScript strict
pnpm build         # Turborepo incremental
pnpm test          # Vitest (unit tests)
pnpm format        # Auto-format

make infra-up      # Docker Compose stack
make infra-down    # Stop (keeps volumes)
make o11y-up       # Optional Grafana + Prometheus stack
```

## Monorepo Structure

```
apps/              6 NestJS services + 2 Next.js frontends
packages/          Contracts, observability, ESLint/TypeScript configs
infra/             Docker Compose + observability stack
docs/              📚 All documentation
Makefile           Dev convenience targets
```

## Documentation

- **[Codebase Summary](./docs/codebase-summary.md)** — File inventory, reading order, per-app overview, technology stack
- **[Codebase Highlights](./docs/codebase-highlights.md)** ⭐ — 6 senior-judgment deep dives (deadlock-free reservation, saga + compensation, webhook idempotency, versioned events, transactional outbox, hexagonal layering)
- **[Project Overview & PDR](./docs/project-overview-pdr.md)** — Vision, personas, functional + non-functional requirements, success metrics
- **[System Architecture](./docs/system-architecture.md)** — Service topology (Mermaid), checkout saga sequence, event flow, data stores
- **[Code Standards](./docs/code-standards.md)** — Hexagonal layering, Result<T,E>, naming conventions, testing strategy
- **[Architecture Patterns](./docs/architecture-patterns.md)** — Deep walkthroughs (transactional outbox, saga, webhook idempotency, multi-currency)
- **[Deployment Guide](./docs/deployment-guide.md)** — Local setup (5 min), env var groups, Docker Compose, Stripe webhook testing, troubleshooting
- **[Design Guidelines](./docs/design-guidelines.md)** — Storefront Swiss Modernism (monochrome + accent) vs. Admin shadcn/ui (rounded + HSL), NextAuth v5
- **[Project Status & Roadmap](./docs/project-roadmap.md)** — Current status, consciously deferred items, success metrics

## Contributing

1. Create feature branch: `git checkout -b feat/your-feature`
2. Make changes; validate: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`
3. Commit with conventional format: `git commit -m "feat(service): description"`
4. Push and open PR; CI validates before merge

See [Code Standards](./docs/code-standards.md) for patterns and conventions.

## License

MIT
