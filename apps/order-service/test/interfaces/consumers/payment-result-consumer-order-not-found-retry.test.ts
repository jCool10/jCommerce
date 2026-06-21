/**
 * Tests for the ORDER_NOT_FOUND race-condition retry path in PaymentResultConsumer.
 *
 * Scenario: a `payment.succeeded` message arrives before the saga has committed
 * the order row to the database. MarkPaymentSucceededUseCase returns
 * ORDER_NOT_FOUND. The consumer must nack+requeue (not ack terminally) until
 * x-retry-count reaches MAX_ORDER_NOT_FOUND_RETRIES, after which it routes to
 * the DLX via nack(false, false).
 */
import { describe, it, expect, vi, type MockedFunction } from 'vitest';
import { err, ok } from '../../../src/domain/common/result.js';
import type { OrderError } from '../../../src/domain/order-error.js';

// ---------------------------------------------------------------------------
// Minimal fakes — we test only the consumer's branching logic, not NestJS DI
// ---------------------------------------------------------------------------

/** Fake AMQP channel that records ack/nack calls. */
function makeFakeChannel() {
  const acked: unknown[] = [];
  const nacked: Array<{ msg: unknown; allUpTo: boolean; requeue: boolean }> = [];

  return {
    assertQueue: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn(),
    ack: (msg: unknown) => { acked.push(msg); },
    nack: (msg: unknown, allUpTo: boolean, requeue: boolean) => {
      nacked.push({ msg, allUpTo, requeue });
    },
    acked,
    nacked,
  };
}

/** Build a minimal AMQP Message-like object with optional headers. */
function makeMsg(
  body: unknown,
  headers: Record<string, unknown> = {},
) {
  return {
    content: Buffer.from(JSON.stringify(body)),
    properties: { headers },
  };
}

