import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authApi } from './api/auth';
import { ApiError } from './api-client';

// Session/JWT module augmentation lives in /types/next-auth.d.ts so the
// module-resolution rules pick it up before NextAuth's own types load.

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!email || !password) return null;
        try {
          const result = await authApi.login({ email, password }, { server: true });
          return {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            // Stash backend tokens on the user object — `jwt` callback below
            // copies them into the JWT (NextAuth user object is the only
            // bridge between `authorize` and `jwt`).
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
            accessTokenExpiresAt: Date.now() + result.tokens.expiresIn * 1000,
            role: result.user.role,
          };
        } catch (error) {
          if (error instanceof ApiError) return null;
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // First sign-in — copy backend identity onto the JWT.
      if (user) {
        const u = user as {
          id?: string;
          accessToken?: string;
          refreshToken?: string;
          accessTokenExpiresAt?: number;
          role?: 'customer' | 'admin';
        };
        token.userId = u.id;
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
        token.accessTokenExpiresAt = u.accessTokenExpiresAt;
        token.role = u.role;
        return token;
      }

      // Token still valid (60s safety window) — keep using it.
      if (
        token.accessTokenExpiresAt &&
        Date.now() < token.accessTokenExpiresAt - 60_000
      ) {
        return token;
      }

      // Try silent refresh against auth-service; on failure mark the session
      // expired so the client can redirect to /login.
      if (token.refreshToken) {
        try {
          const refreshed = await authApi.refresh(token.refreshToken, { server: true });
          token.accessToken = refreshed.tokens.accessToken;
          token.accessTokenExpiresAt = Date.now() + refreshed.tokens.expiresIn * 1000;
          delete token.error;
          return token;
        } catch {
          token.error = 'AccessTokenExpired';
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      if (token.userId) session.user.id = token.userId;
      session.user.role = token.role;
      session.error = token.error;
      return session;
    },
  },
});
