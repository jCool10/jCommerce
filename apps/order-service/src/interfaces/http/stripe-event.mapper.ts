import type { Currency } from '@jcool/contracts';
import type { StripeWebhookInput } from '../../application/use-cases/payment/handle-stripe-webhook.use-case.js';
import type { StripeEventEnvelope } from '../../infrastructure/stripe/stripe-signature-verifier.port.js';

/**
 * Narrow projection of the PaymentIntent fields the mapper reads.
 * Avoids importing `Stripe.PaymentIntent` so the interfaces layer keeps
 * a minimal vendor surface.
 */
interface PaymentIntentPayload {
  id: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string> | null;
  last_payment_error?: { message?: string | null; code?: string | null } | null;
}

/**
 * Pure projection from `StripeEventEnvelope` → use-case input. Lives in
 * interfaces/ because it depends on the (vendor-flavored) envelope shape.
 *
 * Two failure modes are folded into 'unhandled' so the controller can
 * still return 200 (Stripe MUST NOT retry on bad metadata — that wastes
 * our webhook quota forever):
 *   - missing/invalid metadata.orderId
 *   - unknown currency
 */
export function mapStripeEventToInput(
  event: StripeEventEnvelope,
): StripeWebhookInput {
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as PaymentIntentPayload;
    const orderId = pi.metadata?.orderId;
    const currency = normalizeCurrency(pi.currency);
    if (!orderId || !currency) {
      return {
        kind: 'unhandled',
        stripeEventId: event.id,
        eventType: `${event.type}/bad-metadata`,
        payload: pi,
      };
    }
    return {
      kind: 'payment_intent.succeeded',
      stripeEventId: event.id,
      stripePaymentIntentId: pi.id,
      orderId,
      amount: pi.amount,
      currency,
      eventCreatedAt: new Date(event.created * 1000),
    };
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as PaymentIntentPayload;
    const orderId = pi.metadata?.orderId;
    if (!orderId) {
      return {
        kind: 'unhandled',
        stripeEventId: event.id,
        eventType: `${event.type}/bad-metadata`,
        payload: pi,
      };
    }
    const reason =
      pi.last_payment_error?.message ??
      pi.last_payment_error?.code ??
      'payment_failed';
    return {
      kind: 'payment_intent.payment_failed',
      stripeEventId: event.id,
      stripePaymentIntentId: pi.id,
      orderId,
      reason,
      eventCreatedAt: new Date(event.created * 1000),
    };
  }

  return {
    kind: 'unhandled',
    stripeEventId: event.id,
    eventType: event.type,
    payload: event.data.object,
  };
}

function normalizeCurrency(raw: string | undefined): Currency | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper === 'USD' || upper === 'VND') return upper;
  return null;
}
