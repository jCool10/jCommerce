import type { UserRole } from '../../domain/user-role.js';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: UserRole;
}

export interface RefreshTokenClaims {
  sub: string;
  jti: string;
}

export interface SignedTokenPair {
  accessToken: string;
  refreshToken: string;
  refreshJti: string;
  refreshExpiresAtEpochSeconds: number;
  accessExpiresInSeconds: number;
}

export interface TokenSigner {
  signTokenPair(claims: AccessTokenClaims): Promise<SignedTokenPair>;
  verifyAccess(token: string): Promise<AccessTokenClaims>;
  verifyRefresh(token: string): Promise<RefreshTokenClaims & { expEpochSeconds: number }>;
}

export const TOKEN_SIGNER = Symbol('TOKEN_SIGNER');
