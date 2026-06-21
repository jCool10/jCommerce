import { describe, expect, it } from 'vitest';
import { RefreshTokensUseCase } from '../../../src/application/use-cases/refresh-tokens.use-case.js';
import { InMemoryUserRepository } from '../../fakes/in-memory-user.repository.js';
import { InMemoryRefreshTokenBlocklist } from '../../fakes/in-memory-refresh-token-blocklist.js';
import { FakeTokenSigner } from '../../fakes/fake-token-signer.js';
import { isErr, isOk } from '../../../src/domain/common/result.js';

const setup = async () => {
  const users = new InMemoryUserRepository();
  const blocklist = new InMemoryRefreshTokenBlocklist();
  const signer = new FakeTokenSigner();
  const user = await users.create({
    email: 'eve@example.com',
    name: 'Eve',
    role: 'customer',
    provider: 'credentials',
    passwordHash: 'irrelevant',
  });
  const initial = await signer.signTokenPair({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  const sut = new RefreshTokensUseCase(users, signer, blocklist);
  return { sut, users, signer, blocklist, user, initial };
};

describe('RefreshTokensUseCase', () => {
  it('rotates: returns new pair, old refresh added to blocklist', async () => {
    const { sut, initial, blocklist } = await setup();
    const res = await sut.execute({ refreshToken: initial.refreshToken });
    expect(isOk(res)).toBe(true);
    if (!isOk(res)) return;
    expect(res.value.tokens.refreshToken).not.toBe(initial.refreshToken);
    expect(await blocklist.isBlocked(initial.refreshJti)).toBe(true);
  });

  it('reuse of a blocked refresh token triggers full session revoke', async () => {
    const { sut, initial, blocklist, user } = await setup();

    // First rotate — consumes initial token.
    await sut.execute({ refreshToken: initial.refreshToken });

    // Replay attack: client (or attacker) re-uses the now-blocked token.
    const replay = await sut.execute({ refreshToken: initial.refreshToken });
    expect(isErr(replay)).toBe(true);
    if (isErr(replay)) expect(replay.error.kind).toBe('REFRESH_TOKEN_REVOKED');

    // Whole user session revoked.
    expect(await blocklist.isUserSessionRevoked(user.id)).toBe(true);
  });

  it('rejects refresh after session was revoked', async () => {
    const { sut, signer, blocklist, user } = await setup();
    // Some fresh, never-blocklisted token — but user session is already revoked.
    const fresh = await signer.signTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    await blocklist.blockAllForUser(user.id, Math.floor(Date.now() / 1000) + 1000);

    const res = await sut.execute({ refreshToken: fresh.refreshToken });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.kind).toBe('REFRESH_TOKEN_REVOKED');
  });

  it('rejects malformed / unknown refresh token', async () => {
    const { sut } = await setup();
    const res = await sut.execute({ refreshToken: 'bogus' });
    expect(isErr(res)).toBe(true);
    if (isErr(res)) expect(res.error.kind).toBe('REFRESH_TOKEN_INVALID');
  });
});
