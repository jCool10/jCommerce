# Local Infrastructure

Local-only docker compose stack for development. Production deploy is GCP Cloud Run (phase 15).

## Quick start

```bash
make infra-up         # boot all services
make infra-logs       # tail logs
make infra-down       # stop (keeps volumes)
make infra-reset      # stop + delete volumes (full wipe)
```

Or raw:

```bash
docker compose -f infra/docker-compose.yml up -d
```

## Services & ports

| Service       | Port(s)      | Notes                                      |
| ------------- | ------------ | ------------------------------------------ |
| Postgres      | 5432         | DBs: `auth_db`, `catalog_db`, `order_db`   |
| Redis         | 6379         | Cache + sessions + BullMQ                  |
| RabbitMQ      | 5672 / 15672 | AMQP / management UI (guest / guest)       |
| Elasticsearch | 9200         | Single-node, security disabled, 512MB heap |
| Mailhog       | 1025 / 8025  | SMTP / web UI                              |

## Credentials (dev only)

| Service  | User     | Password |
| -------- | -------- | -------- |
| Postgres | postgres | postgres |
| RabbitMQ | guest    | guest    |

All overridable via `.env` at the repo root (see `.env.example`).

## Pre-declared RabbitMQ topology

`infra/rabbitmq/definitions.json` declares:

- Topic exchange **events** + DLX **events.dlx**
- Queues (main + `.dlq` siblings): `order-created`, `inventory-reserved`, `inventory-failed`, `payment-succeeded`, `payment-failed`, `order-confirmed`, `product-indexed`
- All main queues dead-letter to `events.dlx` with `<routing-key>.dlq` keys

Open the management UI at <http://localhost:15672> after boot to verify.

## Troubleshooting

- **Postgres won't start / "data dir not empty"** → `make infra-reset`
- **Elasticsearch OOM** → confirm heap cap `ES_JAVA_OPTS=-Xms512m -Xmx512m` (set in compose)
- **RabbitMQ definitions not loaded** → ensure `rabbitmq.conf` and `definitions.json` mounted read-only; check container logs for parse errors
- **Boot >90s** → first run pulls images; subsequent boots should be much faster

## RAM budget

Realistic dev workstation needs **≥16GB total** (infra ~6-8GB + IDE/Chrome/Docker overhead + 6 NestJS services + 2 Next.js apps). For low-RAM machines, a minimal compose without Elasticsearch is a future addition (catalog falls back to Postgres FTS for offline dev).
