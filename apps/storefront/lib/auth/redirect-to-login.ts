/**
 * Helpers for building a clean re-auth redirect URL.
 *
 * Keeping URL construction here (and not inline in the API client) means
 * both the server-side wrapper and any client hook can produce the exact
 * same destination without duplicating encoding logic.
 */

/** /login?returnTo=<encoded-path> — used by both RSC and client code. */
export function buildLoginUrl(returnTo: string): string {
  // Sanitise: only allow same-origin relative paths to avoid open-redirect.
  const safePath = returnTo.startsWith('/') ? returnTo : '/';
  return `/login?returnTo=${encodeURIComponent(safePath)}`;
}

/**
 * Sentinel error thrown by the server-side fetch wrapper when both the
 * access-token request AND the refresh attempt return 401.
 *
 * RSC callers catch this and call `redirect(buildLoginUrl(returnTo))`, or
 * let the nearest error.tsx boundary handle it.
 */
export class AuthRedirectError extends Error {
  readonly loginUrl: string;
  constructor(returnTo: string) {
    super('Session expired — re-authentication required');
    this.name = 'AuthRedirectError';
    this.loginUrl = buildLoginUrl(returnTo);
  }
}
