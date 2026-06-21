import { describe, expect, it, vi } from 'vitest';
import { CorrelationMiddleware, REQUEST_ID_HEADER } from '../src/modules/correlation/correlation.middleware.js';

function setup(headerValue?: string) {
  const req = { headers: headerValue ? { [REQUEST_ID_HEADER]: headerValue } : {} } as unknown as Parameters<
    CorrelationMiddleware['use']
  >[0];
  const setHeader = vi.fn();
  const res = { setHeader } as unknown as Parameters<CorrelationMiddleware['use']>[1];
  const next = vi.fn() as unknown as Parameters<CorrelationMiddleware['use']>[2];
  return { req, res, next, setHeader };
}

describe('CorrelationMiddleware', () => {
  const mw = new CorrelationMiddleware();

  it('preserves incoming x-request-id', () => {
    const { req, res, next, setHeader } = setup('incoming-123');
    mw.use(req, res, next);
    expect(req.requestId).toBe('incoming-123');
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'incoming-123');
    expect(next).toHaveBeenCalledOnce();
  });

  it('generates a uuid when header is missing', () => {
    const { req, res, next, setHeader } = setup();
    mw.use(req, res, next);
    const id = req.requestId as string;
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, id);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects suspicious incoming values and regenerates', () => {
    const { req, res, next } = setup('a'.repeat(500));
    mw.use(req, res, next);
    const id = req.requestId as string;
    expect(id).not.toBe('a'.repeat(500));
    expect(id.length).toBeLessThanOrEqual(128);
    expect(next).toHaveBeenCalledOnce();
  });
});
