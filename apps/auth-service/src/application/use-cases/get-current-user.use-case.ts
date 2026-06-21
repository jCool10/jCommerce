import { err, ok, type Result } from '../../domain/common/result.js';
import type { AuthError } from '../../domain/auth-error.js';
import type { User } from '../../domain/user.entity.js';
import type { UserRepository } from '../../domain/ports/user.repository.js';

export interface GetCurrentUserInput {
  userId: string;
}

export class GetCurrentUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: GetCurrentUserInput): Promise<Result<User, AuthError>> {
    const user = await this.users.findById(input.userId);
    if (!user) return err({ kind: 'USER_NOT_FOUND' });
    return ok(user);
  }
}
