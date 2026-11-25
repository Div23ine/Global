/**
 * Exchange-rate management (USD base).
 * units_per_usd = amount of local currency equal to one USD.
 * Live provider: Frankfurter (ECB-derived, no API key).
 */
import { getServiceClient } from './supabase.service';
import { auditAllowed } from './audit.service';
import { badRequest, invalidState } from '../utils/httpError';
import type { Money } from '../utils/money';
import { cmpMoney } from '../utils/money';

export type FxSource = 'manual' | 'live';
export type FxMode = 'manual' | 'live';

export interface FxRateRow {
  currency_code: string;
  units_per_usd: string;
  source: FxSource;
  provider: string | null;
  rate_timestamp: string;
  updated_at: string;
  updated_by: string | null;
}

export interface FxSettingsRow {
  id: number;
  mode: FxMode;
  live_provider: string;
  last_refresh_at: string | null;
  last_refresh_error: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface ResolvedRate {
  currencyCode: string;
  unitsPerUsd: string;
  source: FxSource;
  provider: string | null;
  rateTimestamp: string;
  retrievedAt: string;
}

/** Live rates older than this are rejected for subsequent-deposit conversion. */
export const LIVE_STALE_MS = 24 * 60 * 60 * 1000;

const SUPPORTED = new Set(['USD', 'EUR', 'GBP', 'CHF', 'PLN']);

/** Fallback used only for the preserved first-deposit policy path. */
export const FIRST_DEPOSIT_INDICATIVE_RATES: Record<string, string> = {
  USD: '1.00000000',
  EUR: '0.95000000',
  GBP: '0.82000000',
  CHF: '0.90000000',
  PLN: '4.10000000',
};

type Ctx = { role?: string | null; ip?: string | null; userAgent?: string | null };

function assertSupported(code: string): string {
  const c = code.toUpperCase();
  if (!SUPPORTED.has(c)) throw badRequest(`Unsupported currency ${code}.`);
  return c;
}

function assertPositiveRate(raw: string | number): string {
  const s = String(raw).trim();
  if (!/^\d+(\.\d{1,8})?$/.test(s)) {
    throw badRequest('Rate must be a positive number with at most 8 decimal places.');
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) throw badRequest('Rate must be a positive finite number.');
  if (n > 1_000_000) throw badRequest('Rate is outside the accepted range.');
  // Normalize to 8 dp string without float drift for simple decimals
  const [intPart, frac = ''] = s.split('.');
  return `${intPart}.${(frac + '00000000').slice(0, 8)}`;
}

/** Ceiling of (usdMin * unitsPerUsd) to 2 decimal places, returned as Money (4 dp). */
export function minLocalFromUsd(usdMin: number, unitsPerUsd: string): Money {
  if (!Number.isFinite(usdMin) || usdMin <= 0) throw badRequest('Invalid USD floor.');
  const [ri, rf = ''] = String(unitsPerUsd).split('.');
  const rate8 = BigInt(ri + (rf + '00000000').slice(0, 8));
  const product = BigInt(Math.trunc(usdMin)) * rate8; // local currency * 1e8
  const scaleToCents = 10n ** 6n;
  const cents = (product + scaleToCents - 1n) / scaleToCents; // ceil to 0.01
  const whole = cents / 100n;
  const frac = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${frac}00` as Money;
}

/** USD equivalent of local amount at units_per_usd (truncate to 4 dp toward zero for display/eligibility). */
export function usdEquivalentOf(localAmount: Money, unitsPerUsd: string): Money {
  const [ai, af = ''] = String(localAmount).split('.');
  const amt4 = BigInt(ai + (af + '0000').slice(0, 4));
  const [ri, rf = ''] = unitsPerUsd.split('.');
  const rate8 = BigInt(ri + (rf + '00000000').slice(0, 8));
  if (rate8 === 0n) throw invalidState('Exchange rate is zero.');
  // local = amt4/1e4 and rate = rate8/1e8, so usd = local / rate
  //   = amt4 * 1e8 / (1e4 * rate8). In 4-dp USD units (usd4 = usd * 1e4):
  //   usd4 = amt4 * 1e8 / rate8. BigInt division truncates toward zero,
  //   which is exactly the documented 4-dp truncation.
  const usd4 = (amt4 * (10n ** 8n)) / rate8;
  const whole = usd4 / 10000n;
  const frac = (usd4 % 10000n).toString().padStart(4, '0');
  return `${whole}.${frac}` as Money;
}

export async function getFxSettings(): Promise<FxSettingsRow> {
  const db = getServiceClient();
  const { data, error } = await db.from('fx_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return {
      id: 1,
      mode: 'manual',
      live_provider: 'frankfurter',
      last_refresh_at: null,
      last_refresh_error: null,
      updated_at: new Date().toISOString(),
      updated_by: null,
    };
  }
  return data as FxSettingsRow;
}

export async function listRates(): Promise<{ settings: FxSettingsRow; rates: FxRateRow[] }> {
  const db = getServiceClient();
  const settings = await getFxSettings();
  const { data, error } = await db.from('exchange_rates').select('*').order('currency_code');
  if (error) throw new Error(error.message);
  return { settings, rates: (data || []) as FxRateRow[] };
}

export async function setFxMode(adminId: string, mode: FxMode, ctx?: Ctx): Promise<FxSettingsRow> {
  if (mode !== 'manual' && mode !== 'live') throw badRequest('Mode must be manual or live.');
  const db = getServiceClient();
  const { data, error } = await db.from('fx_settings').upsert({
    id: 1,
    mode,
    updated_at: new Date().toISOString(),
    updated_by: adminId,
    last_refresh_error: mode === 'manual' ? null : undefined,
  }).select('*').single();
  if (error) throw new Error(error.message);
  await auditAllowed(adminId, 'fx.mode_change', { type: 'fx_settings', id: '1' }, { mode }, ctx);
  return data as FxSettingsRow;
}

export async function setManualRate(
  adminId: string,
  currencyCode: string,
  unitsPerUsd: string | number,
  ctx?: Ctx,
): Promise<FxRateRow> {
  const code = assertSupported(currencyCode);
  const rate = assertPositiveRate(unitsPerUsd);
  const db = getServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await db.from('exchange_rates').upsert({
    currency_code: code,
    units_per_usd: rate,
    source: 'manual',
    provider: 'manual',
    rate_timestamp: now,
    updated_at: now,
    updated_by: adminId,
  }).select('*').single();
  if (error) throw new Error(error.message);
  await auditAllowed(
    adminId,
    'fx.rate_update',
    { type: 'exchange_rate', id: code },
    { unitsPerUsd: rate, source: 'manual' },
    ctx,
  );
  return data as FxRateRow;
}

export async function refreshLiveRates(adminId: string | null, ctx?: Ctx): Promise<{
  settings: FxSettingsRow;
  rates: FxRateRow[];
}> {
  const settings = await getFxSettings();
  if (settings.mode !== 'live') {
    throw invalidState('Live refresh is only available when FX mode is live.');
  }

  let payload: { rates?: Record<string, number>; date?: string };
  try {
    const url = 'https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,CHF,PLN';
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Provider HTTP ${res.status}`);
    payload = await res.json() as { rates?: Record<string, number>; date?: string };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provider unavailable';
    const db = getServiceClient();
    await db.from('fx_settings').update({
      last_refresh_error: message,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    }).eq('id', 1);
    throw invalidState('Live exchange rates could not be retrieved. Try again or switch to manual rates.');
  }

  const ratesMap = payload.rates || {};
  const needed = ['EUR', 'GBP', 'CHF', 'PLN'];
  for (const c of needed) {
    const v = ratesMap[c];
    if (v == null || !(Number(v) > 0)) {
      const db = getServiceClient();
      await db.from('fx_settings').update({
        last_refresh_error: `Missing rate for ${c}`,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
      throw invalidState('Live exchange-rate response was incomplete. Rates were not updated.');
    }
  }

  const rateTs = payload.date ? `${payload.date}T00:00:00.000Z` : new Date().toISOString();
  const now = new Date().toISOString();
  const db = getServiceClient();
  const rows = [
    { currency_code: 'USD', units_per_usd: '1.00000000' },
    ...needed.map((c) => ({
      currency_code: c,
      units_per_usd: assertPositiveRate(ratesMap[c]),
    })),
  ];

  for (const row of rows) {
    const { error } = await db.from('exchange_rates').upsert({
      currency_code: row.currency_code,
      units_per_usd: row.units_per_usd,
      source: 'live',
      provider: 'frankfurter',
      rate_timestamp: rateTs,
      updated_at: now,
      updated_by: adminId,
    });
    if (error) throw new Error(error.message);
  }

  const { error: sErr } = await db.from('fx_settings').update({
    last_refresh_at: now,
    last_refresh_error: null,
    updated_at: now,
    updated_by: adminId,
  }).eq('id', 1).select('*').single();
  if (sErr) throw new Error(sErr.message);

  if (adminId) {
    await auditAllowed(adminId, 'fx.live_refresh', { type: 'fx_settings', id: '1' }, {
      provider: 'frankfurter',
      rateTimestamp: rateTs,
    }, ctx);
  }

  return listRates();
}

/**
 * Resolve the rate used for subsequent-deposit eligibility.
 * Does not invent rates on failure.
 */
export async function resolveRateForDeposit(currencyCode: string): Promise<ResolvedRate> {
  const code = assertSupported(currencyCode);
  const settings = await getFxSettings();
  const db = getServiceClient();
  const { data, error } = await db.from('exchange_rates').select('*').eq('currency_code', code).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw invalidState(
      'An exchange rate for this currency is not configured. Please try again later or contact support.',
    );
  }

  const retrievedAt = new Date().toISOString();
  if (settings.mode === 'live') {
    if (data.source !== 'live') {
      throw invalidState(
        'Live exchange rates are enabled but no live rate is available for this currency. An administrator must refresh rates.',
      );
    }
    const age = Date.now() - new Date(data.rate_timestamp).getTime();
    if (age > LIVE_STALE_MS) {
      throw invalidState(
        'Exchange rates are out of date. An administrator must refresh live rates before this deposit can be accepted.',
      );
    }
    if (settings.last_refresh_error) {
      throw invalidState(
        'Exchange rates are currently unavailable. Please try again later.',
      );
    }
  }

  const units = String(data.units_per_usd);
  if (!(Number(units) > 0)) {
    throw invalidState('Configured exchange rate is invalid.');
  }

  return {
    currencyCode: code,
    unitsPerUsd: units.includes('.') ? units : `${units}.00000000`,
    source: data.source as FxSource,
    provider: data.provider,
    rateTimestamp: data.rate_timestamp,
    retrievedAt,
  };
}

/** First-deposit policy rate: prefer DB rate, else historical indicative constant. */
export function firstDepositPolicyRate(currencyCode: string, dbRate?: string | null): string {
  const code = assertSupported(currencyCode);
  if (dbRate && Number(dbRate) > 0) return assertPositiveRate(dbRate);
  const fallback = FIRST_DEPOSIT_INDICATIVE_RATES[code];
  if (!fallback) throw badRequest(`Unsupported currency ${code}.`);
  return fallback;
}

export function assertMeetsUsdFloor(
  amount: Money,
  unitsPerUsd: string,
  usdFloor: number,
  currencyCode: string,
): { minLocal: Money; usdEquivalent: Money } {
  const minLocal = minLocalFromUsd(usdFloor, unitsPerUsd);
  const usdEquivalent = usdEquivalentOf(amount, unitsPerUsd);
  if (cmpMoney(amount, minLocal) < 0) {
    throw badRequest(
      `This deposit must be at least ${Number(minLocal).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${currencyCode} (USD ${usdFloor.toLocaleString('en-US')} equivalent).`,
    );
  }
  return { minLocal, usdEquivalent };
}
