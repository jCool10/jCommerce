/**
 * Resolves the recipient email for a user. The auth-service lookup isn't wired
 * up yet so the current adapter synthesises a dev address; the interface keeps
 * one clean seam to swap in the real one later.
 */
export interface UserEmailResolver {
  resolveUserEmail(userId: string): Promise<string>;
}

export const USER_EMAIL_RESOLVER = Symbol('USER_EMAIL_RESOLVER');
