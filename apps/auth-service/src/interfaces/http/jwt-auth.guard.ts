import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  TOKEN_SIGNER,
  type AccessTokenClaims,
  type TokenSigner,
} from '../../application/ports/token-signer.port.js';

export interface AuthenticatedRequest extends Request {
  authUser: AccessTokenClaims;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_SIGNER) private readonly signer: TokenSigner) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'MISSING_BEARER', message: 'Missing token' });
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      const claims = await this.signer.verifyAccess(token);
      req.authUser = claims;
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Invalid token' });
    }
  }
}
