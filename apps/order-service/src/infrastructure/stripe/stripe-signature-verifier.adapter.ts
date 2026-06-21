import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import type {
  StripeEventEnvelope,
  StripeSignatureVerifier,
} from './stripe-signature-verifier.port.js';

type StripeInstance = InstanceType<typeof Stripe>;

/**
 * Production verifier — delegates to the Stripe SDK. The SDK throws on
 * bad signature; the controller catches and translates to 400.
 *
 * Returns the SDK event as our narrow envelope shape (same field
 * positions — just a type re-statement to keep vendor types out of the
 * application layer).
 */
@Injectable()
export class StripeSdkSignatureVerifier implements StripeSignatureVerifier {
  constructor(
    private readonly stripe: StripeInstance,
    private readonly webhookSecret: string,
  ) {}

  constructEvent(rawBody: Buffer, signature: string): StripeEventEnvelope {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    ) as StripeEventEnvelope;
  }
}
