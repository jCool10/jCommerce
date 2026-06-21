import { describe, expect, it, beforeAll } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JoseTokenSigner } from '../../src/infrastructure/crypto/jose-token-signer.adapter.js';

const buildSigner = async (): Promise<JoseTokenSigner> => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const pubPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const cfg = new ConfigService({
    JWT_PRIVATE_KEY_B64: Buffer.from(privPem).toString('base64'),
    JWT_PUBLIC_KEY_B64: Buffer.from(pubPem).toString('base64'),
    JWT_ACCESS_TTL_SECONDS: '900',
    JWT_REFRESH_TTL_SECONDS: '604800',
    JWT_ISSUER: 'jcool-auth',
    JWT_AUDIENCE: 'jcool-clients',
  });
  const signer = new JoseTokenSigner(cfg);
  await signer.onModuleInit();
  return signer;
};

describe('JoseTokenSigner (typ discriminator)', () => {
  let signer: JoseTokenSigner;
  beforeAll(async () => {
    signer = await buildSigner();
  });

  it('round-trips an access token', async () => {
    const pair = await signer.signTokenPair({
      sub: 'u1',
      email: 'u1@x.com',
      role: 'customer',
    });
    const claims = await signer.verifyAccess(pair.accessToken);
    expect(claims.sub).toBe('u1');
    expect(claims.role).toBe('customer');
  });

  it('round-trips a refresh token', async () => {
    const pair = await signer.signTokenPair({
      sub: 'u2',
      email: 'u2@x.com',
      role: 'admin',
    });
    const refresh = await signer.verifyRefresh(pair.refreshToken);
    expect(refresh.sub).toBe('u2');
    expect(refresh.jti).toBeTruthy();
  });

  it('rejects a refresh token presented as access (privilege confusion guard)', async () => {
    const pair = await signer.signTokenPair({
      sub: 'u3',
      email: 'u3@x.com',
      role: 'customer',
    });
    await expect(signer.verifyAccess(pair.refreshToken)).rejects.toThrow();
  });

  it('rejects an access token presented as refresh', async () => {
    const pair = await signer.signTokenPair({
      sub: 'u4',
      email: 'u4@x.com',
      role: 'customer',
    });
    await expect(signer.verifyRefresh(pair.accessToken)).rejects.toThrow();
  });
});
