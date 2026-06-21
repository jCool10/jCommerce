import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { UserEmailResolver } from './user-email-resolver.port.js';

/**
 * Dev stand-in: auth-service doesn't expose `GET /users/:id` yet, so instead
 * of blocking the order-confirmed → email flow we synthesise a deterministic
 * dev address per userId. Swap this for the real HTTP adapter once the lookup
 * exists.
 *
 * Refuses to start in production unless ALLOW_DEV_EMAIL_RESOLVER=1, otherwise
 * every confirmation would go to a dead `@jcool.local` address.
 */
@Injectable()
export class DevUserEmailResolver implements UserEmailResolver, OnModuleInit {
  private readonly logger = new Logger(DevUserEmailResolver.name);

  onModuleInit(): void {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_DEV_EMAIL_RESOLVER !== '1'
    ) {
      throw new Error(
        'DevUserEmailResolver wired in production. Replace with the real ' +
          'gateway-backed adapter (phase 10) or set ALLOW_DEV_EMAIL_RESOLVER=1 to override.',
      );
    }
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn(
        'ALLOW_DEV_EMAIL_RESOLVER=1 → emails routing to synthetic @jcool.local addresses',
      );
    }
  }

  async resolveUserEmail(userId: string): Promise<string> {
    const slug = userId.replace(/-/g, '').slice(0, 8);
    const address = `buyer-${slug}@jcool.local`;
    this.logger.debug(`dev resolver → ${address}`);
    return address;
  }
}
