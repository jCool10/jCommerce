import type { RefreshTokenBlocklistRepository } from '../../src/domain/ports/refresh-token-blocklist.repository.js';

export class InMemoryRefreshTokenBlocklist implements RefreshTokenBlocklistRepository {
  private readonly blocked = new Set<string>();
  private readonly userRevokedAt = new Map<string, number>();

  async block(jti: string, _expiresAtEpochSeconds: number): Promise<void> {
    this.blocked.add(jti);
  }

  async isBlocked(jti: string): Promise<boolean> {
    return this.blocked.has(jti);
  }

  async blockAllForUser(userId: string, _expiresAtEpochSeconds: number): Promise<void> {
    this.userRevokedAt.set(userId, Math.floor(Date.now() / 1000));
  }

  async isUserSessionRevoked(userId: string): Promise<boolean> {
    return this.userRevokedAt.has(userId);
  }
}
