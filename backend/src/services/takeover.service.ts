/**
 * Server-controlled administrator account takeover.
 *
 * The administrator retains their own authenticated identity. A separate
 * opaque HttpOnly cookie scopes customer-route reads to the target profile.
 * Customer credentials are never obtained, forged, or exposed.
 */
import { createHash, randomBytes } from 'node:crypto';
import { getServiceClient } from './supabase.service';
import { auditAllowed, auditDenied } from './audit.service';
import { badRequest, forbidden, notFound } from '../utils/httpError';

export const TAKEOVER_TTL_SECONDS = 60 * 60; // 1 hour

export interface TakeoverSessionRow {
  id: string;
  admin_profile_id: string;
  target_profile_id: string;
  token_hash: string;
  reason: string;
  status: 'active' | 'ended' | 'expired';
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  started_ip: string | null;
  started_ua: string | null;
  ended_ip: string | null;
  ended_ua: string | null;
  target_email?: string;
  target_name?: string;
  admin_email?: string;
  admin_name?: string;
}

export interface TakeoverContext {
  sessionId: string;
  adminUserId: string;
  targetUserId: string;
  reason: string;
  expiresAt: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

type Ctx = { ip?: string | null; userAgent?: string | null; role?: string | null };

async function assertTargetIsCustomer(targetUserId: string): Promise<{
  id: string; email: string; full_name: string | null; status: string;
}> {
  const db = getServiceClient();
  const { data: profile, error } = await db
    .from('profiles')
    .select('id, email, full_name, status')
    .eq('id', targetUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw notFound('Customer not found.');
  if (profile.status !== 'active') throw badRequest('Target customer account is not active.');

  const { data: adminRow } = await db
    .from('admin_users')
    .select('profile_id')
    .eq('profile_id', targetUserId)
    .maybeSingle();
  if (adminRow) throw forbidden('Cannot start a takeover against an administrator account.');

  return profile;
}

/** End any active session for this administrator (single active session rule). */
async function endActiveForAdmin(
  adminUserId: string,
  ctx: Ctx,
  reason = 'superseded',
): Promise<void> {
  const db = getServiceClient();
  const now = new Date().toISOString();
  const { data: active } = await db
    .from('admin_takeover_sessions')
    .select('id, target_profile_id')
    .eq('admin_profile_id', adminUserId)
    .eq('status', 'active');
  if (!active?.length) return;
  for (const row of active) {
    await db.from('admin_takeover_sessions').update({
      status: 'ended',
      ended_at: now,
      ended_ip: ctx.ip ?? null,
      ended_ua: ctx.userAgent ?? null,
    }).eq('id', row.id);
    await auditAllowed(
      adminUserId,
      'takeover.end',
      { type: 'takeover_session', id: row.id },
      { targetUserId: row.target_profile_id, reason },
      ctx,
    );
  }
}

export async function startTakeover(
  adminUserId: string,
  targetUserId: string,
  reason: string,
  ctx: Ctx,
): Promise<{ session: TakeoverSessionRow; token: string }> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw badRequest('A takeover reason of at least 3 characters is required.');
  if (adminUserId === targetUserId) throw forbidden('Cannot take over your own account.');

  const target = await assertTargetIsCustomer(targetUserId);
  await endActiveForAdmin(adminUserId, ctx, 'replaced_by_new_session');

  const token = mintToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TAKEOVER_TTL_SECONDS * 1000).toISOString();
  const db = getServiceClient();

  const { data, error } = await db.from('admin_takeover_sessions').insert({
    admin_profile_id: adminUserId,
    target_profile_id: target.id,
    token_hash: tokenHash,
    reason: trimmed,
    status: 'active',
    expires_at: expiresAt,
    started_ip: ctx.ip ?? null,
    started_ua: ctx.userAgent ?? null,
  }).select('*').single();

  if (error) throw new Error(error.message);

  await auditAllowed(
    adminUserId,
    'takeover.start',
    { type: 'takeover_session', id: data.id },
    {
      targetUserId: target.id,
      targetEmail: target.email,
      reason: trimmed,
      expiresAt,
    },
    ctx,
  );

  return { session: data as TakeoverSessionRow, token };
}

