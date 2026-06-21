COMPOSE := docker compose -f infra/docker-compose.yml
O11Y_COMPOSE := docker compose -f infra/observability/docker-compose.observability.yml
ORDER_PORT ?= 3004

.PHONY: help infra-up infra-down infra-reset infra-logs infra-ps stripe-listen email-worker mailhog \
	o11y-up o11y-up-lite o11y-down o11y-reset o11y-logs o11y-ps grafana

help:
	@echo "Targets:"
	@echo "  infra-up       Boot all local infra (Postgres, Redis, RabbitMQ, ES, Mailhog)"
	@echo "  infra-down     Stop infra (keeps volumes)"
	@echo "  infra-reset    Stop + delete volumes (full wipe)"
	@echo "  infra-logs     Tail logs from all infra services"
	@echo "  infra-ps       Show container status"
	@echo "  stripe-listen  Forward Stripe webhooks → order-service (requires Stripe CLI)"
	@echo "  email-worker   Run email-worker locally (consumer + bullmq worker)"
	@echo "  mailhog        Open Mailhog UI at http://localhost:8025"
	@echo ""
	@echo "Observability (phase 14):"
	@echo "  o11y-up        Boot Grafana + Prometheus + Loki + Promtail + Tempo (~1.5GB RAM)"
	@echo "  o11y-up-lite   Same but skips Tempo (saves ~500MB for low-RAM machines)"
	@echo "  o11y-down      Stop observability stack (keeps volumes)"
	@echo "  o11y-reset     Stop + delete volumes (full wipe)"
	@echo "  o11y-logs      Tail logs"
	@echo "  o11y-ps        Container status"
	@echo "  grafana        Open Grafana UI at http://localhost:3001"

infra-up:
	$(COMPOSE) up -d

infra-down:
	$(COMPOSE) down

infra-reset:
	$(COMPOSE) down -v

infra-logs:
	$(COMPOSE) logs -f --tail=200

infra-ps:
	$(COMPOSE) ps

# Stripe CLI: `brew install stripe/stripe-cli/stripe` then `stripe login`.
# Prints the webhook signing secret on first run — paste into
# STRIPE_WEBHOOK_SECRET in your local .env. Keep running during dev.
stripe-listen:
	stripe listen --forward-to localhost:$(ORDER_PORT)/api/v1/webhooks/stripe

# Local email worker — requires infra-up (RabbitMQ + Redis + Mailhog).
email-worker:
	pnpm --filter @jcool/email-worker dev

# Mailhog catches every dev SMTP send. UI shows recipient, headers, raw MIME.
mailhog:
	@command -v open >/dev/null && open http://localhost:8025 || \
		echo "Mailhog UI: http://localhost:8025"

# Observability stack (phase 14). Apps run on host; Prometheus scrapes via
# host.docker.internal. Grafana auto-loads datasources + dashboards from
# infra/observability/grafana/{provisioning,dashboards}.
o11y-up:
	$(O11Y_COMPOSE) up -d

# Skip Tempo when running on a low-RAM box. Traces will not be collected
# but logs + metrics + dashboards remain functional.
o11y-up-lite:
	$(O11Y_COMPOSE) up -d prometheus loki promtail grafana

o11y-down:
	$(O11Y_COMPOSE) down

o11y-reset:
	$(O11Y_COMPOSE) down -v

o11y-logs:
	$(O11Y_COMPOSE) logs -f --tail=200

o11y-ps:
	$(O11Y_COMPOSE) ps

grafana:
	@command -v open >/dev/null && open http://localhost:3001 || \
		echo "Grafana UI: http://localhost:3001"
