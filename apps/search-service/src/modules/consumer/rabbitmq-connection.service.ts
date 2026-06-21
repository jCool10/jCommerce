import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { type Channel, type ChannelModel } from 'amqplib';

/**
 * Lazy-connected AMQP channel — survives broker restarts by reconnecting on next use.
 * Mirrors the catalog-service publisher pattern but creates a regular (non-confirm) channel
 * since search-service only consumes.
 */
@Injectable()
export class RabbitMqConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConnectionService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private connecting: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      this.logger.error(`Error closing RabbitMQ: ${(error as Error).message}`);
    }
  }

  async ensureChannel(): Promise<Channel> {
    if (this.channel) return this.channel;
    if (this.connecting) {
      await this.connecting;
      if (this.channel) return this.channel;
    }
    this.connecting = (async () => {
      const url =
        this.config.get<string>('RABBITMQ_URL') ?? 'amqp://guest:guest@localhost:5672';
      const conn = await amqp.connect(url);
      const ch = await conn.createChannel();
      conn.on('close', () => {
        this.logger.warn('RabbitMQ connection closed — will reconnect on next use');
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
