'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { Elements } from '@stripe/react-stripe-js';
import { orderApi, type ShippingAddress } from '@/lib/api/orders';
import { getStripe } from '@/lib/stripe-browser';
import { ApiError } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCheckoutClientSecret } from '@/hooks/use-checkout-client-secret';
import { CheckoutPayment } from './checkout-payment';

interface CheckoutSession {
  orderId: string;
  clientSecret: string;
}

export function CheckoutForm(): JSX.Element {
  const router = useRouter();
  const { data: session } = useSession();
  const accessToken = session?.accessToken;

  // Persistence hook — probes sessionStorage on mount and restores a valid
  // in-flight checkout session so strict-mode double-mounts and page
  // refreshes do not lose the Stripe Elements context.
  const { probing, restored, saveSession, clearSession } = useCheckoutClientSecret(accessToken);

  const [address, setAddress] = useState<ShippingAddress>({
    line1: '',
    city: '',
    postalCode: '',
    country: 'US',
  });
  // Active checkout — either restored from sessionStorage or freshly fetched.
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Apply a restored session once the mount-time probe resolves.
  useEffect(() => {
    if (!probing && restored && !checkout) {
      setCheckout(restored);
    }
  }, [probing, restored, checkout]);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) {
      router.push('/login?callbackUrl=/checkout');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await orderApi.checkout(address, { accessToken });
      // Persist before updating state so a crash/remount between the two
      // cannot leave the PI in-flight without a recovery path.
      saveSession(result.orderId, result.clientSecret);
      setCheckout(result);
    } catch (err) {
      const message = err instanceof ApiError ? (err.body?.message ?? err.message) : 'Checkout failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Show a neutral loading state while the probe is running — prevents the
  // address form from flashing before a restored session takes over.
  if (probing) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-md border border-border bg-bg-elevated">
        <p className="text-sm text-muted-fg">Loading…</p>
      </div>
    );
  }

  if (checkout) {
    return (
      <Elements
        stripe={getStripe()}
        options={{
          clientSecret: checkout.clientSecret,
          // Stripe appearance — match Swiss Modernism tokens: sharp 6px radius,
          // mono surfaces, accent ring. Re-renders on theme toggle would
          // require remount; we lock to light here since Stripe Elements
          // inside our card always sit on a light surface.
          appearance: {
            theme: 'flat',
            variables: {
              colorPrimary: '#0a0a0a',
              colorText: '#0a0a0a',
              colorBackground: '#ffffff',
              colorDanger: '#dc2626',
              borderRadius: '6px',
              spacingUnit: '4px',
              fontFamily: 'Nunito Sans, system-ui, sans-serif',
              fontSizeBase: '14px',
            },
            rules: {
              '.Input': {
                borderColor: '#e4e4e7',
                boxShadow: 'none',
              },
              '.Input:focus': {
                borderColor: '#0a0a0a',
                boxShadow: '0 0 0 2px rgba(255,77,45,0.4)',
              },
              '.Label': {
                fontSize: '11px',
                fontWeight: '600',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#71717a',
              },
            },
          },
        }}
      >
        <CheckoutPayment orderId={checkout.orderId} onPaymentSuccess={clearSession} />
      </Elements>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-6 rounded-md border border-border bg-bg-elevated p-6 md:p-8"
    >
      <header className="border-b border-border pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
          Step 1 of 2
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-fg">
          Shipping address
        </h2>
      </header>

      <Field label="Street address" required>
        <Input
          required
          autoComplete="address-line1"
          value={address.line1}
          onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
        />
      </Field>
      <Field label="Apartment, suite, etc.">
        <Input
          autoComplete="address-line2"
          value={address.line2 ?? ''}
          onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value || undefined }))}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="City" required>
          <Input
            required
            autoComplete="address-level2"
            value={address.city}
            onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
          />
        </Field>
        <Field label="Region / state">
          <Input
            autoComplete="address-level1"
            value={address.region ?? ''}
            onChange={(e) => setAddress((a) => ({ ...a, region: e.target.value || undefined }))}
          />
        </Field>
        <Field label="Postal code" required>
          <Input
            required
            autoComplete="postal-code"
            value={address.postalCode}
            onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))}
          />
        </Field>
        <Field label="Country (ISO-2)" required>
          <Input
            required
            maxLength={2}
            autoComplete="country"
            value={address.country}
            onChange={(e) =>
              setAddress((a) => ({ ...a, country: e.target.value.toUpperCase().slice(0, 2) }))
            }
          />
        </Field>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-danger-500/30 bg-danger-100/40 px-4 py-3 text-xs text-danger-600"
        >
          {error}
        </div>
      ) : null}

      <Button type="submit" variant="brand" size="xl" fullWidth loading={submitting}>
        Continue to payment
      </Button>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
        {label}
        {required ? <span className="ml-0.5 text-accent-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
