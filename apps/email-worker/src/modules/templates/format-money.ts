import type { Money } from '@jcool/contracts';

/**
 * Money formatting respects the per-currency subunit. USD `amount` is
 * cents → divide by 100 and show two fraction digits. VND `amount` IS
 * the đồng (no subunit) → render as-is.
 */
export function formatMoney(money: Money): string {
  if (money.currency === 'USD') {
    const dollars = money.amount / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(dollars);
  }
  // VND
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(money.amount);
}
