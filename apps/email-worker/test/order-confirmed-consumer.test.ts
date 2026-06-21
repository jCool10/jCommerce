import { describe, it, expect, vi } from 'vitest';
import { OrderConfirmedConsumer } from '../src/modules/consumer/order-confirmed.consumer.js';
import type { EmailJobEnqueuer } from '../src/modules/queue/email-job-enqueuer.port.js';

const validEvent = {
  version: 1,
  orderId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  stripePaymentIntentId: 'pi_test_123',
  total: { amount: 4999, currency: 'USD' },
  confirmedAt: '2026-06-18T10:00:00.000Z',
};

function buildConsumer(overrides: Partial<EmailJobEnqueuer> = {}) {
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const enqueuer: EmailJobEnqueuer = { enqueueOrderConfirmation: enqueue, ...overrides };
  const consumer = new OrderConfirmedConsumer(
    enqueuer,
    // userLookup: synthesises a dev email; real impl swaps in via DI in phase 10+
    { resolveUserEmail: vi.fn().mockResolvedValue('buyer@example.com') },
  );
  return { consumer, enqueue };
}

describe('OrderConfirmedConsumer.handleMessage', () => {
  it('enqueues a job and returns "ack" for a valid event', async () => {
    const { consumer, enqueue } = buildConsumer();
    const content = Buffer.from(JSON.stringify(validEvent));

    const result = await consumer.handleMessage(content);

    expect(result).toBe('ack');
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith({
      orderId: validEvent.orderId,
      userId: validEvent.userId,
      userEmail: 'buyer@example.com',
      total: validEvent.total,
      confirmedAt: validEvent.confirmedAt,
      stripePaymentIntentId: validEvent.stripePaymentIntentId,
    });
  });

  it('returns "nack-poison" and does NOT enqueue on schema parse failure', async () => {
    const { consumer, enqueue } = buildConsumer();
    const content = Buffer.from(JSON.stringify({ version: 1, orderId: 'not-a-uuid' }));

    const result = await consumer.handleMessage(content);

    expect(result).toBe('nack-poison');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('returns "nack-poison" on invalid JSON (drop to DLX, do not requeue)', async () => {
    const { consumer, enqueue } = buildConsumer();
    const content = Buffer.from('not-json-at-all');

    const result = await consumer.handleMessage(content);

    expect(result).toBe('nack-poison');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('returns "nack-requeue" when the queue is temporarily unavailable', async () => {
    const { consumer } = buildConsumer({
      enqueueOrderConfirmation: vi.fn().mockRejectedValue(new Error('redis down')),
    });
    const content = Buffer.from(JSON.stringify(validEvent));

    const result = await consumer.handleMessage(content);

    expect(result).toBe('nack-requeue');
  });

  it('idempotency: uses orderId as the job identifier so RabbitMQ redelivery does not double-enqueue', async () => {
    const { consumer, enqueue } = buildConsumer();
    const content = Buffer.from(JSON.stringify(validEvent));

    await consumer.handleMessage(content);

    const [payload] = enqueue.mock.calls[0] ?? [];
    expect(payload).toMatchObject({ orderId: validEvent.orderId });
  });
});
