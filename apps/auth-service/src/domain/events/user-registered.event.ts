import type { AuthProvider } from '../auth-provider.js';
import type { UserRole } from '../user-role.js';

export interface UserRegisteredEvent {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  provider: AuthProvider;
  occurredAt: Date;
}
