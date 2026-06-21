import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  JwtVerifier,
  type VerifiedClaims,
} from '../../infrastructure/auth/jwt-verifier.adapter.js';

export interface AuthenticatedRequest extends Request {
  authUser: VerifiedClaims;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly verifier: JwtVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'MISSING_BEARER', message: 'Missing token' });
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      const claims = await this.verifier.verify(token);
      req.authUser = claims;
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Invalid token' });
    }
  }
}
