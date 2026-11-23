/**
 * CORS origin policy contract tests (audit F-8 regression).
 *
 * Promise under test: the allowlist admits the configured frontend origin
 * with proper CORS headers, and denies every other origin CLEANLY —
 * without CORS headers and without raising a 500 through the error
 * handler (the old behaviour logged a spurious INTERNAL error and
 * returned HTTP 500 for a mere origin denial).
 *
 * These tests boot the real Express app via supertest; the health
 * endpoint is public so no credentials are involved.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';

const app = createApp();
const ALLOWED = env.corsOrigin[0] ?? 'http://localhost:4173';
const DISALLOWED = 'https://definitely-not-meridian.example';

describe('CORS origin policy', () => {
  it('admits the configured origin with CORS headers', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', ALLOWED);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('denies a disallowed origin cleanly — no CORS headers, never a 500', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', DISALLOWED);
    // The request itself proceeds (CORS is browser-side read protection);
    // the denial means the response carries no CORS grant for that origin.
    expect(res.status).not.toBe(500);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('denies a disallowed-origin preflight cleanly — no CORS headers, never a 500', async () => {
    // With cb(null, false) the cors middleware is skipped for this origin:
    // the preflight falls through to Express's automatic OPTIONS response
    // (200, no CORS grant) instead of the old HTTP 500. Browsers block the
    // request because no access-control-allow-origin is present.
    const res = await request(app).options('/api/v1/health')
      .set('Origin', DISALLOWED)
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).not.toBe(500);
    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers an allowed-origin preflight with CORS headers', async () => {
    const res = await request(app).options('/api/v1/health')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, Authorization');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('same-origin (no Origin header) requests are unaffected', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
  });
});
