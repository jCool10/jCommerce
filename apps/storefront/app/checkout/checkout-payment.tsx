'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Lock } from 'lucide-react';
import { orderApi } from '@/lib/api/orders';
import { useCartStore } from '@/lib/store/cart-store';
import { Button } from '@/components/ui/button';

interface CheckoutPaymentProps {
  orderId: string;
  /** Called with orderId after stripe.confirmPayment succeeds — clears the persisted clientSecret. */
  onPaymentSuccess: (orderId: string) => void;
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;
const TERMINAL_STATUSES = new Set(['CONFIRMED', 'CANCELLED']);

export function CheckoutPayment({ orderId, onPaymentSuccess }: CheckoutPaymentProps): JSX.Element {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const { data: session } = useSession();
  const resetCart = useCartStore((s) => s.reset);
  const [status, setStatus] = useState<'idle' | 'paying' | 'polling' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setStatus('paying');
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      // Poll our own backend rather than letting Stripe redirect — keeps the
      // user on-site and surfaces the saga state directly.
      redirect: 'if_required',
    });
    if (confirmError) {
      setStatus('error');
      setError(confirmError.message ?? 'Payment failed.');
      // Keep the persisted clientSecret on failure — backend idempotency
      // allows the user to retry with the same PaymentIntent.
      return;
    }

    // Payment confirmed — clear the persisted clientSecret before navigating
    // so a refresh after success does not replay the Elements mount.
    onPaymentSuccess(orderId);

    setStatus('polling');
    const reachedTerminal = await pollUntilTerminal(orderId, session?.accessToken);
    if (reachedTerminal === 'CONFIRMED') {
      resetCart();
      setStatus('done');
      router.replace(`/orders/${orderId}?paid=1`);
    } else if (reachedTerminal === 'CANCELLED') {
      setStatus('error');
      setError('Order was cancelled.');
    } else {
      setStatus('done');
      router.replace(`/orders/${orderId}`);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-6 rounded-md border border-border bg-bg-elevated p-6 md:p-8"
    >
      <header className="border-b border-border pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
          Step 2 of 2
        </p>
        <h2 className="mt-2 flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-fg">
          Payment
          <Lock className="h-3.5 w-3.5 text-muted-fg" aria-hidden="true" />
        </h2>
        <p className="mt-1 text-xs text-muted-fg">Secured by Stripe · TLS encrypted</p>
      </header>

      <div className="rounded-md border border-border bg-bg p-4">
        <PaymentElement />
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-danger-500/30 bg-danger-100/40 px-4 py-3 text-xs text-danger-600"
        >
          {error}
        </div>
      ) : null}

      <Button
        type="submit"
        size="xl"
        fullWidth
        disabled={!stripe || status === 'paying' || status === 'polling'}
        loading={status === 'paying' || status === 'polling'}
      >
        {status === 'paying'
          ? 'Processing…'
          : status === 'polling'
            ? 'Confirming order…'
            : 'Pay now'}
      </Button>
    </form>
  );
}

async function pollUntilTerminal(
  orderId: string,
  accessToken: string | undefined,
): Promise<'CONFIRMED' | 'CANCELLED' | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const order = await orderApi.getById(orderId, { accessToken });
      if (TERMINAL_STATUSES.has(order.status)) {
        return order.status as 'CONFIRMED' | 'CANCELLED';
      }
    } catch {
      // Tolerate transient 4xx/5xx — webhook may still be propagating.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return null;
}
