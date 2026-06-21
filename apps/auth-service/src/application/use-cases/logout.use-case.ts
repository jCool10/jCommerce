import { ok, type Result } from '../../domain/common/result.js';
import type { AuthError } from '../../domain/auth-error.js';
import type { RefreshTokenBlocklistRepository } from '../../domain/ports/refresh-token-blocklist.repository.js';
import type { TokenSigner } from '../ports/token-signer.port.js';

export interface LogoutInput {
  refreshToken: string;
}

export class LogoutUseCase {
  constructor(
    private readonly signer: TokenSigner,
    private readonly blocklist: RefreshTokenBlocklistRepository,
  ) {}

  /**
   * Idempotent: any input returns ok. An unparseable refresh token cannot be
   * used to obtain access tokens, so logout is a no-op — never an error.
   */
  async execute(input: LogoutInput): Promise<Result<void, AuthError>> {
    try {
      const claims = await this.signer.verifyRefresh(input.refreshToken);
      await this.blocklist.block(claims.jti, claims.expEpochSeconds);
    } catch {
      // swallow — logout is best-effort idempotent
    }
    return ok(undefined);
  }
}
