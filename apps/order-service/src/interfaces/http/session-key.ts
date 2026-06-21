import type { Request } from 'express';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';
import { BadRequestException } from '@nestjs/common';

/**
 * Cart sessionKey resolution:
 *   - Authenticated request → `user:{userId}` (from JWT sub claim).
 *   - Anonymous request    → `guest:{anonId}` from `X-Guest-Session` header.
 *
 * The guest id must be a UUIDv4 (storefront sets it as an httpOnly cookie on
 * first visit and echoes it in this header). Validating the shape caps Redis
 * memory pressure and closes a log/key-format injection vector — it does not
 * prove ownership, so don't treat the guest id as authenticated.
 */
const GUEST_HEADER = 'x-guest-session';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const resolveSessionKey = (req: Request): string => {
  const authed = (req as AuthenticatedRequest).authUser;
  if (authed?.sub) return `user:${authed.sub}`;
  const guest = req.headers[GUEST_HEADER];
  if (typeof guest === 'string' && UUID_RE.test(guest)) {
    return `guest:${guest.toLowerCase()}`;
  }
  throw new BadRequestException({
    code: 'MISSING_SESSION',
    message: `Provide ${GUEST_HEADER} header (UUID) or a Bearer token`,
  });
};
