import { describe, expect, it, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { GatewayErrorFilter } from '../src/modules/errors/error-filter.js';

function host(overrides: Partial<{ path: string; method: string; requestId: string }> = {}) {
  const req = {
    originalUrl: overrides.path ?? '/api/v1/orders',
    method: overrides.method ?? 'GET',
    requestId: overrides.requestId ?? 'req-1',
  };
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const res = { status, json };
  return {
    res,
    status,
    json,
    arg: {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as Parameters<GatewayErrorFilter['catch']>[1],
  };
}

describe('GatewayErrorFilter', () => {
  const filter = new GatewayErrorFilter();

  it('preserves HttpException status and structured body', () => {
    const ex = new HttpException(
      { code: 'INVALID_TOKEN', message: 'bad token' },
      HttpStatus.UNAUTHORIZED,
    );
    const h = host({ path: '/api/v1/orders', requestId: 'r1' });
    filter.catch(ex, h.arg);
    expect(h.status).toHaveBeenCalledWith(401);
    expect(h.json).toHaveBeenCalledWith({
      error: {
        code: 'INVALID_TOKEN',
        message: 'bad token',
        requestId: 'r1',
        path: '/api/v1/orders',
      },
    });
  });

  it('falls back to message for plain HttpException', () => {
    const ex = new HttpException('Not found', HttpStatus.NOT_FOUND);
    const h = host();
    filter.catch(ex, h.arg);
    expect(h.status).toHaveBeenCalledWith(404);
    expect(h.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'NOT_FOUND', message: 'Not found' }),
    });
  });

  it('hides internal details for non-HttpException errors', () => {
    const ex = new Error('connection ECONNREFUSED 127.0.0.1:5432');
    const h = host();
    filter.catch(ex, h.arg);
    expect(h.status).toHaveBeenCalledWith(500);
    const body = h.json.mock.calls[0]?.[0] as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Internal error');
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });
});
