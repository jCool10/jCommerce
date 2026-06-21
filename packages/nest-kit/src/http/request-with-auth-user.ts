/**
 * Minimal request shape the shared guards read. Each service's own auth guard
 * attaches the full `authUser` (its service-local claims type); the shared
 * guards only need the role to make an authorization decision, so they stay
 * decoupled from any service's domain claims type.
 */
export interface RequestWithAuthUser {
  authUser?: { role?: string };
}
