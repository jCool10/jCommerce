import { err, ok, type Result } from '../../domain/common/result.js';
import type { AuthError } from '../../domain/auth-error.js';
import type { UserRepository } from '../../domain/ports/user.repository.js';
import type { RefreshTokenBlocklistRepository } from '../../domain/ports/refresh-token-blocklist.repository.js';
import type { SignedTokenPair, TokenSigner } from '../ports/token-signer.port.js';

export interface RefreshTokensInput {
  refreshToken: string;
}

export interface RefreshTokensSuccess {
  tokens: SignedTokenPair;
}

export class RefreshTokensUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly signer: TokenSigner,
    private readonly blocklist: RefreshTokenBlocklistRepository,
  ) {}

  async execute(
    input: RefreshTokensInput,
  ): Promise<Result<RefreshTokensSuccess, AuthError>> {
    let claims: { sub: string; jti: string; expEpochSeconds: number };
    try {
      claims = await this.signer.verifyRefresh(input.refreshToken);
    } catch {
      return err({ kind: 'REFRESH_TOKEN_INVALID' });
    }

    if (await this.blocklist.isUserSessionRevoked(claims.sub)) {
      return err({ kind: 'REFRESH_TOKEN_REVOKED' });
    }

    if (await this.blocklist.isBlocked(claims.jti)) {
      // Reuse detected: invalidate every refresh token issued to this user.
      await this.blocklist.blockAllForUser(claims.sub, claims.expEpochSeconds);
      return err({ kind: 'REFRESH_TOKEN_REVOKED' });
    }

    const user = await this.users.findById(claims.sub);
    if (!user) return err({ kind: 'REFRESH_TOKEN_INVALID' });

    // Rotation: blocklist the old jti before signing a new pair.
    await this.blocklist.block(claims.jti, claims.expEpochSeconds);

    const tokens = await this.signer.signTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return ok({ tokens });
  }
}
