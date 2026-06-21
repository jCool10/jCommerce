'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { Lock, Mail, UserRound } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function RegisterForm(): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.register({ email, password, name });
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        router.push('/login');
        return;
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.message ?? 'Registration failed.');
      } else {
        setError('Registration failed.');
      }
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-md border border-border bg-bg-elevated p-7"
    >
      <Field label="Full name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          autoComplete="name"
          leadingIcon={<UserRound className="h-4 w-4" />}
          placeholder="Ada Lovelace"
        />
      </Field>
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          leadingIcon={<Mail className="h-4 w-4" />}
          placeholder="you@example.com"
        />
      </Field>
      <Field label="Password">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          autoComplete="new-password"
          leadingIcon={<Lock className="h-4 w-4" />}
          placeholder="At least 8 characters"
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
        Create account
      </Button>
      <p className="text-center text-xs text-muted-fg">
        Already have one?{' '}
        <Link
          href="/login"
          className="font-semibold text-fg underline-offset-4 transition-colors hover:text-accent-500 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
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
