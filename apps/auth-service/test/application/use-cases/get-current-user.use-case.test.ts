import { describe, expect, it } from 'vitest';
import { GetCurrentUserUseCase } from '../../../src/application/use-cases/get-current-user.use-case.js';
import { InMemoryUserRepository } from '../../fakes/in-memory-user.repository.js';
import { isErr, isOk } from '../../../src/domain/common/result.js';

describe('GetCurrentUserUseCase', () => {
  it('returns user when id exists', async () => {
    const users = new InMemoryUserRepository();
    const u = await users.create({
      email: 'me@x.com',
      name: 'Me',
      role: 'customer',
      provider: 'credentials',
      passwordHash: 'hashed::x',
    });
    const sut = new GetCurrentUserUseCase(users);
    const res = await sut.execute({ userId: u.id });
    expect(isOk(res)).toBe(true);
    if (isOk(res)) expect(res.value.email).toBe('me@x.com');
  });

  it('returns USER_NOT_FOUND when id is unknown', async () => {
    const sut = new GetCurrentUserUseCase(new InMemoryUserRepository());
    const res = await sut.execute({ userId: 'missing' });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.kind).toBe('USER_NOT_FOUND');
  });
});
