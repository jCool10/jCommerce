'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const StoreInfoSchema = z.object({
  storeName: z.string().min(2, 'At least 2 characters').max(80),
  supportEmail: z.string().email('Enter a valid email'),
  defaultCurrency: z.enum(['USD', 'VND']),
});
type StoreInfoValues = z.infer<typeof StoreInfoSchema>;

const DEFAULTS: StoreInfoValues = {
  storeName: 'jCool',
  supportEmail: 'support@jcool.example',
  defaultCurrency: 'USD',
};

export function StoreInfoForm(): React.JSX.Element {
  const [saved, setSaved] = useState(false);
  const form = useForm<StoreInfoValues>({
    resolver: zodResolver(StoreInfoSchema),
    defaultValues: DEFAULTS,
  });

  const onSubmit = (values: StoreInfoValues): void => {
    // No-op for now — backend settings table is wired in a follow-up phase.
    // Mirrors the value to the console so devs can inspect submitted payloads.
    // eslint-disable-next-line no-console
    console.info('[settings/store-info] submitted', values);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Store info</CardTitle>
        <CardDescription>
          Public-facing name, support address, and default pricing currency.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex items-start gap-2 rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-info">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Persistence is wired in a follow-up phase. Submissions currently log
            to the dev console.
          </p>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="storeName">Store name</Label>
            <Input id="storeName" {...form.register('storeName')} />
            {form.formState.errors.storeName ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.storeName.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="supportEmail">Support email</Label>
            <Input id="supportEmail" type="email" {...form.register('supportEmail')} />
            {form.formState.errors.supportEmail ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.supportEmail.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="defaultCurrency">Default currency</Label>
            <select
              id="defaultCurrency"
              {...form.register('defaultCurrency')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="USD">USD — United States dollar</option>
              <option value="VND">VND — Vietnamese đồng</option>
            </select>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Save changes
            </Button>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved (dev console)
              </span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
