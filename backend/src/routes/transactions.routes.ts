/** Customer transaction history (filters + pagination) and detail view. */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getUserClient } from '../services/supabase.service';
import { parsePagination, pageMeta } from '../utils/pagination';
import { badRequest, notFound, ok } from '../utils/httpError';

export const transactionsRouter = Router();

transactionsRouter.use('/transactions', requireAuth);

transactionsRouter.get('/transactions', async (req, res, next) => {
  try {
    const p = parsePagination(req.query as Record<string, unknown>);
    const db = getUserClient(req.auth!.supabaseJwt); // RLS-scoped read

    let query = db.from('transactions').select('*', { count: 'exact' }).eq('profile_id', req.auth!.userId);
    const q = req.query as Record<string, string>;

    const search = String(q.search ?? '').slice(0, 60);
    if (search) query = query.or(`reference.ilike.%${search}%,description.ilike.%${search}%`);
    const currency = String(q.currency ?? '').toUpperCase();
    if (/^[A-Z]{3}$/.test(currency)) query = query.eq('currency_code', currency);
    const status = String(q.status ?? '');
    if (['posted', 'pending', 'failed', 'cancelled'].includes(status)) query = query.eq('status', status);
    const from = String(q.from ?? '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte('created_at', `${from}T00:00:00Z`);
    const to = String(q.to ?? '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lt('created_at', `${to}T23:59:59Z`);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(p.offset, p.offset + p.pageSize - 1);
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Transactions', pageMeta(p, count ?? 0));
  } catch (err) { next(err); }
});

transactionsRouter.get('/transactions/:reference', async (req, res, next) => {
  try {
    const reference = String(req.params.reference);
    if (!/^TXN-\d{4}-\d{6}$/.test(reference)) throw badRequest('Invalid transaction reference.');
    const db = getUserClient(req.auth!.supabaseJwt);
    const { data, error } = await db
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .eq('profile_id', req.auth!.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound('Transaction not found.');
    ok(res, data, 'Transaction detail');
  } catch (err) { next(err); }
});
