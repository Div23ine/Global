/** Notifications and support tickets (customer side). */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { supportLimiter } from '../middleware/rateLimit';
import { getUserClient, getServiceClient } from '../services/supabase.service';
import { markRead } from '../services/notifications.service';
import { notifyAdminsByEmail } from '../services/admin-gmail.service';
import { parsePagination, pageMeta } from '../utils/pagination';
import { badRequest, ok } from '../utils/httpError';

export const notificationsRouter = Router();
export const supportRouter = Router();

notificationsRouter.use('/notifications', requireAuth);

notificationsRouter.get('/notifications', async (req, res, next) => {
  try {
    const p = parsePagination(req.query as Record<string, unknown>);
    const db = getUserClient(req.auth!.supabaseJwt);
    const [list, unread] = await Promise.all([
      db.from('notifications').select('*', { count: 'exact' })
        .eq('profile_id', req.auth!.userId)
        .order('created_at', { ascending: false })
        .range(p.offset, p.offset + p.pageSize - 1),
      db.from('notifications').select('id', { count: 'exact', head: true })
        .eq('profile_id', req.auth!.userId).is('read_at', null),
    ]);
    if (list.error) throw new Error(list.error.message);
    ok(res, list.data ?? [], 'Notifications', { ...pageMeta(p, list.count ?? 0), unread: unread.count ?? 0 });
  } catch (err) { next(err); }
});

notificationsRouter.post('/notifications/:id/read', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (id !== 'all' && !/^[0-9a-f-]{36}$/i.test(id)) throw badRequest('Invalid notification id.');
    await markRead(req.auth!.userId, id);
    ok(res, { id }, 'Marked read');
  } catch (err) { next(err); }
});

supportRouter.use('/support', requireAuth);

supportRouter.get('/support/tickets', async (req, res, next) => {
  try {
    const db = getUserClient(req.auth!.supabaseJwt);
    const { data, error } = await db
      .from('support_tickets')
      .select('*, support_messages(*)')
      .eq('profile_id', req.auth!.userId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Support tickets');
  } catch (err) { next(err); }
});

const ticketSchema = z.object({
  subject: z.string().min(4).max(120),
  category: z.enum(['general', 'deposits', 'currencies', 'security', 'account']),
  message: z.string().min(10).max(4000),
}).strict();

supportRouter.post('/support/tickets', supportLimiter, validate(ticketSchema), async (req, res, next) => {
  try {
    const db = getServiceClient();
    const { data: ticket, error } = await db
      .from('support_tickets')
      .insert({
        profile_id: req.auth!.userId,
        subject: req.body.subject,
        category: req.body.category,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    const { error: msgErr } = await db
      .from('support_messages')
      .insert({ ticket_id: ticket.id, sender: 'customer', body: req.body.message });
    if (msgErr) throw new Error(msgErr.message);
    await notifyAdminsByEmail({
      eventType: 'support.ticket_created', subject: 'New customer support request — ' + req.body.subject,
      body: 'A customer submitted a support request requiring administrator attention.\\n\\nTicket ID: ' + ticket.id +
        '\\nCategory: ' + req.body.category + '\\nSubject: ' + req.body.subject +
        '\\n\\nMessage:\\n' + String(req.body.message).slice(0, 1500) +
        '\\n\\nSign in to Meridian and open Support to respond.',
    });
    res.status(201);
    res.json({ success: true, message: 'Support ticket created', data: ticket, meta: {} });
  } catch (err) { next(err); }
});
