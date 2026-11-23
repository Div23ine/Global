/**
 * Regression tests for the profile full_name assembly contract (audit F-7).
 *
 * Promise under test: a partial name patch never corrupts `full_name` —
 * `full_name` is recomputed from the STORED parts plus the patched parts.
 *
 * Realistic defect that turns this red: the old `PATCH /profile` handler
 * rebuilt `full_name` from the request body alone, so an `firstName`-only
 * patch erased the stored last name, and a `lastName`-only patch left
 * `full_name` stale. Both routes (customer and admin) now share
 * computeFullName, so this unit pins the shared behaviour.
 */
import { describe, expect, it } from 'vitest';
import { computeFullName } from '../../src/utils/name';

const STORED = { first_name: 'Ada', last_name: 'Lovelace' };

describe('computeFullName — partial patches never corrupt full_name', () => {
  it('firstName-only patch preserves the STORED last name', () => {
    // Old behaviour produced 'Grace' (last name erased).
    expect(computeFullName(STORED, { firstName: 'Grace' })).toBe('Grace Lovelace');
  });

  it('lastName-only patch recomputes full_name with the STORED first name', () => {
    // Old behaviour left full_name stale as 'Ada Lovelace'.
    expect(computeFullName(STORED, { lastName: 'Hopper' })).toBe('Ada Hopper');
  });

  it('both parts patched yields the merged name', () => {
    expect(computeFullName(STORED, { firstName: 'Grace', lastName: 'Hopper' })).toBe('Grace Hopper');
  });

  it('empty patch (no name fields) leaves assembly identical to stored', () => {
    expect(computeFullName(STORED, {})).toBe('Ada Lovelace');
  });

  it('missing stored profile falls back to the patched parts only', () => {
    expect(computeFullName(null, { lastName: 'Hopper' })).toBe('Hopper');
    expect(computeFullName(null, { firstName: 'Grace' })).toBe('Grace');
    expect(computeFullName(null, {})).toBe('');
  });

  it('null parts are skipped instead of rendering "null"', () => {
    expect(computeFullName({ first_name: null, last_name: 'Lovelace' }, {})).toBe('Lovelace');
    expect(computeFullName({ first_name: null, last_name: null }, { firstName: 'Grace' })).toBe('Grace');
  });

  it('surrounding whitespace is trimmed and blank parts dropped', () => {
    expect(computeFullName({ first_name: '  Ada  ', last_name: 'Lovelace' }, {})).toBe('Ada Lovelace');
    expect(computeFullName(STORED, { firstName: '   ' })).toBe('Lovelace');
  });
});
