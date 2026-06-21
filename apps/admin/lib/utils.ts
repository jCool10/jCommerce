import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatMoney(amount: number, currency: 'USD' | 'VND'): string {
  if (currency === 'USD') return `$${(amount / 100).toFixed(2)}`;
  return `${amount.toLocaleString('vi-VN')} ₫`;
}
