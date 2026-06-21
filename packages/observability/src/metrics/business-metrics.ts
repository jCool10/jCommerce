import { Counter, Gauge } from 'prom-client';
import { getRegistry } from './metrics-registry.js';

let _ordersCreated: Counter<string> | null = null;
let _revenue: Counter<string> | null = null;
let _sagaCompensations: Counter<string> | null = null;
let _inventoryReserved: Counter<string> | null = null;
let _outboxPending: Gauge<string> | null = null;

export function ordersCreatedTotal(): Counter<string> {
  if (_ordersCreated) return _ordersCreated;
  _ordersCreated = new Counter({
    name: 'orders_created_total',
    help: 'Total orders created, by terminal status + currency',
    labelNames: ['status', 'currency'],
    registers: [getRegistry()],
  });
  return _ordersCreated;
}

export function revenueSubunitTotal(): Counter<string> {
  if (_revenue) return _revenue;
  _revenue = new Counter({
    name: 'revenue_subunit_total',
    help: 'Cumulative recognised revenue in minor units (cents / VND)',
    labelNames: ['currency'],
    registers: [getRegistry()],
  });
  return _revenue;
}

export function sagaCompensationsTotal(): Counter<string> {
  if (_sagaCompensations) return _sagaCompensations;
  _sagaCompensations = new Counter({
    name: 'saga_compensations_total',
    help: 'Total saga compensation actions executed',
    labelNames: ['saga', 'step'],
    registers: [getRegistry()],
  });
  return _sagaCompensations;
}

export function inventoryReservedTotal(): Counter<string> {
  if (_inventoryReserved) return _inventoryReserved;
  _inventoryReserved = new Counter({
    name: 'inventory_reserved_total',
    help: 'Total inventory reservations (per sku)',
    labelNames: ['sku', 'result'],
    registers: [getRegistry()],
  });
  return _inventoryReserved;
}

export function outboxEventsPending(): Gauge<string> {
  if (_outboxPending) return _outboxPending;
  _outboxPending = new Gauge({
    name: 'outbox_events_pending',
    help: 'Pending events in the transactional outbox table',
    labelNames: ['source'],
    registers: [getRegistry()],
  });
  return _outboxPending;
}

// Sugar helpers so app code never imports prom-client directly.

export function recordOrderCreated(status: string, currency: string): void {
  ordersCreatedTotal().labels({ status, currency }).inc();
}

export function recordRevenue(currency: string, amountSubunit: number): void {
  if (amountSubunit <= 0) return;
  revenueSubunitTotal().labels({ currency }).inc(amountSubunit);
}

export function recordSagaCompensation(saga: string, step: string): void {
  sagaCompensationsTotal().labels({ saga, step }).inc();
}

export function recordInventoryReservation(sku: string, result: 'reserved' | 'rejected'): void {
  inventoryReservedTotal().labels({ sku, result }).inc();
}

export function setOutboxPending(source: string, depth: number): void {
  outboxEventsPending().labels({ source }).set(depth);
}
