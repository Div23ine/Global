/** Statements: list, generate (idempotent upsert), download (text). */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getServiceClient } from '../services/supabase.service';
import { generateStatement, renderStatementText } from '../services/statement.service';
import { badRequest, notFound, ok } from '../utils/httpError';

export const statementsRouter = Router();

statementsRouter.use('/statements', requireAuth);

statementsRouter.get('/statements', async (req, res, next) => {
  try {
    const db = getServiceClient();
    const { data: accounts } = await db
      .from('accounts')
      .select('id')
      .eq('profile_id', req.auth!.userId);
    const ids = (accounts ?? []).map((a: { id: string }) => a.id);
    if (ids.length === 0) { ok(res, [], 'Statements'); return; }
    const { data, error } = await db
      .from('statements')
      .select('*')
      .in('account_id', ids)
      .order('period_end', { ascending: false });
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Statements');
  } catch (err) { next(err); }
});

const genSchema = z.object({
  accountId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/),
}).strict();

statementsRouter.post('/statements/generate', validate(genSchema), async (req, res, next) => {
  try {
    const row = await generateStatement(
      req.auth!.userId, req.body.accountId, req.body.periodStart, req.body.periodEnd,
    );
    res.status(201);
    res.json({ success: true, message: 'Statement generated', data: row, meta: {} });
  } catch (err) { next(err); }
});

statementsRouter.get('/statements/:id/download', async (req, res, next) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(String(req.params.id))) throw badRequest('Invalid statement id.');
    const db = getServiceClient();
    const { data: stmt } = await db.from('statements').select('*').eq('id', req.params.id).maybeSingle();
    if (!stmt) throw notFound('Statement not found.');

    const { data: account } = await db
      .from('accounts')
      .select('id, profile_id, currency_code')
      .eq('id', stmt.account_id)
      .maybeSingle();
    if (!account || account.profile_id !== req.auth!.userId) throw notFound('Statement not found.');

    const { data: profile } = await db
      .from('profiles')
      .select('full_name, email')
      .eq('id', req.auth!.userId)
      .maybeSingle();

    const { data: entries } = await db
      .from('transactions')
      .select('reference, direction, amount, description, created_at')
      .eq('account_id', stmt.account_id)
      .eq('status', 'posted')
      .gte('created_at', stmt.period_start)
      .lt('created_at', stmt.period_end)
      .order('created_at', { ascending: true });

    const text = renderStatementText(
      stmt,
      account as { currency_code: string },
      entries ?? [],
      profile ?? { full_name: '', email: '' },
    );
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="meridian-statement-${req.params.id}.txt"`);
    res.send(text);
  } catch (err) { next(err); }
});
