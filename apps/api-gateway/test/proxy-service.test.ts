import { describe, expect, it, vi } from 'vitest';
import { PassThrough, Readable } from 'node:stream';
import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ProxyService, type ProxyHttpRequestFn } from '../src/modules/proxy/proxy.service.js';
import { ServiceRegistry } from '../src/modules/proxy/service-registry.js';

const registry = new ServiceRegistry({
  auth: 'http://auth:3001',
  catalog: 'http://catalog:3002',
  order: 'http://order:3004',
  search: 'http://search:3003',
});

const proxyOpts = { headersTimeoutMs: 1000, bodyTimeoutMs: 2000 };

function mockReq(overrides: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: NodeJS.ReadableStream;
  authUser?: { sub: string; role: 'customer' | 'admin' };
  requestId?: string;
}) {
  return {
    method: overrides.method ?? 'GET',
    originalUrl: overrides.url ?? '/api/v1/orders',
    url: overrides.url ?? '/api/v1/orders',
    headers: overrides.headers ?? {},
    pipe: overrides.body?.pipe.bind(overrides.body),
    on: overrides.body?.on.bind(overrides.body) ?? (() => {}),
    once: overrides.body?.once.bind(overrides.body) ?? (() => {}),
    emit: overrides.body?.emit.bind(overrides.body) ?? (() => {}),
    authUser: overrides.authUser,
    requestId: overrides.requestId ?? 'req-1',
  } as unknown as Parameters<ProxyService['forward']>[0];
}

function mockRes() {
  const writes: Buffer[] = [];
  const setHeaders: Record<string, string> = {};
  let statusCode = 200;
  const stream = new PassThrough();
  stream.on('data', (chunk: Buffer) => writes.push(chunk));
  Object.assign(stream, {
    status(code: number) {
      statusCode = code;
      return stream;
    },
    setHeader(name: string, value: string) {
      setHeaders[name.toLowerCase()] = value;
    },
    flushHeaders() {},
  });
  return {
    writes,
    setHeaders,
    get statusCode() {
      return statusCode;
    },
    res: stream as unknown as Parameters<ProxyService['forward']>[1],
  };
}

function okResponse(body: string, init: { status?: number; headers?: Record<string, string> } = {}) {
  return {
    statusCode: init.status ?? 200,
    headers: init.headers ?? { 'content-type': 'application/json' },
    body: Readable.from(Buffer.from(body)),
  };
}

