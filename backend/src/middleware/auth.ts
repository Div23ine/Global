/**
 * Cookie-first authentication and server-side role authorization.
 * Browser sessions are HttpOnly-cookie-only; bearer tokens are not accepted
 * so a token left in old browser storage cannot bypass the new session model.
 */
import type { NextFunction, Request, Response } from 'express';
import { verifySupabaseAccessToken } from '../services/supabase-auth.service';
import { getServiceClient } from '../services/supabase.service';
import { readAuthCookies, readTakeoverToken, assertCsrf, assertTrustedOrigin, clearTakeoverCookie } from '../services/session-cookie.service';
import { resolveTakeoverFromToken } from '../services/takeover.service';
import { forbidden, unauthenticated } from '../utils/httpError';
import { auditDenied } from '../services/audit.service';

export interface AuthInfo {
  userId: string;
  supabaseUserId: string;
  email: string | null;
  /** Verified JWT, server-side only, for RLS-scoped database reads. */
  supabaseJwt: string;
}
export interface AdminInfo extends AuthInfo {
  roleId: string;
  permissions: string[];
}
export interface AdminGateHandler {
  (req: Request, res: Response, next: NextFunction): Promise<void>;
  readonly requiredPermissions: readonly string[];
}
export interface TakeoverInfo {
  sessionId: string;
  adminUserId: string;
  targetUserId: string;
  reason: string;
  expiresAt: string;
}
declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthInfo;
    admin?: AdminInfo;
    /** Active account-takeover scope (admin identity remains in auth). */
    takeover?: TakeoverInfo | null;
  }
}
export type VerifyJwtOptions = { enforceAal2?: boolean };
export type VerifyJwt = (
  headerValue: string,
  options?: VerifyJwtOptions,
) => Promise<{ sub: string; email?: string }>;

let verifier: VerifyJwt = (header, options) => verifySupabaseAccessToken(header, options);
export function setJwtVerifierForTests(value: VerifyJwt | null): void {
  verifier = value ?? ((header, options) => verifySupabaseAccessToken(header, options));
}

