/**
 * Authentication & authorization middleware.
 *
 * requireAuth: verifies the Clerk session JWT (JWKS) and attaches
 *   req.auth = { userId, email, clerkJwt }.
 * requireAdmin(...permissions): resolves the caller's admin role from
 *   admin_users and enforces the required permission. Deny by default.
 */
import type { NextFunction, Request, Response } from 'express';
import { verifySessionToken } from '../services/clerk.service';
import { getServiceClient } from '../services/supabase.service';
import { forbidden, unauthenticated } from '../utils/httpError';
import { auditDenied } from '../services/audit.service';

export interface AuthInfo {
  userId: string;
  email: string | null;
  clerkJwt: string;
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

/** Injectable verifier so tests can issue fake identities without env flags. */
let verifier: VerifyJwt = (h) => verifySessionToken(h);

export function setJwtVerifierForTests(v: VerifyJwt | null): void {
  verifier = v ?? ((h) => verifySessionToken(h));
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header) throw unauthenticated();
    const claims = await verifier(header);
    req.auth = {
      userId: claims.sub,
      email: claims.email ?? null,
      clerkJwt: header.startsWith('Bearer ') ? header.slice(7) : header,
    };
    next();
  } catch {
    next(unauthenticated());
  }
}

async function loadAdmin(userId: string): Promise<AdminInfo | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from('admin_users')
    .select('clerk_user_id, display_name, role_id, admin_roles(permissions)')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const role = data.admin_roles as unknown as { permissions: string[] } | null;
  return {
    userId,
    email: null,
    clerkJwt: '',
    roleId: String(data.role_id),
    permissions: role?.permissions ?? [],
  };
}

/**
 * Admin gate. Usage: requireAdmin('users.read') — the caller's role must
 * include EVERY listed permission (AND semantics). When the caller was
 * already resolved by an earlier requireAdmin() in the chain, the cached
 * result is reused.
 */
export function requireAdmin(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw unauthenticated();
      let admin: AdminInfo | null = req.admin ?? null;
      if (!admin || admin.userId !== req.auth.userId) {
        admin = await loadAdmin(req.auth.userId);
        if (!admin) {
          await auditDenied(req.auth.userId, 'admin.access', 'no admin role', undefined, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
          });
          throw forbidden();
        }
        req.admin = admin;
      }
      const missing = requiredPermissions.filter((p) => !admin.permissions.includes(p));
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
