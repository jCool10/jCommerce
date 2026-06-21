import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from '../correlation/correlation.middleware.js';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
    path?: string;
  };
}

/**
 * Maps every uncaught error to a stable envelope so storefront/admin clients
 * can branch on `error.code` without parsing strings. Internal errors are
 * scrubbed — downstream stack traces never leak to the public boundary.
 */
@Catch()
export class GatewayErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(GatewayErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<RequestWithId>();
    const res = ctx.getResponse<Response>();

    const { status, body } = this.render(exception, req);
    res.status(status).json(body);
  }

  private render(exception: unknown, req: RequestWithId): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const { code, message, details } = normalizeHttpPayload(payload, status);
      return {
        status,
        body: {
          error: { code, message, details, requestId: req.requestId, path: req.originalUrl },
        },
      };
    }
    this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal error',
          requestId: req.requestId,
          path: req.originalUrl,
        },
      },
    };
  }
}

function normalizeHttpPayload(
  payload: string | object,
  status: number,
): { code: string; message: string; details?: unknown } {
  if (typeof payload === 'string') {
    return { code: defaultCodeForStatus(status), message: payload };
  }
  const obj = payload as { code?: unknown; message?: unknown; error?: unknown; details?: unknown };
  const code = typeof obj.code === 'string' ? obj.code : defaultCodeForStatus(status);
  const message = typeof obj.message === 'string'
    ? obj.message
    : Array.isArray(obj.message)
      ? (obj.message as string[]).join(', ')
      : typeof obj.error === 'string'
        ? obj.error
        : defaultMessageForStatus(status);
  return { code, message, details: obj.details };
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}

function defaultMessageForStatus(status: number): string {
  return status >= 500 ? 'Internal error' : 'Request failed';
}
