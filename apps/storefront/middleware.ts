import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';

// Protect /checkout, /orders, /orders/:id, /account behind NextAuth.
// Unauthenticated requests are redirected to /login with `callbackUrl` so
// the original destination survives the round-trip.
export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/checkout/:path*', '/orders/:path*', '/account/:path*'],
};
