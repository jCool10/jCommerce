'use client';

import { useSession } from 'next-auth/react';
import { Construction } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Read-only MVP: auth-service does not yet expose an admin "list users" endpoint
// (only GET /auth/me). For now we show the current session user so the page is
// not empty; a future iteration adds GET /auth/users (admin-only).
export default function UsersPage(): React.JSX.Element {
  const { data: session } = useSession();
  const rows = session?.user ? [session.user] : [];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Admin and staff accounts. Listing endpoint coming soon.
        </p>
      </header>

      <Card className="border-dashed bg-warning/5">
        <CardHeader className="flex flex-row items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-warning/15 text-warning">
            <Construction className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">Pending backend endpoint</CardTitle>
            <CardDescription>
              Admin user listing requires <span className="font-mono">GET /auth/users</span> on
              auth-service. Showing the current session user as a placeholder.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </TableHead>
                <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Role
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No active session.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="px-3 py-3">{u.email}</TableCell>
                    <TableCell className="px-3 py-3">{u.name}</TableCell>
                    <TableCell className="px-3 py-3">
                      <Badge variant="info">{u.role}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
