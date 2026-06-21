import {
  BadGatewayException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type { Response } from 'express';
import { REQUEST_ID_HEADER, type RequestWithId } from '../correlation/correlation.middleware.js';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { ServiceRegistry } from './service-registry.js';

export interface ProxyOptions {
  headersTimeoutMs: number;
  bodyTimeoutMs: number;
}

export interface ProxyHttpResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: NodeJS.ReadableStream;
}

export type ProxyHttpRequestFn = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: NodeJS.ReadableStream;
    headersTimeout?: number;
    bodyTimeout?: number;
  },
) => Promise<ProxyHttpResponse>;

export const PROXY_HTTP_REQUEST = Symbol('PROXY_HTTP_REQUEST');
export const PROXY_OPTIONS = Symbol('PROXY_OPTIONS');

const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
]);

// Always stripped from incoming requests — these are gateway-authoritative.
// A client supplying `x-user-id` on a public route (where no JWT runs) would
// otherwise reach downstream as if forged by the gateway. The gateway re-adds
// the right values from `req.authUser` + `req.requestId` after the strip.
const GATEWAY_AUTHORITATIVE_HEADERS = new Set(['x-user-id', 'x-user-role', 'x-request-id']);

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'te',
  'trailer',
]);

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD', 'OPTIONS']);

const TIMEOUT_ERROR_CODES = new Set([
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'ETIMEDOUT',
]);

type GatewayRequest = AuthenticatedRequest & RequestWithId;

/**
 * Stateless reverse proxy. Resolves the downstream service from the first path
 * segment after `/api/v1/`, forwards the request stream untouched (minus
 * hop-by-hop headers + the original Bearer), injects the user projection +
 * correlation id, and pipes the response stream back to the client.
 */
@Injectable()
export class ProxyService {
  constructor(
    private readonly registry: ServiceRegistry,
    @Inject(PROXY_HTTP_REQUEST) private readonly httpRequest: ProxyHttpRequestFn,
    @Inject(PROXY_OPTIONS) private readonly opts: ProxyOptions,
  ) {}

  async forward(req: GatewayRequest, res: Response): Promise<void> {
    const path = req.originalUrl ?? req.url;
    const prefix = extractServicePrefix(path);
    const target = prefix ? this.registry.resolve(prefix) : null;
    if (!target) {
      throw new BadGatewayException({ code: 'NO_ROUTE', message: 'No route for path' });
    }

    const headers = buildDownstreamHeaders(req);
    const body = METHODS_WITHOUT_BODY.has(req.method.toUpperCase()) ? undefined : req;

    let upstream: ProxyHttpResponse;
    try {
      upstream = await this.httpRequest(target + path, {
        method: req.method,
        headers,
        body: body as unknown as NodeJS.ReadableStream | undefined,
        headersTimeout: this.opts.headersTimeoutMs,
        bodyTimeout: this.opts.bodyTimeoutMs,
      });
    } catch (err) {
      throw mapNetworkError(err);
    }

    res.status(upstream.statusCode);
    for (const [name, value] of Object.entries(upstream.headers)) {
      if (value == null) continue;
      if (HOP_BY_HOP_RESPONSE_HEADERS.has(name.toLowerCase())) continue;
      res.setHeader(name, value as string | string[]);
    }
    await pipeline(toReadable(upstream.body), res as unknown as NodeJS.WritableStream);
  }
}

function extractServicePrefix(path: string): string | null {
  // Path shape: /api/v1/<prefix>/...
  const segments = path.split('?')[0]?.split('/').filter(Boolean) ?? [];
  return segments[2] ?? null;
}

function buildDownstreamHeaders(req: GatewayRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, raw] of Object.entries(req.headers)) {
    if (raw == null) continue;
    const lower = name.toLowerCase();
    if (HOP_BY_HOP_REQUEST_HEADERS.has(lower)) continue;
    if (GATEWAY_AUTHORITATIVE_HEADERS.has(lower)) continue;
    out[lower] = Array.isArray(raw) ? raw.join(',') : String(raw);
  }
  if (req.authUser) {
    out['x-user-id'] = req.authUser.sub;
    out['x-user-role'] = req.authUser.role;
  }
  if (req.requestId) {
    out[REQUEST_ID_HEADER] = req.requestId;
  }
  return out;
}

function toReadable(body: NodeJS.ReadableStream): Readable {
  return body instanceof Readable ? body : Readable.from(body);
}

function mapNetworkError(err: unknown): Error {
  const code = (err as { code?: string })?.code;
  if (code && TIMEOUT_ERROR_CODES.has(code)) {
    return new ServiceUnavailableException({
      code: 'UPSTREAM_TIMEOUT',
      message: 'Upstream service timed out',
    });
  }
  return new BadGatewayException({
    code: 'UPSTREAM_UNAVAILABLE',
    message: 'Upstream service unavailable',
  });
}
