/**
 * Administrator surface.
 *
 * Money mutations for deposits and refunds are performed exclusively through
 * the service-layer functions that call atomic PostgreSQL RPCs
 * (admin_credit_deposit_payment, process_internal_refund).
 * Customer identity for credits is always derived from the original financial
 * record — never supplied by the administrator at approval time.
 * Every administrative action is audit-logged.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getServiceClient } from '../services/supabase.service';
import {
  deleteSupabaseUserForProfile,
  getLinkedProfileByEmail,
  setSupabaseUserBan,
} from '../services/supabase-auth.service';
import { auditAllowed } from '../services/audit.service';
import { notify, notifyWithSms } from '../services/notifications.service';
import { parsePagination, pageMeta } from '../utils/pagination';
import { badRequest, invalidState, notFound, ok } from '../utils/httpError';
import {
  assignReceivingBank,
  verifyAndCreditPayment,
  rejectDeposit,
  listReceivingBanks,
  upsertReceivingBank,
} from '../services/deposits.service';
import {
  createRefundRequest,
  approveAndProcessRefund,
  rejectRefund,
  listRefunds,
} from '../services/refunds.service';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin());

const ctxOf = (req: { admin?: { roleId: string }; ip?: string; get(h: string): string | undefined }) => ({
  role: req.admin?.roleId ?? null,
  ip: req.ip,
  userAgent: req.get('user-agent'),
});

/* ------------------------------------------------------------------ overview */
adminRouter.get('/admin/overview', requireAdmin(), async (_req, res, next) => {
  try {
    const db = getServiceClient();
    const [users, active, suspended, banned, pendingDeposits, openTickets, criticalEvents] =
      await Promise.all([
        db.from('profiles').select('id', { count: 'exact', head: true }),
        db.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        db.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'suspended'),
        db.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'banned'),
        db.from('deposits').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        db.from('security_events').select('id', { count: 'exact', head: true }).eq('severity', 'critical'),
      ]);
    ok(res, {
      users: users.count ?? 0,
      active: active.count ?? 0,
      suspended: suspended.count ?? 0,
      banned: banned.count ?? 0,
      pendingDeposits: pendingDeposits.count ?? 0,
      openTickets: openTickets.count ?? 0,
      criticalEvents: criticalEvents.count ?? 0,
    }, 'Admin overview');
  } catch (err) { next(err); }
});

/* ---------------------------------------------------------------------- users */
adminRouter.get('/admin/users', requireAdmin('users.read'), async (req, res, next) => {
  try {
    const p = parsePagination(req.query as Record<string, unknown>);
    const db = getServiceClient();
    let query = db.from('profiles').select('*', { count: 'exact' });
    const q = req.query as Record<string, string>;
    const search = String(q.q ?? '').slice(0, 80);
    if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    if (['active', 'suspended', 'banned', 'deleted'].includes(String(q.status))) {
      query = query.eq('status', q.status);
    }
    if (/^[A-Z]{2}$/.test(String(q.country ?? '').toUpperCase())) {
      query = query.eq('country_code', String(q.country).toUpperCase());
    }
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(p.offset, p.offset + p.pageSize - 1);
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Users', pageMeta(p, count ?? 0));
  } catch (err) { next(err); }
});

adminRouter.get('/admin/users/:id', requireAdmin('users.read'), async (req, res, next) => {
  try {
    const db = getServiceClient();
    const { data: profile } = await db.from('profiles').select('*').eq('id', String(req.params.id)).maybeSingle();
    if (!profile) throw notFound('User not found.');
    const [accounts, txns, deposits, events] = await Promise.all([
      db.from('accounts').select('*').eq('profile_id', String(req.params.id)),
      db.from('transactions').select('*').eq('profile_id', String(req.params.id)).order('created_at', { ascending: false }).limit(10),
      db.from('deposits').select('*').eq('profile_id', String(req.params.id)).order('requested_at', { ascending: false }).limit(10),
      db.from('security_events').select('*').eq('profile_id', String(req.params.id)).order('created_at', { ascending: false }).limit(10),
    ]);
    ok(res, { profile, accounts: accounts.data ?? [], recentTransactions: txns.data ?? [],
      deposits: deposits.data ?? [], securityEvents: events.data ?? [] }, 'User detail');
  } catch (err) { next(err); }
});

const userPatchSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/).optional().nullable(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: 'No permitted fields provided' });

adminRouter.patch('/admin/users/:id', requireAdmin('users.edit'), validate(userPatchSchema), async (req, res, next) => {
  try {
    const patch: Record<string, unknown> = {};
    if (req.body.firstName !== undefined) patch.first_name = req.body.firstName;
    if (req.body.lastName !== undefined) patch.last_name = req.body.lastName;
    if (req.body.phone !== undefined) patch.phone = req.body.phone;
    if (req.body.firstName !== undefined || req.body.lastName !== undefined) {
      const { data: cur } = await db_getProfile(String(req.params.id));
      const full = [req.body.firstName ?? cur?.first_name, req.body.lastName ?? cur?.last_name]
        .filter(Boolean).join(' ').trim();
      patch.full_name = full;
    }
    const db = getServiceClient();
    const { data, error } = await db.from('profiles').update(patch).eq('id', String(req.params.id)).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound('User not found.');
    await auditAllowed(req.auth!.userId, 'admin.profile_edit', { type: 'profile', id: String(req.params.id) },
      { fields: Object.keys(req.body) }, ctxOf(req));
    ok(res, data, 'Permitted profile fields updated. The customer is not notified automatically.');
  } catch (err) { next(err); }
});

async function db_getProfile(id: string): Promise<{ data: { first_name: string; last_name: string } | null }> {
  const db = getServiceClient();
  const { data } = await db.from('profiles').select('first_name, last_name').eq('id', id).maybeSingle();
  return { data: (data as { first_name: string; last_name: string } | null) ?? null };
}

/* --------------------------------------------------- suspend / ban / unban */
const reasonSchema = z.object({ reason: z.string().min(3).max(500) }).strict();

adminRouter.post('/admin/users/:id/suspend', requireAdmin('users.ban'), validate(reasonSchema), async (req, res, next) => {
  try {
    const db = getServiceClient();
    const { error } = await db.from('profiles').update({ status: 'suspended' }).eq('id', String(req.params.id));
    if (error) throw new Error(error.message);
    await setSupabaseUserBan(String(req.params.id), true);
    await db.from('security_events').insert({
      profile_id: String(req.params.id), type: 'suspend', severity: 'warning',
      detail: { reason: req.body.reason, by: req.auth!.userId },
    });
    await notify(String(req.params.id), 'security', 'Account suspended',
      `Your account has been suspended: ${req.body.reason}`);
    await auditAllowed(req.auth!.userId, 'admin.user_suspend', { type: 'profile', id: String(req.params.id) },
      { reason: req.body.reason }, ctxOf(req));
    ok(res, { id: String(req.params.id), status: 'suspended' }, 'User suspended');
  } catch (err) { next(err); }
});

adminRouter.post('/admin/users/:id/ban', requireAdmin('users.ban'), validate(reasonSchema), async (req, res, next) => {
  try {
    const db = getServiceClient();
    const { error } = await db.from('profiles').update({ status: 'banned' }).eq('id', String(req.params.id));
    if (error) throw new Error(error.message);
    await setSupabaseUserBan(String(req.params.id), true);
    await db.from('security_events').insert({
      profile_id: String(req.params.id), type: 'ban', severity: 'critical',
      detail: { reason: req.body.reason, by: req.auth!.userId },
    });
    await auditAllowed(req.auth!.userId, 'admin.user_ban', { type: 'profile', id: String(req.params.id) },
      { reason: req.body.reason }, ctxOf(req));
    ok(res, { id: String(req.params.id), status: 'banned' }, 'User banned');
  } catch (err) { next(err); }
});

adminRouter.post('/admin/users/:id/unban', requireAdmin('users.ban'), async (req, res, next) => {
  try {
    const db = getServiceClient();
    await setSupabaseUserBan(String(req.params.id), false);
    const { error } = await db.from('profiles').update({ status: 'active' }).eq('id', String(req.params.id));
    if (error) throw new Error(error.message);
    await db.from('security_events').insert({
      profile_id: String(req.params.id), type: 'unban', severity: 'info',
      detail: { by: req.auth!.userId },
    });
    await auditAllowed(req.auth!.userId, 'admin.user_unban', { type: 'profile', id: String(req.params.id) }, undefined, ctxOf(req));
    ok(res, { id: String(req.params.id), status: 'active' }, 'User unbanned');
  } catch (err) { next(err); }
});

