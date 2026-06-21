'use client';

import { Breadcrumbs } from './breadcrumbs';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export function Topbar(): React.JSX.Element {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
