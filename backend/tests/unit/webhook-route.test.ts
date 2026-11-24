/**
 * Route-level webhook verification (supertest).
 *
 * Contract under test: the payment provider signs the exact raw request
 * bytes; the route must verify the HMAC over those bytes — never over a
 * re-serialization (JSON.stringify of the express.raw Buffer produces
 * '{"type":"Buffer","data":[...]}' and rejects every legitimate webhook) —
 * and must accept only whitelisted terminal event types.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/app';
import { setServiceClientForTests } from '../../src/services/supabase.service';

const SECRET = 'whsec_test_secret';
const PROVIDER = 'test-provider';

const rawBody = JSON.stringify({
  type: 'confirmed',
  reference: 'DEP-2026-000042',
  providerRef: 'wire-abc-123',
});

const sign = (payload: string) => createHmac('sha256', SECRET).update(payload).digest('hex');

describe('payment webhook route', () => {
  beforeAll(() => {
    // Never touch a real Supabase project from unit tests. The audit writer
    // swallows its own failures, so a minimal stub is enough here.
    setServiceClientForTests({
      rpc: async () => ({ data: {}, error: null }),
      from: () => ({ insert: async () => ({ error: null }) }),
    } as never);
  });
  afterAll(() => {
    setServiceClientForTests(null);
  });

  it('accepts a correctly signed webhook (signature over the exact raw bytes)', async () => {
    const app = createApp();
    const res = await request(app)
      .post(`/api/v1/webhooks/payments/${PROVIDER}`)
      .set('Content-Type', 'application/json')
      .set('x-meridian-signature', sign(rawBody))
      .send(rawBody);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects a signature computed over different bytes', async () => {
    const app = createApp();
    const res = await request(app)
      .post(`/api/v1/webhooks/payments/${PROVIDER}`)
      .set('Content-Type', 'application/json')
      .set('x-meridian-signature', sign(rawBody + ' '))
      .send(rawBody);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid signature');
  });

  it('rejects unknown event types before any state change', async () => {
    const app = createApp();
    const body = JSON.stringify({ type: 'pending', reference: 'DEP-2026-000042' });
    const res = await request(app)
      .post(`/api/v1/webhooks/payments/${PROVIDER}`)
      .set('Content-Type', 'application/json')
      .set('x-meridian-signature', sign(body))
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Unsupported webhook event type');
  });

  it('rejects a validly signed event without a reference', async () => {
    const app = createApp();
    const body = JSON.stringify({ type: 'confirmed', providerRef: 'x' });
    const res = await request(app)
      .post(`/api/v1/webhooks/payments/${PROVIDER}`)
      .set('Content-Type', 'application/json')
      .set('x-meridian-signature', sign(body))
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Missing reference');
  });
});