export async function endTakeover(
  adminUserId: string,
  sessionId: string | null,
  ctx: Ctx,
): Promise<TakeoverSessionRow | null> {
  const db = getServiceClient();
  let query = db
    .from('admin_takeover_sessions')
    .select('*')
    .eq('admin_profile_id', adminUserId)
    .eq('status', 'active');
  if (sessionId) query = query.eq('id', sessionId);
  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  if (!rows?.length) return null;

  const now = new Date().toISOString();
  let last: TakeoverSessionRow | null = null;
  for (const row of rows) {
    const { data: updated, error: upErr } = await db
      .from('admin_takeover_sessions')
      .update({
        status: 'ended',
        ended_at: now,
        ended_ip: ctx.ip ?? null,
        ended_ua: ctx.userAgent ?? null,
      })
      .eq('id', row.id)
      .select('*')
      .single();
    if (upErr) throw new Error(upErr.message);
    last = updated as TakeoverSessionRow;
    await auditAllowed(
      adminUserId,
      'takeover.end',
      { type: 'takeover_session', id: row.id },
      { targetUserId: row.target_profile_id },
      ctx,
    );
  }
  return last;
}

export async function resolveTakeoverFromToken(
  adminUserId: string,
  token: string | null | undefined,
): Promise<TakeoverContext | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const db = getServiceClient();

  // Re-check the administrator's current role and permission on every
  // request. Removing an admin or revoking takeover.manage must terminate
  // their ability to use an already-issued takeover cookie immediately.
  const { data: admin, error: adminError } = await db
    .from('admin_users')
    .select('profile_id, admin_roles(permissions)')
    .eq('profile_id', adminUserId)
    .maybeSingle();
  if (adminError) throw new Error(adminError.message);
  const role = admin?.admin_roles as unknown as { permissions: string[] } | null;
  if (!admin || !(role?.permissions ?? []).includes('takeover.manage')) return null;

  const { data, error } = await db
    .from('admin_takeover_sessions')
    .select('*')
    .eq('token_hash', tokenHash)
    .eq('admin_profile_id', adminUserId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await db.from('admin_takeover_sessions').update({
      status: 'expired',
      ended_at: new Date().toISOString(),
    }).eq('id', data.id);
    await auditAllowed(
      adminUserId,
      'takeover.expire',
      { type: 'takeover_session', id: data.id },
      { targetUserId: data.target_profile_id, reason: 'session_ttl_elapsed' },
    );
    return null;
  }

  return {
    sessionId: data.id,
    adminUserId: data.admin_profile_id,
    targetUserId: data.target_profile_id,
    reason: data.reason,
    expiresAt: data.expires_at,
  };
}

export async function getActiveTakeover(adminUserId: string): Promise<TakeoverSessionRow | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from('admin_takeover_sessions')
    .select('*')
    .eq('admin_profile_id', adminUserId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await db.from('admin_takeover_sessions').update({
      status: 'expired',
      ended_at: new Date().toISOString(),
    }).eq('id', data.id);
    return null;
  }

  const { data: target } = await db
    .from('profiles')
    .select('email, full_name')
    .eq('id', data.target_profile_id)
    .maybeSingle();

  return {
    ...(data as TakeoverSessionRow),
    target_email: target?.email,
    target_name: target?.full_name,
  };
}

export async function listTakeoverHistory(limit = 50): Promise<TakeoverSessionRow[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from('admin_takeover_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw new Error(error.message);
  const rows = (data || []) as TakeoverSessionRow[];
  if (!rows.length) return rows;

  const ids = Array.from(new Set(rows.flatMap((r) => [r.admin_profile_id, r.target_profile_id])));
  const { data: profiles } = await db.from('profiles').select('id, email, full_name').in('id', ids);
  const map = new Map((profiles || []).map((p: { id: string; email: string; full_name: string | null }) => [p.id, p]));

  return rows.map((r) => ({
    ...r,
    admin_email: map.get(r.admin_profile_id)?.email,
    admin_name: map.get(r.admin_profile_id)?.full_name ?? undefined,
    target_email: map.get(r.target_profile_id)?.email,
    target_name: map.get(r.target_profile_id)?.full_name ?? undefined,
  }));
}

/** True when the current request is inside an active takeover (customer scope). */
export function isTakeoverRequest(req: { takeover?: TakeoverContext | null }): boolean {
  return Boolean(req.takeover?.targetUserId);
}

export async function denyTakeoverMutation(
  adminUserId: string,
  action: string,
  ctx: Ctx,
): Promise<never> {
  await auditDenied(
    adminUserId,
    action,
    'Blocked during account takeover (financial or privileged mutation)',
    undefined,
    ctx,
  );
  throw forbidden('This action is not permitted during an account takeover session.');
}
