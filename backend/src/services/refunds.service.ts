/**
 * Internal Meridian balance refunds.
 * ALL refunds stay inside Meridian. Approving a refund credits the
 * customer's Meridian account balance. There is no external bank payout.
 */
import { getServiceClient } from './supabase.service';
import { auditAllowed } from './audit.service';
import { badRequest, conflict, forbidden, invalidState, notFound } from '../utils/httpError';
import { parseAmount, type Money } from '../utils/money';
import { emailRefundCompleted } from './resend.service';
import { notifyAdminsByEmail } from './admin-gmail.service';

export interface RefundInput {
  originalTransactionId: string;
  requestedAmount: string | number;
  reason: string;
  notes?: string;
}

export interface RefundRecord {
  id: string;
  reference: string;
  profile_id: string;
  account_id: string;
  original_transaction_id: string;
  original_reference: string;
  original_amount: Money;
  requested_amount: Money;
  approved_amount: Money | null;
  currency_code: string;
  reason: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

function mapPgError(message: string): never {
  if (message.includes('REFUND_NOT_FOUND')) throw notFound('Refund not found.');
  if (message.includes('REFUND_NOT_APPROVED')) throw invalidState('Refund is not in an approvable state.');
  if (message.includes('ORIGINAL_TRANSACTION_NOT_FOUND')) throw notFound('Original transaction not found.');
  if (message.includes('REFUND_EXCEEDS_ORIGINAL')) throw conflict('Refund would exceed the original transaction amount.');
  if (message.includes('INVALID_REFUND_AMOUNT')) throw badRequest('Invalid refund amount.');
  throw new Error(message);
}

export async function createRefundRequest(
  actorId: string,
  input: RefundInput,
  isAdmin: boolean,
  idempotencyKey?: string,
  ctx?: { ip?: string | null; userAgent?: string | null },
): Promise<RefundRecord> {
  const amount = parseAmount(input.requestedAmount);
  if (Number(amount) <= 0) throw badRequest('Requested refund amount must be positive.');
  if (!input.reason?.trim()) throw badRequest('A refund reason is required.');

  const db = getServiceClient();

  if (idempotencyKey) {
    const { data: existing } = await db
      .from('refunds')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing) return existing as RefundRecord;
  }

  const { data: orig, error: origErr } = await db
    .from('transactions')
    .select('*')
    .eq('id', input.originalTransactionId)
    .maybeSingle();
  if (origErr) throw new Error(origErr.message);
  if (!orig) throw notFound('Original transaction not found.');
  if (orig.status !== 'posted') throw invalidState('Only posted transactions can be refunded.');

  if (!isAdmin && orig.profile_id !== actorId) {
    throw forbidden('You may only request refunds for your own transactions.');
  }

  const { data: prior } = await db
    .from('refunds')
    .select('approved_amount, requested_amount, status')
    .eq('original_transaction_id', orig.id)
    .in('status', ['requested', 'under_review', 'approved', 'processing', 'completed']);

  const already = (prior ?? []).reduce((sum, r) => {
    if (r.status === 'completed') return sum + Number(r.approved_amount ?? 0);
    return sum + Number(r.requested_amount ?? 0);
  }, 0);

  if (already + Number(amount) > Number(orig.amount)) {
    throw conflict(
      `Refundable balance exceeded. Original ${orig.amount}, already claimed/refunded ${already}, requested ${amount}.`,
    );
  }

  const year = new Date().getUTCFullYear();
  const seq = String(Date.now() % 1000000).padStart(6, '0');
  const reference = `MGR-${year}-${seq}`;