/* -------------------------------------------------------------- deletion */
adminRouter.delete('/admin/users/:id', requireAdmin('users.delete'), async (req, res, next) => {
  try {
    const db = getServiceClient();
    // Block the account first; then delete the Auth identity and anonymize PII.
    const { error: statusError } = await db.from('profiles')
      .update({ status: 'deleted' }).eq('id', String(req.params.id));
    if (statusError) throw new Error(statusError.message);
    await deleteSupabaseUserForProfile(String(req.params.id));
    const { error } = await db.rpc('anonymize_profile', { p_profile_id: String(req.params.id) });
    if (error) throw new Error(error.message);
    await auditAllowed(req.auth!.userId, 'admin.user_delete', { type: 'profile', id: String(req.params.id) },
      { note: 'Supabase Auth identity deleted; profile anonymized; financial records retained' }, ctxOf(req));
    ok(res, { id: String(req.params.id), anonymized: true },
      'Identity deleted; profile anonymized; financial records retained per policy');
  } catch (err) { next(err); }
});

/* ------------------------------------------------- manual notification */
const notifySchema = z.object({
  title: z.string().min(3).max(120),
  body: z.string().min(3).max(2000),
  alsoSms: z.boolean().optional(),
}).strict();

adminRouter.post('/admin/users/:id/notify', requireAdmin('users.edit'), validate(notifySchema), async (req, res, next) => {
  try {
    const db = getServiceClient();
    const { data: profile } = await db.from('profiles').select('phone').eq('id', String(req.params.id)).maybeSingle();
    if (!profile) throw notFound('User not found.');
    if (req.body.alsoSms) {
      await notifyWithSms(String(req.params.id), (profile as { phone: string | null }).phone ?? null,
        'info', req.body.title, req.body.body);
    } else {
      await notify(String(req.params.id), 'info', req.body.title, req.body.body);
    }
    await auditAllowed(req.auth!.userId, 'admin.manual_notification', { type: 'profile', id: String(req.params.id) },
      { title: req.body.title, sms: Boolean(req.body.alsoSms) }, ctxOf(req));
    ok(res, { sent: true }, 'Manual notification sent (users are never notified automatically)');
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------- currencies */
adminRouter.get('/admin/currencies', requireAdmin('deposits.read'), async (_req, res, next) => {
  try {
    const db = getServiceClient();
    const { data, error } = await db.from('currencies').select('*').order('display_order');
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Currencies');
  } catch (err) { next(err); }
});

const currencyPatchSchema = z.object({ status: z.enum(['active', 'unavailable']) }).strict();

adminRouter.patch('/admin/currencies/:code', requireAdmin('currencies.manage'), validate(currencyPatchSchema), async (req, res, next) => {
  try {
    const code = String(req.params.code).toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) throw badRequest('Invalid currency code.');
    const db = getServiceClient();
    const { data, error } = await db.from('currencies').update({ status: req.body.status })
      .eq('code', code).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound('Currency not found.');
    await auditAllowed(req.auth!.userId, 'admin.currency_status', { type: 'currency', id: code },
      { status: req.body.status }, ctxOf(req));
    ok(res, data, `Currency ${code} set to ${req.body.status}`);
  } catch (err) { next(err); }
});

/* ------------------------------------------- deposits / transactions / payments */
adminRouter.get('/admin/deposits', requireAdmin('deposits.read'), async (req, res, next) => {
  try {
    const p = parsePagination(req.query as Record<string, unknown>);
    const db = getServiceClient();
    let query = db.from('deposits').select('*, profiles(email, full_name)', { count: 'exact' });
    const status = String(req.query.status ?? '');
    if (['pending', 'completed', 'failed', 'cancelled'].includes(status)) query = query.eq('status', status);
    const { data, count, error } = await query
      .order('requested_at', { ascending: false })
      .range(p.offset, p.offset + p.pageSize - 1);
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Deposits (administrators cannot alter deposit records)', pageMeta(p, count ?? 0));
  } catch (err) { next(err); }
});

adminRouter.get('/admin/transactions', requireAdmin('transactions.read'), async (req, res, next) => {
  try {
    const p = parsePagination(req.query as Record<string, unknown>);
    const db = getServiceClient();
    let query = db.from('transactions').select('*, profiles(email, full_name)', { count: 'exact' });
    const q = req.query as Record<string, string>;
    const search = String(q.q ?? '').slice(0, 60);
    if (search) query = query.or(`reference.ilike.%${search}%,description.ilike.%${search}%`);
    if (/^[A-Z]{3}$/.test(String(q.currency ?? '').toUpperCase())) {
      query = query.eq('currency_code', String(q.currency).toUpperCase());
    }
    if (['posted', 'pending', 'failed', 'cancelled'].includes(String(q.status))) {
      query = query.eq('status', q.status);
    }
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(p.offset, p.offset + p.pageSize - 1);
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Transactions (ledger is immutable)', pageMeta(p, count ?? 0));
  } catch (err) { next(err); }
});

adminRouter.get('/admin/payments', requireAdmin('payments.read'), async (req, res, next) => {
  try {
    const p = parsePagination(req.query as Record<string, unknown>);
    const db = getServiceClient();
    const { data, count, error } = await db
      .from('payment_attempts')
      .select('*, deposits(reference, currency_code, amount, status)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(p.offset, p.offset + p.pageSize - 1);
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Payment attempts', pageMeta(p, count ?? 0));
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ security */
adminRouter.get('/admin/security/events', requireAdmin('security.read'), async (req, res, next) => {
  try {
    const p = parsePagination(req.query as Record<string, unknown>);
    const db = getServiceClient();
    let query = db.from('security_events').select('*, profiles(email, full_name)', { count: 'exact' });
    if (String(req.query.severity ?? '') === 'critical') query = query.eq('severity', 'critical');
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(p.offset, p.offset + p.pageSize - 1);
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Security events', pageMeta(p, count ?? 0));
  } catch (err) { next(err); }
});

const freezeSchema = z.object({ userId: z.string().min(1).max(128), reason: z.string().min(3).max(500) }).strict();

adminRouter.post('/admin/security/freeze', requireAdmin('security.freeze'), validate(freezeSchema), async (req, res, next) => {
  try {
    const db = getServiceClient();
    const { error } = await db.from('profiles').update({ status: 'suspended' }).eq('id', req.body.userId);
    if (error) throw new Error(error.message);
    await setSupabaseUserBan(req.body.userId, true);
    await db.from('security_events').insert({
      profile_id: req.body.userId, type: 'freeze', severity: 'warning',
      detail: { reason: req.body.reason, by: req.auth!.userId },
    });
    await auditAllowed(req.auth!.userId, 'admin.security_freeze', { type: 'profile', id: req.body.userId },
      { reason: req.body.reason }, ctxOf(req));
    ok(res, { userId: req.body.userId, status: 'suspended' }, 'Account frozen');
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------- reports */
adminRouter.get('/admin/reports', requireAdmin('reports.read'), async (_req, res, next) => {
  try {
    const db = getServiceClient();
    const [byMethod, byStatus, byCountry] = await Promise.all([
      db.from('deposits').select('method, status'),
      db.from('deposits').select('status'),
      db.from('profiles').select('country_code, status'),
    ]);
    const methodCount: Record<string, number> = {};
    for (const r of byMethod.data ?? []) methodCount[r.method as string] = (methodCount[r.method as string] ?? 0) + 1;
    const statusCount: Record<string, number> = {};
    for (const r of byStatus.data ?? []) statusCount[r.status as string] = (statusCount[r.status as string] ?? 0) + 1;
    const countryCount: Record<string, number> = {};
    for (const r of byCountry.data ?? []) {
      const c = (r.country_code as string) || 'unknown';
      countryCount[c] = (countryCount[c] ?? 0) + 1;
    }
    ok(res, { depositsByMethod: methodCount, depositsByStatus: statusCount, usersByCountry: countryCount },
      'Reports (aggregate counts; full data export via CSV in the admin console)');
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------- support */
adminRouter.get('/admin/support/tickets', requireAdmin('support.manage'), async (req, res, next) => {
  try {
    const p = parsePagination(req.query as Record<string, unknown>);
    const db = getServiceClient();
    let query = db.from('support_tickets').select('*, support_messages(*), profiles(email, full_name)', { count: 'exact' });
    const status = String(req.query.status ?? '');
    if (['open', 'pending', 'resolved'].includes(status)) query = query.eq('status', status);
    const { data, count, error } = await query
      .order('updated_at', { ascending: false })
      .range(p.offset, p.offset + p.pageSize - 1);
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Support tickets', pageMeta(p, count ?? 0));
  } catch (err) { next(err); }
});

const replySchema = z.object({ message: z.string().min(2).max(4000) }).strict();

adminRouter.post('/admin/support/tickets/:id/reply', requireAdmin('support.manage'), validate(replySchema), async (req, res, next) => {
  try {
    const db = getServiceClient();
    const { data: ticket } = await db.from('support_tickets').select('id, profile_id, subject, status')
      .eq('id', String(req.params.id)).maybeSingle();
    if (!ticket) throw notFound('Ticket not found.');
    const { error } = await db.from('support_messages')
      .insert({ ticket_id: ticket.id, sender: 'support', body: req.body.message });
    if (error) throw new Error(error.message);
    await db.from('support_tickets').update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', ticket.id);
    await notify(ticket.profile_id as string, 'info', 'Support replied',
      `Your request "${ticket.subject}" has a new reply.`);
    await auditAllowed(req.auth!.userId, 'admin.support_reply', { type: 'ticket', id: String(ticket.id) }, undefined, ctxOf(req));
    ok(res, { replied: true }, 'Reply posted');
  } catch (err) { next(err); }
});

adminRouter.post('/admin/support/tickets/:id/resolve', requireAdmin('support.manage'), async (req, res, next) => {
  try {
    const db = getServiceClient();
    const { data: ticket } = await db.from('support_tickets').select('id, profile_id, subject')
      .eq('id', String(req.params.id)).maybeSingle();
    if (!ticket) throw notFound('Ticket not found.');
    const { error } = await db.from('support_tickets')
      .update({ status: 'resolved', updated_at: new Date().toISOString() }).eq('id', ticket.id);
    if (error) throw new Error(error.message);
    await auditAllowed(req.auth!.userId, 'admin.support_resolve', { type: 'ticket', id: String(ticket.id) }, undefined, ctxOf(req));
    ok(res, { resolved: true }, 'Ticket resolved');
  } catch (err) { next(err); }
});

/* --------------------------------------------------------------------- roles */
adminRouter.get('/admin/roles', requireAdmin('roles.manage'), async (_req, res, next) => {
  try {
    const db = getServiceClient();
    const [roles, holders] = await Promise.all([
      db.from('admin_roles').select('*').order('id'),
      db.from('admin_users').select('*, admin_roles(id, description)').order('assigned_at'),
    ]);
    if (roles.error) throw new Error(roles.error.message);
    ok(res, { roles: roles.data ?? [], holders: holders.data ?? [] }, 'Admin roles and permission matrix');
  } catch (err) { next(err); }
});

const assignSchema = z.object({
  email: z.string().email().max(254),
  roleId: z.enum(['super_admin', 'support', 'compliance', 'finance_readonly']),
  displayName: z.string().max(120).optional(),
}).strict();

adminRouter.post('/admin/roles/assign', requireAdmin('roles.manage'), validate(assignSchema), async (req, res, next) => {
  try {
    // The user must already have a confirmed Supabase Auth identity linked
    // to a profile before an administrator can grant a role.
    const user = await getLinkedProfileByEmail(req.body.email);
    const db = getServiceClient();
    const { data, error } = await db.from('admin_users').upsert({
      profile_id: user.id,
      display_name: req.body.displayName ?? `${user.first_name} ${user.last_name}`.trim(),
      role_id: req.body.roleId,
      assigned_by: req.auth!.userId,
      assigned_at: new Date().toISOString(),
    }).select('*').single();
    if (error) throw new Error(error.message);
    await auditAllowed(req.auth!.userId, 'admin.role_assign', { type: 'admin_user', id: user.id },
      { roleId: req.body.roleId }, ctxOf(req));
    ok(res, data, 'Role assigned');
  } catch (err) { next(err); }
});

adminRouter.post('/admin/roles/revoke', requireAdmin('roles.manage'), async (req, res, next) => {
  try {
    const body = z.object({ profileId: z.string().min(1).max(128) }).parse(req.body);
    if (body.profileId === req.auth!.userId) {
      throw invalidState('You cannot revoke your own admin role.');
    }
    const db = getServiceClient();
    const { error } = await db.from('admin_users').delete().eq('profile_id', body.profileId);
    if (error) throw new Error(error.message);
    await auditAllowed(req.auth!.userId, 'admin.role_revoke', { type: 'admin_user', id: body.profileId }, undefined, ctxOf(req));
    ok(res, { revoked: body.profileId }, 'Role revoked');
  } catch (err) { next(err); }
});

/* --------------------------------------------------------------------- audit */
adminRouter.get('/admin/audit', requireAdmin('audit.read'), async (req, res, next) => {
  try {
    const p = parsePagination(req.query as Record<string, unknown>);
    const db = getServiceClient();
    let query = db.from('audit_logs').select('*', { count: 'exact' });
    const q = req.query as Record<string, string>;
    const search = String(q.q ?? '').slice(0, 60);
    if (search) query = query.or(`action.ilike.%${search}%,actor_id.ilike.%${search}%,target_id.ilike.%${search}%`);
    if (['allowed', 'denied'].includes(String(q.result))) query = query.eq('result', q.result);
    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(p.offset, p.offset + p.pageSize - 1);
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Audit log (append-only)', pageMeta(p, count ?? 0));
  } catch (err) { next(err); }
});

/* ------------------------------------------------------------------ settings */
adminRouter.get('/admin/settings', requireAdmin('settings.manage'), async (_req, res, next) => {
  try {
    const db = getServiceClient();
    const { data, error } = await db.from('app_settings').select('*').order('key');
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Settings');
  } catch (err) { next(err); }
});

const settingsPatchSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  supportEmail: z.string().email().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: 'No settings provided' });

adminRouter.patch('/admin/settings', requireAdmin('settings.manage'), validate(settingsPatchSchema), async (req, res, next) => {
  try {
    const db = getServiceClient();
    if (req.body.maintenanceMode !== undefined) {
      const { error } = await db.from('app_settings')
        .upsert({ key: 'platform.maintenance_mode', value: req.body.maintenanceMode, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    }
    if (req.body.supportEmail !== undefined) {
      const { error } = await db.from('app_settings')
        .upsert({ key: 'support.email', value: req.body.supportEmail, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    }
    await auditAllowed(req.auth!.userId, 'admin.settings_update', { type: 'settings', id: 'platform' },
      { ...req.body }, ctxOf(req));
    ok(res, { ...req.body }, 'Settings updated');
  } catch (err) { next(err); }
});

/* -------------------------------------------------------------------------- */
/* Manual bank-transfer deposit management + internal refunds                 */
/* -------------------------------------------------------------------------- */

adminRouter.get('/admin/receiving-banks', requireAdmin('deposits.read'), async (_req, res, next) => {
  try {
    const banks = await listReceivingBanks(false);
    ok(res, banks, 'Receiving bank accounts');
  } catch (err) { next(err); }
});

const bankSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(120),
  bankName: z.string().min(1).max(120),
  beneficiaryName: z.string().min(1).max(120),
  accountNumber: z.string().max(64).optional(),
  iban: z.string().max(34).optional(),
  swiftBic: z.string().max(11).optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  transferInstructions: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
}).strict();

adminRouter.post('/admin/receiving-banks', requireAdmin('deposits.read'), validate(bankSchema), async (req, res, next) => {
  try {
    const bank = await upsertReceivingBank(req.auth!.userId, req.body);
    res.status(201);
    ok(res, bank, 'Receiving bank account saved');
  } catch (err) { next(err); }
});

adminRouter.get('/admin/deposits/queue', requireAdmin('deposits.read'), async (req, res, next) => {
  try {
    const p = parsePagination(req.query as Record<string, unknown>);
    const db = getServiceClient();
    let query = db
      .from('deposits')
      .select('*, profiles(email, full_name), receiving_bank_accounts(label, bank_name, currency_code)', { count: 'exact' });
    const status = String(req.query.status ?? '');
    if (status) query = query.eq('status', status);
    else {
      query = query.in('status', [
        'pending_admin_action', 'awaiting_payment', 'payment_reported',
        'under_verification', 'partially_fulfilled', 'unmatched_payment',
      ]);
    }
    const { data, count, error } = await query
      .order('requested_at', { ascending: true })
      .range(p.offset, p.offset + p.pageSize - 1);
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Deposit management queue', pageMeta(p, count ?? 0));
  } catch (err) { next(err); }
});

const assignBankSchema = z.object({ bankAccountId: z.string().uuid() }).strict();

adminRouter.post('/admin/deposits/:id/assign-bank', requireAdmin('deposits.read'), validate(assignBankSchema), async (req, res, next) => {
  try {
    const deposit = await assignReceivingBank(
      req.auth!.userId, String(req.params.id), req.body.bankAccountId, ctxOf(req),
    );
    ok(res, deposit, 'Receiving bank assigned — customer notified');
  } catch (err) { next(err); }
});

const verifyCreditSchema = z.object({
  amountReceived: z.union([z.string(), z.number()]),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  receivingBankId: z.string().uuid().optional(),
  bankTransactionId: z.string().max(120).optional(),
  bankTransactionRef: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
}).strict();

adminRouter.post('/admin/deposits/:id/verify-credit', requireAdmin('deposits.read'), validate(verifyCreditSchema), async (req, res, next) => {
  try {
    const result = await verifyAndCreditPayment(
      req.auth!.userId, String(req.params.id), req.body, ctxOf(req),
    );
    ok(res, result, 'Payment verified and Meridian balance credited');
  } catch (err) { next(err); }
});

const rejectDepSchema = z.object({ reason: z.string().min(3).max(1000) }).strict();

adminRouter.post('/admin/deposits/:id/reject', requireAdmin('deposits.read'), validate(rejectDepSchema), async (req, res, next) => {
  try {
    const deposit = await rejectDeposit(req.auth!.userId, String(req.params.id), req.body.reason, ctxOf(req));
    ok(res, deposit, 'Deposit rejected');
  } catch (err) { next(err); }
});

adminRouter.get('/admin/refunds', requireAdmin('deposits.read'), async (req, res, next) => {
  try {
    const p = parsePagination(req.query as Record<string, unknown>);
    const status = String(req.query.status ?? '') || undefined;
    const result = await listRefunds({ status, limit: p.pageSize, offset: p.offset });
    ok(res, result.data, 'Refunds', pageMeta(p, result.count));
  } catch (err) { next(err); }
});

const createRefundSchema = z.object({
  originalTransactionId: z.string().uuid(),
  requestedAmount: z.union([z.string(), z.number()]),
  reason: z.string().min(3).max(1000),
  notes: z.string().max(2000).optional(),
}).strict();

adminRouter.post('/admin/refunds', requireAdmin('deposits.read'), validate(createRefundSchema), async (req, res, next) => {
  try {
    const refund = await createRefundRequest(
      req.auth!.userId, req.body, true,
      (req.headers['idempotency-key'] as string | undefined)?.slice(0, 120),
      ctxOf(req),
    );
    res.status(201);
    ok(res, refund, 'Refund request created');
  } catch (err) { next(err); }
});

const approveRefundSchema = z.object({
  approvedAmount: z.union([z.string(), z.number()]).optional(),
  notes: z.string().max(2000).optional(),
}).strict();

adminRouter.post('/admin/refunds/:id/approve', requireAdmin('deposits.read'), validate(approveRefundSchema), async (req, res, next) => {
  try {
    const result = await approveAndProcessRefund(
      req.auth!.userId, String(req.params.id), req.body.approvedAmount, req.body.notes, ctxOf(req),
    );
    ok(res, result, 'Refund approved and Meridian balance credited');
  } catch (err) { next(err); }
});

const rejectRefundSchema = z.object({ reason: z.string().min(3).max(1000) }).strict();

adminRouter.post('/admin/refunds/:id/reject', requireAdmin('deposits.read'), validate(rejectRefundSchema), async (req, res, next) => {
  try {
    const refund = await rejectRefund(req.auth!.userId, String(req.params.id), req.body.reason, ctxOf(req));
    ok(res, refund, 'Refund rejected');
  } catch (err) { next(err); }
});
