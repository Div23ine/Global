import { describe, expect, it } from 'vitest';
import { addMoney, cmpMoney, parseAmount, subMoney } from '../../src/utils/money';

describe('money utils', () => {
  it('parses plain and decimal amounts', () => {
    expect(parseAmount('100')).toBe('100');
    expect(parseAmount('100.50')).toBe('100.5');
    expect(parseAmount(10)).toBe('10');
  });

  it('rejects malformed amounts but accepts European comma decimals', () => {
    expect(() => parseAmount('')).toThrow();
    expect(() => parseAmount('-5')).toThrow();
    expect(() => parseAmount('1.23456')).toThrow();
    expect(() => parseAmount('abc')).toThrow();
    // European comma decimal separator is accepted (EUR-first product).
    expect(parseAmount('10,00')).toBe('10');
    expect(parseAmount('10,5')).toBe('10.5');
  });

  it('adds and subtracts without float drift', () => {
    expect(addMoney('0.1', '0.2')).toBe('0.3');
    expect(addMoney('9999999999.9999', '0.0001')).toBe('10000000000');
    expect(subMoney('10', '0.3')).toBe('9.7');
    expect(subMoney('5', '5')).toBe('0');
  });

  it('compares safely', () => {
    expect(cmpMoney('0.1', '0.2')).toBe(-1);
    expect(cmpMoney('1.0000', '1')).toBe(0);
    expect(cmpMoney('2', '1.9999')).toBe(1);
  });
});
