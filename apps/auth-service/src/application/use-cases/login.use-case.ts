import { err, ok, type Result } from '../../domain/common/result.js';
import type { AuthError } from '../../domain/auth-error.js';
import type { User } from '../../domain/user.entity.js';
import type { UserRepository } from '../../domain/ports/user.repository.js';
import type { PasswordHasher } from '../ports/password-hasher.port.js';
import type { SignedTokenPair, TokenSigner } from '../ports/token-signer.port.js';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginSuccess {
  user: User;
  tokens: SignedTokenPair;
}

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly signer: TokenSigner,
  ) {}

  async execute(input: LoginInput): Promise<Result<LoginSuccess, AuthError>> {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);
    // Same error for unknown email + wrong password + OAuth-only account: don't leak account state.
    if (!user || !user.passwordHash) return err({ kind: 'INVALID_CREDENTIALS' });

    const valid = await this.hasher.compare(input.password, user.passwordHash);
    if (!valid) return err({ kind: 'INVALID_CREDENTIALS' });

    const tokens = await this.signer.signTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return ok({ user, tokens });
  }
}
