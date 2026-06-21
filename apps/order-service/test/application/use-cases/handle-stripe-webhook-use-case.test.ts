import { describe, expect, it } from 'vitest';
import {
  PaymentFailedV1Schema,
  PaymentSucceededV1Schema,
  ROUTING_KEYS,
} from '@jcool/contracts';
import { isOk } from '../../../src/domain/common/result.js';
import { HandleStripeWebhookUseCase } from '../../../src/application/use-cases/payment/handle-stripe-webhook.use-case.js';
import { InMemoryWebhookEventRepository } from '../../fakes/in-memory-webhook-event.repository.js';
import { FakeDirectEventPublisher } from '../../fakes/fake-direct-event-publisher.js';

const ORDER = '11111111-1111-1111-1111-111111111111';
const PI = 'pi_test_123';
const EVT = 'evt_test_abc';
const OCCURRED = new Date('2026-06-18T00:00:00.000Z');

const makeSut = () => {
  const webhookEvents = new InMemoryWebhookEventRepository();
  const publisher = new FakeDirectEventPublisher();
  const sut = new HandleStripeWebhookUseCase(webhookEvents, publisher);
  return { sut, webhookEvents, publisher };
};

describe('HandleStripeWebhookUseCase — succeeded events', () => {
  it('records event, publishes payment.succeeded with V1 contract payload', async () => {
    const { sut, webhookEvents, publisher } = makeSut();
    const r = await sut.execute({
      kind: 'payment_intent.succeeded',
      stripeEventId: EVT,
      stripePaymentIntentId: PI,
      orderId: ORDER,
      amount: 1500,
      currency: 'USD',
      eventCreatedAt: OCCURRED,
    });

    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value.idempotent).toBe(false);

    expect(webhookEvents.seen.has(EVT)).toBe(true);
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]!.routingKey).toBe(ROUTING_KEYS.PAYMENT_SUCCEEDED);

    // Payload must validate against shared V1 schema (no drift).
    const parsed = PaymentSucceededV1Schema.safeParse(publisher.published[0]!.payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.orderId).toBe(ORDER);
      expect(parsed.data.stripePaymentIntentId).toBe(PI);
      expect(parsed.data.amount).toEqual({ currency: 'USD', amount: 1500 });
      expect(parsed.data.succeededAt).toBe(OCCURRED.toISOString());
    }
  });
});

describe('HandleStripeWebhookUseCase — failed events', () => {
  it('records event, publishes payment.failed with V1 contract payload', async () => {
    const { sut, publisher } = makeSut();
    const r = await sut.execute({
      kind: 'payment_intent.payment_failed',
      stripeEventId: EVT,
      stripePaymentIntentId: PI,
      orderId: ORDER,
      reason: 'card_declined',
      eventCreatedAt: OCCURRED,
    });

    expect(isOk(r)).toBe(true);
    expect(publisher.published[0]!.routingKey).toBe(ROUTING_KEYS.PAYMENT_FAILED);
    const parsed = PaymentFailedV1Schema.safeParse(publisher.published[0]!.payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.orderId).toBe(ORDER);
      expect(parsed.data.reason).toBe('card_declined');
      expect(parsed.data.stripePaymentIntentId).toBe(PI);
      expect(parsed.data.failedAt).toBe(OCCURRED.toISOString());
    }
  });
});

describe('HandleStripeWebhookUseCase — idempotency', () => {
  it('second delivery with same stripeEventId → no publish, idempotent=true', async () => {
    const { sut, webhookEvents, publisher } = makeSut();
    const event = {
      kind: 'payment_intent.succeeded' as const,
      stripeEventId: EVT,
      stripePaymentIntentId: PI,
      orderId: ORDER,
      amount: 1500,
      currency: 'USD' as const,
      eventCreatedAt: OCCURRED,
    };

    const first = await sut.execute(event);
    const second = await sut.execute(event);

    expect(isOk(first)).toBe(true);
    if (isOk(first)) expect(first.value.idempotent).toBe(false);
    expect(isOk(second)).toBe(true);
    if (isOk(second)) expect(second.value.idempotent).toBe(true);

    expect(webhookEvents.records).toHaveLength(1);
    expect(publisher.published).toHaveLength(1);
  });
});

describe('HandleStripeWebhookUseCase — unhandled event types', () => {
  it('records event but does not publish for unrelated Stripe types', async () => {
    const { sut, webhookEvents, publisher } = makeSut();
    const r = await sut.execute({
      kind: 'unhandled',
      stripeEventId: EVT,
      eventType: 'invoice.created',
      payload: { irrelevant: true },
    });

    expect(isOk(r)).toBe(true);
    expect(webhookEvents.records).toHaveLength(1);
    expect(webhookEvents.records[0]!.type).toBe('invoice.created');
    expect(publisher.published).toHaveLength(0);
  });
});
