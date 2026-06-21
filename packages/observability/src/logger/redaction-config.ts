/**
 * Centralized PII / secret redaction paths fed into pino's `redact` option.
 *
 * Conventions:
 *   - `req.body.password`, `req.headers.authorization` → exact field paths
 *     observed via pino-http auto-binding (`req`).
 *   - `*.creditCard`, `*.cvv` → wildcard segments — pino expands these for
 *     arbitrary object nesting up to one level.
 *   - Email is partially masked (`j***@example.com`) instead of fully redacted
 *     so that operational debugging still has a usable identifier while not
 *     leaking the address. Implemented via a censor function.
 */

const REDACTED = '[Redacted]';

/** Email regex anchored to a full string match. */
const EMAIL_PATTERN = /^([^@\s]+)@([^@\s]+)$/;

/** Mask an email keeping the first character of the local part. */
export function maskEmail(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const match = EMAIL_PATTERN.exec(value);
  if (!match) return REDACTED;
  const local = match[1] ?? '';
  const domain = match[2] ?? '';
  const head = local[0] ?? '*';
  return `${head}***@${domain}`;
}

/** Paths fully replaced with `[Redacted]`. */
export const SECRET_PATHS: string[] = [
  // Auth / session
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  '*.headers.authorization',
  '*.headers.cookie',
  // Credentials in request bodies
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.body.secret',
  'req.body.apiKey',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.refreshToken',
  '*.accessToken',
  '*.secret',
  '*.apiKey',
  '*.token',
  // Payment data
  '*.creditCard',
  '*.cvv',
  '*.cardNumber',
  // Stripe webhook secrets / signing keys
  '*.stripeSecretKey',
  '*.stripeWebhookSecret',
];

/** Paths replaced via the `maskEmail` censor. */
export const EMAIL_PATHS: string[] = ['*.email', 'req.body.email'];

export const REDACTION_REPLACEMENT = REDACTED;
