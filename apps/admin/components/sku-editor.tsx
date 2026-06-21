'use client';

import { useFieldArray, useFormContext, type ArrayPath, type FieldValues } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type SkuRowValue = {
  sku: string;
  attributes?: Record<string, string>;
  initialStock?: number;
  prices: { USD: number; VND: number };
};

interface SkuEditorProps<T extends FieldValues> {
  name: ArrayPath<T>;
}

export function SkuEditor<T extends FieldValues>({ name }: SkuEditorProps<T>): React.JSX.Element {
  const { control, register } = useFormContext<T>();
  const { fields, append, remove } = useFieldArray<T>({ control, name });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">SKUs</h3>
          <p className="text-xs text-muted-foreground">
            USD prices in cents (¢) · VND in đồng. Both required.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              sku: '',
              attributesJson: '',
              initialStock: 0,
              prices: { USD: 0, VND: 0 },
            } as never)
          }
        >
          <Plus className="h-4 w-4" />
          Add SKU
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2 text-left font-semibold">Code</th>
              <th className="p-2 text-left font-semibold">USD ¢</th>
              <th className="p-2 text-left font-semibold">VND đ</th>
              <th className="p-2 text-left font-semibold">Stock</th>
              <th className="p-2 text-left font-semibold">Attributes (JSON)</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                  No SKUs yet. Click <span className="font-medium">Add SKU</span> to create one.
                </td>
              </tr>
            )}
            {fields.map((field, idx) => (
              <tr key={field.id} className="border-t border-border/60">
                <td className="p-2">
                  <Input
                    {...register(`${name}.${idx}.sku` as never)}
                    placeholder="MAIN-RED-M"
                    className="h-8 font-mono text-xs"
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="h-8 tabular-nums"
                    {...register(`${name}.${idx}.prices.USD` as never, { valueAsNumber: true })}
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="h-8 tabular-nums"
                    {...register(`${name}.${idx}.prices.VND` as never, { valueAsNumber: true })}
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="h-8 tabular-nums"
                    {...register(`${name}.${idx}.initialStock` as never, { valueAsNumber: true })}
                  />
                </td>
                <td className="p-2">
                  <Input
                    placeholder='{"size":"M","color":"red"}'
                    className="h-8 font-mono text-xs"
                    {...register(`${name}.${idx}.attributesJson` as never)}
                  />
                </td>
                <td className="p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(idx)}
                    aria-label="Remove SKU"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
