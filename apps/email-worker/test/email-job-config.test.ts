import { describe, it, expect } from 'vitest';
import {
  EMAIL_JOB_NAME,
  emailDefaultJobOptions,
  EMAIL_BACKOFF_MS,
} from '../src/modules/queue/email-job-config.js';

describe('email job config', () => {
  it('uses a stable job name so producer + worker agree', () => {
    expect(EMAIL_JOB_NAME).toBe('send-email');
  });

  it('attempts = 3 with exponential backoff (phase 9 spec)', () => {
    expect(emailDefaultJobOptions.attempts).toBe(3);
    expect(emailDefaultJobOptions.backoff).toEqual({
      type: 'exponential',
      delay: EMAIL_BACKOFF_MS[0],
    });
  });

  it('backoff progression hits 5s, 30s, 5min (approximate)', () => {
    expect(EMAIL_BACKOFF_MS[0]).toBe(5_000);
    expect(EMAIL_BACKOFF_MS[1]).toBe(30_000);
    expect(EMAIL_BACKOFF_MS[2]).toBe(300_000);
  });

  it('removeOnComplete is time-based so jobId-based deduplication outlives count eviction (webhook replay safety)', () => {
    expect(emailDefaultJobOptions.removeOnComplete).toEqual({
      age: 7 * 24 * 3600,
      count: 100_000,
    });
    expect(emailDefaultJobOptions.removeOnFail).toEqual({
      age: 14 * 24 * 3600,
      count: 50_000,
    });
  });
});