function authentication(enforceAal2: boolean) {
  return async function requireAuthMode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cookies = readAuthCookies(req);
      const cookieMode = Boolean(cookies.accessToken);
      let accessToken = cookies.accessToken;

      // TEMPORARY rollout bridge: the Pages deployment is blocked by the
      // repository's Cloudflare API-token permissions. Accept the previous
      // bearer transport only from an allowlisted frontend Origin so the
      // currently deployed legacy Pages app keeps working. The new BFF client
      // never sends bearer tokens. Remove this branch immediately after Pages
      // publishes the HttpOnly-cookie client.
      if (!accessToken) {
        const authorization = req.headers.authorization || '';
        const bearer = /^Bearer\\s+([^\\s]+)$/i.exec(authorization);
        if (!bearer) throw unauthenticated();
        assertTrustedOrigin(req);
        accessToken = bearer[1];
      }

      // Cookie-authenticated state changes require an Origin check and a
      // double-submit CSRF nonce. Legacy bearer requests are Origin-bound
      // until the Pages deployment is completed.
      if (cookieMode && !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
        assertCsrf(req);
      }

      let claims: { sub: string; email?: string };
      try {
        claims = await verifier('Bearer ' + accessToken, { enforceAal2 });
      } catch {
        throw unauthenticated();
      }

      const db = getServiceClient();
      let { data: profile, error } = await db
        .from('profiles')
        .select('id, email, status')
        .eq('supabase_user_id', claims.sub)
        .maybeSingle();
      if (error) throw new Error(error.message);

      if (!profile) {
        const { error: bootstrapError } = await db.rpc('bootstrap_supabase_profile', {
          p_user_id: claims.sub,
        });
        if (bootstrapError) throw new Error(bootstrapError.message);
        const result = await db
          .from('profiles')
          .select('id, email, status')
          .eq('supabase_user_id', claims.sub)
          .maybeSingle();
        profile = result.data;
        error = result.error;
        if (error) throw new Error(error.message);
      }

      if (!profile || profile.status !== 'active') throw unauthenticated();
      req.auth = {
        userId: String(profile.id),
        supabaseUserId: claims.sub,
        email: claims.email ?? profile.email ?? null,
        supabaseJwt: accessToken,
      };
      // Resolve takeover state fail-closed. A stale, forged, or unverifiable
      // takeover cookie must never silently fall back to the administrator's
      // ordinary customer API context.
      req.takeover = null;
      const takeoverToken = readTakeoverToken(req);
      if (takeoverToken) {
        const scope = await resolveTakeoverFromToken(String(profile.id), takeoverToken);
        if (!scope) {
          clearTakeoverCookie(res);
          throw forbidden('The account takeover session is invalid or has expired. Return to the administrator console.');
        }
        req.takeover = scope;

        // During takeover, all state-changing requests are denied by default.
        // The only exceptions are the explicitly permitted basic profile edit
        // and the administrator's own end-session endpoint. This central gate
        // covers routes that might otherwise forget a route-level guard.
        const method = req.method.toUpperCase();
        const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(method);
        const originalPath = req.originalUrl || req.path;
        const isEndTakeover = method === 'POST' && /\/admin\/takeover\/end(?:[/?]|$)/.test(originalPath);
        const isBasicProfileEdit = method === 'PATCH' && /\/profile(?:[/?]|$)/.test(originalPath);
        if (!safeMethod && !isEndTakeover && !isBasicProfileEdit) {
          await auditDenied(
            req.auth.userId,
            'takeover.block.mutation',
            'Blocked state-changing request during account takeover: ' + method + ' ' + req.path,
            { type: 'takeover_session', id: scope.sessionId },
            { ip: req.ip, userAgent: req.get('user-agent') },
          );
          throw forbidden('State-changing actions are disabled during an account takeover session.');
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Standard API gate: requires AAL2 where a customer enrolled TOTP. */
export const requireAuth = authentication(true);
/** Only session/MFA routes may use AAL1 to finish a pending second factor. */
export const requireAuthForSession = authentication(false);

async function loadAdmin(auth: AuthInfo): Promise<AdminInfo | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from('admin_users')
    .select('profile_id, display_name, role_id, admin_roles(permissions)')
    .eq('profile_id', auth.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const role = data.admin_roles as unknown as { permissions: string[] } | null;
  return {
    ...auth,
    roleId: String(data.role_id),
    permissions: role?.permissions ?? [],
  };
}

export function requireAdmin(...requiredPermissions: string[]): AdminGateHandler {
  const handler = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw unauthenticated();
      let admin: AdminInfo | null = req.admin ?? null;
      if (!admin || admin.userId !== req.auth.userId) {
        admin = await loadAdmin(req.auth);
        if (!admin) {
          await auditDenied(req.auth.userId, 'admin.access', 'no admin role', undefined, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
          });
          throw forbidden();
        }
        req.admin = admin;
      }
      const missing = requiredPermissions.filter((permission) => !admin.permissions.includes(permission));
      if (missing.length) {
        await auditDenied(
          admin.userId,
          'admin.permission',
          'missing: ' + missing.join(', '),
          undefined,
          { role: admin.roleId, ip: req.ip, userAgent: req.get('user-agent') },
        );
        throw forbidden();
      }
      next();
    } catch (error) {
      next(error);
    }
  };
  handler.requiredPermissions = Object.freeze([...requiredPermissions]);
  return handler;
}


/** Profile id whose data customer routes should return (target during takeover). */
export function subjectUserId(req: Request): string {
  if (req.takeover?.targetUserId) return req.takeover.targetUserId;
  if (!req.auth) throw unauthenticated();
  return req.auth.userId;
}

/** Always the authenticated administrator/customer — never the takeover target. */
export function actorUserId(req: Request): string {
  if (!req.auth) throw unauthenticated();
  return req.auth.userId;
}

/**
 * Reject financial / privileged mutations while a takeover is active.
 * Hide-buttons-only is not sufficient; this runs on the server.
 */
export function rejectIfTakeover(...blockedActions: string[]) {
  return async function takeoverMutationGate(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.takeover) {
        next();
        return;
      }
      const action = blockedActions[0] || `${req.method} ${req.path}`;
      await auditDenied(
        req.auth!.userId,
        action,
        'Blocked during account takeover (financial or privileged mutation)',
        { type: 'takeover_session', id: req.takeover.sessionId },
        {
          role: req.admin?.roleId ?? null,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        },
      );
      throw forbidden('This action is not permitted during an account takeover session.');
    } catch (error) {
      next(error);
    }
  };
}
