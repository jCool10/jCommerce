import { Gauge } from 'prom-client';
import { getRegistry } from '../metrics/metrics-registry.js';

/**
 * Known DLQ queue names (from infra/rabbitmq/definitions.json).
 * Depth > 0 means messages were nacked and not retried — silent data loss
 * without this metric. We poll every tick to catch new arrivals fast.
 */
const DLQ_QUEUES = [
  'order.created.dlq',
  'inventory.reserved.dlq',
  'inventory.failed.dlq',
  'payment.succeeded.dlq',
  'payment.failed.dlq',
  'order.confirmed.dlq',
  'order.cancelled.dlq',
  'order.shipped.dlq',
  'product.indexed.dlq',
] as const;

export interface DLQDepthCollectorOptions {
  /** RabbitMQ management HTTP base URL, e.g. http://localhost:15672 */
  managementUrl: string;
  /** Management API username */
  username: string;
  /** Management API password */
  password: string;
  /** Poll interval in milliseconds. Default: 30 000 */
  intervalMs?: number;
}

interface RabbitMQQueueInfo {
  messages_ready: number;
  messages_unacknowledged: number;
}

let _gauge: Gauge<string> | null = null;

function getDLQGauge(): Gauge<string> {
  if (_gauge) return _gauge;
  _gauge = new Gauge({
    name: 'rabbitmq_dlq_message_count',
    help: 'Total messages in each RabbitMQ dead-letter queue (ready + unacknowledged). Depth > 0 means nacked events are accumulating — potential silent data loss.',
    labelNames: ['queue'],
    registers: [getRegistry()],
  });
  return _gauge;
}

export interface DLQDepthCollector {
  /** Begin polling the RabbitMQ management API on the configured interval. */
  start(): void;
  /** Stop polling and clear the interval. */
  stop(): void;
}

/**
 * Factory that returns a collector with explicit start/stop lifecycle.
 * The host service (e.g. order-service) owns the lifecycle — this package
 * never calls setInterval on its own, keeping ownership clean.
 *
 * Usage:
 *   const collector = createDLQDepthCollector({ managementUrl, username, password });
 *   collector.start();   // call in onApplicationBootstrap
 *   collector.stop();    // call in onApplicationShutdown
 */
export function createDLQDepthCollector(
  options: DLQDepthCollectorOptions,
): DLQDepthCollector {
  const {
    managementUrl,
    username,
    password,
    intervalMs = 30_000,
  } = options;

  const gauge = getDLQGauge();
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  let timer: ReturnType<typeof setInterval> | null = null;

  async function poll(): Promise<void> {
    for (const queue of DLQ_QUEUES) {
      // Encode the queue name: vhost "/" becomes "%2F"
      const encoded = encodeURIComponent(queue);
      const url = `${managementUrl}/api/queues/%2F/${encoded}`;
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Basic ${auth}` },
          // Abort if management API is slow — don't block the next tick
          signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) {
          // Non-2xx: management API may be restarting; skip and retry next tick
          gauge.labels({ queue }).set(NaN);
          continue;
        }
        const data = (await res.json()) as RabbitMQQueueInfo;
        const depth =
          (data.messages_ready ?? 0) + (data.messages_unacknowledged ?? 0);
        gauge.labels({ queue }).set(depth);
      } catch {
        // Network failure or timeout: set NaN so Prometheus can distinguish
        // "unknown" from "zero" — alerts fire on > 0, not on NaN
        gauge.labels({ queue }).set(NaN);
      }
    }
  }

  return {
    start() {
      if (timer !== null) return; // idempotent
      // Poll immediately on start so the metric is available before first scrape
      void poll();
      timer = setInterval(() => void poll(), intervalMs);
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

/** Exported for tests only — allows inspecting gauge values */
export function __getDLQGaugeForTests(): Gauge<string> {
  return getDLQGauge();
}
