import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { exportSPKI, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { AuthModule } from '../src/modules/auth/auth.module.js';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard.js';
import { CorrelationMiddleware } from '../src/modules/correlation/correlation.middleware.js';
import { GatewayErrorFilter } from '../src/modules/errors/error-filter.js';
import { ProxyController } from '../src/modules/proxy/proxy.controller.js';
import {
  PROXY_HTTP_REQUEST,
  PROXY_OPTIONS,
  ProxyService,
  type ProxyHttpRequestFn,
  type ProxyOptions,
} from '../src/modules/proxy/proxy.service.js';
import { ServiceRegistry, type ServiceUrls } from '../src/modules/proxy/service-registry.js';
import { undiciAdapter } from './helpers/undici-adapter.js';

interface Recorded {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

async function startMock(): Promise<{ server: Server; url: string; last: () => Recorded | null }> {
  let last: Recorded | null = null;
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      last = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      };
      if (req.url?.startsWith('/api/v1/orders')) {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.setHeader('x-downstream', 'order-service');
        res.end(JSON.stringify({ orderId: 'o_1', headersSeen: req.headers }));
        return;
      }
      if (req.url?.startsWith('/api/v1/auth/login') || req.url?.startsWith('/api/v1/auth/refresh')) {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ accessToken: 'fake' }));
        return;
      }
      res.statusCode = 404;
      res.end('not found');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, url: `http://127.0.0.1:${port}`, last: () => last };
}

describe('api-gateway integration', () => {
  let app: INestApplication;
  let mock: Awaited<ReturnType<typeof startMock>>;
  let validToken: string;

  beforeAll(async () => {
    mock = await startMock();
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const spki = await exportSPKI(publicKey);
    process.env.AUTH_PUBLIC_KEY_B64 = Buffer.from(spki).toString('base64');

    validToken = await new SignJWT({ email: 'a@b.c', role: 'customer' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('u_42')
      .setIssuedAt()
      // Mirror auth-service defaults so the verifier's iss/aud pinning passes.
      .setIssuer('jcool-auth')
      .setAudience('jcool-clients')
      .setExpirationTime('5m')
      .sign(privateKey);

    const urls: ServiceUrls = {
      auth: mock.url,
      catalog: mock.url,
      order: mock.url,
      search: mock.url,
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRoot({
          // Single `default` throttler with a high baseline. Routes decorated
          // with @Throttle({ default: ... }) override it (e.g. auth/login at
          // 5 req per window — exercised by the rate-limit test below).
          throttlers: [{ name: 'default', limit: 1000, ttl: 60_000 }],
        }),
        AuthModule,
      ],
      controllers: [ProxyController],
      providers: [
        { provide: ServiceRegistry, useValue: new ServiceRegistry(urls) },
        { provide: PROXY_HTTP_REQUEST, useValue: undiciAdapter as ProxyHttpRequestFn },
        {
          provide: PROXY_OPTIONS,
          useValue: { headersTimeoutMs: 5000, bodyTimeoutMs: 5000 } satisfies ProxyOptions,
        },
        ProxyService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: GatewayErrorFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use((req: Parameters<CorrelationMiddleware['use']>[0], res: Parameters<CorrelationMiddleware['use']>[1], next: Parameters<CorrelationMiddleware['use']>[2]) => {
      new CorrelationMiddleware().use(req, res, next);
    });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  });

  it('rejects protected route without Bearer with unified envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/orders');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_BEARER');
    expect(res.body.error.requestId).toBeDefined();
    expect(res.body.error.path).toBe('/api/v1/orders');
  });

  it('rejects protected route with bad token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('forwards protected route with valid token, passes Bearer through, injects user headers', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/orders?status=paid')
      .set('authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['x-downstream']).toBe('order-service');
    const recorded = mock.last();
    expect(recorded?.method).toBe('GET');
    expect(recorded?.url).toBe('/api/v1/orders?status=paid');
    expect(recorded?.headers['x-user-id']).toBe('u_42');
    expect(recorded?.headers['x-user-role']).toBe('customer');
    expect(recorded?.headers['x-request-id']).toBeDefined();
    // Bearer passes through so each downstream JwtAuthGuard still verifies.
    expect(recorded?.headers.authorization).toBe(`Bearer ${validToken}`);
  });

  it('strips client-supplied x-user-id / x-user-role on public route', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-user-id', 'attacker-u')
      .set('x-user-role', 'admin')
      .send({ email: 'a@b.c', password: 'x' });
    expect(res.status).toBe(200);
    const recorded = mock.last();
    expect(recorded?.headers['x-user-id']).toBeUndefined();
    expect(recorded?.headers['x-user-role']).toBeUndefined();
  });

  it('forwards POST body bytes downstream (bodyParser disabled)', async () => {
    const payload = { email: 'a@b.c', password: 'secret-123' };
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('content-type', 'application/json')
      .send(payload);
    const recorded = mock.last();
    expect(recorded?.body.length).toBeGreaterThan(0);
    expect(JSON.parse(recorded!.body)).toEqual(payload);
  });

  it('rate-limits 5 req / 15min on the login throttle (probed via /auth/refresh to avoid budget interference from other tests)', async () => {
    const server = app.getHttpServer();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await request(server).post('/api/v1/auth/refresh').send({});
      statuses.push(r.status);
    }
    expect(statuses.filter((s) => s === 200).length).toBe(5);
    expect(statuses.filter((s) => s === 429).length).toBe(2);
    const last = await request(server).post('/api/v1/auth/refresh').send({});
    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('forwards public auth/login without token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.c', password: 'x' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('fake');
  });

  it('echoes back the x-request-id sent by the client', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('authorization', `Bearer ${validToken}`)
      .set('x-request-id', 'cli-test-7');
    expect(res.headers['x-request-id']).toBe('cli-test-7');
    expect(mock.last()?.headers['x-request-id']).toBe('cli-test-7');
  });

});
