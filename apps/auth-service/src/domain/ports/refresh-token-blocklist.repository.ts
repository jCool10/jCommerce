export interface RefreshTokenBlocklistRepository {
  /** Add a refresh-token id (jti) to the blocklist, expiring at the given epoch-seconds. */
  block(jti: string, expiresAtEpochSeconds: number): Promise<void>;
  isBlocked(jti: string): Promise<boolean>;
  /** Block every refresh token for a user (full session revoke when reuse is detected). */
  blockAllForUser(userId: string, expiresAtEpochSeconds: number): Promise<void>;
  isUserSessionRevoked(userId: string): Promise<boolean>;
}

export const REFRESH_TOKEN_BLOCKLIST_REPOSITORY = Symbol(
  'REFRESH_TOKEN_BLOCKLIST_REPOSITORY',
);
