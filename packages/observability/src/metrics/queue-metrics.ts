import { Counter, Gauge, Histogram } from 'prom-client';
import { getRegistry } from './metrics-registry.js';

const buckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 300];

let _jobDuration: Histogram<string> | null = null;
let _jobFailed: Counter<string> | null = null;
let _queueDepth: Gauge<string> | null = null;

export function bullmqJobDurationSeconds(): Histogram<string> {
  if (_jobDuration) return _jobDuration;
  _jobDuration = new Histogram({
    name: 'bullmq_job_duration_seconds',
    help: 'BullMQ job execution duration in seconds',
    labelNames: ['queue', 'name'],
    buckets,
    registers: [getRegistry()],
  });
  return _jobDuration;
}

export function bullmqJobFailedTotal(): Counter<string> {
  if (_jobFailed) return _jobFailed;
  _jobFailed = new Counter({
    name: 'bullmq_job_failed_total',
    help: 'Total BullMQ jobs that ended in failed state',
    labelNames: ['queue', 'name'],
    registers: [getRegistry()],
  });
  return _jobFailed;
}

export function bullmqQueueDepth(): Gauge<string> {
  if (_queueDepth) return _queueDepth;
  _queueDepth = new Gauge({
    name: 'bullmq_queue_depth',
    help: 'BullMQ queue depth (waiting + delayed) per queue',
    labelNames: ['queue', 'state'],
    registers: [getRegistry()],
  });
  return _queueDepth;
}

/**
 * Minimal subset of BullMQ's QueueEvents used by `attachBullmqEvents`.
 * Kept narrow so we don't take BullMQ as a hard dep of this package.
 */
export interface BullmqEventsLike {
  on(
    event: 'completed' | 'failed',
    listener: (args: { jobId: string }, ...rest: unknown[]) => void,
  ): unknown;
}

export interface BullmqJobMetadata {
  name: string;
  durationSeconds: number;
}

/**
 * Wire BullMQ QueueEvents → Prometheus. The consumer passes a function that
 * looks up job metadata by id since QueueEvents only delivers ids.
 */
export function attachBullmqEvents(
  queue: string,
  events: BullmqEventsLike,
  lookup: (jobId: string) => Promise<BullmqJobMetadata | null>,
): void {
  events.on('completed', async (args) => {
    const meta = await lookup(args.jobId);
    if (!meta) return;
    bullmqJobDurationSeconds().labels({ queue, name: meta.name }).observe(meta.durationSeconds);
  });
  events.on('failed', async (args) => {
    const meta = await lookup(args.jobId);
    bullmqJobFailedTotal().labels({ queue, name: meta?.name ?? 'unknown' }).inc();
    if (meta) {
      bullmqJobDurationSeconds().labels({ queue, name: meta.name }).observe(meta.durationSeconds);
    }
  });
}

export function setBullmqDepth(queue: string, state: 'waiting' | 'delayed' | 'active', depth: number): void {
  bullmqQueueDepth().labels({ queue, state }).set(depth);
}
