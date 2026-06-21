import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, importPKCS8, importSPKI, jwtVerify, type KeyLike } from 'jose';
import type {
  AccessTokenClaims,
  RefreshTokenClaims,
  SignedTokenPair,
  TokenSigner,
} from '../../application/ports/token-signer.port.js';

const ALG = 'RS256';

@Injectable()
export class JoseTokenSigner implements TokenSigner, OnModuleInit {
  private privateKey!: KeyLike;
  private publicKey!: KeyLike;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(private readonly config: ConfigService) {
    this.accessTtl = Number(config.get<string>('JWT_ACCESS_TTL_SECONDS') ?? '900');
    this.refreshTtl = Number(config.get<string>('JWT_REFRESH_TTL_SECONDS') ?? '604800');
    this.issuer = config.get<string>('JWT_ISSUER') ?? 'jcool-auth';
    this.audience = config.get<string>('JWT_AUDIENCE') ?? 'jcool-clients';
  }

  async onModuleInit(): Promise<void> {
    const privB64 = this.config.get<string>('JWT_PRIVATE_KEY_B64');
    const pubB64 = this.config.get<string>('JWT_PUBLIC_KEY_B64');
    if (!privB64 || !pubB64) {
      throw new Error('JWT_PRIVATE_KEY_B64 and JWT_PUBLIC_KEY_B64 must be set');
    }
    const privPem = Buffer.from(privB64, 'base64').toString('utf8');
    const pubPem = Buffer.from(pubB64, 'base64').toString('utf8');
    this.privateKey = await importPKCS8(privPem, ALG);
    this.publicKey = await importSPKI(pubPem, ALG);
  }

  async signTokenPair(claims: AccessTokenClaims): Promise<SignedTokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const refreshJti = randomUUID();
    const refreshExp = now + this.refreshTtl;

    const accessToken = await new SignJWT({
      tkn: 'access',
      email: claims.email,
      role: claims.role,
    })
      .setProtectedHeader({ alg: ALG, typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuedAt(now)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setExpirationTime(now + this.accessTtl)
      .sign(this.privateKey);

    const refreshToken = await new SignJWT({ tkn: 'refresh' })
      .setProtectedHeader({ alg: ALG, typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuedAt(now)
      .setJti(refreshJti)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setExpirationTime(refreshExp)
      .sign(this.privateKey);

    return {
      accessToken,
      refreshToken,
      refreshJti,
      refreshExpiresAtEpochSeconds: refreshExp,
      accessExpiresInSeconds: this.accessTtl,
    };
  }

  async verifyAccess(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.publicKey, {
      issuer: this.issuer,
      audience: this.audience,
    });
    // Reject refresh tokens presented as access (privilege confusion guard).
    if (payload.tkn !== 'access') throw new Error('not an access token');
    if (payload.role !== 'admin' && payload.role !== 'customer') {
      throw new Error('access token has invalid role');
    }
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ''),
      role: payload.role,
    };
  }

  async verifyRefresh(
    token: string,
  ): Promise<RefreshTokenClaims & { expEpochSeconds: number }> {
    const { payload } = await jwtVerify(token, this.publicKey, {
      issuer: this.issuer,
      audience: this.audience,
    });
    if (payload.tkn !== 'refresh') throw new Error('not a refresh token');
    if (!payload.jti || !payload.exp || !payload.sub) {
      throw new Error('refresh token missing required claims');
    }
    return {
      sub: String(payload.sub),
      jti: String(payload.jti),
      expEpochSeconds: Number(payload.exp),
    };
  }
}
