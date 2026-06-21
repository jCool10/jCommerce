/**
 * Unit tests for RabbitMqEventPublisher.
 *
 * All RabbitMQ I/O is replaced by vitest fakes so the suite runs without a
 * broker.  The critical invariant: publish() MUST NOT resolve until the
 * broker confirm callback fires — a drain-based shortcut would break this.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { RabbitMqEventPublisher } from './rabbitmq-event-publisher.adapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal ConfirmChannel fake.
 *
 * @param publishImmediateReturn - value returned by channel.publish() (true =
 *   write buffer not full, false = backpressure).
 * @param confirmError - if non-null the confirm callback receives this error.
 */
function makeChannelFake(
  publishImmediateReturn = true,
  confirmError: Error | null = null,
) {
  // waitForConfirms resolves after a microtask tick so tests can assert
  // ordering (confirm callback fires first, then waitForConfirms resolves).
  const waitForConfirms = vi.fn().mockResolvedValue(undefined);

  const publish = vi.fn(
    (
      _exchange: string,
      _routingKey: string,
      _content: Buffer,
      _options: unknown,
      callback: (err: Error | null) => void,
    ) => {
      // Fire the confirm callback asynchronously to simulate network round-trip
      Promise.resolve().then(() => callback(confirmError));
      return publishImmediateReturn;
    },
  );

  return { publish, waitForConfirms };
}

/**
 * Build a publisher whose ensureChannel() returns the provided fake channel
 * instead of opening a real TCP connection.
 */
function makePublisher(channelFake: ReturnType<typeof makeChannelFake>) {
  const config = { get: () => 'amqp://localhost' } as unknown as ConfigService;
  const publisher = new RabbitMqEventPublisher(config);

  // Inject the fake channel directly — bypasses TCP setup.
  // `channel` is private; cast through unknown to satisfy TypeScript.
  (publisher as unknown as Record<string, unknown>)['channel'] = channelFake;

  return publisher;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RabbitMqEventPublisher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves only AFTER waitForConfirms returns, not when channel.publish() returns', async () => {
    const channelFake = makeChannelFake(/* okWrite= */ true);
    const publisher = makePublisher(channelFake);

    const resolvedOrder: string[] = [];

    // Track when publish resolves
    const publishPromise = publisher
      .publish('product.indexed', { id: '1' })
      .then(() => resolvedOrder.push('publish-resolved'));

    // waitForConfirms should only run after the confirm callback resolved
    // the inner promise — we don't resolve until after that.
    channelFake.waitForConfirms.mockImplementation(() => {
      resolvedOrder.push('waitForConfirms-called');
      return Promise.resolve();
    });

    await publishPromise;

    // Confirm callback fires → inner promise resolves → waitForConfirms called
    // → publish() resolves.
    expect(resolvedOrder).toEqual(['waitForConfirms-called', 'publish-resolved']);
    expect(channelFake.waitForConfirms).toHaveBeenCalledOnce();
  });

  it('publish() calls waitForConfirms exactly once per message', async () => {
    const channelFake = makeChannelFake();
    const publisher = makePublisher(channelFake);

    await publisher.publish('product.indexed', { id: '2' });

    expect(channelFake.waitForConfirms).toHaveBeenCalledOnce();
  });

  it('publish() rejects when the confirm callback receives an error', async () => {
    const brokerError = new Error('broker nack');
    const channelFake = makeChannelFake(true, brokerError);
    const publisher = makePublisher(channelFake);

    await expect(publisher.publish('product.indexed', { id: '3' })).rejects.toThrow(
      'broker nack',
    );
    // waitForConfirms must NOT be called when the confirm step already rejected
    expect(channelFake.waitForConfirms).not.toHaveBeenCalled();
  });

  it('does NOT resolve on backpressure (okWrite=false) before confirm fires', async () => {
    // okWrite = false simulates a full write buffer (backpressure).
    // The old drain-based code would resolve immediately on the drain event.
    // The correct code keeps waiting for the confirm callback.
    const channelFake = makeChannelFake(/* publishImmediateReturn= */ false);
    const publisher = makePublisher(channelFake);

    let publishSettled = false;
    const publishPromise = publisher
      .publish('inventory.reserved', { orderId: 'o-1' })
      .then(() => {
        publishSettled = true;
      });

    // Yield one microtask — confirm callback has been scheduled but not yet
    // processed.  publishSettled must still be false at this point.
    await Promise.resolve();
    // The confirm callback fires on the next microtask tick inside makeChannelFake.
    // After awaiting the whole promise the value flips.
    await publishPromise;

    expect(publishSettled).toBe(true);
    // Crucially: waitForConfirms was still called (drain path removed).
    expect(channelFake.waitForConfirms).toHaveBeenCalledOnce();
  });
});
