import { BrandMark } from '@/components/brand-mark';
import { RegisterForm } from './register-form';

export const metadata = { title: 'Create account' };

export default function RegisterPage(): JSX.Element {
  return (
    <div className="bg-bg py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-md space-y-10">
          <div className="space-y-5 text-center">
            <div className="flex justify-center">
              <BrandMark iconOnly />
            </div>
            <p className="eyebrow">Get started</p>
            <h1 className="font-display text-3xl font-semibold tracking-tighter text-fg md:text-5xl">
              Create your account
            </h1>
            <p className="text-sm text-muted-fg">
              8+ characters minimum. You can edit your profile any time.
            </p>
          </div>
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
