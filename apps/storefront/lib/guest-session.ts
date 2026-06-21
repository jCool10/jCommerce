'use client';

// Stable UUIDv4 per browser; mirrors the order-service `X-Guest-Session` contract.
// Cookie + localStorage dual-write so the server-side proxy can read it without
// a separate roundtrip when we move cart hydration to the server later.
const STORAGE_KEY = 'jcool.guest-session';
const COOKIE_KEY = 'jcool_guest_session';
const ONE_YEAR_S = 60 * 60 * 24 * 365;

export function getOrCreateGuestSession(): string {
  if (typeof window === 'undefined') return '';
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing && isUuid(existing)) return existing;
  const fresh = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, fresh);
  document.cookie = `${COOKIE_KEY}=${fresh}; path=/; max-age=${ONE_YEAR_S}; SameSite=Lax`;
  return fresh;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
