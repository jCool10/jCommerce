# @jcool/email-worker

Phase 9 — standalone NestJS worker that turns `order.confirmed` RabbitMQ events into outbound emails.

## Pipeline

```
RabbitMQ (order-confirmed)
  └─ OrderConfirmedConsumer (amqplib) ──► BullMQ queue (send-email)
                                            └─ BullMQ Worker
                                                ├─ OrderConfirmationRendererService (MJML + Handlebars)
                                                └─ NodemailerSmtpSender (SMTP → Mailhog dev)
```

## Why both RabbitMQ and BullMQ?

- **RabbitMQ** is the inter-service event bus. Order-service publishes `order.confirmed`; this worker consumes it.
- **BullMQ** is the _internal_ job queue. It owns retry/backoff/DLQ for the SMTP send itself, so a transient SMTP outage does not requeue the RabbitMQ event over and over (which would re-trigger every downstream consumer too).

Trade-off documented to avoid the confusion the phase plan flagged.

## Run locally

```bash
make infra-up          # postgres + redis + rabbitmq + es + mailhog
make email-worker      # this app, watch mode
make mailhog           # opens http://localhost:8025
```

To trigger an email, publish a sample `order.confirmed` event (or run the full checkout flow via order-service).

## Reliability config

| Setting               | Value               | Source                                 |
| --------------------- | ------------------- | -------------------------------------- |
| BullMQ attempts       | 3                   | `email-job-config.ts`                  |
| Backoff (exponential) | 5s → 30s → 5min     | `EMAIL_BACKOFF_MS`                     |
| DLQ                   | BullMQ `failed` set | `bullmq-email-worker.service.ts` event |
| Idempotency           | `jobId = orderId`   | `bullmq-email-queue.adapter.ts`        |
| Consumer poison       | nack → `events.dlx` | `order-confirmed.consumer.ts`          |
| Consumer transient    | nack with requeue   | `order-confirmed.consumer.ts`          |

## Adding a new template type (welcome email, password reset, ...)

1. Drop `<name>.mjml` into `src/modules/templates/`.
2. Add a `<Name>RendererService` next to `OrderConfirmationRendererService`, register it in `app.module.ts`.
3. Add a new BullMQ job name + processor branch in `email-worker.processor.ts`.
4. Optionally bind a new RabbitMQ queue to a new consumer.

Welcome email + password reset are out of scope for MVP per the phase plan.

## Escape hatches

```
EMAIL_DISABLE_CONSUMER=1   # consumer does not subscribe (worker still runs)
EMAIL_DISABLE_WORKER=1     # worker does not start (consumer still enqueues)
```

Useful when one half of the pipeline needs maintenance without losing events.
