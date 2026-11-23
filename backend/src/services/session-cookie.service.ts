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

function cookieNames() {
  // Resolve at request time: Cloudflare Worker bindings are applied after
  // module evaluation, so production mode is not reliable at import time.
  const prefix = env.isProduction ? '__Host-mg-' : 'mg-';
  return { access: prefix + 'access', refresh: prefix + 'refresh', csrf: prefix + 'csrf' };
}
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
  const names = cookieNames();
  return {
    accessToken: cookies[names.access] || null,
    refreshToken: cookies[names.refresh] || null,
    csrfToken: cookies[names.csrf] || null,
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
  const names = cookieNames();
  appendCookie(res, cookie(names.access, session.access_token, accessAge));
  appendCookie(res, cookie(names.refresh, session.refresh_token, REFRESH_COOKIE_TTL));
  appendCookie(res, cookie(names.csrf, csrfToken, REFRESH_COOKIE_TTL));
  return csrfToken;
}

export function clearSessionCookies(res: Response): void {
  res.setHeader('Cache-Control', 'no-store, private');
  const names = cookieNames();
  const expiry = 'Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  const secure = env.isProduction ? '; Secure' : '';
  appendCookie(res, names.access + '=; ' + expiry + secure + '; HttpOnly');
  appendCookie(res, names.refresh + '=; ' + expiry + secure + '; HttpOnly');
  appendCookie(res, names.csrf + '=; ' + expiry + secure + '; HttpOnly');
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
  appendCookie(res, cookie(cookieNames().csrf, token, REFRESH_COOKIE_TTL));
  return token;
}
