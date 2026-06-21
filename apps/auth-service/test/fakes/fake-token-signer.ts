import { randomUUID } from 'node:crypto';
import type {
  AccessTokenClaims,
  RefreshTokenClaims,
  SignedTokenPair,
  TokenSigner,
} from '../../src/application/ports/token-signer.port.js';

interface IssuedRefresh {
  claims: RefreshTokenClaims;
  expEpochSeconds: number;
}

export class FakeTokenSigner implements TokenSigner {
  private readonly issued = new Map<string, IssuedRefresh>();
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;

  constructor(accessTtlSeconds = 900, refreshTtlSeconds = 604_800) {
    this.accessTtlSeconds = accessTtlSeconds;
    this.refreshTtlSeconds = refreshTtlSeconds;
  }

  async signTokenPair(claims: AccessTokenClaims): Promise<SignedTokenPair> {
    const jti = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const refreshExp = now + this.refreshTtlSeconds;
    const refreshToken = `refresh::${jti}`;
    this.issued.set(refreshToken, {
      claims: { sub: claims.sub, jti },
      expEpochSeconds: refreshExp,
    });
    return {
      accessToken: `access::${claims.sub}::${claims.role}`,
      refreshToken,
      refreshJti: jti,
      refreshExpiresAtEpochSeconds: refreshExp,
      accessExpiresInSeconds: this.accessTtlSeconds,
    };
  }

  async verifyAccess(token: string): Promise<AccessTokenClaims> {
    const m = /^access::([^:]+)::(customer|admin)$/.exec(token);
    if (!m) throw new Error('invalid access token');
    return { sub: m[1] as string, email: '', role: m[2] as 'customer' | 'admin' };
  }

  async verifyRefresh(
    token: string,
  ): Promise<RefreshTokenClaims & { expEpochSeconds: number }> {
    const rec = this.issued.get(token);
    if (!rec) throw new Error('invalid refresh token');
    return { ...rec.claims, expEpochSeconds: rec.expEpochSeconds };
  }
}
