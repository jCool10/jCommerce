import {
  Catch,
  HttpException,
  type ArgumentsHost,
} from '@nestjs/common';
import {
  BaseExceptionFilter,
  type HttpAdapterHost,
} from '@nestjs/core';
import { captureException, withScope } from '@sentry/node';

/**
 * Global exception filter that forwards unhandled / 5xx errors to Sentry
 * and then delegates to Nest's default exception rendering. 4xx
 * HttpExceptions are user errors and intentionally skipped so the Sentry
 * quota tracks real defects, not validation noise.
 *
 * Register globally (after Nest's HTTP adapter is wired):
 *   const httpAdapterHost = app.get(HttpAdapterHost);
 *   app.useGlobalFilters(new SentryExceptionFilter(httpAdapterHost.httpAdapter));
 *
 * No-op when Sentry isn't initialized — `captureException` is a harmless
 * call on the un-initialized SDK in that state.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  constructor(applicationRef?: HttpAdapterHost['httpAdapter']) {
    super(applicationRef);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (this.shouldCapture(exception)) {
      withScope((scope) => {
        const httpHost = host.switchToHttp();
        const req = httpHost.getRequest<{
          url?: string;
          method?: string;
          headers?: Record<string, string | string[] | undefined>;
        }>();
        if (req) {
          scope.setContext('http', { url: req.url, method: req.method });
          const correlationId = req.headers?.['x-correlation-id'];
          if (typeof correlationId === 'string') {
            scope.setTag('correlation_id', correlationId);
          }
        }
        captureException(exception);
      });
    }

    // Delegate to Nest's default filter so the HTTP response is rendered
    // exactly as it would be without Sentry in the chain.
    super.catch(exception, host);
  }

  private shouldCapture(exception: unknown): boolean {
    if (exception instanceof HttpException) {
      // 4xx = client error / validation — skip. 5xx = server defect — capture.
      return exception.getStatus() >= 500;
    }
    // Non-HttpException = uncaught runtime error → always capture.
    return true;
  }
}
