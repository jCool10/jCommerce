import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { LoginInputSchema } from '@jcool/contracts';

const GATEWAY = process.env.GATEWAY_INTERNAL_URL ?? 'http://localhost:3000/api/v1';

type LoginResponse = {
  user: { id: string; email: string; name: string; role: 'admin' | 'customer' };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
};

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = LoginInputSchema.safeParse(raw);
        if (!parsed.success) return null;

        const res = await fetch(`${GATEWAY}/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) return null;

        const data = (await res.json()) as LoginResponse;
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
          accessExpiresAt: Date.now() + data.tokens.expiresIn * 1000,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessExpiresAt = user.accessExpiresAt;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user = {
        ...session.user,
        id: token.userId as string,
        email: (token.email as string) ?? '',
        name: (token.name as string) ?? '',
        role: token.role as 'admin' | 'customer',
      };
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isAdmin = auth?.user?.role === 'admin';
      const { pathname } = request.nextUrl;

      if (pathname.startsWith('/login')) return true;

      if (!isLoggedIn) return false;
      // Logged-in but not admin → block. Middleware redirects.
      return isAdmin;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
