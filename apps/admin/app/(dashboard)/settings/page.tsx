'use client';

import { useState } from 'react';
import { Construction, Settings as SettingsIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { StoreInfoForm } from './store-info-form';

type SettingsTab = 'store' | 'currencies' | 'tax' | 'email';

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'store', label: 'Store info' },
  { id: 'currencies', label: 'Currencies' },
  { id: 'tax', label: 'Tax' },
  { id: 'email', label: 'Email templates' },
];

export default function SettingsPage(): React.JSX.Element {
  const [active, setActive] = useState<SettingsTab>('store');

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage store info, currencies, tax rules, and customer email templates.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="flex flex-row flex-wrap gap-1 lg:flex-col">
          {TABS.map((tab) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={cn(
                  'inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div>
          {active === 'store' ? (
            <StoreInfoForm />
          ) : (
            <ComingSoonPanel section={TABS.find((t) => t.id === active)?.label ?? ''} />
          )}
        </div>
      </div>
    </div>
  );
}

function ComingSoonPanel({ section }: { section: string }): React.JSX.Element {
  return (
    <Card className="border-dashed bg-warning/5">
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-warning/15 text-warning">
          <Construction className="h-4 w-4" />
        </div>
        <div>
          <CardTitle className="text-base">{section} — coming soon</CardTitle>
          <CardDescription>
            Persistence for this section is wired in a follow-up phase. Form
            scaffolding will land here once the backend settings table is in place.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid h-32 place-items-center rounded-md border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <SettingsIcon className="h-3.5 w-3.5" />
            Section under construction
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