  const { data: refund, error } = await db
    .from('refunds')
    .insert({
      reference,
      profile_id: orig.profile_id,
      account_id: orig.account_id,
      original_transaction_id: orig.id,
      original_reference: orig.reference,
      original_amount: orig.amount,
      requested_amount: amount,
      currency_code: orig.currency_code,
      reason: input.reason.trim(),
      status: isAdmin ? 'under_review' : 'requested',
      requested_by: actorId,
      admin_notes: input.notes ?? null,
      idempotency_key: idempotencyKey ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  await auditAllowed(actorId, 'refund.create', { type: 'refund', id: reference }, {
    original: orig.reference, amount, reason: input.reason,
  }, { ip: ctx?.ip, userAgent: ctx?.userAgent });
  if (!isAdmin) {
    await notifyAdminsByEmail({
      eventType: 'refund.requested', subject: 'New refund request — ' + reference,
      body: 'A customer submitted a refund request requiring administrator review.\\n\\nReference: ' + reference +
        '\\nOriginal transaction: ' + orig.reference + '\\nRequested amount: ' + amount + ' ' + orig.currency_code +
        '\\nReason: ' + input.reason.trim() + '\\n\\nSign in to Meridian and open Refund Management to review it.',
    });
  }

  return refund as RefundRecord;
}

export async function approveAndProcessRefund(
  adminId: string,
  refundId: string,
  approvedAmount?: string | number,
  notes?: string,
  ctx?: { ip?: string | null; userAgent?: string | null },
): Promise<Record<string, unknown>> {
  const db = getServiceClient();

  const { data: refund, error } = await db
    .from('refunds')
    .select('*')
    .eq('id', refundId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!refund) throw notFound('Refund not found.');
  if (!['requested', 'under_review', 'approved'].includes(refund.status)) {
    throw invalidState(`Refund status "${refund.status}" cannot be approved.`);
  }

  const amount = approvedAmount != null
    ? parseAmount(approvedAmount)
    : parseAmount(refund.requested_amount);

  await db
    .from('refunds')
    .update({
      status: 'approved',
      approved_amount: amount,
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      admin_notes: notes ?? refund.admin_notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', refundId);

  const { data, error: rpcErr } = await db.rpc('process_internal_refund', {
    p_refund_id: refundId,
    p_approved_by: adminId,
    p_approved_amount: amount,
  });
  if (rpcErr) mapPgError(rpcErr.message);

  const result = (data ?? {}) as Record<string, unknown>;

  await db.from('notifications').insert({
    profile_id: refund.profile_id,
    type: 'success',
    title: 'Refund completed',
    body: `Refund ${refund.reference} of ${result.credited ?? amount} ${refund.currency_code} has been credited to your Meridian balance (original transaction ${refund.original_reference}).`,
  });

  try {
    const { data: profile } = await db
      .from('profiles')
      .select('email, full_name, first_name')
      .eq('id', refund.profile_id)
      .maybeSingle();
    if (profile?.email) {
      await emailRefundCompleted({
        to: profile.email,
        customerName: profile.full_name || profile.first_name || '',
        reference: refund.reference,
        amount: String(result.credited ?? amount),
        currency: refund.currency_code,
        originalReference: refund.original_reference,
      });
    }
  } catch { /* non-blocking */ }

  await auditAllowed(adminId, 'refund.approve_process', { type: 'refund', id: refund.reference }, {
    amount, result,
  }, { ip: ctx?.ip, userAgent: ctx?.userAgent });

  return result;
}

export async function rejectRefund(
  adminId: string,
  refundId: string,
  reason: string,
  ctx?: { ip?: string | null; userAgent?: string | null },
): Promise<RefundRecord> {
  const db = getServiceClient();
  const { data: refund, error } = await db.from('refunds').select('*').eq('id', refundId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!refund) throw notFound('Refund not found.');
  if (['completed', 'rejected', 'cancelled'].includes(refund.status)) {
    throw invalidState('Refund is already in a terminal state.');
  }

  const { data: updated, error: updErr } = await db
    .from('refunds')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', refundId)
    .select('*')
    .single();
  if (updErr) throw new Error(updErr.message);

  await db.from('notifications').insert({
    profile_id: refund.profile_id,
    type: 'warning',
    title: 'Refund request rejected',
    body: `Your refund request ${refund.reference} was rejected. Reason: ${reason}`,
  });

  await auditAllowed(adminId, 'refund.reject', { type: 'refund', id: refund.reference }, { reason }, {
    ip: ctx?.ip, userAgent: ctx?.userAgent,
  });

  return updated as RefundRecord;
}

export async function listRefunds(opts: {
  profileId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const db = getServiceClient();
  let q = db.from('refunds').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (opts.profileId) q = q.eq('profile_id', opts.profileId);
  if (opts.status) q = q.eq('status', opts.status);
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  q = q.range(offset, offset + limit - 1);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return { data: data ?? [], count: count ?? 0 };
}
