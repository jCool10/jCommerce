/**
 * Minimal stub for `next/navigation` used in Vitest unit tests.
 *
 * The real `redirect()` from Next.js throws a special internal symbol that
 * the Next.js runtime intercepts — it cannot run outside the App Router
 * server environment. This stub makes redirect() observable in tests
 * without requiring a full Next.js runtime.
 */
export class RedirectError extends Error {
  constructor(public readonly destination: string) {
    super(`NEXT_REDIRECT:${destination}`);
    this.name = 'RedirectError';
  }
}

export function redirect(destination: string): never {
  throw new RedirectError(destination);
}

export function useRouter() {
  return { push: () => undefined, replace: () => undefined };
}

export function usePathname() {
  return '/';
}
