import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { applyWorkerEnv, env } from '../../src/config/env';
import {
  assertCsrf,
  clearSessionCookies,
  readAuthCookies,
  setSessionCookies,
} from '../../src/services/session-cookie.service';

const originalNodeEnv = env.nodeEnv;
const originalOrigins = env.corsOrigin.join(',');

function productionMode() {
  applyWorkerEnv({
    NODE_ENV: 'production',
    CORS_ORIGIN: 'https://meridian.uk.com,https://www.meridian.uk.com',
  });
}

function mockResponse() {
  const cookies: string[] = [];
  const response = {
    append: vi.fn((_name: string, value: string) => { cookies.push(value); return response; }),
    setHeader: vi.fn(),
  } as unknown as Response;
  return { response, cookies };
}

afterEach(() => {
  applyWorkerEnv({ NODE_ENV: originalNodeEnv, CORS_ORIGIN: originalOrigins });
});

describe('production session cookie security', () => {
  it('sets access, refresh and CSRF cookies as Secure, HttpOnly, SameSite=Lax host-only cookies', () => {
    productionMode();
    const { response, cookies } = mockResponse();

    setSessionCookies(response, {
      access_token: 'access.jwt.value',
      refresh_token: 'refresh.secret.value',
      expires_in: 3600,
    });

    expect(cookies).toHaveLength(3);
    expect(cookies.map((value) => value.split('=')[0]).sort()).toEqual([
      '__Host-mg-access',
      '__Host-mg-csrf',
      '__Host-mg-refresh',
    ]);

    for (const value of cookies) {
      expect(value).toContain('Path=/');
      expect(value).toContain('Secure');
      expect(value).toContain('HttpOnly');
      expect(value).toContain('SameSite=Lax');
      expect(value).not.toMatch(/;\s*Domain=/i);
    }
  });

  it('does not expose access or refresh tokens in readable browser cookies', () => {
    productionMode();
    const { response, cookies } = mockResponse();
    setSessionCookies(response, {
      access_token: 'access.jwt.value',
      refresh_token: 'refresh.secret.value',
      expires_in: 3600,
    });

    const access = cookies.find((value) => value.startsWith('__Host-mg-access='));
    const refresh = cookies.find((value) => value.startsWith('__Host-mg-refresh='));
    expect(access).toContain('HttpOnly');
    expect(refresh).toContain('HttpOnly');
  });

  it('accepts only a matching CSRF cookie/header pair from an allowed Origin', () => {
    productionMode();
    const req = {
      headers: { cookie: '__Host-mg-csrf=nonce-value' },
      get: (name: string) => {
        const normalized = name.toLowerCase();
        if (normalized === 'origin') return 'https://meridian.uk.com';
        if (normalized === 'x-meridian-csrf') return 'nonce-value';
        return undefined;
      },
    } as unknown as Request;

    expect(readAuthCookies(req).csrfToken).toBe('nonce-value');
    expect(() => assertCsrf(req)).not.toThrow();
  });

  it('rejects mismatched CSRF values and unapproved origins', () => {
    productionMode();
    const mismatch = {
      headers: { cookie: '__Host-mg-csrf=expected' },
      get: (name: string) => name.toLowerCase() === 'origin'
        ? 'https://meridian.uk.com'
        : name.toLowerCase() === 'x-meridian-csrf' ? 'wrong' : undefined,
    } as unknown as Request;
    const foreignOrigin = {
      headers: { cookie: '__Host-mg-csrf=expected' },
      get: (name: string) => name.toLowerCase() === 'origin'
        ? 'https://attacker.example'
        : name.toLowerCase() === 'x-meridian-csrf' ? 'expected' : undefined,
    } as unknown as Request;

    expect(() => assertCsrf(mismatch)).toThrow();
    expect(() => assertCsrf(foreignOrigin)).toThrow();
  });

  it('expires all three cookies on logout', () => {
    productionMode();
    const { response, cookies } = mockResponse();
    clearSessionCookies(response);

    expect(cookies).toHaveLength(3);
    for (const value of cookies) {
      expect(value).toContain('Max-Age=0');
      expect(value).toContain('Secure');
      expect(value).toContain('HttpOnly');
      expect(value).toContain('Path=/');
      expect(value).not.toMatch(/;\s*Domain=/i);
    }
  });
});
