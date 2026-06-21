import { BrandMark } from '@/components/brand-mark';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

interface LoginPageProps {
  searchParams: { callbackUrl?: string; error?: string };
}

export default function LoginPage({ searchParams }: LoginPageProps): JSX.Element {
  return (
    <div className="bg-bg py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-md space-y-10">
          <div className="space-y-5 text-center">
            <div className="flex justify-center">
              <BrandMark iconOnly />
            </div>
            <p className="eyebrow">Welcome back</p>
            <h1 className="font-display text-3xl font-semibold tracking-tighter text-fg md:text-5xl">
              Sign in
            </h1>
            <p className="text-sm text-muted-fg">
              Use your email and password to sign in.
            </p>
          </div>
          <LoginForm callbackUrl={searchParams.callbackUrl} initialError={searchParams.error} />
        </div>
      </div>
    </div>
  );
}
