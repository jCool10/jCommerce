import { err, ok, type Result } from '../../src/domain/common/result.js';
import type { OrderError } from '../../src/domain/order-error.js';
import type {
  CreateIntentRequest,
  CreateIntentResult,
  PaymentGateway,
} from '../../src/domain/ports/payment-gateway.port.js';

export class FakePaymentGateway implements PaymentGateway {
  private createOutcome: Result<CreateIntentResult, OrderError> = ok({
    stripePaymentIntentId: 'pi_fake_default',
    clientSecret: 'pi_fake_default_secret',
  });
  private refundOutcome: Result<void, OrderError> = ok(undefined);

  readonly createCalls: CreateIntentRequest[] = [];
  readonly refundCalls: string[] = [];

  setCreateOutcome(outcome: Result<CreateIntentResult, OrderError>): this {
    this.createOutcome = outcome;
    return this;
  }

  setRefundOutcome(outcome: Result<void, OrderError>): this {
    this.refundOutcome = outcome;
    return this;
  }

  async createIntent(
    req: CreateIntentRequest,
  ): Promise<Result<CreateIntentResult, OrderError>> {
    this.createCalls.push(req);
    return this.createOutcome;
  }

  async refund(stripePaymentIntentId: string): Promise<Result<void, OrderError>> {
    this.refundCalls.push(stripePaymentIntentId);
    return this.refundOutcome;
  }

  // Helper to assert idempotency: payment gateway adapters call createIntent
  // with `orderId` as the idempotency key. When enabled, the fake also rolls
  // forward a deterministic per-orderId intent id, so happy-path tests can
  // assert on `pi_fake_{orderId}` and saga unit tests can match clientSecret
  // shape. Reads `this.createOutcome` on each call so `setCreateOutcome`
  // invoked AFTER `enableIdempotency` still takes effect.
  enableIdempotency(): this {
    const seen = new Map<string, Result<CreateIntentResult, OrderError>>();
    this.createIntent = async (req) => {
      this.createCalls.push(req);
      const cached = seen.get(req.orderId);
      if (cached) return cached;
      const current = this.createOutcome;
      const fresh: Result<CreateIntentResult, OrderError> =
        current.ok && current.value.stripePaymentIntentId === 'pi_fake_default'
          ? ok({
              stripePaymentIntentId: `pi_fake_${req.orderId}`,
              clientSecret: `pi_fake_${req.orderId}_secret`,
            })
          : current;
      seen.set(req.orderId, fresh);
      return fresh;
    };
    return this;
  }

  // tiny helper for tests that want a forced error
  static failedWith(reason: string): Result<CreateIntentResult, OrderError> {
    return err({ kind: 'PAYMENT_GATEWAY_FAILED', reason });
  }
}
