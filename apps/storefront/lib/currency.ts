import type { Currency } from '@jcool/contracts';

export const SUPPORTED_CURRENCIES: readonly Currency[] = ['USD', 'VND'] as const;
export const DEFAULT_CURRENCY: Currency = 'USD';
export const CURRENCY_COOKIE = 'jcool_currency';

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function parseCurrencyOrDefault(value: unknown): Currency {
  return isCurrency(value) ? value : DEFAULT_CURRENCY;
}
