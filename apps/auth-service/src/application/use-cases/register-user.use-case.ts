import { err, ok, type Result } from '../../domain/common/result.js';
import type { AuthError } from '../../domain/auth-error.js';
import type { User } from '../../domain/user.entity.js';
import type { UserRepository } from '../../domain/ports/user.repository.js';
import type { UserRole } from '../../domain/user-role.js';
import type { PasswordHasher } from '../ports/password-hasher.port.js';
import type { SignedTokenPair, TokenSigner } from '../ports/token-signer.port.js';
import type { EventPublisher } from '../ports/event-publisher.port.js';

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface RegisterUserSuccess {
  user: User;
  tokens: SignedTokenPair;
}

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly signer: TokenSigner,
    private readonly events: EventPublisher,
  ) {}

  async execute(
    input: RegisterUserInput,
  ): Promise<Result<RegisterUserSuccess, AuthError>> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.users.findByEmail(email);
    if (existing) return err({ kind: 'EMAIL_ALREADY_REGISTERED' });

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      email,
      name: input.name,
      role: input.role ?? 'customer',
      provider: 'credentials',
      passwordHash,
    });

    const tokens = await this.signer.signTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    await this.events.publish('user.registered.v1', {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      provider: user.provider,
      occurredAt: user.createdAt.toISOString(),
    });

    return ok({ user, tokens });
  }
}
