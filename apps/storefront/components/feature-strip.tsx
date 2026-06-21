import { ShieldCheck, Sparkles, Truck, Undo2 } from 'lucide-react';

const ITEMS = [
  { icon: Truck, title: 'Free shipping', body: 'Standard delivery on every order over $50.' },
  { icon: Undo2, title: '30-day returns', body: 'Send back anything unused, no questions asked.' },
  { icon: ShieldCheck, title: 'Secure checkout', body: 'Encrypted by Stripe — your card stays with them.' },
  { icon: Sparkles, title: 'Shop your way', body: 'Browse and pay in USD or VND, switch any time.' },
] as const;

// Editorial feature strip — hairline-divided grid, mono icons, tight type.
export function FeatureStrip(): JSX.Element {
  return (
    <section className="container">
      <div className="grid grid-cols-1 divide-y divide-border border border-border rounded-md sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
        {ITEMS.map(({ icon: Icon, title, body }, index) => (
          <div
            key={title}
            className={
              // Restore bottom dividers within rows on sm+ via a manual divider
              // pattern: we rely on the parent's divide-x on sm and add a top
              // border on the second row of large grids via mod-position.
              [
                'flex items-start gap-3 p-5',
                index >= 2 ? 'lg:border-t lg:border-border' : '',
                index % 2 === 0 ? 'sm:border-t-0' : '',
              ].join(' ')
            }
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border text-fg">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold tracking-tight text-fg">{title}</p>
              <p className="text-xs leading-relaxed text-muted-fg">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
