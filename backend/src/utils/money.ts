/**
 * Money helpers. All arithmetic on numeric strings/numbers uses cent-safe
 * paths; formatting is EUR-first (European default presentation currency).
 */
import { badRequest } from './httpError';

export type Money = string; // numeric(19,4) as string from Postgres

const DECIMALS = 4;

function toUnits(value: Money | number): bigint {
  const s = typeof value === 'number' ? value.toFixed(DECIMALS) : value.trim();
  const negative = s.startsWith('-');
  const abs = negative ? s.slice(1) : s;
  const [intPart, fracPartRaw = ''] = abs.split('.');
  const frac = (fracPartRaw + '0'.repeat(DECIMALS)).slice(0, DECIMALS);
  const units = BigInt(intPart || '0') * 10n ** BigInt(DECIMALS) + BigInt(frac || '0');
  return negative ? -units : units;
}

function fromUnits(units: bigint): Money {
  const negative = units < 0;
  const abs = negative ? -units : units;
  const base = 10n ** BigInt(DECIMALS);
  const intPart = abs / base;
  const fracPart = (abs % base).toString().padStart(DECIMALS, '0');
  const trimmed = fracPart.replace(/0+$/, '');
  const s = trimmed ? `${intPart}.${trimmed}` : `${intPart}`;
  return negative ? `-${s}` : s;
}

export function addMoney(a: Money, b: Money): Money {
  return fromUnits(toUnits(a) + toUnits(b));
}

export function subMoney(a: Money, b: Money): Money {
  return fromUnits(toUnits(a) - toUnits(b));
}

export function cmpMoney(a: Money, b: Money): number {
  const x = toUnits(a);
  const y = toUnits(b);
  return x === y ? 0 : x < y ? -1 : 1;
}

export function isPositive(a: Money): boolean {
  return toUnits(a) > 0n;
}

export function isNonNegative(a: Money): boolean {
  return toUnits(a) >= 0n;
}

/** Parse a user-supplied amount string into a canonical Money value. */
export function parseAmount(input: string | number): Money {
  const s = String(input).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,4})?$/.test(s)) {
    // ApiError so malformed amounts surface as HTTP 400, not a generic 500.
    throw badRequest('Amount must be a positive number with at most 4 decimals');
  }
  const parsed = fromUnits(toUnits(s));
  if (!isPositive(parsed)) {
    throw badRequest('Amount must be greater than zero');
  }
  return parsed;
}

/** Convert between currencies using an indicative rate map (display only). */
export function convert(amount: Money, rate: number): number {
  return Number(amount) * rate;
}

export function formatMoney(amount: Money | number, currency: string, locale = 'de-DE'): string {
  const value = typeof amount === 'number' ? amount : Number(amount);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}
