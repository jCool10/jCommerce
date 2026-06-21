import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import Redis from 'ioredis';
import { THROTTLE_DEFAULT } from '../proxy/throttler-limits.js';

const logger = new Logger('ThrottlerConfig');

/**
 * Redis-backed throttler storage so multi-instance deploys share counters
 * (Cloud Run scales out → in-memory store would let a caller burst N times
 * the limit). Local dev still works against a single Redis container.
 *
 * Behavior on Redis outage: ioredis emits 'error' and queues commands fail
 * fast (`enableOfflineQueue: false`). The next request through ThrottlerGuard
 * will surface a 500 INTERNAL_ERROR via the global exception filter — i.e.
 * the gateway fails CLOSED, not open, during a Redis blip. That trades brief
 * availability loss for hard rate-limit guarantees on the public ingress.
 */
export function buildThrottlerOptions(config: ConfigService): ThrottlerModuleOptions {
  const redisUrl = config.getOrThrow<string>('GATEWAY_REDIS_URL');
  const redis = new Redis(redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
  });
  redis.on('error', (err) => {
    logger.error(`redis error: ${err.message}`);
  });

  return {
    // Single named throttler. Per-route limits come from @Throttle({ default: ... })
    // overrides in ProxyController — see throttler-limits.ts for the why.
    throttlers: [{ name: 'default', limit: THROTTLE_DEFAULT.limit, ttl: THROTTLE_DEFAULT.ttl }],
    storage: new ThrottlerStorageRedisService(redis),
    errorMessage: 'Too many requests',
  };
}
