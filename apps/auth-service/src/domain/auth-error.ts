export type AuthError =
  | { kind: 'EMAIL_ALREADY_REGISTERED' }
  | { kind: 'INVALID_CREDENTIALS' }
  | { kind: 'USER_NOT_FOUND' }
  | { kind: 'REFRESH_TOKEN_INVALID' }
  | { kind: 'REFRESH_TOKEN_REVOKED' }
  | { kind: 'WEAK_PASSWORD' };
