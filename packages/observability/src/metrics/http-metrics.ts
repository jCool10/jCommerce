import { Counter, Histogram } from 'prom-client';
import { getRegistry } from './metrics-registry.js';

const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

let _requests: Counter<string> | null = null;
let _duration: Histogram<string> | null = null;

export function httpRequestsTotal(): Counter<string> {
  if (_requests) return _requests;
  _requests = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests received',
    labelNames: ['method', 'route', 'status'],
    registers: [getRegistry()],
  });
  return _requests;
}

export function httpRequestDurationSeconds(): Histogram<string> {
  if (_duration) return _duration;
  _duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets,
    registers: [getRegistry()],
  });
  return _duration;
}

export interface HttpMetricLabels {
  method: string;
  route: string;
  status: string;
  [k: string]: string;
}

/** Record one finished HTTP request. */
export function recordHttpRequest(labels: HttpMetricLabels, durationSeconds: number): void {
  httpRequestsTotal().labels(labels).inc();
  httpRequestDurationSeconds().labels(labels).observe(durationSeconds);
}
