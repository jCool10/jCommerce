import { Injectable, Logger } from '@nestjs/common';
import { err, ok, type Result } from '../../domain/common/result.js';
import type { OrderError } from '../../domain/order-error.js';
import type {
  CreateIntentRequest,
  CreateIntentResult,
  PaymentGateway,
} from '../../domain/ports/payment-gateway.port.js';
import type { StripePaymentIntentsClient } from './stripe-payment-intents.port.js';

/**
 * Stripe PaymentIntent adapter.
 *
 *   - idempotencyKey = orderId so a retried call (e.g. saga restart mid-flight)
 *     returns the same PaymentIntent instead of charging twice.
 *   - currency is lowercased; Stripe wants lowercase ISO codes.
 *   - metadata.orderId is required — the webhook handler reads it back to
 *     correlate the event to our Order.
 *
 * Refund is still a stub.
 */
@Injectable()
export class StripePaymentGatewayAdapter implements PaymentGateway {
  private readonly logger = new Logger(StripePaymentGatewayAdapter.name);

  constructor(private readonly paymentIntents: StripePaymentIntentsClient) {}

  async createIntent(
    req: CreateIntentRequest,
  ): Promise<Result<CreateIntentResult, OrderError>> {
    try {
      const intent = await this.paymentIntents.create(
        {
          amount: req.amount,
          currency: req.currency.toLowerCase(),
          metadata: { orderId: req.orderId },
          automatic_payment_methods: { enabled: true },
        },
        { idempotencyKey: req.orderId },
      );
      if (!intent.client_secret) {
        return err({
          kind: 'PAYMENT_GATEWAY_FAILED',
          reason: `stripe response missing client_secret for intent ${intent.id}`,
        });
      }
      return ok({
        stripePaymentIntentId: intent.id,
        clientSecret: intent.client_secret,
      });
    } catch (error) {
      const reason = (error as Error).message ?? 'unknown';
      this.logger.error(`stripe createIntent failed order=${req.orderId}: ${reason}`);
      return err({ kind: 'PAYMENT_GATEWAY_FAILED', reason });
    }
  }

  async refund(stripePaymentIntentId: string): Promise<Result<void, OrderError>> {
    this.logger.warn(`refund not implemented (piid=${stripePaymentIntentId})`);
    return ok(undefined);
  }
}
