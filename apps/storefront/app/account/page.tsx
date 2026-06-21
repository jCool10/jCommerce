import { redirect } from 'next/navigation';
import { Mail, ShieldCheck, UserRound } from 'lucide-react';
import { auth } from '@/lib/auth-config';
import { authApi } from '@/lib/api/auth';
import { SignOutButton } from './sign-out-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Account' };

export default async function AccountPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.accessToken) redirect('/login?callbackUrl=/account');

  const user = await authApi
    .me({ server: true, accessToken: session.accessToken })
    .catch(() => null);

  const name = user?.name ?? session.user?.name ?? '—';
  const email = user?.email ?? session.user?.email ?? '—';
  const role = user?.role ?? session.user?.role ?? 'customer';

  return (
    <div className="pb-24">
      <section className="border-b border-border">
        <div className="container py-12">
          <p className="eyebrow">Account</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tighter text-fg md:text-6xl">
            {name}
          </h1>
          <p className="mt-3 text-sm text-muted-fg">Manage your profile and session.</p>
        </div>
      </section>

      <div className="container py-10">
        <div className="mx-auto max-w-3xl space-y-8">
          <section className="rounded-md border border-border bg-bg-elevated p-6 md:p-8">
            <div className="flex items-center gap-4 border-b border-border pb-5">
              <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-fg font-display text-xl font-bold text-bg">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <p className="font-display text-lg font-semibold tracking-tight text-fg">
                  {name}
                </p>
                <p className="text-xs text-muted-fg">{email}</p>
              </div>
            </div>
            <dl className="grid gap-px bg-border pt-px sm:grid-cols-3">
              <Field icon={<UserRound className="h-4 w-4" />} label="Name" value={name} />
              <Field icon={<Mail className="h-4 w-4" />} label="Email" value={email} />
              <Field icon={<ShieldCheck className="h-4 w-4" />} label="Role" value={role} />
            </dl>
          </section>

          <div className="flex justify-end">
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="space-y-1.5 bg-bg-elevated p-4">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-fg">
        {icon}
        {label}
      </dt>
      <dd className="truncate text-sm font-medium text-fg">{value}</dd>
    </div>
  );
}
