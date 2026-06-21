'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  orders: 'Orders',
  users: 'Users',
};

function pretty(segment: string): string {
  if (LABELS[segment]) return LABELS[segment];
  if (segment.length > 12 && /^[a-f0-9-]+$/i.test(segment)) return `${segment.slice(0, 8)}…`;
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs(): React.JSX.Element {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const trail = segments.map((seg, idx) => ({
    href: `/${segments.slice(0, idx + 1).join('/')}`,
    label: pretty(seg),
    last: idx === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <Link
        href="/dashboard"
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        jCool
      </Link>
      {trail.map((item) => (
        <span key={item.href} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          {item.last ? (
            <span className="font-medium text-foreground">{item.label}</span>
          ) : (
            <Link
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
