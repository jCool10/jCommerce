import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtVerifierService, type VerifiedClaims } from './jwt-verifier.service.js';
import { isPublicRoute } from './public-route-matcher.js';

export interface AuthenticatedRequest extends Request {
  authUser?: VerifiedClaims;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly verifier: JwtVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (isPublicRoute(req.method, req.originalUrl ?? req.url)) {
      return true;
    }
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'MISSING_BEARER', message: 'Missing token' });
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      req.authUser = await this.verifier.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Invalid token' });
    }
  }
}
