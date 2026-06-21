'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    params.get('error') === 'forbidden' ? 'Admin role required.' : null,
  );
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await signIn('credentials', { email, password, redirect: false });
    setSubmitting(false);
    if (res?.error) {
      setError('Invalid credentials.');
      return;
    }
    const callbackUrl = params.get('callbackUrl') ?? '/dashboard';
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@jcool.dev"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          'Sign in'
        )}
      </Button>
    </form>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-foreground text-background lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07] bg-grid"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-primary/30 blur-3xl"
        />

        <div className="relative flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <span className="font-mono text-base font-bold">j</span>
          </div>
          <div>
            <p className="text-sm font-semibold">jCool</p>
            <p className="text-[11px] uppercase tracking-wider text-background/60">Admin Console</p>
          </div>
        </div>

        <div className="relative max-w-md space-y-4">
          <p className="text-3xl font-semibold leading-tight tracking-tight">
            Operate the catalog. Watch the orders. Ship calmly.
          </p>
          <p className="text-sm leading-relaxed text-background/70">
            Internal dashboard for the jCool storefront — products, SKUs, inventory, and the
            checkout saga, all in one place.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-3 text-xs">
          {[
            { label: 'Services', value: '6' },
            { label: 'Currencies', value: 'USD · VND' },
            { label: 'Saga steps', value: '10' },
          ].map((kv) => (
            <div key={kv.label} className="rounded-md border border-background/10 bg-background/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-background/50">{kv.label}</p>
              <p className="mt-0.5 font-mono text-sm text-background">{kv.value}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <span className="font-mono text-sm font-bold">j</span>
            </div>
            <p className="text-sm font-semibold">jCool Admin</p>
          </div>

          <header className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with your admin credentials to continue.
            </p>
          </header>

          <Suspense
            fallback={
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            }
          >
            <LoginForm />
          </Suspense>

          <p className="mt-8 text-xs text-muted-foreground">
            Admin role required. Lost access?{' '}
            <span className="font-medium text-foreground">Contact the team owner.</span>
          </p>
        </div>
      </main>
    </div>
  );
}
