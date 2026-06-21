import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { OrderConfirmedV1Schema } from '@jcool/contracts';
import {
  newCorrelationId,
  recordConsumed,
  runWithCorrelation,
} from '@jcool/observability';
import {
  EMAIL_JOB_ENQUEUER,
  type EmailJobEnqueuer,
} from '../queue/email-job-enqueuer.port.js';
import {
  USER_EMAIL_RESOLVER,
  type UserEmailResolver,
} from './user-email-resolver.port.js';
import { RabbitMqConnection } from './rabbitmq-connection.service.js';

const ORDER_CONFIRMED_QUEUE = 'order-confirmed';

export type HandleResult = 'ack' | 'nack-poison' | 'nack-requeue';

/**
 * Subscribes to the RabbitMQ `order-confirmed` queue and forwards each
 * event to the BullMQ email queue. BullMQ owns retry/backoff/DLQ — this
 * consumer's only job is parse + handoff + ack/nack.
 *
 * Decision matrix:
 *   - parse fail (poison)  → nack(false, false) → DLX
 *   - enqueue fail (Redis) → nack(false, true)  → RabbitMQ redelivers
 *   - success              → ack
 */
@Injectable()
export class OrderConfirmedConsumer implements OnModuleInit {
  private readonly logger = new Logger(OrderConfirmedConsumer.name);

  constructor(
    @Inject(EMAIL_JOB_ENQUEUER) private readonly enqueuer: EmailJobEnqueuer,
    @Inject(USER_EMAIL_RESOLVER) private readonly users: UserEmailResolver,
    private readonly connection?: RabbitMqConnection,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.EMAIL_DISABLE_CONSUMER === '1') {
      this.logger.warn('EMAIL_DISABLE_CONSUMER=1 → order-confirmed consumer not started');
      return;
    }
    if (!this.connection) return; // unit-test path
    try {
      await this.start();
    } catch (error) {
      this.logger.warn(
        `consumer boot failed (${(error as Error).message}); will retry on next ensure()`,
      );
    }
  }

  private async start(): Promise<void> {
    if (!this.connection) return;
    const channel = await this.connection.ensure();
    await channel.assertQueue(ORDER_CONFIRMED_QUEUE, { durable: true });
    await channel.consume(ORDER_CONFIRMED_QUEUE, async (msg) => {
      if (!msg) return;
      const correlationId =
        correlationFromHeaders(msg.properties.headers) ?? newCorrelationId();
      await runWithCorrelation({ correlationId }, async () => {
        const result = await this.handleMessage(msg.content);
        if (result === 'ack') {
          channel.ack(msg);
          recordConsumed(ORDER_CONFIRMED_QUEUE, 'ack');
        } else if (result === 'nack-poison') {
          channel.nack(msg, false, false);
          recordConsumed(ORDER_CONFIRMED_QUEUE, 'dropped');
        } else {
          channel.nack(msg, false, true);
          recordConsumed(ORDER_CONFIRMED_QUEUE, 'requeued');
        }
      });
    });
    this.logger.log(`subscribed: ${ORDER_CONFIRMED_QUEUE}`);
  }

  async handleMessage(content: Buffer): Promise<HandleResult> {
    let raw: unknown;
    try {
      raw = JSON.parse(content.toString('utf8'));
    } catch (error) {
      this.logger.warn(`drop poison: invalid JSON (${(error as Error).message})`);
      return 'nack-poison';
    }
    const parsed = OrderConfirmedV1Schema.safeParse(raw);
    if (!parsed.success) {
      this.logger.warn(`drop poison: schema mismatch (${parsed.error.message})`);
      return 'nack-poison';
    }
    const event = parsed.data;
    try {
      const userEmail = await this.users.resolveUserEmail(event.userId);
      await this.enqueuer.enqueueOrderConfirmation({
        orderId: event.orderId,
        userId: event.userId,
        userEmail,
        total: event.total,
        confirmedAt: event.confirmedAt,
        stripePaymentIntentId: event.stripePaymentIntentId,
      });
      return 'ack';
    } catch (error) {
      this.logger.error(
        `enqueue failed for order=${event.orderId}: ${(error as Error).message}`,
      );
      return 'nack-requeue';
    }
  }
}

function correlationFromHeaders(headers: unknown): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const map = headers as Record<string, unknown>;
  const raw = map['x-request-id'];
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  return undefined;
}
