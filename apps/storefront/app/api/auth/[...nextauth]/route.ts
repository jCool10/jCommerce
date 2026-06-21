// NextAuth v5 catch-all route handler — `handlers` exposes the HTTP method
// functions; re-export them so Next.js picks them up as route segment handlers.
import { handlers } from '@/lib/auth-config';

export const { GET, POST } = handlers;
