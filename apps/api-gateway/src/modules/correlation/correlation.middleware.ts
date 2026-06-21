import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Bounded so a malicious caller cannot flood log fields with a giant header. */
const MAX_LEN = 128;
const SAFE = /^[\w.:-]+$/;

export interface RequestWithId extends Request {
  requestId?: string;
}

/**
 * Assigns `req.requestId` from `x-request-id` when the incoming value is safe,
 * otherwise generates a UUID v4. Echoes the chosen id back on the response and
 * the downstream proxy forwards the same value so logs from every service can
 * be joined on a single request id.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const id = isSafe(candidate) ? (candidate as string) : randomUUID();
    req.requestId = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}

function isSafe(value: string | undefined): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_LEN && SAFE.test(value);
}
