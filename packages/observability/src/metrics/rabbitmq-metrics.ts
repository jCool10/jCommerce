import { Counter, Gauge } from 'prom-client';
import { getRegistry } from './metrics-registry.js';

let _published: Counter<string> | null = null;
let _consumed: Counter<string> | null = null;
let _lag: Gauge<string> | null = null;

export function rabbitmqMessagesPublishedTotal(): Counter<string> {
  if (_published) return _published;
  _published = new Counter({
    name: 'rabbitmq_messages_published_total',
    help: 'Total messages successfully published to RabbitMQ',
    labelNames: ['routingKey', 'exchange'],
    registers: [getRegistry()],
  });
  return _published;
}

export function rabbitmqMessagesConsumedTotal(): Counter<string> {
  if (_consumed) return _consumed;
  _consumed = new Counter({
    name: 'rabbitmq_messages_consumed_total',
    help: 'Total messages consumed from RabbitMQ',
    labelNames: ['queue', 'status'],
    registers: [getRegistry()],
  });
  return _consumed;
}

export function rabbitmqConsumerLag(): Gauge<string> {
  if (_lag) return _lag;
  _lag = new Gauge({
    name: 'rabbitmq_consumer_lag',
    help: 'Approximate queue depth observed per queue',
    labelNames: ['queue'],
    registers: [getRegistry()],
  });
  return _lag;
}

export type ConsumeStatus = 'ack' | 'nack' | 'requeued' | 'dropped';

export function recordPublished(routingKey: string, exchange: string): void {
  rabbitmqMessagesPublishedTotal().labels({ routingKey, exchange }).inc();
}

export function recordConsumed(queue: string, status: ConsumeStatus): void {
  rabbitmqMessagesConsumedTotal().labels({ queue, status }).inc();
}

export function setQueueDepth(queue: string, depth: number): void {
  rabbitmqConsumerLag().labels({ queue }).set(depth);
}
