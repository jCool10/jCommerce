'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { Lock, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface LoginFormProps {
  callbackUrl?: string;
  initialError?: string;
}

export function LoginForm({ callbackUrl, initialError }: LoginFormProps): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn('credentials', {
      email,
      password,
      redirect: true,
      callbackUrl: callbackUrl ?? '/',
    });
    if (result?.error) {
      setError('Invalid email or password.');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-md border border-border bg-bg-elevated p-7">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            leadingIcon={<Mail className="h-4 w-4" />}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            leadingIcon={<Lock className="h-4 w-4" />}
            placeholder="••••••••"
          />
        </Field>
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-danger-500/30 bg-danger-100/40 px-3 py-2 text-xs text-danger-600"
          >
            {error}
          </div>
        ) : null}
        <Button type="submit" variant="brand" loading={submitting} size="lg" fullWidth>
          Sign in
        </Button>
      </form>

      <p className="text-center text-xs text-muted-fg">
        New here?{' '}
        <Link
          href="/register"
          className="font-semibold text-fg underline-offset-4 transition-colors hover:text-accent-500 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
        {label}
      </span>
      {children}
    </label>
  );
}
