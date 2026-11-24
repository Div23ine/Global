/**
 * Legacy bearer-transport bridge (auth.ts).
 *
 * Contract: an Authorization: Bearer <token> header from a trusted Origin is
 * accepted while the cookie rollout bridge exists. The bridge previously used
 * a double-escaped regex literal that could never match a real header,
 * silently disabling the documented transport — this test exists to keep that
 * regression impossible.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { requireAuth, setJwtVerifierForTests } from '../../src/middleware/auth';
import { setServiceClientForTests } from '../../src/services/supabase.service';
import { ApiError } from '../../src/utils/httpError';

/** The middleware reports failures via next(err) instead of throwing. */
function nextCapture(): { fn: NextFunction; first: () => unknown } {
  const seen: unknown[] = [];
  const fn = ((err?: unknown) => { seen.push(err); }) as NextFunction;
  return { fn, first: () => seen[0] };
}

const TRUSTED_ORIGIN = 'http://localhost:4173'; // env.corsOrigin default
const TOKEN = 'legacy-access-token';

function makeReq(headers: Record<string, string>): Request {
  return {
    headers,
    get: (name: string) => headers[name.toLowerCase()],
    method: 'GET',
    path: '/api/v1/profile',
    originalUrl: '/api/v1/profile',
  } as unknown as Request;
}

const profileRow = { id: 'profile_legacy_1', email: 'legacy@example.com', status: 'active' };

function profileDbStub() {
  const maybeSingle = () => Promise.resolve({ data: profileRow, error: null });
  const eq = () => ({ maybeSingle });
  const select = () => ({ eq });
  return {
    from: () => ({ select }),
    rpc: async () => ({ data: null, error: null }),
  } as never;
}

describe('legacy bearer bridge', () => {
  beforeAll(() => {
    setJwtVerifierForTests(async (header) => {
      if (!header.startsWith('Bearer ')) throw new Error('not a bearer header');
      return { sub: 'auth-uuid-legacy-1', email: 'legacy@example.com' };
    });
    setServiceClientForTests(profileDbStub());
  });
  afterAll(() => {
    setJwtVerifierForTests(null);
    setServiceClientForTests(null);
  });

  it('accepts a standard "Bearer <token>" header from a trusted origin', async () => {
    let nextCalled = false;
    await requireAuth(
      makeReq({ authorization: `Bearer ${TOKEN}`, origin: TRUSTED_ORIGIN }),
      {} as Response,
      (() => { nextCalled = true; }) as NextFunction,
    );
    expect(nextCalled).toBe(true);
  });

  it('rejects backslash-mangled headers the old double-escaped regex accepted', async () => {
    const next = nextCapture();
    await requireAuth(
      makeReq({ authorization: 'Bearer\\ss' + TOKEN, origin: TRUSTED_ORIGIN }),
      {} as Response,
      next.fn,
    );
    const err = next.first() as ApiError | undefined;
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('UNAUTHENTICATED');
  });

  it('still rejects bearer headers from untrusted origins', async () => {
    const next = nextCapture();
    await requireAuth(
      makeReq({ authorization: `Bearer ${TOKEN}`, origin: 'https://evil.example' }),
      {} as Response,
      next.fn,
    );
    const err = next.first() as ApiError | undefined;
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('FORBIDDEN');
  });
});
