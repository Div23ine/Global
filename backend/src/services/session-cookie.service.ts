/**
 * First-party session cookies. Supabase tokens never enter browser JS.
 * Production cookies use __Host-, Secure, HttpOnly, SameSite=Lax and Path=/.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../config/env';
import { forbidden } from '../utils/httpError';

export interface CookieSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

export interface AuthCookies {
  accessToken: string | null;
  refreshToken: string | null;
  csrfToken: string | null;
}

const PREFIX = env.isProduction ? '__Host-mg-' : 'mg-';
const ACCESS = PREFIX + 'access';
const REFRESH = PREFIX + 'refresh';
const CSRF = PREFIX + 'csrf';
const REFRESH_COOKIE_TTL = 12 * 60 * 60;

function readCookies(req: Request): Record<string, string> {
  const result: Record<string, string> = {};
  (req.headers.cookie || '').split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index <= 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { result[key] = decodeURIComponent(value); }
    catch { result[key] = value; }
  });
  return result;
}

export function readAuthCookies(req: Request): AuthCookies {
  const cookies = readCookies(req);
  return {
    accessToken: cookies[ACCESS] || null,
    refreshToken: cookies[REFRESH] || null,
    csrfToken: cookies[CSRF] || null,
  };
}

function cookie(name: string, value: string, maxAge: number): string {
  const parts = [
    'Path=/',
    'SameSite=Lax',
    'Max-Age=' + Math.max(0, Math.floor(maxAge)),
  ];
  if (env.isProduction) parts.push('Secure');
  parts.push('HttpOnly');
  // No Domain attribute: __Host- cookies are host-only and cannot be set by
  // sibling subdomains. In production they are scoped to api.meridian.uk.com.
  return name + '=' + encodeURIComponent(value) + '; ' + parts.join('; ');
}

function appendCookie(res: Response, value: string): void {
  res.append('Set-Cookie', value);
}

export function setSessionCookies(
  res: Response,
  session: CookieSession,
  existingCsrf?: string | null,
): string {
  const accessAge = session.expires_in && session.expires_in > 0 ? session.expires_in : 3600;
  const csrfToken = existingCsrf || randomBytes(32).toString('hex');
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  appendCookie(res, cookie(ACCESS, session.access_token, accessAge));
  appendCookie(res, cookie(REFRESH, session.refresh_token, REFRESH_COOKIE_TTL));
  appendCookie(res, cookie(CSRF, csrfToken, REFRESH_COOKIE_TTL));
  return csrfToken;
}

export function clearSessionCookies(res: Response): void {
  res.setHeader('Cache-Control', 'no-store, private');
  const expiry = 'Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  const secure = env.isProduction ? '; Secure' : '';
  appendCookie(res, ACCESS + '=; ' + expiry + secure + '; HttpOnly');
  appendCookie(res, REFRESH + '=; ' + expiry + secure + '; HttpOnly');
  appendCookie(res, CSRF + '=; ' + expiry + secure + '; HttpOnly');
}

export function assertTrustedOrigin(req: Request): void {
  const origin = req.get('origin');
  if (!origin || !env.corsOrigin.includes(origin)) {
    throw forbidden('Request origin is not allowed');
  }
}

export function assertCsrf(req: Request): void {
  assertTrustedOrigin(req);
  const cookieToken = readAuthCookies(req).csrfToken || '';
  const headerToken = req.get('x-meridian-csrf') || '';
  if (!cookieToken || !headerToken) throw forbidden('CSRF validation failed');
  const cookieBytes = Buffer.from(cookieToken);
  const headerBytes = Buffer.from(headerToken);
  if (cookieBytes.length !== headerBytes.length || !timingSafeEqual(cookieBytes, headerBytes)) {
    throw forbidden('CSRF validation failed');
  }
}

export function ensureCsrfCookie(res: Response, existingToken?: string | null): string {
  const token = existingToken || randomBytes(32).toString('hex');
  res.setHeader('Cache-Control', 'no-store, private');
  appendCookie(res, cookie(CSRF, token, REFRESH_COOKIE_TTL));
  return token;
}
