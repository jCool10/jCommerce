type MethodMatcher = '*' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Rule {
  readonly method: MethodMatcher;
  /** Exact path or a path ending with `/*` to match any descendant. */
  readonly path: string;
}

const PUBLIC_RULES: readonly Rule[] = [
  { method: '*', path: '/api/v1/auth/register' },
  { method: '*', path: '/api/v1/auth/login' },
  { method: '*', path: '/api/v1/auth/refresh' },
  { method: 'GET', path: '/api/v1/products' },
  { method: 'GET', path: '/api/v1/products/*' },
  { method: 'GET', path: '/api/v1/search' },
  { method: 'GET', path: '/api/v1/search/*' },
];

/**
 * Returns true when the (method, path) pair is reachable without a Bearer JWT.
 * Used by the global JwtAuthGuard to skip verification.
 *
 * Path is normalized first: percent-decoded then traversal/double-slash
 * rejected. `/api/v1/products/../orders` would otherwise match `products/*`
 * and bypass auth before Express ever resolves the URL.
 */
export function isPublicRoute(method: string, fullPath: string): boolean {
  const normalizedMethod = method.toUpperCase();
  const path = normalize(fullPath);
  if (path == null) return false;
  for (const rule of PUBLIC_RULES) {
    if (rule.method !== '*' && rule.method !== normalizedMethod) continue;
    if (matchPath(rule.path, path)) return true;
  }
  return false;
}

function normalize(fullPath: string): string | null {
  const noQuery = fullPath.split('?')[0] ?? '';
  let decoded: string;
  try {
    decoded = decodeURIComponent(noQuery);
  } catch {
    return null;
  }
  if (decoded.includes('..') || decoded.includes('//') || decoded.includes('\\')) {
    return null;
  }
  return decoded;
}

function matchPath(rule: string, actual: string): boolean {
  if (rule.endsWith('/*')) {
    const prefix = rule.slice(0, -1); // keep trailing slash
    return actual.startsWith(prefix);
  }
  return rule === actual;
}
