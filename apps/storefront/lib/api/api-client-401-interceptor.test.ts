/**
 * Unit tests for the 401 / AccessTokenExpired interceptor in apiFetch.
 *
 * Strategy: stub global `fetch` per test so we can control exactly which
 * responses the interceptor sees, then assert on thrown error types and
 * retry counts — no real network traffic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError, AuthRedirectError } from '../api-client';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeJsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function make401(): Response {
  return makeJsonResponse(401, {
    statusCode: 401,
    error: 'Unauthorized',
    message: 'Access token expired',
  });
}

function makeOk<T>(body: T): Response {
  return makeJsonResponse(200, body);
}

function makeRefreshOk(): Response {
  return makeJsonResponse(200, {
    tokens: {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 900,
    },
  });
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('apiFetch — 401 interceptor', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes through 200 responses without touching refresh', async () => {
    fetchSpy.mockResolvedValueOnce(makeOk({ id: '1' }));

    const result = await apiFetch<{ id: string }>('/products/1', {
      accessToken: 'valid-token',
    });

    expect(result).toEqual({ id: '1' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError on non-401 server errors without attempting refresh', async () => {
    fetchSpy.mockResolvedValueOnce(
      makeJsonResponse(500, { statusCode: 500, error: 'InternalServerError', message: 'boom' }),
    );

    await expect(
      apiFetch('/orders', { accessToken: 'tok', refreshToken: 'ref' }),
    ).rejects.toThrow(ApiError);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError on 401 when no refreshToken is provided (no retry)', async () => {
    fetchSpy.mockResolvedValueOnce(make401());

    await expect(apiFetch('/orders', { accessToken: 'expired' })).rejects.toThrow(ApiError);
    // Only one fetch — no refresh attempted because refreshToken is absent.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries original request after successful token refresh', async () => {
    const onTokenRefreshed = vi.fn();

    fetchSpy
      .mockResolvedValueOnce(make401())           // 1st: original request → 401
      .mockResolvedValueOnce(makeRefreshOk())     // 2nd: refresh → 200 + new tokens
      .mockResolvedValueOnce(makeOk({ id: '7' })); // 3rd: retry with new token → 200

    const result = await apiFetch<{ id: string }>('/orders/7', {
      accessToken: 'expired-access',
      refreshToken: 'valid-refresh',
      onTokenRefreshed,
    });

    expect(result).toEqual({ id: '7' });
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // Callback must be invoked with the new token set before the retry fires.
    expect(onTokenRefreshed).toHaveBeenCalledOnce();
    expect(onTokenRefreshed).toHaveBeenCalledWith({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 900,
    });

    // The retry must carry the fresh access token in the Authorization header.
    const retryCall = fetchSpy.mock.calls[2]!;
    expect((retryCall[1] as RequestInit).headers).toMatchObject({
      authorization: 'Bearer new-access-token',
    });
  });

  it('throws AuthRedirectError when refresh also returns 401 — no further retry', async () => {
    fetchSpy
      .mockResolvedValueOnce(make401())   // original request → 401
      .mockResolvedValueOnce(make401());  // refresh → 401 (refresh token expired)

    await expect(
      apiFetch('/checkout', {
        accessToken: 'expired-access',
        refreshToken: 'expired-refresh',
        returnTo: '/checkout',
      }),
    ).rejects.toThrow(AuthRedirectError);

    // Exactly two fetch calls: original + refresh attempt. No third retry.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('AuthRedirectError carries the correct loginUrl with returnTo', async () => {
    fetchSpy
      .mockResolvedValueOnce(make401())
      .mockResolvedValueOnce(make401());

    let caught: AuthRedirectError | undefined;
    try {
      await apiFetch('/cart', {
        accessToken: 'expired',
        refreshToken: 'also-expired',
        returnTo: '/cart',
      });
    } catch (err) {
      if (err instanceof AuthRedirectError) caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught?.loginUrl).toBe('/login?returnTo=%2Fcart');
  });

  it('does not retry a second time if the retried request also returns 401 (_isRetry guard)', async () => {
    fetchSpy
      .mockResolvedValueOnce(make401())    // original → 401
      .mockResolvedValueOnce(makeRefreshOk()) // refresh → ok
      .mockResolvedValueOnce(make401());   // retry → 401 again

    // The retried request gets a 401 but _isRetry=true prevents another refresh
    // loop; it should fall through to a plain ApiError, not recurse.
    await expect(
      apiFetch('/orders', {
        accessToken: 'expired',
        refreshToken: 'valid-refresh',
        returnTo: '/orders',
      }),
    ).rejects.toThrow(ApiError);

    // original + refresh + retry = 3 total, no 4th call.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('throws AuthRedirectError when refresh call itself throws a network error', async () => {
    fetchSpy
      .mockResolvedValueOnce(make401())              // original → 401
      .mockRejectedValueOnce(new Error('network')); // refresh → network failure

    await expect(
      apiFetch('/account', {
        accessToken: 'expired',
        refreshToken: 'valid-refresh',
        returnTo: '/account',
      }),
    ).rejects.toThrow(AuthRedirectError);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
