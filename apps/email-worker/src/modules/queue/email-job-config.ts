import type { JobsOptions } from 'bullmq';

export const EMAIL_JOB_NAME = 'send-email';

/**
 * Exponential backoff steps the worker MUST hit before sending to DLQ.
 * 5s → 30s → 5min covers transient SMTP outages (Mailhog restart, brief
 * SendGrid 5xx) without hammering the upstream for hours.
 */
export const EMAIL_BACKOFF_MS: readonly [number, number, number] = [
  5_000,
  30_000,
  300_000,
] as const;

export const emailDefaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: EMAIL_BACKOFF_MS[0] },
  // Time-based eviction so `jobId = orderId` keeps deduplicating webhook
  // replays for the full Stripe replay window (~30d). 7d covers normal
  // operational replays; count cap prevents Redis blow-up under load.
  removeOnComplete: { age: 7 * 24 * 3600, count: 100_000 },
  removeOnFail: { age: 14 * 24 * 3600, count: 50_000 },
};
