import { describe, expect, it } from 'vitest';
import { RegisterUserUseCase } from '../../../src/application/use-cases/register-user.use-case.js';
import { InMemoryUserRepository } from '../../fakes/in-memory-user.repository.js';
import { FakePasswordHasher } from '../../fakes/fake-password-hasher.js';
import { FakeTokenSigner } from '../../fakes/fake-token-signer.js';
import { FakeEventPublisher } from '../../fakes/fake-event-publisher.js';
import { isErr, isOk } from '../../../src/domain/common/result.js';

const makeSut = () => {
  const users = new InMemoryUserRepository();
  const hasher = new FakePasswordHasher();
  const signer = new FakeTokenSigner();
  const events = new FakeEventPublisher();
  const sut = new RegisterUserUseCase(users, hasher, signer, events);
  return { sut, users, hasher, signer, events };
};

describe('RegisterUserUseCase', () => {
  it('creates a customer, hashes password, issues tokens, publishes event', async () => {
    const { sut, users, events } = makeSut();

    const result = await sut.execute({
      email: 'Alice@Example.COM',
      password: 'super-secret-pw',
      name: 'Alice',
    });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.tokens.accessToken).toMatch(/^access::/);
    expect(result.value.tokens.refreshToken).toMatch(/^refresh::/);
    expect(result.value.user.role).toBe('customer');
    expect(result.value.user.email).toBe('alice@example.com'); // lowercased

    const saved = await users.findByEmail('alice@example.com');
    expect(saved).not.toBeNull();
    expect(saved?.passwordHash).toBe('hashed::super-secret-pw');
    expect(saved?.provider).toBe('credentials');
    expect(events.published).toHaveLength(1);
    expect(events.published[0]?.routingKey).toBe('user.registered.v1');
  });

  it('rejects duplicate email (case-insensitive)', async () => {
    const { sut } = makeSut();
    await sut.execute({ email: 'a@b.com', password: 'pwpwpwpw', name: 'A' });
    const dup = await sut.execute({
      email: 'A@B.COM',
      password: 'pwpwpwpw',
      name: 'A',
    });
    expect(isErr(dup)).toBe(true);
    if (isErr(dup)) expect(dup.error.kind).toBe('EMAIL_ALREADY_REGISTERED');
  });
});
