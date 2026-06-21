import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isAdmin = req.auth?.user?.role === 'admin';
  const onLogin = nextUrl.pathname.startsWith('/login');

  if (onLogin) {
    if (isLoggedIn && isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!isAdmin) {
    // Customers go to the storefront. In dev, fall back to /login with an error flag.
    const storefront = process.env.NEXT_PUBLIC_STOREFRONT_URL;
    if (storefront) return NextResponse.redirect(new URL(storefront));
    const loginUrl = new URL('/login', nextUrl);
    loginUrl.searchParams.set('error', 'forbidden');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
