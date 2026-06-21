import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Nunito_Sans, Rubik } from 'next/font/google';
import { Providers } from './providers';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import './globals.css';

// Swiss Modernism pairing — Rubik for tight, slightly geometric display headings;
// Nunito Sans for readable UI body. Both Google Fonts, swap to avoid FOIT.
const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const rubik = Rubik({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100'),
  title: {
    default: 'jCool — Considered objects',
    template: '%s · jCool',
  },
  description:
    'Considered objects from makers we trust — curated drops, multi-currency checkout, free shipping over $50.',
  openGraph: {
    title: 'jCool — Considered objects',
    description:
      'Considered objects from makers we trust — curated drops, multi-currency checkout, free shipping over $50.',
    type: 'website',
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html
      lang="en"
      className={`${nunitoSans.variable} ${rubik.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col bg-bg text-fg">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
