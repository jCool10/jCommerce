import type { AuthProvider } from './auth-provider.js';
import type { UserRole } from './user-role.js';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  provider: AuthProvider;
  passwordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewUser {
  email: string;
  name: string;
  role: UserRole;
  provider: AuthProvider;
  passwordHash: string | null;
}
