import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard.js';
import type { JwtVerifierService, VerifiedClaims } from '../src/modules/auth/jwt-verifier.service.js';

function ctx(method: string, url: string, authHeader?: string): ExecutionContext {
  const req: Record<string, unknown> = { method, originalUrl: url, url, headers: {} };
  if (authHeader) (req.headers as Record<string, string>).authorization = authHeader;
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const claims: VerifiedClaims = {
  sub: 'u_123',
  email: 'a@b.c',
  role: 'customer',
  iat: 0,
  exp: 9999999999,
};

describe('JwtAuthGuard', () => {
  it('lets public route through without token', async () => {
    const verifier = { verify: vi.fn() } as unknown as JwtVerifierService;
    const guard = new JwtAuthGuard(verifier);
    await expect(guard.canActivate(ctx('POST', '/api/v1/auth/login'))).resolves.toBe(true);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('rejects protected route without Bearer header', async () => {
    const verifier = { verify: vi.fn() } as unknown as JwtVerifierService;
    const guard = new JwtAuthGuard(verifier);
    await expect(guard.canActivate(ctx('GET', '/api/v1/orders'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects protected route when verify throws', async () => {
    const verifier = { verify: vi.fn().mockRejectedValue(new Error('bad')) } as unknown as JwtVerifierService;
    const guard = new JwtAuthGuard(verifier);
    await expect(
      guard.canActivate(ctx('GET', '/api/v1/orders', 'Bearer bad')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches authUser when verify succeeds', async () => {
    const verifier = { verify: vi.fn().mockResolvedValue(claims) } as unknown as JwtVerifierService;
    const guard = new JwtAuthGuard(verifier);
    const c = ctx('GET', '/api/v1/orders', 'Bearer ok');
    await expect(guard.canActivate(c)).resolves.toBe(true);
    const req = c.switchToHttp().getRequest() as { authUser?: VerifiedClaims };
    expect(req.authUser).toEqual(claims);
  });
});
