import type { Currency, Money } from '@jcool/contracts';

// USD prices are stored as cents (subunit factor 100); VND has no subunit
// (đồng is already the smallest unit per ISO 4217). Keep this table local
// so the storefront stays decoupled from any backend money helpers.
const SUBUNIT_FACTOR: Record<Currency, number> = {
  USD: 100,
  VND: 1,
};

const LOCALE: Record<Currency, string> = {
  USD: 'en-US',
  VND: 'vi-VN',
};

export function formatMoney(money: Money): string {
  return formatAmount(money.amount, money.currency);
}

export function formatAmount(amount: number, currency: Currency): string {
  const major = amount / SUBUNIT_FACTOR[currency];
  return new Intl.NumberFormat(LOCALE[currency], {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(major);
}
