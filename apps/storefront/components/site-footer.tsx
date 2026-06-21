import Link from 'next/link';
import { Github } from 'lucide-react';
import { BrandMark } from './brand-mark';

const COLUMNS = [
  {
    heading: 'Shop',
    links: [
      { href: '/products', label: 'All products' },
      { href: '/search', label: 'Search catalog' },
      { href: '/cart', label: 'View cart' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/login', label: 'Sign in' },
      { href: '/register', label: 'Create account' },
      { href: '/orders', label: 'Your orders' },
    ],
  },
  {
    heading: 'About',
    links: [
      { href: '/', label: 'Home' },
      { href: '/account', label: 'Profile' },
    ],
  },
] as const;

export function SiteFooter(): JSX.Element {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-bg">
      <div className="container py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_3fr]">
          <div className="space-y-4">
            <BrandMark />
            <p className="max-w-sm text-sm leading-relaxed text-muted-fg">
              Considered objects from makers we trust — curated drops,
              multi-currency checkout, free shipping over&nbsp;$50.
            </p>
            <a
              href="https://github.com/jcool10"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-fg transition-colors hover:text-fg"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
          <nav className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.heading}>
                <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
                  {column.heading}
                </h3>
                <ul className="space-y-2.5 text-sm">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={{ pathname: link.href }}
                        className="text-fg/80 transition-colors hover:text-accent-500"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-fg">
          <p>© {year} jCool. All rights reserved.</p>
          <p className="font-mono text-[11px] uppercase tracking-widest">
            Secure checkout · Free shipping $50+ · 30-day returns
          </p>
        </div>
      </div>
    </footer>
  );
}
