/**
 * Authentication Backend-for-Frontend.
 * Supabase access/refresh tokens remain in Secure, HttpOnly API-host cookies.
 * The browser receives only a sanitized user object and a CSRF nonce.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { createClient, type User } from '@supabase/supabase-js';
import { env, supabaseConfigured } from '../config/env';
import { getServiceClient } from '../services/supabase.service';
import { authLimiter } from '../middleware/rateLimit';
import { requireAuth, requireAuthForSession } from '../middleware/auth';
import {
  assertCsrf, assertTrustedOrigin, clearSessionCookies, ensureCsrfCookie,
  readAuthCookies, setSessionCookies,
} from '../services/session-cookie.service';
import { badRequest, notConfigured, unauthenticated, ok } from '../utils/httpError';

export const authRouter = Router();

authRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

function trustedOrigin(req: Request, _res: Response, next: NextFunction): void {
  try { assertTrustedOrigin(req); next(); } catch (error) { next(error); }
}
function csrfGuard(req: Request, _res: Response, next: NextFunction): void {
  try { assertCsrf(req); next(); } catch (error) { next(error); }
}
function createAuthClient() {
  if (!supabaseConfigured()) throw notConfigured('Supabase Auth');
  return createClient(env.supabase.url, env.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
function safeUser(user: User) {
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const firstName = String(metadata.first_name || '');
  const lastName = String(metadata.last_name || '');
  return {
    id: user.id,
    email: user.email || '',
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' ') || String(metadata.full_name || 'Customer'),
    phone: user.phone || metadata.phone || null,
    hasImage: Boolean(metadata.avatar_url),
    imageUrl: String(metadata.avatar_url || ''),
  };
}
function requireEmail(value: unknown): string {
  if (typeof value !== 'string') throw badRequest('A valid email address is required.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest('A valid email address is required.');
  }
  return email;
}
async function getSessionClient(req: Request) {
  if (!req.auth) throw unauthenticated();
  const cookies = readAuthCookies(req);
  if (!cookies.refreshToken) throw unauthenticated('Your session has expired. Please sign in again.');
  const client = createAuthClient();
  const { error } = await client.auth.setSession({
    access_token: req.auth.supabaseJwt,
    refresh_token: cookies.refreshToken,
  });
  if (error) throw unauthenticated('Your session has expired. Please sign in again.');
  return client;
}
async function findAdminUser(userId: string): Promise<boolean> {
  const db = getServiceClient();
  const { data: profile, error: profileError } = await db.from('profiles')
    .select('id').eq('supabase_user_id', userId).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile) return false;
  const { data: admin, error } = await db.from('admin_users')
    .select('profile_id').eq('profile_id', profile.id).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(admin);
}

/** Create a CSRF nonce. Browser code receives the nonce in JSON, not cookies. */
authRouter.get('/csrf', trustedOrigin, (req, res) => {
  const existing = readAuthCookies(req).csrfToken;
  const csrfToken = ensureCsrfCookie(res, existing);
  ok(res, { csrfToken }, 'CSRF token ready');
});

/** Send the numeric OTP; registration is explicitly requested by the client. */
authRouter.post('/otp', authLimiter, csrfGuard, async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const email = requireEmail(body.email);
    const shouldCreateUser = body.shouldCreateUser === true;
    let metadata: Record<string, unknown> | undefined;
    if (shouldCreateUser) {
      const candidate = body.data;
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw badRequest('Registration details are required.');
      }
      metadata = candidate as Record<string, unknown>;
    }
    const { error } = await createAuthClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser, ...(metadata ? { data: metadata } : {}) },
    });
    if (error) throw badRequest('Could not send the email verification code. Check the address and try again.');
    ok(res, { sent: true }, 'Verification code sent');
  } catch (error) { next(error); }
});

/** Exchange a six-digit OTP for server-set cookies. Passwords are saved here too. */
authRouter.post('/verify-otp', authLimiter, csrfGuard, async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const email = requireEmail(body.email);
    const token = typeof body.token === 'string' ? body.token.replace(/\s+/g, '') : '';
    if (!/^\d{6}$/.test(token)) throw badRequest('Enter the six-digit email code.');
    const password = body.password;
    if (password !== undefined &&
        (typeof password !== 'string' || password.length < 8 || password.length > 128)) {
      throw badRequest('Password must contain between 8 and 128 characters.');
    }

    const client = createAuthClient();
    const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (error || !data.session || !data.user) {
      throw unauthenticated('The verification code is invalid or expired. Request a new code.');
    }

    let session = data.session;
    let user = data.user;
    if (typeof password === 'string') {
      const { error: setError } = await client.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (setError) throw unauthenticated('Could not establish the registration session.');
      const { data: updated, error: passwordError } = await client.auth.updateUser({ password });
      if (passwordError || !updated.user) {
        throw badRequest('Email verified, but the password could not be saved. Sign in and use password recovery.');
      }
      user = updated.user;
      const refreshed = await client.auth.getSession();
      if (refreshed.data.session) session = refreshed.data.session;
    }

    const csrfToken = setSessionCookies(res, session);
    ok(res, { user: safeUser(user), csrfToken }, 'Email verified; secure session established');
  } catch (error) { next(error); }
});

