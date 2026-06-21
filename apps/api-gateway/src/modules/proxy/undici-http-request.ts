import { request } from 'undici';
import type { ProxyHttpRequestFn } from './proxy.service.js';

/**
 * undici-backed ProxyHttpRequestFn. Lives in its own file so the integration
 * test can reuse the same adapter the production module wires — keeps the
 * "what gets sent on the wire" surface tested end-to-end.
 */
export const undiciHttpRequest: ProxyHttpRequestFn = async (url, init) => {
  const res = await request(url, {
    method: init.method as Parameters<typeof request>[1] extends infer T
      ? T extends { method?: infer M }
        ? M
        : never
      : never,
    headers: init.headers,
    body: init.body as Parameters<typeof request>[1] extends infer T
      ? T extends { body?: infer B }
        ? B
        : never
      : never,
    headersTimeout: init.headersTimeout,
    bodyTimeout: init.bodyTimeout,
  });
  return {
    statusCode: res.statusCode,
    headers: res.headers as Record<string, string | string[] | undefined>,
    body: res.body,
  };
};
