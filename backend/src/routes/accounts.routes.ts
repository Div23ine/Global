/** Customer accounts + currency activation. */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getServiceClient, getUserClient } from '../services/supabase.service';
import { auditAllowed } from '../services/audit.service';
import { badRequest, invalidState, conflict, notFound, ok } from '../utils/httpError';

export const accountsRouter = Router();

accountsRouter.use(requireAuth);

/** Public (within auth) list of currencies with per-user activation flags. */
accountsRouter.get('/currencies', async (req, res, next) => {
  try {
    const db = getServiceClient();
    const [currencies, accounts] = await Promise.all([
      db.from('currencies').select('*').order('display_order'),
      db.from('accounts').select('currency_code, status').eq('profile_id', req.auth!.userId),
    ]);
    if (currencies.error) throw new Error(currencies.error.message);
    const mine = new Set((accounts.data ?? []).map((a: { currency_code: string }) => a.currency_code));
    ok(res,
      (currencies.data ?? []).map((c: Record<string, unknown>) => ({
        ...c,
        activeForMe: mine.has(String(c.code)),
      })),
      'Currencies');
  } catch (err) { next(err); }
});

accountsRouter.get('/accounts', async (req, res, next) => {
  try {
    const db = getUserClient(req.auth!.supabaseJwt); // RLS-scoped read
    const { data, error } = await db
      .from('accounts')
      .select('*, transactions(count)')
      .eq('profile_id', req.auth!.userId)
      .order('opened_at');
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Accounts');
  } catch (err) { next(err); }
});

accountsRouter.get('/accounts/:currency', async (req, res, next) => {
  try {
    const code = String(req.params.currency).toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) throw badRequest('Invalid currency code.');
    const db = getUserClient(req.auth!.supabaseJwt);
    const { data: account, error } = await db
      .from('accounts')
      .select('*')
      .eq('profile_id', req.auth!.userId)
      .eq('currency_code', code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!account) throw notFound('Account not found.');

    const [txns, deps] = await Promise.all([
      db.from('transactions').select('*').eq('account_id', account.id)
        .order('created_at', { ascending: false }).limit(10),
      db.from('deposits').select('*').eq('account_id', account.id)
        .order('requested_at', { ascending: false }).limit(10),
    ]);
    ok(res, { account, transactions: txns.data ?? [], deposits: deps.data ?? [] }, 'Account detail');
  } catch (err) { next(err); }
});

const activateSchema = z.object({ currencyCode: z.string().regex(/^[A-Z]{3}$/) }).strict();

accountsRouter.post('/accounts/activate', validate(activateSchema), async (req, res, next) => {
  try {
    const db = getServiceClient();
    const { data, error } = await db.rpc('activate_currency', {
      p_profile_id: req.auth!.userId,
      p_currency: req.body.currencyCode,
    });
    if (error) {
      const msg = error.message;
      if (msg.includes('CURRENCY_UNKNOWN')) throw badRequest('This currency is not offered.');
      if (msg.includes('CURRENCY_UNAVAILABLE')) throw invalidState('This currency is temporarily unavailable.');
      if (msg.includes('ALREADY_ACTIVE')) throw conflict('This currency account is already active.');
      throw new Error(msg);
    }
    await auditAllowed(req.auth!.userId, 'currency.activate', { type: 'account', id: req.body.currencyCode },
      { currency: req.body.currencyCode }, { ip: req.ip, userAgent: req.get('user-agent') });
    res.status(201);
    res.json({ success: true, message: 'Currency account activated with a zero balance', data, meta: {} });
  } catch (err) { next(err); }
});

accountsRouter.post('/accounts/:currency/close', async (req, res, next) => {
  try {
    const code = String(req.params.currency).toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) throw badRequest('Invalid currency code.');
    const db = getServiceClient();
    const { data: account } = await db
      .from('accounts')
      .select('id, balance, status')
      .eq('profile_id', req.auth!.userId)
      .eq('currency_code', code)
      .maybeSingle();
    if (!account) throw notFound('Account not found.');
    if (Number(account.balance) !== 0) {
      throw invalidState('This account still holds a balance and cannot be closed.');
    }
    const { error } = await db.from('accounts')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', account.id);
    if (error) throw new Error(error.message);
    await auditAllowed(req.auth!.userId, 'account.close', { type: 'account', id: code }, { currency: code },
      { ip: req.ip, userAgent: req.get('user-agent') });
    ok(res, { closed: code }, 'Account closed');
  } catch (err) { next(err); }
});
