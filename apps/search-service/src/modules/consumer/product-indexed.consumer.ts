import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConsumeMessage } from 'amqplib';
import {
  ProductIndexedV1Schema,
  parseEvent,
  EventParseError,
  type ProductIndexedV1,
} from '@jcool/contracts';
import { RabbitMqConnectionService } from './rabbitmq-connection.service.js';
import { IndexAliasManagerService } from '../elasticsearch/index-alias-manager.service.js';
import { ProductDocumentIndexerService } from './product-document-indexer.service.js';

const QUEUE_NAME = 'product-indexed';

/**
 * Subscribes to `product.indexed` events emitted by catalog's outbox poller.
 * Ack only after a successful ES write; processing failures nack-without-requeue
 * so the broker routes the message to `events.dlx` → `product.indexed.dlq`.
 *
 * Schema/parse errors are also nack-without-requeue (poison → DLQ, not silent
 * data loss). The broker won't redeliver because requeue=false; the operator
 * inspects `product.indexed.dlq` and the matching error log.
 */
@Injectable()
export class ProductIndexedConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ProductIndexedConsumer.name);
  private consumerTag: string | null = null;
  private stopping = false;

  constructor(
    private readonly rabbit: RabbitMqConnectionService,
    private readonly aliasManager: IndexAliasManagerService,
    private readonly indexer: ProductDocumentIndexerService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('SEARCH_DISABLE_CONSUMER') === 'true') {
      this.logger.warn('SEARCH_DISABLE_CONSUMER=true — skipping RabbitMQ subscription');
      return;
    }
    try {
      await this.aliasManager.ensureAlias();
    } catch (error) {
      this.logger.warn(
        `Could not pre-create alias (${(error as Error).message}) — will retry on first event`,
      );
    }
    try {
      await this.start();
    } catch (error) {
      this.logger.warn(
        `Consumer failed to start (${(error as Error).message}); messages will not be processed until RabbitMQ is reachable`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.consumerTag) {
      try {
        const channel = await this.rabbit.ensureChannel();
        await channel.cancel(this.consumerTag);
      } catch (error) {
        this.logger.error(`Error cancelling consumer: ${(error as Error).message}`);
      }
    }
  }

  private async start(): Promise<void> {
    const channel = await this.rabbit.ensureChannel();
    await channel.prefetch(10);
    const { consumerTag } = await channel.consume(
      QUEUE_NAME,
      (msg) => {
        if (!msg) return;
        void this.handle(msg);
      },
      { noAck: false },
    );
    this.consumerTag = consumerTag;
    this.logger.log(`Subscribed to ${QUEUE_NAME} (tag=${consumerTag})`);
  }

  private async handle(msg: ConsumeMessage): Promise<void> {
    if (this.stopping) return;
    const channel = await this.rabbit.ensureChannel();
    let event: ProductIndexedV1;
    try {
      const json: unknown = JSON.parse(msg.content.toString('utf8'));
      event = parseEvent(ProductIndexedV1Schema, json);
    } catch (error) {
      if (error instanceof EventParseError) {
        this.logger.error(`Poison message — schema failed: ${error.message}`);
      } else {
        this.logger.error(`Poison message — invalid JSON: ${(error as Error).message}`);
      }
      // nack without requeue → broker routes to events.dlx → product.indexed.dlq
      // so operators can inspect the payload, instead of silently dropping it.
      channel.nack(msg, false, false);
      return;
    }

    try {
      if (event.action === 'UPSERT') {
        await this.indexer.upsertByProductId(event.productId, event.indexedAt);
      } else {
        await this.indexer.deleteByProductId(event.productId);
      }
      channel.ack(msg);
    } catch (error) {
      this.logger.error(
        `Failed to index ${event.productId} (action=${event.action}): ${(error as Error).message}`,
      );
      channel.nack(msg, false, false);
    }
  }
}
