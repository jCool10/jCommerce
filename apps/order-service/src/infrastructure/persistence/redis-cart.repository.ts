import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Currency } from '@jcool/contracts';
import { Cart } from '../../domain/cart.entity.js';
import type { CartRepository } from '../../domain/ports/cart.repository.js';

// Stored shape — `currency:null` when empty + items as a compact array.
interface CartRecord {
  currency: Currency | null;
  items: Array<{ skuId: string; productId: string; quantity: number }>;
}

const REDIS_KEY = (sessionKey: string): string => `cart:${sessionKey}`;

@Injectable()
export class RedisCartRepository implements CartRepository, OnModuleDestroy {
  private readonly logger = new Logger(RedisCartRepository.name);
  private readonly client: Redis;
  private readonly ttlSeconds: number;

  constructor(config: ConfigService) {
    const url =
      config.get<string>('ORDER_REDIS_URL') ?? 'redis://localhost:6379/2';
    this.client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
    this.client.on('error', (e) => this.logger.error(`redis: ${e.message}`));
    this.ttlSeconds = Number(config.get('CART_TTL_SECONDS') ?? 604_800);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async findBySessionKey(sessionKey: string): Promise<Cart | null> {
    const raw = await this.client.get(REDIS_KEY(sessionKey));
    if (!raw) return null;
    let parsed: CartRecord;
    try {
      parsed = JSON.parse(raw) as CartRecord;
    } catch (err) {
      this.logger.warn(
        `cart ${sessionKey} JSON parse failure (${(err as Error).message}); discarding`,
      );
      return null;
    }
    return Cart.rehydrate(sessionKey, parsed.items ?? [], parsed.currency ?? null);
  }

  async save(cart: Cart): Promise<void> {
    if (cart.isEmpty()) {
      await this.client.del(REDIS_KEY(cart.sessionKey));
      return;
    }
    const record: CartRecord = {
      currency: cart.currency,
      items: cart.snapshotItems(),
    };
    await this.client.set(
      REDIS_KEY(cart.sessionKey),
      JSON.stringify(record),
      'EX',
      this.ttlSeconds,
    );
  }

  async delete(sessionKey: string): Promise<void> {
    await this.client.del(REDIS_KEY(sessionKey));
  }
}
