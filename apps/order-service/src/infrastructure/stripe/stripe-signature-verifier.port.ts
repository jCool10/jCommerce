/**
 * Narrow envelope projection of `Stripe.Event` — only the fields the
 * mapper reads. Avoids pulling Stripe's namespace into the rest of the
 * codebase (application/domain layers stay vendor-free).
 *
 * `data.object` stays `unknown`; the mapper narrows per `type`.
 */
export interface StripeEventEnvelope {
  id: string;
  type: string;
  created: number;
  data: { object: unknown };
}

export interface StripeSignatureVerifier {
  constructEvent(rawBody: Buffer, signature: string): StripeEventEnvelope;
}

export const STRIPE_SIGNATURE_VERIFIER = Symbol('STRIPE_SIGNATURE_VERIFIER');
