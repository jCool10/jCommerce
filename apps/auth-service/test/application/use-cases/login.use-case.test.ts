import { describe, expect, it } from 'vitest';
import { LoginUseCase } from '../../../src/application/use-cases/login.use-case.js';
import { InMemoryUserRepository } from '../../fakes/in-memory-user.repository.js';
import { FakePasswordHasher } from '../../fakes/fake-password-hasher.js';
import { FakeTokenSigner } from '../../fakes/fake-token-signer.js';
import { isErr, isOk } from '../../../src/domain/common/result.js';

const seedUser = async (users: InMemoryUserRepository, hasher: FakePasswordHasher) => {
  return users.create({
    email: 'bob@example.com',
    name: 'Bob',
    role: 'customer',
    provider: 'credentials',
    passwordHash: await hasher.hash('correct-password'),
  });
};

describe('LoginUseCase', () => {
  it('issues tokens for valid credentials', async () => {
    const users = new InMemoryUserRepository();
    const hasher = new FakePasswordHasher();
    const signer = new FakeTokenSigner();
    const sut = new LoginUseCase(users, hasher, signer);
    const bob = await seedUser(users, hasher);

    const result = await sut.execute({
      email: 'BOB@example.com',
      password: 'correct-password',
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.user.id).toBe(bob.id);
    expect(result.value.tokens.accessToken).toMatch(/^access::/);
  });

  it('rejects unknown email', async () => {
    const sut = new LoginUseCase(
      new InMemoryUserRepository(),
      new FakePasswordHasher(),
      new FakeTokenSigner(),
    );
    const res = await sut.execute({ email: 'nobody@x.com', password: 'whatever' });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.kind).toBe('INVALID_CREDENTIALS');
  });

  it('rejects wrong password (does not reveal which is wrong)', async () => {
    const users = new InMemoryUserRepository();
    const hasher = new FakePasswordHasher();
    await seedUser(users, hasher);
    const sut = new LoginUseCase(users, hasher, new FakeTokenSigner());
    const res = await sut.execute({ email: 'bob@example.com', password: 'wrong' });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.kind).toBe('INVALID_CREDENTIALS');
  });

  it('rejects accounts with null password hash (no-password accounts)', async () => {
    const users = new InMemoryUserRepository();
    await users.create({
      email: 'nopw@example.com',
      name: 'No PW User',
      role: 'customer',
      provider: 'credentials',
      passwordHash: null,
    });
    const sut = new LoginUseCase(users, new FakePasswordHasher(), new FakeTokenSigner());
    const res = await sut.execute({ email: 'nopw@example.com', password: 'anything' });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.kind).toBe('INVALID_CREDENTIALS');
  });
});
