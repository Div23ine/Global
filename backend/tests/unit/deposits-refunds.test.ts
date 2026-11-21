/**
 * Unit tests for money safety and deposit/refund invariants that do not
 * require a live database. Integration coverage lives in database.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { addMoney, cmpMoney, parseAmount, subMoney, type Money } from '../../src/utils/money';

describe('deposit amount invariants', () => {
  it('partial + remainder equals requested without float drift', () => {
    const requested: Money = '10000.0000';
    const first: Money = '8000.0000';
    const second: Money = '2000.0000';
    const total = addMoney(first, second);
    expect(cmpMoney(total, requested)).toBe(0);
  });

  it('outstanding is requested minus credited', () => {
    const requested = parseAmount('10000');
    const credited = parseAmount('8000');
    const outstanding = subMoney(requested, credited);
    expect(outstanding).toBe('2000');
  });

  it('overpayment detection: credited must not exceed requested', () => {
    const requested = parseAmount('10000');
    const incoming = parseAmount('11000');
    expect(cmpMoney(incoming, requested)).toBe(1); // incoming > requested
    // Cap applied by RPC — unit check of the arithmetic
    const capped = requested; // max credit
    expect(cmpMoney(capped, requested)).toBe(0);
  });

  it('rejects negative and zero deposit amounts at parse boundary', () => {
    expect(() => parseAmount('0')).toThrow();
    expect(() => parseAmount('-1')).toThrow();
    expect(() => parseAmount('0.0000')).toThrow();
  });
});

describe('refund limit arithmetic', () => {
  it('sum of partial refunds must not exceed original', () => {
    const original = parseAmount('1000');
    const r1 = parseAmount('300');
    const r2 = parseAmount('200');
    const r3 = parseAmount('500');
    const total = addMoney(addMoney(r1, r2), r3);
    expect(cmpMoney(total, original)).toBe(0);
  });

  it('detects excess when partials would exceed original', () => {
    const original = parseAmount('1000');
    const already = parseAmount('700');
    const next = parseAmount('400');
    const projected = addMoney(already, next);
    expect(cmpMoney(projected, original)).toBe(1); // would exceed
  });
});
