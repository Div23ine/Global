import { describe, expect, it } from 'vitest';
import { minLocalFromUsd, usdEquivalentOf } from '../src/services/fx.service';
import { cmpMoney } from '../src/utils/money';

describe('FX minimum helpers', () => {
  it('USD subsequent floor is exactly 10000.00', () => {
    const min = minLocalFromUsd(10_000, '1.00000000');
    expect(min).toBe('10000.0000');
    expect(cmpMoney('10000.0000', min)).toBe(0);
    expect(cmpMoney('9999.9900', min)).toBeLessThan(0);
  });

  it('EUR floor ceils 10000 * 0.95', () => {
    const min = minLocalFromUsd(10_000, '0.95000000');
    expect(min).toBe('9500.0000');
  });

  it('first-deposit USD 20000 floor preserved', () => {
    expect(minLocalFromUsd(20_000, '1.00000000')).toBe('20000.0000');
    expect(minLocalFromUsd(20_000, '0.95000000')).toBe('19000.0000');
  });

  it('usd equivalent of local amount', () => {
    expect(usdEquivalentOf('10000.0000', '1.00000000')).toBe('10000.0000');
    // 9500 EUR at 0.95 → 10000 USD
    expect(usdEquivalentOf('9500.0000', '0.95000000')).toBe('10000.0000');
  });
});
