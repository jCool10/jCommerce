import type { HttpErrorResponse } from '@jcool/contracts';
import { AuthRedirectError, buildLoginUrl } from './auth/redirect-to-login';

// All traffic goes through the api-gateway at /api/v1/*. Server Components use
// INTERNAL_API_URL (docker-internal host); browser code uses NEXT_PUBLIC_API_URL
// so the browser can resolve the hostname.
const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const INTERNAL_BASE = process.env.INTERNAL_API_URL ?? PUBLIC_BASE;

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Bearer token; if set, sent as `Authorization: Bearer <token>`. */
  accessToken?: string;
  /** Refresh token used to attempt a silent token rotation on 401. */
  refreshToken?: string;
  /**
   * Callback invoked after a successful token refresh.
   * Callers (e.g. client-side hooks) use this to persist the new tokens so
   * the next request does not re-enter the refresh flow.
   */
  onTokenRefreshed?: (tokens: { accessToken: string; refreshToken: string; expiresIn: number }) => void;
  /** Current page path used as `returnTo` when forcing a re-auth redirect. */
  returnTo?: string;
  /** Echoed back via `X-Request-Id` so logs across services correlate. */
  correlationId?: string;
  /** Guest cart session id (UUIDv4). Mirrors order-service contract. */
  guestSessionId?: string;
  /** Next.js fetch revalidate seconds; pass 0 to disable cache. */
  revalidate?: number;
  /** Next.js fetch cache tags. */
  tags?: string[];
  /** Forces use of the internal hostname (Server Components / Server Actions). */
  server?: boolean;
  /**
   * Internal flag — set to true on the single retry after a successful
   * token refresh to prevent an infinite refresh loop.
   */
  _isRetry?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: HttpErrorResponse | null;

  constructor(status: number, body: HttpErrorResponse | null, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Core fetch wrapper. On a 401, if a refreshToken was supplied and this isn't
 * already a retry, it refreshes the token once and replays the request. If the
 * refresh itself fails the session is gone, so it throws AuthRedirectError and
 * callers send the user to /login instead of surfacing a raw 401.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const base = options.server ? INTERNAL_BASE : PUBLIC_BASE;
  const url = `${base.replace(/\/+$/, '')}${normalizePath(path)}`;

  const headers: Record<string, string> = {
    accept: 'application/json',
    ...options.headers,
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.accessToken) headers.authorization = `Bearer ${options.accessToken}`;
  if (options.guestSessionId) headers['x-guest-session'] = options.guestSessionId;
  headers['x-request-id'] = options.correlationId ?? generateCorrelationId();

  const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  };
  if (options.revalidate !== undefined || options.tags) {
    init.next = {};
    if (options.revalidate !== undefined) init.next.revalidate = options.revalidate;
    if (options.tags) init.next.tags = options.tags;
  }

  const response = await fetch(url, init);

  // --- 401 interceptor ---
  // Non-auth endpoints returning 401 trigger a single refresh attempt.
  // Auth endpoints (/auth/login, /auth/refresh) are excluded to prevent
  // circular refresh calls — they never carry a refreshToken option.
  if (
    response.status === 401 &&
    options.refreshToken &&
    !options._isRetry
  ) {
    return handle401WithRefresh<T>(path, options);
  }

  if (!response.ok) {
    const body = await safeJson<HttpErrorResponse>(response);
    throw new ApiError(
      response.status,
      body,
      body?.message ?? `Request to ${path} failed: ${response.status}`,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Attempt one token refresh then retry the original request.
 * On refresh failure, throw AuthRedirectError so callers can redirect cleanly
 * instead of showing a raw "401 Unauthorized" to the user mid-flow.
 */
async function handle401WithRefresh<T>(
  path: string,
  options: ApiRequestOptions,
): Promise<T> {
  const returnTo = options.returnTo ?? '/';

  let newTokens: { accessToken: string; refreshToken: string; expiresIn: number };
  try {
    // Inline refresh call — avoids circular import with lib/api/auth.ts while
    // keeping the interceptor self-contained inside api-client.
    const base = options.server ? INTERNAL_BASE : PUBLIC_BASE;
    const refreshUrl = `${base.replace(/\/+$/, '')}/api/v1/auth/refresh`;
    const refreshHeaders: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-request-id': generateCorrelationId(),
    };
    const refreshRes = await fetch(refreshUrl, {
      method: 'POST',
      headers: refreshHeaders,
      body: JSON.stringify({ refreshToken: options.refreshToken }),
    });

    if (!refreshRes.ok) {
      // Refresh failed (expired / revoked / invalid) — session unrecoverable.
      // Redirect to login rather than propagating a confusing 401 to the UI.
      throw new AuthRedirectError(returnTo);
    }

    const refreshData = (await refreshRes.json()) as {
      tokens: { accessToken: string; refreshToken: string; expiresIn: number };
    };
    newTokens = refreshData.tokens;
  } catch (err) {
    // Re-throw our own sentinel as-is; wrap unexpected fetch errors in redirect.
    if (err instanceof AuthRedirectError) throw err;
    throw new AuthRedirectError(returnTo);
  }

  // Notify caller so they can persist the rotated tokens (e.g. update Zustand,
  // call NextAuth update(), etc.) before the retry fires.
  options.onTokenRefreshed?.(newTokens);

  // Retry original request once with the fresh access token.
  // _isRetry=true prevents any further refresh attempts on this call chain.
  return apiFetch<T>(path, {
    ...options,
    accessToken: newTokens.accessToken,
    refreshToken: newTokens.refreshToken,
    _isRetry: true,
  });
}

function normalizePath(path: string): string {
  if (path.startsWith('/api/v1/')) return path;
  if (path.startsWith('/api/')) return path;
  return `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function withCurrency(path: string, currency: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}currency=${encodeURIComponent(currency)}`;
}

/**
 * Convenience re-export so RSC callers can import both the fetch wrapper
 * and the redirect utilities from one place.
 */
export { AuthRedirectError, buildLoginUrl };
