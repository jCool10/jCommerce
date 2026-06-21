import { CheckoutForm } from './checkout-form';

export const metadata = { title: 'Checkout' };

export default function CheckoutPage(): JSX.Element {
  return (
    <div className="pb-24">
      <section className="border-b border-border">
        <div className="container py-12">
          <p className="eyebrow">Checkout</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tighter text-fg md:text-6xl">
            Almost <span className="italic text-accent-500">there.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-fg">
            Encrypted payment by Stripe. Your card details never touch our
            servers.
          </p>
          {process.env.NODE_ENV !== 'production' ? (
            <p className="mt-3 max-w-2xl text-[11px] uppercase tracking-widest text-muted-fg">
              Dev hint — Stripe test card{' '}
              <code className="rounded-sm border border-border bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-fg">
                4242 4242 4242 4242
              </code>{' '}
              · any future date · any CVC.
            </p>
          ) : null}
        </div>
      </section>

      <div className="container py-10">
        <div className="mx-auto max-w-3xl">
          <CheckoutForm />
        </div>
      </div>
    </div>
  );
}
