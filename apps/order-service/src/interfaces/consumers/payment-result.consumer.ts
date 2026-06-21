import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  PaymentFailedV1Schema,
  PaymentSucceededV1Schema,
} from '@jcool/contracts';
import {
  recordConsumed,
  runWithCorrelation,
  newCorrelationId,
} from '@jcool/observability';
import { isErr } from '../../domain/common/result.js';
import { MarkPaymentSucceededUseCase } from '../../application/use-cases/saga/mark-payment-succeeded.use-case.js';
import { MarkPaymentFailedUseCase } from '../../application/use-cases/saga/mark-payment-failed.use-case.js';
import { RabbitMqConnection } from './rabbitmq-connection.service.js';

const SUCCEEDED_QUEUE = 'payment-succeeded';
const FAILED_QUEUE = 'payment-failed';

/**
 * Maximum number of retries for ORDER_NOT_FOUND before routing to DLX.
 * The race window is: webhook arrives before the saga's PENDING→PAYMENT_PENDING
 * commit. 5 retries with RabbitMQ's default re-delivery back-off covers
 * several seconds; after that the operator finds the message in the DLQ.
 */
const MAX_ORDER_NOT_FOUND_RETRIES = 5;

/**
 * RabbitMQ consumer subscribed to `payment.succeeded` and `payment.failed`
 * queues. On message:
 *   - Parse with the corresponding zod schema
 *   - On parse failure → nack(false, false) → DLX (no requeue, queue is
 *     configured with x-dead-letter-exchange in infra/rabbitmq/definitions.json)
 *   - On use-case error that is RETRYABLE (catalog unavailable) → nack with
 *     requeue
 *   - On terminal use-case error or success → ack
 *
 * Runs as a single consumer instance (order-service is pinned to one instance)
 * so messages for the same order don't race.
 */
@Injectable()
export class PaymentResultConsumer implements OnModuleInit {
  private readonly logger = new Logger(PaymentResultConsumer.name);

  constructor(
    private readonly connection: RabbitMqConnection,
    private readonly succeeded: MarkPaymentSucceededUseCase,
    private readonly failed: MarkPaymentFailedUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.ORDER_DISABLE_CONSUMER === '1') {
      this.logger.warn('ORDER_DISABLE_CONSUMER=1 → payment consumers not started');
      return;
    }
    try {
      await this.start();
    } catch (error) {
      this.logger.warn(
        `payment consumers boot failed (${(error as Error).message}); will retry on first message`,
      );
    }
  }

  private async start(): Promise<void> {
    const channel = await this.connection.ensure();
    await channel.assertQueue(SUCCEEDED_QUEUE, { durable: true });
    await channel.assertQueue(FAILED_QUEUE, { durable: true });

    await channel.consume(SUCCEEDED_QUEUE, async (msg) => {
      if (!msg) return;
      const correlationId = correlationFromHeaders(msg.properties.headers) ?? newCorrelationId();
      await runWithCorrelation({ correlationId }, async () => {
        try {
          const json = JSON.parse(msg.content.toString('utf8'));
          const parsed = PaymentSucceededV1Schema.safeParse(json);
          if (!parsed.success) {
            this.logger.warn(`drop poison succeeded message: ${parsed.error.message}`);
            channel.nack(msg, false, false);
            recordConsumed(SUCCEEDED_QUEUE, 'dropped');
            return;
          }
          const result = await this.succeeded.execute({
            orderId: parsed.data.orderId,
            stripePaymentIntentId: parsed.data.stripePaymentIntentId,
          });
          if (isErr(result)) {
            this.logger.warn(
              `payment.succeeded handler failed order=${parsed.data.orderId}: ${result.error.kind}`,
            );
            if (result.error.kind === 'CATALOG_UNAVAILABLE') {
              channel.nack(msg, false, true);
              recordConsumed(SUCCEEDED_QUEUE, 'requeued');
              return;
            }
            if (result.error.kind === 'ORDER_NOT_FOUND') {
              // Race: webhook arrived before saga committed the order row.
              // x-retry-count tracks how many times we have re-queued so we
              // don't loop forever; after MAX retries the DLX catches it.
              const retryCount = retryCountFromHeaders(msg.properties.headers);
              if (retryCount < MAX_ORDER_NOT_FOUND_RETRIES) {
                this.logger.warn(
                  `ORDER_NOT_FOUND for order=${parsed.data.orderId} retry=${retryCount + 1}/${MAX_ORDER_NOT_FOUND_RETRIES}; requeueing`,
                );
                channel.nack(msg, false, true);
                recordConsumed(SUCCEEDED_QUEUE, 'requeued');
              } else {
                this.logger.error(
                  `ORDER_NOT_FOUND for order=${parsed.data.orderId} after ${MAX_ORDER_NOT_FOUND_RETRIES} retries; routing to DLQ`,
                );
                channel.nack(msg, false, false);
                recordConsumed(SUCCEEDED_QUEUE, 'nack');
              }
              return;
            }
            // All other terminal errors (PAYMENT_INTENT_MISMATCH, etc.): ack
            // to prevent infinite requeue — these are not transient.
            channel.ack(msg);
            recordConsumed(SUCCEEDED_QUEUE, 'ack');
            return;
          }
          channel.ack(msg);
          recordConsumed(SUCCEEDED_QUEUE, 'ack');
        } catch (error) {
          this.logger.error(`succeeded consumer error: ${(error as Error).message}`);
          channel.nack(msg, false, false);
          recordConsumed(SUCCEEDED_QUEUE, 'nack');
        }
      });
    });

    await channel.consume(FAILED_QUEUE, async (msg) => {
      if (!msg) return;
      const correlationId = correlationFromHeaders(msg.properties.headers) ?? newCorrelationId();
      await runWithCorrelation({ correlationId }, async () => {
        try {
          const json = JSON.parse(msg.content.toString('utf8'));
          const parsed = PaymentFailedV1Schema.safeParse(json);
          if (!parsed.success) {
            this.logger.warn(`drop poison failed message: ${parsed.error.message}`);
            channel.nack(msg, false, false);
            recordConsumed(FAILED_QUEUE, 'dropped');
            return;
          }
          const result = await this.failed.execute({
            orderId: parsed.data.orderId,
            reason: parsed.data.reason,
          });
          if (isErr(result)) {
            const retry = result.error.kind === 'CATALOG_UNAVAILABLE';
            if (retry) {
              channel.nack(msg, false, true);
              recordConsumed(FAILED_QUEUE, 'requeued');
            } else {
              channel.ack(msg);
              recordConsumed(FAILED_QUEUE, 'ack');
            }
            return;
          }
          channel.ack(msg);
          recordConsumed(FAILED_QUEUE, 'ack');
        } catch (error) {
          this.logger.error(`failed consumer error: ${(error as Error).message}`);
          channel.nack(msg, false, false);
          recordConsumed(FAILED_QUEUE, 'nack');
        }
      });
    });

    this.logger.log('payment.succeeded + payment.failed consumers started');
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

/**
 * Reads x-retry-count from AMQP message headers. RabbitMQ does not
 * auto-increment this header — the consumer tracks it manually on each
 * nack+requeue. Returns 0 when the header is absent (first delivery).
 */
function retryCountFromHeaders(headers: unknown): number {
  if (!headers || typeof headers !== 'object') return 0;
  const map = headers as Record<string, unknown>;
  const raw = map['x-retry-count'];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
