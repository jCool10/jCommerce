import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Single shared Redis connection for catalog-service (Singleton via Nest DI).
 *
 * Parallels PrismaService: one long-lived client opened once and closed on
 * shutdown. Redis is a *cache* here, not a system of record, so a connection
 * failure must never take the service down — the client connects lazily and
 * commands fail fast (offline queue disabled) so callers can fall back to
 * Postgres instead of blocking.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>('CATALOG_REDIS_URL') ?? 'redis://localhost:6379/3';
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.client.on('error', (e) => this.logger.warn(`redis: ${e.message}`));
  }

  async onModuleInit(): Promise<void> {
    // A cold cache must not block startup; background reconnects self-heal it.
    try {
      await this.client.connect();
      this.logger.log('redis cache connected');
    } catch (e) {
      this.logger.warn(
        `redis cache unavailable at boot; serving from Postgres (${(e as Error).message})`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
