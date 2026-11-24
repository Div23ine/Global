/** Deposits (customer) — manual bank-transfer workflow. */
import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { requireAuth, subjectUserId, rejectIfTakeover } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { depositLimiter } from '../middleware/rateLimit';
import { getServiceClient } from '../services/supabase.service';
import {
  applyProviderEvent,
  cancelDeposit,
  createDeposit,
  reportPayment,
  verifyProviderSignature,
} from '../services/deposits.service';
import { parsePagination, pageMeta } from '../utils/pagination';
import { badRequest, ok } from '../utils/httpError';
import { logger } from '../utils/logger';

export const depositsRouter = Router();
export const paymentsWebhookRouter = Router();

const createSchema = z.object({
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  amount: z.union([z.string(), z.number()]),
  notes: z.string().max(500).optional(),
}).strict();

depositsRouter.post('/deposits', requireAuth, rejectIfTakeover('takeover.block.deposit_create'), depositLimiter, validate(createSchema), async (req, res, next) => {
  try {
    const deposit = await createDeposit(
      subjectUserId(req),
      { currencyCode: req.body.currencyCode, amount: req.body.amount, notes: req.body.notes },
      (req.headers['idempotency-key'] as string | undefined)?.slice(0, 120),
      { ip: req.ip, userAgent: req.get('user-agent') },
    );
    res.status(201);
    res.json({
      success: true,
      message: 'Deposit request submitted. An administrator will provide receiving bank details shortly.',
      data: {
        deposit,
        nextStep: {
          status: 'pending_admin_action',
          instructions:
            'Your deposit request has been recorded. Meridian administrators will assign receiving bank details. ' +
            'You will be notified in your dashboard when the transfer instructions are ready. ' +
            'Do not transfer funds until bank details appear in your Deposit section. ' +
            'Always include the unique deposit reference in the bank transfer narration.',
        },
      },
      meta: {},
    });
  } catch (err) { next(err); }
});

depositsRouter.get('/deposits', requireAuth, async (req, res, next) => {
  try {
    const p = parsePagination(req.query as Record<string, unknown>);
    const db = getServiceClient();
    let query = db
      .from('deposits')
      .select('*, receiving_bank_accounts(bank_name, beneficiary_name, iban, account_number, swift_bic, country_code, currency_code, transfer_instructions)', { count: 'exact' })
      .eq('profile_id', subjectUserId(req));
    const status = String(req.query.status ?? '');
    if (status) query = query.eq('status', status);
    const { data, count, error } = await query
      .order('requested_at', { ascending: false })
      .range(p.offset, p.offset + p.pageSize - 1);
    if (error) throw new Error(error.message);
    ok(res, data ?? [], 'Deposits', pageMeta(p, count ?? 0));
  } catch (err) { next(err); }
});

depositsRouter.get('/deposits/:reference', requireAuth, async (req, res, next) => {
  try {
    const reference = String(req.params.reference);
    const db = getServiceClient();
    const { data, error } = await db
      .from('deposits')
      .select('*, receiving_bank_accounts(bank_name, beneficiary_name, iban, account_number, swift_bic, country_code, currency_code, transfer_instructions), deposit_payments(*)')
      .eq('reference', reference)
      .eq('profile_id', subjectUserId(req))
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw badRequest('Deposit not found.');
    ok(res, data, 'Deposit detail');
  } catch (err) { next(err); }
});

depositsRouter.post('/deposits/:reference/cancel', requireAuth, rejectIfTakeover('takeover.block.deposit_cancel'), async (req, res, next) => {
  try {
    const reference = String(req.params.reference);
    const result = await cancelDeposit(subjectUserId(req), reference, {
      ip: req.ip, userAgent: req.get('user-agent'),
    });
    ok(res, result, 'Deposit cancelled');
  } catch (err) { next(err); }
});

const reportSchema = z.object({
  notes: z.string().max(1000).optional(),
  bankTransactionRef: z.string().trim().min(3).max(120),
  receiptUrl: z.string().url().max(500).optional(),
}).strict();

depositsRouter.post('/deposits/:reference/report-payment', requireAuth, rejectIfTakeover('takeover.block.deposit_report'), validate(reportSchema), async (req, res, next) => {
  try {
    const reference = String(req.params.reference);
    const deposit = await reportPayment(
      subjectUserId(req),
      reference,
      { notes: req.body.notes, bankTransactionRef: req.body.bankTransactionRef, receiptUrl: req.body.receiptUrl },
      { ip: req.ip, userAgent: req.get('user-agent') },
    );
    ok(res, deposit, 'Payment reported — awaiting administrator verification. No balance has been credited yet.');
  } catch (err) { next(err); }
});

paymentsWebhookRouter.post('/payments/:provider', async (req: Request, res, next) => {
  try {
    const provider = String(req.params.provider);
    const signature = req.get('x-meridian-signature') ?? undefined;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    if (!verifyProviderSignature(provider, rawBody, signature)) {
      logger.warn({ provider }, 'Rejected payment webhook — invalid signature');
      res.status(401).json({ success: false, message: 'Invalid signature' });
      return;
    }
    const body = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);
    const event = {
      type: body.type === 'failed' ? 'failed' as const : 'confirmed' as const,
      reference: String(body.reference ?? ''),
      providerRef: String(body.providerRef ?? body.provider_ref ?? ''),
      reason: body.reason ? String(body.reason) : undefined,
    };
    if (!event.reference) {
      res.status(400).json({ success: false, message: 'Missing reference' });
      return;
    }
    const result = await applyProviderEvent(provider, event);
    ok(res, result, 'Webhook processed');
  } catch (err) { next(err); }
});