describe('ProxyService.forward', () => {
  it('rejects unknown route prefix with 502', async () => {
    const httpRequest = vi.fn();
    const svc = new ProxyService(registry, httpRequest, proxyOpts);
    const req = mockReq({ url: '/api/v1/unknown' });
    const r = mockRes();
    await expect(svc.forward(req, r.res)).rejects.toBeInstanceOf(BadGatewayException);
    expect(httpRequest).not.toHaveBeenCalled();
  });

  it('forwards GET with preserved url, method, query, and injected headers', async () => {
    const httpRequest: ProxyHttpRequestFn = vi.fn(async () => okResponse('{"ok":true}'));
    const svc = new ProxyService(registry, httpRequest, proxyOpts);
    const req = mockReq({
      method: 'GET',
      url: '/api/v1/orders?status=paid',
      headers: { accept: 'application/json', authorization: 'Bearer xyz' },
      authUser: { sub: 'u_1', role: 'customer' },
      requestId: 'rid-42',
    });
    const r = mockRes();
    await svc.forward(req, r.res);
    expect(httpRequest).toHaveBeenCalledOnce();
    const [calledUrl, init] = (httpRequest as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [
      string,
      Parameters<ProxyHttpRequestFn>[1],
    ];
    expect(calledUrl).toBe('http://order:3004/api/v1/orders?status=paid');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['x-user-id']).toBe('u_1');
    expect((init.headers as Record<string, string>)['x-user-role']).toBe('customer');
    expect((init.headers as Record<string, string>)['x-request-id']).toBe('rid-42');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer xyz');
    expect((init.headers as Record<string, string>).host).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it('omits user headers on public routes (no authUser)', async () => {
    const httpRequest: ProxyHttpRequestFn = vi.fn(async () => okResponse('{}'));
    const svc = new ProxyService(registry, httpRequest, proxyOpts);
    const req = mockReq({ method: 'POST', url: '/api/v1/auth/login', requestId: 'rid-99' });
    const r = mockRes();
    await svc.forward(req, r.res);
    const [, init] = (httpRequest as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [
      string,
      Parameters<ProxyHttpRequestFn>[1],
    ];
    expect((init.headers as Record<string, string>)['x-user-id']).toBeUndefined();
    expect((init.headers as Record<string, string>)['x-user-role']).toBeUndefined();
    expect((init.headers as Record<string, string>)['x-request-id']).toBe('rid-99');
  });

  it('streams body for POST/PUT/PATCH', async () => {
    const httpRequest: ProxyHttpRequestFn = vi.fn(async () => okResponse('{}'));
    const svc = new ProxyService(registry, httpRequest, proxyOpts);
    const body = Readable.from(Buffer.from('{"a":1}'));
    const req = mockReq({
      method: 'POST',
      url: '/api/v1/orders',
      headers: { 'content-type': 'application/json', 'content-length': '7' },
      body,
      authUser: { sub: 'u_2', role: 'admin' },
    });
    const r = mockRes();
    await svc.forward(req, r.res);
    const [, init] = (httpRequest as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [
      string,
      Parameters<ProxyHttpRequestFn>[1],
    ];
    expect(init.body).toBe(req);
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('propagates downstream status and content-type', async () => {
    const httpRequest: ProxyHttpRequestFn = vi.fn(async () =>
      okResponse('{"name":"x"}', { status: 201, headers: { 'content-type': 'application/json', 'x-foo': 'bar' } }),
    );
    const svc = new ProxyService(registry, httpRequest, proxyOpts);
    const req = mockReq({ method: 'GET', url: '/api/v1/orders/1' });
    const r = mockRes();
    await svc.forward(req, r.res);
    expect(r.statusCode).toBe(201);
    expect(r.setHeaders['content-type']).toBe('application/json');
    expect(r.setHeaders['x-foo']).toBe('bar');
  });

  it('maps network errors to 502 BadGateway', async () => {
    const httpRequest: ProxyHttpRequestFn = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const svc = new ProxyService(registry, httpRequest, proxyOpts);
    const req = mockReq({ method: 'GET', url: '/api/v1/orders' });
    const r = mockRes();
    await expect(svc.forward(req, r.res)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('strips client-supplied x-user-id / x-user-role even on public routes', async () => {
    const httpRequest: ProxyHttpRequestFn = vi.fn(async () => okResponse('{}'));
    const svc = new ProxyService(registry, httpRequest, proxyOpts);
    const req = mockReq({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-user-id': 'attacker', 'x-user-role': 'admin' },
      requestId: 'rid-strip',
    });
    const r = mockRes();
    await svc.forward(req, r.res);
    const [, init] = (httpRequest as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [
      string,
      Parameters<ProxyHttpRequestFn>[1],
    ];
    expect((init.headers as Record<string, string>)['x-user-id']).toBeUndefined();
    expect((init.headers as Record<string, string>)['x-user-role']).toBeUndefined();
    expect((init.headers as Record<string, string>)['x-request-id']).toBe('rid-strip');
  });

  it('maps abort/timeout errors to 504-shaped ServiceUnavailable', async () => {
    const httpRequest: ProxyHttpRequestFn = vi.fn(async () => {
      const err = new Error('HeadersTimeoutError') as Error & { code: string };
      err.code = 'UND_ERR_HEADERS_TIMEOUT';
      throw err;
    });
    const svc = new ProxyService(registry, httpRequest, proxyOpts);
    const req = mockReq({ method: 'GET', url: '/api/v1/orders' });
    const r = mockRes();
    await expect(svc.forward(req, r.res)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
