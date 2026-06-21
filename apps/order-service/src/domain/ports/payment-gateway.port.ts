import type { Currency } from '@jcool/contracts';
import type { Result } from '../common/result.js';
import type { OrderError } from '../order-error.js';

export interface CreateIntentRequest {
  orderId: string;
  amount: number;
  currency: Currency;
}

export interface CreateIntentResult {
  stripePaymentIntentId: string;
  clientSecret: string;
}

/**
 * Driven-side port for the payment provider. The Stripe adapter lives in
 * `infrastructure/stripe/`; a stub returning deterministic intent IDs lets the
 * saga run end-to-end in tests.
 *
 * Callers must pass `orderId` as the idempotency key so a retried createIntent
 * for the same order returns the same intent.
 */
export interface PaymentGateway {
  createIntent(req: CreateIntentRequest): Promise<Result<CreateIntentResult, OrderError>>;
  refund(stripePaymentIntentId: string): Promise<Result<void, OrderError>>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
