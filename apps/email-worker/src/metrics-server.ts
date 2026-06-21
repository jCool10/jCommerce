import { createServer } from 'node:http';
import { Logger } from '@nestjs/common';
import { getRegistry, initMetrics } from '@jcool/observability';

/**
 * email-worker has no NestJS HTTP adapter (it's a standalone application
 * context). Expose `/metrics` via a tiny native HTTP listener so Prometheus
 * can scrape it like every other service.
 */
export function startMetricsServer(): void {
  initMetrics('email-worker');
  const port = Number(process.env.METRICS_PORT ?? 9100);
  const server = createServer(async (req, res) => {
    if (!req.url) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const path = req.url.split('?')[0];
    if (path === '/metrics') {
      try {
        const body = await getRegistry().metrics();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.end(body);
      } catch (err) {
        res.statusCode = 500;
        res.end((err as Error).message);
      }
      return;
    }
    if (path === '/health') {
      res.statusCode = 200;
      res.end('ok');
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  server.listen(port, () => {
    Logger.log(`email-worker metrics on :${port}/metrics`, 'Metrics');
  });
  const close = () => server.close();
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
}
