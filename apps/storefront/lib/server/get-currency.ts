import { cookies } from 'next/headers';
import type { Currency } from '@jcool/contracts';
import { CURRENCY_COOKIE, parseCurrencyOrDefault } from '../currency';

// Cookie set by lib/store/currency-store.ts in the browser. Server Components
// read the same cookie so ISR fetches are priced in the user's currency.
export function getCurrencyFromCookie(): Currency {
  return parseCurrencyOrDefault(cookies().get(CURRENCY_COOKIE)?.value);
}
