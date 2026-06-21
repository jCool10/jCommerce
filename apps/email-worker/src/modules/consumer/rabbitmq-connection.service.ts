import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { type ChannelModel, type Channel } from 'amqplib';

/**
 * Shared inbound channel for the order-confirmed consumer. Mirrors the
 * pattern from apps/order-service so behavior (lazy connect, prefetch,
 * graceful close) stays consistent across services.
 */
@Injectable()
export class RabbitMqConnection implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConnection.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensure();
    } catch (error) {
      this.logger.warn(
        `RabbitMQ unavailable at boot (${(error as Error).message}); consumer will retry lazily`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      this.logger.error(`error closing RabbitMQ: ${(error as Error).message}`);
    }
  }

  async ensure(): Promise<Channel> {
    if (this.channel) return this.channel;
    const url =
      this.config.get<string>('RABBITMQ_URL') ?? 'amqp://guest:guest@localhost:5672';
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.prefetch(8);
    this.connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed');
      this.connection = null;
      this.channel = null;
    });
    this.connection.on('error', (e) =>
      this.logger.error(`RabbitMQ error: ${e.message}`),
    );
    return this.channel;
  }
}
