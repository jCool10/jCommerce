import {
  PaymentFailedV1Schema,
  PaymentSucceededV1Schema,
  ROUTING_KEYS,
  type Currency,
  type PaymentFailedV1,
  type PaymentSucceededV1,
} from '@jcool/contracts';
import { err, ok, type Result } from '../../../domain/common/result.js';
import type { OrderError } from '../../../domain/order-error.js';
import type {
  WebhookEventRepository,
} from '../../../domain/ports/webhook-event.repository.js';
import type { DirectEventPublisher } from '../../ports/direct-event-publisher.port.js';

/**
 * Discriminated input — the controller does Stripe.Event parsing and hands
 * us a clean shape so the use case stays free of Stripe types. `unhandled`
 * is recorded for observability but never published.
 */
export type StripeWebhookInput =
  | {
      kind: 'payment_intent.succeeded';
      stripeEventId: string;
      stripePaymentIntentId: string;
      orderId: string;
      amount: number;
      currency: Currency;
      eventCreatedAt: Date;
    }
  | {
      kind: 'payment_intent.payment_failed';
      stripeEventId: string;
      stripePaymentIntentId: string;
      orderId: string;
      reason: string;
      eventCreatedAt: Date;
    }
  | {
      kind: 'unhandled';
      stripeEventId: string;
      eventType: string;
      payload: unknown;
    };

export interface HandleStripeWebhookResult {
  idempotent: boolean;
}

/**
 * Handles inbound Stripe webhooks. Dedup is enforced by the webhook_events
 * unique row: a duplicate returns ok({ idempotent: true }) so the controller
 * still answers 200 (Stripe keeps retrying anything non-2xx).
 *
 * Known race: recordIfNew and publish aren't in one transaction, so a publish
 * failure after the row is inserted leaves the order stuck in PAYMENT_PENDING.
 * The reconciliation cron picks those up. A full outbox would close the gap.
 */
export class HandleStripeWebhookUseCase {
  constructor(
    private readonly webhookEvents: WebhookEventRepository,
    private readonly publisher: DirectEventPublisher,
  ) {}

  async execute(
    event: StripeWebhookInput,
  ): Promise<Result<HandleStripeWebhookResult, OrderError>> {
    const inserted = await this.webhookEvents.recordIfNew({
      stripeEventId: event.stripeEventId,
      type: event.kind === 'unhandled' ? event.eventType : event.kind,
      payload: this.serializablePayload(event),
    });
    if (!inserted) return ok({ idempotent: true });

    if (event.kind === 'payment_intent.succeeded') {
      const payload: PaymentSucceededV1 = {
        version: 1,
        orderId: event.orderId,
        stripePaymentIntentId: event.stripePaymentIntentId,
        amount: { currency: event.currency, amount: event.amount },
        succeededAt: event.eventCreatedAt.toISOString(),
      };
      const validated = PaymentSucceededV1Schema.safeParse(payload);
      if (!validated.success) {
        return err({
          kind: 'PAYMENT_GATEWAY_FAILED',
          reason: `contract-violation: ${validated.error.message}`,
        });
      }
      await this.publisher.publish(ROUTING_KEYS.PAYMENT_SUCCEEDED, validated.data);
      return ok({ idempotent: false });
    }

    if (event.kind === 'payment_intent.payment_failed') {
      const payload: PaymentFailedV1 = {
        version: 1,
        orderId: event.orderId,
        stripePaymentIntentId: event.stripePaymentIntentId,
        reason: event.reason,
        failedAt: event.eventCreatedAt.toISOString(),
      };
      const validated = PaymentFailedV1Schema.safeParse(payload);
      if (!validated.success) {
        return err({
          kind: 'PAYMENT_GATEWAY_FAILED',
          reason: `contract-violation: ${validated.error.message}`,
        });
      }
      await this.publisher.publish(ROUTING_KEYS.PAYMENT_FAILED, validated.data);
      return ok({ idempotent: false });
    }

    // 'unhandled' → recorded above for audit; no publish.
    return ok({ idempotent: false });
  }

  private serializablePayload(event: StripeWebhookInput): unknown {
    if (event.kind === 'unhandled') return event.payload;
    // Replace Date with ISO string so Prisma JSONB serialization is stable.
    return {
      ...event,
      eventCreatedAt: event.eventCreatedAt.toISOString(),
    };
  }
}
