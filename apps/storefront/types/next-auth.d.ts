import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    error?: 'AccessTokenExpired';
    user: {
      id?: string;
      role?: 'customer' | 'admin';
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    role?: 'customer' | 'admin';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    userId?: string;
    role?: 'customer' | 'admin';
    error?: 'AccessTokenExpired';
  }
}
