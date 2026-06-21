/**
 * Narrow façade over the slice of `stripe.paymentIntents` the adapter uses.
 * Lets unit tests pass a vi.fn() without instantiating the full Stripe SDK
 * (which requires an API key + makes test runs flaky if env vars drift).
 *
 * Field names mirror the Stripe REST shape (`client_secret`, snake_case)
 * so the real SDK's return value passes through unchanged.
 */
export interface StripePaymentIntentCreateParams {
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  automatic_payment_methods?: { enabled: boolean };
}

export interface StripePaymentIntentResponse {
  id: string;
  client_secret: string | null;
}

export interface StripeRequestOptions {
  idempotencyKey?: string;
}

export interface StripePaymentIntentRetrieveResponse {
  id: string;
  status: string;
}

export interface StripePaymentIntentsClient {
  create(
    params: StripePaymentIntentCreateParams,
    options?: StripeRequestOptions,
  ): Promise<StripePaymentIntentResponse>;
  retrieve(
    id: string,
  ): Promise<StripePaymentIntentRetrieveResponse>;
}
