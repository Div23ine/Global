import { describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';

/** Mirror of service token hashing — pure unit coverage without DB. */
function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

describe('takeover token hashing', () => {
  it('produces stable sha256 hex digests', () => {
    const token = 'test-token-value';
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toHaveLength(64);
  });

  it('does not equal the plaintext token', () => {
    const token = randomBytes(32).toString('base64url');
    expect(hashToken(token)).not.toEqual(token);
  });

  it('differs for different tokens', () => {
    expect(hashToken('a')).not.toEqual(hashToken('b'));
  });
});
