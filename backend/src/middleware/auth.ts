/**
 * Cookie-first authentication and server-side role authorization.
 * Browser sessions are HttpOnly-cookie-only; bearer tokens are not accepted
 * so a token left in old browser storage cannot bypass the new session model.
 */
import type { NextFunction, Request, Response } from 'express';
import { verifySupabaseAccessToken } from '../services/supabase-auth.service';
import { getServiceClient } from '../services/supabase.service';
import { readAuthCookies, assertCsrf } from '../services/session-cookie.service';
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
declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthInfo;
    admin?: AdminInfo;
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
  return async function requireAuthMode(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const cookies = readAuthCookies(req);
      if (!cookies.accessToken) throw unauthenticated();

      // Cookie-authenticated state changes require an allowed Origin and a
      // CSRF nonce echoed in a custom request header.
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) assertCsrf(req);

      let claims: { sub: string; email?: string };
      try {
        claims = await verifier('Bearer ' + cookies.accessToken, { enforceAal2 });
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
        supabaseJwt: cookies.accessToken,
      };
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
