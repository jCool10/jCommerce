import { Injectable } from '@nestjs/common';
import type { StripePaymentIntentStatusClient } from '../../application/use-cases/saga/reconcile-orphan-reservations.use-case.js';
import type { StripePaymentIntentsClient } from './stripe-payment-intents.port.js';

/**
 * Adapts the narrow Stripe paymentIntents.retrieve facade to the application
 * port the reservation cleanup cron uses for the I2 "paid-but-not-confirmed"
 * surface check. Kept thin so the application stays SDK-agnostic.
 */
@Injectable()
export class StripePaymentIntentStatusAdapter
  implements StripePaymentIntentStatusClient
{
  constructor(private readonly paymentIntents: StripePaymentIntentsClient) {}

  async retrieve(piid: string): Promise<{ id: string; status: string }> {
    return this.paymentIntents.retrieve(piid);
  }
}

export const STRIPE_PAYMENT_INTENT_STATUS_CLIENT = Symbol(
  'STRIPE_PAYMENT_INTENT_STATUS_CLIENT',
);
