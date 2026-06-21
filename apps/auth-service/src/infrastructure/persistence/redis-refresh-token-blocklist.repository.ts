import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { RefreshTokenBlocklistRepository } from '../../domain/ports/refresh-token-blocklist.repository.js';

const JTI_KEY = (jti: string): string => `auth:refresh:block:${jti}`;
const USER_REVOKE_KEY = (userId: string): string => `auth:refresh:revoke:user:${userId}`;

@Injectable()
export class RedisRefreshTokenBlocklistRepository
  implements RefreshTokenBlocklistRepository, OnModuleDestroy
{
  private readonly logger = new Logger(RedisRefreshTokenBlocklistRepository.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    const url = config.get<string>('AUTH_REDIS_URL') ?? 'redis://localhost:6379/0';
    this.client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
    this.client.on('error', (e) => this.logger.error(`redis: ${e.message}`));
  }

  async block(jti: string, expiresAtEpochSeconds: number): Promise<void> {
    const ttl = expiresAtEpochSeconds - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return;
    await this.client.set(JTI_KEY(jti), '1', 'EX', ttl);
  }

  async isBlocked(jti: string): Promise<boolean> {
    return (await this.client.exists(JTI_KEY(jti))) === 1;
  }

  async blockAllForUser(userId: string, expiresAtEpochSeconds: number): Promise<void> {
    const ttl = expiresAtEpochSeconds - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return;
    await this.client.set(USER_REVOKE_KEY(userId), '1', 'EX', ttl);
  }

  async isUserSessionRevoked(userId: string): Promise<boolean> {
    return (await this.client.exists(USER_REVOKE_KEY(userId))) === 1;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