const VALID_SUCCEEDED_BODY = {
  version: 1,
  orderId: '11111111-1111-1111-1111-111111111111',
  stripePaymentIntentId: 'pi_test_abc',
  amount: { amount: 1500, currency: 'USD' },
  succeededAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Import the unit under test AFTER fakes are defined so vi.mock is hoisted.
// We test the private branching logic by wiring a mock MarkPaymentSucceededUseCase.
// ---------------------------------------------------------------------------
import { PaymentResultConsumer } from '../../../src/interfaces/consumers/payment-result.consumer.js';
import { MarkPaymentSucceededUseCase } from '../../../src/application/use-cases/saga/mark-payment-succeeded.use-case.js';
import { MarkPaymentFailedUseCase } from '../../../src/application/use-cases/saga/mark-payment-failed.use-case.js';
import { RabbitMqConnection } from '../../../src/interfaces/consumers/rabbitmq-connection.service.js';

/**
 * Builds a PaymentResultConsumer wired to a scripted MarkPaymentSucceededUseCase.
 * Returns the consumer, the fake channel, and a handle to override execute().
 */
function makeConsumerWithFakeChannel(
  succeededExecute: MockedFunction<MarkPaymentSucceededUseCase['execute']>,
) {
  const channel = makeFakeChannel();
  // RabbitMqConnection.ensure() returns the channel
  const connection = {
    ensure: vi.fn().mockResolvedValue(channel),
  } as unknown as RabbitMqConnection;

  const succeeded = {
    execute: succeededExecute,
  } as unknown as MarkPaymentSucceededUseCase;

  const failed = {
    execute: vi.fn().mockResolvedValue(ok({})),
  } as unknown as MarkPaymentFailedUseCase;

  const consumer = new PaymentResultConsumer(connection, succeeded, failed);

  return { consumer, channel };
}

// ---------------------------------------------------------------------------
// Helpers to drive the consumer's internal SUCCEEDED_QUEUE handler directly.
// `channel.consume` is called with (queue, handler); we capture and invoke it.
// ---------------------------------------------------------------------------

async function invokeSucceededHandler(
  channel: ReturnType<typeof makeFakeChannel>,
  msg: ReturnType<typeof makeMsg>,
): Promise<void> {
  // consume is called twice: once for succeeded, once for failed.
  // The first call is for the succeeded queue.
  const calls = (channel.consume as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
  const handler = calls[0]?.[1] as (msg: unknown) => Promise<void>;
  await handler(msg);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentResultConsumer — ORDER_NOT_FOUND retry path (C3)', () => {
  it('nacks with requeue on first ORDER_NOT_FOUND (retry=0)', async () => {
    const execute = vi.fn().mockResolvedValue(
      err({ kind: 'ORDER_NOT_FOUND', orderId: VALID_SUCCEEDED_BODY.orderId } satisfies OrderError),
    );
    const { consumer, channel } = makeConsumerWithFakeChannel(execute);
    await consumer.onModuleInit();

    const msg = makeMsg(VALID_SUCCEEDED_BODY, {}); // no x-retry-count header
    await invokeSucceededHandler(channel, msg);

    expect(channel.acked).toHaveLength(0);
    expect(channel.nacked).toHaveLength(1);
    expect(channel.nacked[0]).toEqual({ msg, allUpTo: false, requeue: true });
  });

  it('nacks with requeue when x-retry-count=4 (one below limit)', async () => {
    const execute = vi.fn().mockResolvedValue(
      err({ kind: 'ORDER_NOT_FOUND', orderId: VALID_SUCCEEDED_BODY.orderId } satisfies OrderError),
    );
    const { consumer, channel } = makeConsumerWithFakeChannel(execute);
    await consumer.onModuleInit();

    const msg = makeMsg(VALID_SUCCEEDED_BODY, { 'x-retry-count': 4 });
    await invokeSucceededHandler(channel, msg);

    expect(channel.acked).toHaveLength(0);
    expect(channel.nacked).toHaveLength(1);
    expect(channel.nacked[0]).toMatchObject({ requeue: true });
  });

  it('routes to DLQ (nack requeue=false) when x-retry-count=5 (at limit)', async () => {
    const execute = vi.fn().mockResolvedValue(
      err({ kind: 'ORDER_NOT_FOUND', orderId: VALID_SUCCEEDED_BODY.orderId } satisfies OrderError),
    );
    const { consumer, channel } = makeConsumerWithFakeChannel(execute);
    await consumer.onModuleInit();

    const msg = makeMsg(VALID_SUCCEEDED_BODY, { 'x-retry-count': 5 });
    await invokeSucceededHandler(channel, msg);

    expect(channel.acked).toHaveLength(0);
    expect(channel.nacked).toHaveLength(1);
    // requeue=false → message goes to DLX, not re-queued
    expect(channel.nacked[0]).toMatchObject({ requeue: false });
  });

  it('acks on success (happy path unchanged)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fake Order shape sufficient for test
    const execute = vi.fn().mockResolvedValue(ok({} as any));
    const { consumer, channel } = makeConsumerWithFakeChannel(execute);
    await consumer.onModuleInit();

    const msg = makeMsg(VALID_SUCCEEDED_BODY);
    await invokeSucceededHandler(channel, msg);

    expect(channel.acked).toHaveLength(1);
    expect(channel.nacked).toHaveLength(0);
  });

  it('terminal errors other than ORDER_NOT_FOUND still ack (no infinite loop)', async () => {
    const execute = vi.fn().mockResolvedValue(
      err({
        kind: 'PAYMENT_INTENT_MISMATCH',
        expected: 'pi_expected',
        got: 'pi_got',
      } satisfies OrderError),
    );
    const { consumer, channel } = makeConsumerWithFakeChannel(execute);
    await consumer.onModuleInit();

    const msg = makeMsg(VALID_SUCCEEDED_BODY);
    await invokeSucceededHandler(channel, msg);

    expect(channel.acked).toHaveLength(1);
    expect(channel.nacked).toHaveLength(0);
  });

  it('poison / unparseable message nacks to DLX (no requeue)', async () => {
    const execute = vi.fn();
    const { consumer, channel } = makeConsumerWithFakeChannel(execute);
    await consumer.onModuleInit();

    // Body missing required fields → zod parse fails
    const msg = makeMsg({ bad: 'payload' });
    await invokeSucceededHandler(channel, msg);

    expect(execute).not.toHaveBeenCalled();
    expect(channel.acked).toHaveLength(0);
    expect(channel.nacked).toHaveLength(1);
    expect(channel.nacked[0]).toMatchObject({ requeue: false });
  });
});
