'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function SignOutButton(): JSX.Element {
  return (
    <Button
      variant="destructive"
      leadingIcon={<LogOut className="h-4 w-4" />}
      onClick={() => void signOut({ callbackUrl: '/' })}
    >
      Sign out
    </Button>
  );
}
