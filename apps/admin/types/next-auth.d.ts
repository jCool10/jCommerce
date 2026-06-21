import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: 'admin' | 'customer';
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'customer';
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    email: string;
    name: string;
    role: 'admin' | 'customer';
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: number;
  }
}
