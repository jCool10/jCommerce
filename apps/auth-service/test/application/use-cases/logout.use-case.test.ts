import { describe, expect, it } from 'vitest';
import { LogoutUseCase } from '../../../src/application/use-cases/logout.use-case.js';
import { InMemoryRefreshTokenBlocklist } from '../../fakes/in-memory-refresh-token-blocklist.js';
import { FakeTokenSigner } from '../../fakes/fake-token-signer.js';
import { isOk } from '../../../src/domain/common/result.js';

describe('LogoutUseCase', () => {
  it('adds refresh-token jti to blocklist', async () => {
    const signer = new FakeTokenSigner();
    const blocklist = new InMemoryRefreshTokenBlocklist();
    const pair = await signer.signTokenPair({
      sub: 'u1',
      email: 'u1@x.com',
      role: 'customer',
    });
    const sut = new LogoutUseCase(signer, blocklist);

    const res = await sut.execute({ refreshToken: pair.refreshToken });
    expect(isOk(res)).toBe(true);
    expect(await blocklist.isBlocked(pair.refreshJti)).toBe(true);
  });

  it('is idempotent on already-blocked token (still returns ok)', async () => {
    const signer = new FakeTokenSigner();
    const blocklist = new InMemoryRefreshTokenBlocklist();
    const pair = await signer.signTokenPair({
      sub: 'u1',
      email: 'u1@x.com',
      role: 'customer',
    });
    const sut = new LogoutUseCase(signer, blocklist);
    await sut.execute({ refreshToken: pair.refreshToken });
    const second = await sut.execute({ refreshToken: pair.refreshToken });
    expect(isOk(second)).toBe(true);
  });

  it('silently accepts garbage tokens (idempotent best-effort)', async () => {
    const sut = new LogoutUseCase(
      new FakeTokenSigner(),
      new InMemoryRefreshTokenBlocklist(),
    );
    const res = await sut.execute({ refreshToken: 'garbage' });
    expect(isOk(res)).toBe(true);
  });
});
