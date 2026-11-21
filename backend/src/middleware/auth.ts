/**
 * Authentication & authorization middleware.
 *
 * Supabase Auth validates the bearer access token. Each Auth UUID is mapped
 * to a canonical profiles.id so existing financial records keep their owner.
 * Admin permissions are resolved server-side on every request.
 */
import type { NextFunction, Request, Response } from 'express';
import { verifySupabaseAccessToken } from '../services/supabase-auth.service';
import { getServiceClient } from '../services/supabase.service';
import { forbidden, unauthenticated } from '../utils/httpError';
import { auditDenied } from '../services/audit.service';

export interface AuthInfo {
  /** Canonical profiles.id; keeps legacy account/ledger ownership unchanged. */
  userId: string;
  /** Supabase Auth auth.users.id UUID. */
  supabaseUserId: string;
  email: string | null;
  /** Verified Supabase access JWT, forwarded for RLS-scoped reads. */
  supabaseJwt: string;
}

export interface AdminInfo extends AuthInfo {
  roleId: string;
  permissions: string[];
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthInfo;
    admin?: AdminInfo;
  }
}

export type VerifyJwt = (headerValue: string) => Promise<{ sub: string; email?: string }>;

/** Injectable verification seam for middleware tests. */
let verifier: VerifyJwt = (header) => verifySupabaseAccessToken(header);

export function setJwtVerifierForTests(value: VerifyJwt | null): void {
  verifier = value ?? ((header) => verifySupabaseAccessToken(header));
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header) throw unauthenticated();
    const bearer = /^Bearer\\s+([^\\s]+)$/i.exec(header);
    if (!bearer) throw unauthenticated();

    let claims: { sub: string; email?: string };
    try {
      claims = await verifier(header);
    } catch {
      throw unauthenticated();
    }
    const token = bearer[1];
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

    // Account status is checked on every request. This also blocks already
    // issued stateless JWTs after a suspension, ban, or identity deletion.
    if (!profile || profile.status !== 'active') throw unauthenticated();

    req.auth = {
      userId: String(profile.id),
      supabaseUserId: claims.sub,
      email: claims.email ?? profile.email ?? null,
      supabaseJwt: token,
    };
    next();
  } catch (err) {
    next(err);
  }
}

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

/**
 * Admin gate. Usage: requireAdmin('users.read') — the caller's role must
 * include EVERY listed permission (AND semantics). Deny by default.
 */
export function requireAdmin(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      if (missing.length > 0) {
        await auditDenied(
          admin.userId,
          'admin.permission',
          `missing: ${missing.join(', ')}`,
          undefined,
          { role: admin.roleId, ip: req.ip, userAgent: req.get('user-agent') },
        );
        throw forbidden();
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
