import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importSPKI, jwtVerify, type KeyLike } from 'jose';

export interface VerifiedClaims {
  sub: string;
  email: string;
  role: 'customer' | 'admin';
  iat: number;
  exp: number;
}

/**
 * Verifies access tokens issued by auth-service using its RS256 public key
 * (AUTH_PUBLIC_KEY_B64). Same logic lives in catalog-service — worth pulling
 * into a shared package once a third service needs it.
 */
@Injectable()
export class JwtVerifier implements OnModuleInit {
  private readonly logger = new Logger(JwtVerifier.name);
  private publicKey: KeyLike | null = null;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(private readonly config: ConfigService) {
    this.issuer = config.get<string>('JWT_ISSUER') ?? 'jcool-auth';
    this.audience = config.get<string>('JWT_AUDIENCE') ?? 'jcool-clients';
  }

  async onModuleInit(): Promise<void> {
    const b64 = this.config.get<string>('AUTH_PUBLIC_KEY_B64');
    if (!b64) {
      this.logger.warn(
        'AUTH_PUBLIC_KEY_B64 is not set — JWT verification will fail until configured',
      );
      return;
    }
    const pem = Buffer.from(b64, 'base64').toString('utf8');
    this.publicKey = await importSPKI(pem, 'RS256');
  }

  async verify(token: string): Promise<VerifiedClaims> {
    if (!this.publicKey) {
      throw new Error('AUTH_PUBLIC_KEY_B64 not configured');
    }
    // Pin iss/aud — defense-in-depth against tokens signed by an unrelated
    // RS256 key/issuer that happens to be configured here.
    const { payload } = await jwtVerify(token, this.publicKey, {
      algorithms: ['RS256'],
      issuer: this.issuer,
      audience: this.audience,
    });
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      (payload.role !== 'customer' && payload.role !== 'admin') ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      throw new Error('Invalid token payload shape');
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
