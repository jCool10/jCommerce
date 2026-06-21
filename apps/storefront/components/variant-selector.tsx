'use client';

import { useMemo } from 'react';
import type { Sku } from '@jcool/contracts';
import { cn } from '@/lib/cn';

interface VariantSelectorProps {
  skus: Sku[];
  selectedSkuId: string;
  onSelect: (skuId: string) => void;
}

// Picks variants by SKU attributes when present (e.g. {size, color});
// falls back to plain SKU code chips when attributes are empty.
export function VariantSelector({
  skus,
  selectedSkuId,
  onSelect,
}: VariantSelectorProps): JSX.Element | null {
  const groups = useMemo(() => buildAttributeGroups(skus), [skus]);
  const selected = skus.find((s) => s.id === selectedSkuId) ?? skus[0];

  if (skus.length <= 1) return null;

  if (groups.length === 0) {
    return (
      <fieldset className="space-y-2 border-t border-border pt-5">
        <legend className="text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
          Variant
        </legend>
        <div className="flex flex-wrap gap-2">
          {skus.map((sku) => (
            <Chip
              key={sku.id}
              active={sku.id === selectedSkuId}
              disabled={sku.stock === 0}
              onClick={() => onSelect(sku.id)}
              label={sku.sku}
              meta={sku.stock === 0 ? 'Sold out' : `${sku.stock} left`}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div className="space-y-5 border-t border-border pt-5">
      {groups.map(({ key, values }) => (
        <fieldset key={key} className="space-y-2">
          <legend className="flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-fg">
            {key}
            <span className="text-fg normal-case tracking-tight">
              {selected?.attributes?.[key] ?? ''}
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {values.map((value) => {
              const matching = skus.find((s) => s.attributes?.[key] === value);
              const isActive = selected?.attributes?.[key] === value;
              const isSoldOut = matching && matching.stock === 0;
              return (
                <Chip
                  key={`${key}-${value}`}
                  active={isActive}
                  disabled={!matching || Boolean(isSoldOut)}
                  onClick={() => matching && onSelect(matching.id)}
                  label={value}
                  meta={isSoldOut ? 'Sold out' : undefined}
                />
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

interface ChipProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  meta?: string;
}

function Chip({ active, disabled, onClick, label, meta }: ChipProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-sm border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
        active
          ? 'border-fg bg-fg text-bg'
          : 'border-border bg-bg text-fg hover:border-fg/60',
        disabled && 'opacity-40 line-through cursor-not-allowed hover:border-border',
      )}
    >
      <span>{label}</span>
      {meta ? (
        <span className="text-[10px] font-normal uppercase tracking-widest opacity-70">
          {meta}
        </span>
      ) : null}
    </button>
  );
}

interface AttributeGroup {
  key: string;
  values: string[];
}

function buildAttributeGroups(skus: Sku[]): AttributeGroup[] {
  const map = new Map<string, Set<string>>();
  for (const sku of skus) {
    const attrs = sku.attributes ?? {};
    for (const [k, v] of Object.entries(attrs)) {
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(v);
    }
  }
  return Array.from(map.entries()).map(([key, set]) => ({
    key,
    values: Array.from(set),
  }));
}
