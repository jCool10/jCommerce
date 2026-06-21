import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ServiceUrls {
  auth: string;
  catalog: string;
  order: string;
  search: string;
}

/**
 * Maps the first path segment (after `/api/v1/`) to a downstream base URL.
 * Aliases collapse `products` → catalog, `checkout`/`cart` → order so the
 * controller can keep a single route group per service while exposing the
 * canonical REST verbs that the frontend already uses.
 */
@Injectable()
export class ServiceRegistry {
  private readonly map: ReadonlyMap<string, string>;

  constructor(urls: ServiceUrls) {
    this.map = new Map([
      ['auth', urls.auth],
      ['catalog', urls.catalog],
      ['products', urls.catalog],
      ['orders', urls.order],
      ['checkout', urls.order],
      ['cart', urls.order],
      ['search', urls.search],
    ]);
  }

  resolve(prefix: string): string | null {
    return this.map.get(prefix) ?? null;
  }
}

/** Factory so NestJS DI can supply a ServiceRegistry from env via ConfigService. */
export function serviceRegistryFromConfig(config: ConfigService): ServiceRegistry {
  return new ServiceRegistry({
    auth: requireUrl(config, 'AUTH_SERVICE_URL'),
    catalog: requireUrl(config, 'CATALOG_SERVICE_URL'),
    order: requireUrl(config, 'ORDER_SERVICE_URL'),
    search: requireUrl(config, 'SEARCH_SERVICE_URL'),
  });
}

function requireUrl(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (!value) {
    throw new Error(`${key} is required (set it in apps/api-gateway/.env)`);
  }
  return value.replace(/\/+$/, '');
}
