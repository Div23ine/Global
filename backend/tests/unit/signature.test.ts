import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyProviderSignature } from '../../src/services/deposits.service';
import { setServiceClientForTests } from '../../src/services/supabase.service';

const SECRET = 'whsec_test_secret';

describe('payment provider webhook signature', () => {
  beforeAll(() => {
    // Never touch a real Supabase project from unit tests.
    setServiceClientForTests({ rpc: async () => ({ data: null, error: null }) } as never);
  });
  afterAll(() => {
    setServiceClientForTests(null);
  });

  const body = JSON.stringify({ type: 'confirmed', reference: 'DEP-2026-000001', providerRef: 'abc' });
  const sign = (secret: string, payload: string) =>
    createHmac('sha256', secret).update(payload).digest('hex');

  it('accepts a correct signature', () => {
    expect(verifyProviderSignature('test-provider', body, sign(SECRET, body))).toBe(true);
  });

  it('rejects a wrong secret', () => {
    expect(verifyProviderSignature('test-provider', body, sign('other', body))).toBe(false);
  });

  it('rejects tampered payloads', () => {
    const sig = sign(SECRET, body);
    expect(verifyProviderSignature('test-provider', body + ' ', sig)).toBe(false);
  });

  it('rejects unknown providers and missing signatures', () => {
    expect(verifyProviderSignature('other-provider', body, sign(SECRET, body))).toBe(false);
    expect(verifyProviderSignature('test-provider', body, undefined)).toBe(false);
  });

  it('rejects non-hex garbage without throwing', () => {
    expect(verifyProviderSignature('test-provider', body, 'not-hex!!')).toBe(false);
  });
});
