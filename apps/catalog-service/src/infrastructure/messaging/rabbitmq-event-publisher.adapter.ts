import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import { EVENTS_EXCHANGE } from '@jcool/contracts';
import { buildPropagationHeaders, recordPublished } from '@jcool/observability';

/**
 * Publisher used by the outbox poller — NOT by use cases directly.
 * Use cases write to the outbox table (see PrismaProductRepository.save).
 * This adapter is the second hop: outbox row → topic exchange.
 */
@Injectable()
export class RabbitMqEventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqEventPublisher.name);
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private connecting: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureChannel();
    } catch (error) {
      this.logger.warn(
        `RabbitMQ unavailable at boot — will reconnect lazily (${(error as Error).message})`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      this.logger.error(`Error closing RabbitMQ: ${(error as Error).message}`);
    }
  }

  async publish(routingKey: string, payload: unknown): Promise<void> {
    const channel = await this.ensureChannel();
    const body = Buffer.from(JSON.stringify(payload));
    // Carry traceparent + x-request-id into the message so the consumer
    // can stitch its span tree onto the producer's trace.
    const propagation = buildPropagationHeaders();
    // Wait for broker-side confirm before resolving so the outbox poller
    // marks rows published ONLY after RabbitMQ acknowledged durability.
    // `drain` is backpressure signalling, NOT a broker confirm — resolving
    // on drain would let the poller stamp publishedAt before the broker
    // has accepted the message, creating a crash-window for message loss.
    await new Promise<void>((resolve, reject) => {
      const okWrite = channel.publish(
        EVENTS_EXCHANGE,
        routingKey,
        body,
        { persistent: true, contentType: 'application/json', headers: propagation },
        (err) => (err ? reject(err) : resolve()),
      );
      if (!okWrite) {
        this.logger.debug(`backpressure on ${routingKey}; awaiting confirm`);
      }
    });
    await channel.waitForConfirms();
    recordPublished(routingKey, EVENTS_EXCHANGE);
  }

  private async ensureChannel(): Promise<ConfirmChannel> {
    if (this.channel) return this.channel;
    if (this.connecting) {
      await this.connecting;
      if (this.channel) return this.channel;
    }

    this.connecting = (async () => {
      const url = this.config.get<string>('RABBITMQ_URL') ?? 'amqp://guest:guest@localhost:5672';
      const conn = await amqp.connect(url);
      const ch = await conn.createConfirmChannel();
      await ch.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });

      conn.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        this.connection = null;
        this.channel = null;
      });
      conn.on('error', (err) => this.logger.error(`RabbitMQ error: ${err.message}`));

      this.connection = conn;
      this.channel = ch;
    })();

    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
    if (!this.channel) throw new Error('Failed to establish RabbitMQ channel');
    return this.channel;
  }
}
