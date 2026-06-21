import { collectDefaultMetrics, Registry } from 'prom-client';

/**
 * Process-wide singleton prom-client Registry. Every metric authored in this
 * package (HTTP histogram, DB middleware, RabbitMQ, BullMQ, business
 * counters) registers here so `/metrics` returns one consolidated payload.
 */
let registry: Registry | null = null;
let initialized = false;

export function getRegistry(): Registry {
  if (!registry) registry = new Registry();
  return registry;
}

/**
 * Idempotent init. Stamps the `service` label on every default metric and
 * starts Node.js process metrics collection (event loop lag, GC, RSS, etc.).
 */
export function initMetrics(service: string): void {
  if (initialized) return;
  const reg = getRegistry();
  reg.setDefaultLabels({ service });
  collectDefaultMetrics({ register: reg, prefix: '' });
  initialized = true;
}

/** Reset state — used by tests only. */
export function __resetRegistryForTests(): void {
  registry?.clear();
  registry = null;
  initialized = false;
}