/** Return only profile details; never return access/refresh JWTs to the browser. */
authRouter.get('/session', requireAuthForSession, async (req, res, next) => {
  try {
    const client = await getSessionClient(req);
    const { data: userResult, error: userError } = await client.auth.getUser();
    if (userError || !userResult.user) throw unauthenticated();
    const { data: assurance, error: assuranceError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel(req.auth!.supabaseJwt);
    if (assuranceError) throw new Error(assuranceError.message);
    const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
    if (factorsError) throw new Error(factorsError.message);
    const isAdmin = await findAdminUser(userResult.user.id);
    const verified = (factors.totp || []).filter((factor) => factor.status === 'verified');
    const mfaRequired = !isAdmin && verified.length > 0 && assurance.currentLevel !== 'aal2';
    ok(res, {
      user: safeUser(userResult.user),
      csrfToken: readAuthCookies(req).csrfToken,
      mfaRequired,
      mfaFactorId: mfaRequired ? verified[0].id : null,
      currentLevel: assurance.currentLevel,
      nextLevel: assurance.nextLevel,
    }, 'Session active');
  } catch (error) { next(error); }
});

/** Refresh server-side; Supabase token rotation is reflected only in cookies. */
authRouter.post('/refresh', csrfGuard, async (req, res, next) => {
  try {
    const refreshToken = readAuthCookies(req).refreshToken;
    if (!refreshToken) {
      clearSessionCookies(res);
      throw unauthenticated('Your session has expired. Please sign in again.');
    }
    const { data, error } = await createAuthClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) {
      clearSessionCookies(res);
      throw unauthenticated('Your session has expired. Please sign in again.');
    }
    const csrfToken = setSessionCookies(res, data.session, readAuthCookies(req).csrfToken);
    ok(res, { user: safeUser(data.user), csrfToken }, 'Session refreshed');
  } catch (error) { next(error); }
});

/** MFA step-up endpoints may read an AAL1 cookie but require CSRF on all writes. */
authRouter.use('/mfa', requireAuthForSession);

authRouter.get('/mfa/assurance', async (req, res, next) => {
  try {
    const client = await getSessionClient(req);
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(req.auth!.supabaseJwt);
    if (error) throw new Error(error.message);
    ok(res, data, 'Authenticator assurance');
  } catch (error) { next(error); }
});
authRouter.get('/mfa/factors', async (req, res, next) => {
  try {
    const client = await getSessionClient(req);
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) throw new Error(error.message);
    ok(res, data, 'MFA factors');
  } catch (error) { next(error); }
});
authRouter.post('/mfa/enroll', async (req, res, next) => {
  try {
    const client = await getSessionClient(req);
    const { data, error } = await client.auth.mfa.enroll({
      factorType: 'totp', friendlyName: 'Meridian Global Accounts',
    });
    if (error || !data) throw badRequest('Could not start authenticator enrollment.');
    ok(res, data, 'Authenticator enrollment started');
  } catch (error) { next(error); }
});
authRouter.post('/mfa/challenge', async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    if (typeof body.factorId !== 'string' || !body.factorId) throw badRequest('MFA factor is required.');
    const { data, error } = await (await getSessionClient(req)).auth.mfa.challenge({ factorId: body.factorId });
    if (error || !data) throw badRequest('Could not start the authenticator challenge.');
    ok(res, data, 'Authenticator challenge created');
  } catch (error) { next(error); }
});
authRouter.post('/mfa/verify', async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const code = typeof body.code === 'string' ? body.code.replace(/\s+/g, '') : '';
    if (typeof body.factorId !== 'string' || !body.factorId ||
        typeof body.challengeId !== 'string' || !body.challengeId || !/^\d{6}$/.test(code)) {
      throw badRequest('Enter the six-digit authenticator code.');
    }
    const client = await getSessionClient(req);
    const { error } = await client.auth.mfa.verify({
      factorId: body.factorId, challengeId: body.challengeId, code,
    });
    if (error) throw badRequest('The authenticator code is invalid or expired.');
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData.session) throw unauthenticated('The verified session could not be renewed.');
    const csrfToken = setSessionCookies(res, sessionData.session, readAuthCookies(req).csrfToken);
    ok(res, { verified: true, csrfToken }, 'Authenticator verified');
  } catch (error) { next(error); }
});
authRouter.post('/mfa/unenroll', async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    if (typeof body.factorId !== 'string' || !body.factorId) throw badRequest('MFA factor is required.');
    const client = await getSessionClient(req);
    const { error } = await client.auth.mfa.unenroll({ factorId: body.factorId });
    if (error) throw badRequest('Could not remove the authenticator factor. Complete a fresh sign-in if step-up verification is required.');
    const { data: refreshed } = await client.auth.refreshSession();
    if (refreshed.session) {
      const csrfToken = setSessionCookies(res, refreshed.session, readAuthCookies(req).csrfToken);
      ok(res, { removed: true, csrfToken }, 'Authenticator removed');
      return;
    }
    ok(res, { removed: true }, 'Authenticator removed');
  } catch (error) { next(error); }
});

/** Password changes also happen server-side; password never enters local/session storage. */
authRouter.post('/password', requireAuth, async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
      throw badRequest('Password must contain between 8 and 128 characters.');
    }
    const client = await getSessionClient(req);
    const { error } = await client.auth.updateUser({ password: body.password });
    if (error) throw badRequest('Could not update the password.');
    ok(res, { updated: true }, 'Password updated');
  } catch (error) { next(error); }
});

/** Revoke the active session (or other/all sessions) and clear local cookies. */
authRouter.post('/logout', requireAuthForSession, async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const scope = body.scope === 'others' || body.scope === 'global' ? body.scope : 'local';
    const client = await getSessionClient(req);
    const { error } = await client.auth.signOut({ scope });
    if (error) throw badRequest('Could not sign out this session.');
    if (scope !== 'others') clearSessionCookies(res);
    ok(res, { signedOut: scope !== 'others', scope }, 'Sign-out request completed');
  } catch (error) { next(error); }
});
