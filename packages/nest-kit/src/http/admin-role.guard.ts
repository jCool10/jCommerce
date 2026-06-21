import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { RequestWithAuthUser } from './request-with-auth-user.js';

/**
 * Rejects requests whose authenticated user is not an admin. Must run AFTER a
 * guard that populates `req.authUser` (e.g. each service's JwtAuthGuard):
 * `@UseGuards(JwtAuthGuard, AdminRoleGuard)`.
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithAuthUser>();
    if (req.authUser?.role !== 'admin') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Admin role required',
      });
    }
    return true;
  }
}
