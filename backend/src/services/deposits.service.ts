/**
 * Deposit lifecycle — administrator-controlled manual bank-transfer workflow.
 *
 * Rules (enforced structurally):
 *  - Customer creates a deposit request → status pending_admin_action.
 *  - Admin assigns a receiving bank account → awaiting_payment.
 *  - Customer may report payment / upload receipt → payment_reported (never credits).
 *  - Admin verifies real bank arrival and calls APPROVE AND CREDIT.
 *  - Credit is atomic via admin_credit_deposit_payment RPC.
 *  - Customer identity is taken exclusively from the original deposit row.
 *  - Partial payments are supported; overpayments are capped / flagged.
 *  - No floating-point arithmetic for money.
 */
import { getServiceClient } from './supabase.service';
import { auditAllowed } from './audit.service';
import { badRequest, conflict, invalidState, notFound } from '../utils/httpError';
import { parseAmount, type Money } from '../utils/money';
import { env } from '../config/env';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type DepositMethod = 'bank_transfer';

export interface DepositInput {
  currencyCode: string;
  amount: string | number;
  notes?: string;
}

export interface DepositRecord {
  id: string;
  reference: string;
  profile_id: string;
  account_id: string;
  currency_code: string;
  amount: Money;
  requested_amount: Money;
  received_amount: Money;
  credited_amount: Money;
  outstanding_amount?: Money;
  fee: Money;
  method: string;
  status: string;
  assigned_bank_id: string | null;
  assigned_at: string | null;
  payment_reported_at: string | null;
  payment_notes: string | null;
  receipt_url: string | null;
  admin_notes: string | null;
  requested_at: string;
  completed_at: string | null;
  expires_at: string | null;
}

const MIN_AMOUNT: Record<string, Money> = {
  EUR: '1.0000', GBP: '1.0000', USD: '1.0000', CHF: '1.0000', PLN: '5.0000',
};
const MAX_AMOUNT: Money = '50000.0000';

const CREDITABLE_STATUSES = new Set([
  'awaiting_payment', 'payment_reported', 'under_verification', 'partially_fulfilled',
]);

function mapPgError(message: string): never {
  if (message.includes('CURRENCY_UNKNOWN')) throw badRequest('This currency is not offered.');
  if (message.includes('CURRENCY_UNAVAILABLE')) throw invalidState('This currency is temporarily unavailable.');
  if (message.includes('ALREADY_ACTIVE')) throw conflict('This currency account is already active.');
  if (message.includes('DEPOSIT_NOT_FOUND')) throw notFound('Deposit not found.');
  if (message.includes('DEPOSIT_NOT_PENDING') || message.includes('DEPOSIT_NOT_CREDITABLE')) {
    throw invalidState('Deposit is not in a state that allows this action.');
  }
  if (message.includes('DUPLICATE_BANK_TRANSACTION')) throw conflict('This bank transaction ID has already been recorded.');
  if (message.includes('CURRENCY_MISMATCH')) throw badRequest('Currency does not match the deposit request.');
  if (message.includes('ALREADY_FULLY_CREDITED')) throw conflict('Deposit is already fully credited.');
  if (message.includes('INVALID_AMOUNT')) throw badRequest('Invalid amount.');
  throw new Error(message);
}

export async function createDeposit(
  userId: string,
  input: DepositInput,
  idempotencyKey: string | undefined,
  ctx?: { ip?: string | null; userAgent?: string | null },
): Promise<DepositRecord> {
  const amount = parseAmount(input.amount);
  const min = MIN_AMOUNT[input.currencyCode] ?? '1.0000';
  if (Number(amount) < Number(min)) {
    throw badRequest(`Minimum deposit for ${input.currencyCode} is ${min}.`);
  }
  if (Number(amount) > Number(MAX_AMOUNT)) {
    throw badRequest('Deposit exceeds the maximum allowed amount.');
  }

  const db = getServiceClient();

  if (idempotencyKey) {
    const { data: existing } = await db
      .from('deposits')
      .select('*')
      .eq('profile_id', userId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing) return existing as DepositRecord;
  }

  const { data: account, error: accErr } = await db
    .from('accounts')
    .select('id, currency_code, status, currencies(status)')
    .eq('profile_id', userId)
    .eq('currency_code', input.currencyCode)
    .maybeSingle();
  if (accErr) throw new Error(accErr.message);
  if (!account || account.status !== 'active') {
    throw badRequest(`No active ${input.currencyCode} account. Activate it first.`);
  }
  const currency = account.currencies as unknown as { status: string } | null;
  if (currency?.status !== 'active') {
    throw invalidState(`${input.currencyCode} is temporarily unavailable.`);
  }

  const { data: referenceRow } = await db.rpc('next_dep_reference');
  const reference = String(referenceRow ?? `MGD-${Date.now()}`);
  const finalRef = reference.startsWith('DEP-')
    ? `MGD-${new Date().getUTCFullYear()}-${reference.slice(-6)}`
    : reference;

  const { data: deposit, error } = await db
    .from('deposits')
    .insert({
      reference: finalRef,
      profile_id: userId,
      account_id: account.id,
      currency_code: input.currencyCode,
      amount,
      requested_amount: amount,
      received_amount: '0.0000',
      credited_amount: '0.0000',
      fee: '0.0000',
      method: 'bank_transfer',
      status: 'pending_admin_action',
      provider: 'manual-bank-transfer',
      payment_notes: input.notes ?? null,
      idempotency_key: idempotencyKey ?? null,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  await db.from('payment_attempts').insert({
    deposit_id: deposit.id,
    provider: 'manual-bank-transfer',
    outcome: 'initiated',
    detail: { method: 'bank_transfer', currency: input.currencyCode, amount, notes: input.notes },
  });

  await db.from('notifications').insert({
    profile_id: userId,
    type: 'info',
    title: 'Deposit request submitted',
    body: `Your deposit request ${finalRef} for ${amount} ${input.currencyCode} has been received and is awaiting assignment of bank details.`,
  });

  await auditAllowed(userId, 'deposit.create', { type: 'deposit', id: finalRef }, {
    currency: input.currencyCode, amount, method: 'bank_transfer',
  }, { ip: ctx?.ip, userAgent: ctx?.userAgent });

  return deposit as DepositRecord;
}

export async function cancelDeposit(
  userId: string,
  reference: string,
  ctx?: { ip?: string | null; userAgent?: string | null },
): Promise<{ reference: string; status: string }> {
  const db = getServiceClient();
  const { data: dep, error } = await db
    .from('deposits')
    .select('*')
    .eq('reference', reference)
    .eq('profile_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!dep) throw notFound('Deposit not found.');
  if (!['pending_admin_action', 'awaiting_payment'].includes(dep.status)) {
    throw invalidState('Only deposits awaiting admin action or payment can be cancelled by the customer.');
  }

  const { error: updErr } = await db
    .from('deposits')
    .update({ status: 'cancelled' })
    .eq('id', dep.id)
    .eq('profile_id', userId);
  if (updErr) throw new Error(updErr.message);

  await auditAllowed(userId, 'deposit.cancel', { type: 'deposit', id: reference }, undefined, {
    ip: ctx?.ip, userAgent: ctx?.userAgent,
  });
  return { reference, status: 'cancelled' };
}

export async function reportPayment(
  userId: string,
  reference: string,
  payload: { notes?: string; receiptUrl?: string },
  ctx?: { ip?: string | null; userAgent?: string | null },
): Promise<DepositRecord> {
  const db = getServiceClient();
  const { data: dep, error } = await db
    .from('deposits')
    .select('*')
    .eq('reference', reference)
    .eq('profile_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!dep) throw notFound('Deposit not found.');
  if (!['awaiting_payment', 'payment_reported', 'partially_fulfilled'].includes(dep.status)) {
    throw invalidState('Payment can only be reported for deposits that are awaiting payment.');
  }

  const { data: updated, error: updErr } = await db
    .from('deposits')
    .update({
      status: 'payment_reported',
      payment_reported_at: new Date().toISOString(),
      payment_notes: payload.notes ?? dep.payment_notes,
      receipt_url: payload.receiptUrl ?? dep.receipt_url,
    })
    .eq('id', dep.id)
    .select('*')
    .single();
  if (updErr) throw new Error(updErr.message);

  await auditAllowed(userId, 'deposit.report_payment', { type: 'deposit', id: reference }, {
    notes: payload.notes, hasReceipt: Boolean(payload.receiptUrl),
  }, { ip: ctx?.ip, userAgent: ctx?.userAgent });

  return updated as DepositRecord;
}

export async function assignReceivingBank(
  adminId: string,
  depositId: string,
  bankAccountId: string,
  ctx?: { ip?: string | null; userAgent?: string | null },
): Promise<DepositRecord> {
  const db = getServiceClient();

  const { data: bank, error: bankErr } = await db
    .from('receiving_bank_accounts')
    .select('*')
    .eq('id', bankAccountId)
    .eq('is_active', true)
    .maybeSingle();
  if (bankErr) throw new Error(bankErr.message);
  if (!bank) throw notFound('Receiving bank account not found or inactive.');

  const { data: dep, error } = await db
    .from('deposits')
    .select('*')
    .eq('id', depositId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!dep) throw notFound('Deposit not found.');
  if (!['pending_admin_action', 'awaiting_payment'].includes(dep.status)) {
    throw invalidState('Bank details can only be assigned while the deposit is pending admin action or awaiting payment.');
  }
  if (dep.currency_code !== bank.currency_code) {
    throw badRequest(`Bank account currency (${bank.currency_code}) does not match deposit currency (${dep.currency_code}).`);
  }

  const { data: updated, error: updErr } = await db
    .from('deposits')
    .update({
      assigned_bank_id: bankAccountId,
      assigned_at: new Date().toISOString(),
      assigned_by: adminId,
      status: 'awaiting_payment',
    })
    .eq('id', depositId)
    .select('*')
    .single();
  if (updErr) throw new Error(updErr.message);

  await db.from('notifications').insert({
    profile_id: dep.profile_id,
    type: 'success',
    title: 'Bank details ready for your deposit',
    body: `Please transfer ${dep.requested_amount ?? dep.amount} ${dep.currency_code} using the details shown in your Deposit section. Include reference ${dep.reference} in the transfer narration.`,
  });

  await auditAllowed(adminId, 'deposit.assign_bank', { type: 'deposit', id: dep.reference }, {
    bankId: bankAccountId, bankLabel: bank.label,
  }, { ip: ctx?.ip, userAgent: ctx?.userAgent });

  return updated as DepositRecord;
}

export async function verifyAndCreditPayment(
  adminId: string,
  depositId: string,
  input: {
    amountReceived: string | number;
    currencyCode: string;
    receivingBankId?: string;
    bankTransactionId?: string;
    bankTransactionRef?: string;
    notes?: string;
  },
  ctx?: { ip?: string | null; userAgent?: string | null },
): Promise<Record<string, unknown>> {
  const amount = parseAmount(input.amountReceived);
  if (Number(amount) <= 0) throw badRequest('Amount received must be positive.');

  const db = getServiceClient();

  const { data: dep, error } = await db
    .from('deposits')
    .select('*')
    .eq('id', depositId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!dep) throw notFound('Deposit not found.');
  if (!CREDITABLE_STATUSES.has(dep.status)) {
    throw invalidState(`Deposit status "${dep.status}" does not allow crediting.`);
  }

  await db.from('deposits').update({ status: 'under_verification' }).eq('id', depositId);

  const { data, error: rpcErr } = await db.rpc('admin_credit_deposit_payment', {
    p_deposit_id: depositId,
    p_amount: amount,
    p_currency: input.currencyCode,
    p_receiving_bank_id: input.receivingBankId ?? dep.assigned_bank_id,
    p_bank_txn_id: input.bankTransactionId ?? null,
    p_bank_txn_ref: input.bankTransactionRef ?? null,
    p_verified_by: adminId,
    p_notes: input.notes ?? null,
  });
  if (rpcErr) mapPgError(rpcErr.message);

  const result = (data ?? {}) as Record<string, unknown>;

  await db.from('notifications').insert({
    profile_id: dep.profile_id,
    type: 'success',
    title: 'Deposit credited',
    body: `Your deposit ${dep.reference} has been verified. ${result.credited_this_payment ?? amount} ${input.currencyCode} has been added to your Meridian balance.`,
  });

  await auditAllowed(adminId, 'deposit.verify_credit', { type: 'deposit', id: dep.reference }, {
    amount, currency: input.currencyCode, bankTxnId: input.bankTransactionId, result,
  }, { ip: ctx?.ip, userAgent: ctx?.userAgent });

  return result;
}

export async function rejectDeposit(
  adminId: string,
  depositId: string,
  reason: string,
  ctx?: { ip?: string | null; userAgent?: string | null },
): Promise<DepositRecord> {
  const db = getServiceClient();
  const { data: dep, error } = await db.from('deposits').select('*').eq('id', depositId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!dep) throw notFound('Deposit not found.');
  if (['completed', 'cancelled', 'rejected'].includes(dep.status)) {
    throw invalidState('Deposit is already in a terminal state.');
  }

  const { data: updated, error: updErr } = await db
    .from('deposits')
    .update({ status: 'rejected', rejected_reason: reason, admin_notes: reason })
    .eq('id', depositId)
    .select('*')
    .single();
  if (updErr) throw new Error(updErr.message);

  await db.from('notifications').insert({
    profile_id: dep.profile_id,
    type: 'warning',
    title: 'Deposit request rejected',
    body: `Your deposit request ${dep.reference} was rejected. Reason: ${reason}`,
  });

  await auditAllowed(adminId, 'deposit.reject', { type: 'deposit', id: dep.reference }, { reason }, {
    ip: ctx?.ip, userAgent: ctx?.userAgent,
  });

  return updated as DepositRecord;
}

export async function listReceivingBanks(activeOnly = true) {
  const db = getServiceClient();
  let q = db.from('receiving_bank_accounts').select('*').order('display_order');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertReceivingBank(
  adminId: string,
  payload: {
    id?: string;
    label: string;
    bankName: string;
    beneficiaryName: string;
    accountNumber?: string;
    iban?: string;
    swiftBic?: string;
    countryCode: string;
    currencyCode: string;
    transferInstructions?: string;
    isActive?: boolean;
    displayOrder?: number;
  },
) {
  const db = getServiceClient();
  const row = {
    label: payload.label,
    bank_name: payload.bankName,
    beneficiary_name: payload.beneficiaryName,
    account_number: payload.accountNumber ?? null,
    iban: payload.iban ?? null,
    swift_bic: payload.swiftBic ?? null,
    country_code: payload.countryCode,
    currency_code: payload.currencyCode,
    transfer_instructions: payload.transferInstructions ?? '',
    is_active: payload.isActive ?? true,
    display_order: payload.displayOrder ?? 100,
    updated_at: new Date().toISOString(),
  };

  if (payload.id) {
    const { data, error } = await db
      .from('receiving_bank_accounts')
      .update(row)
      .eq('id', payload.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    await auditAllowed(adminId, 'bank_account.update', { type: 'receiving_bank', id: payload.id }, row);
    return data;
  }

  const { data, error } = await db
    .from('receiving_bank_accounts')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  await auditAllowed(adminId, 'bank_account.create', { type: 'receiving_bank', id: data.id }, row);
  return data;
}

export interface ProviderEvent {
  type: 'confirmed' | 'failed';
  reference: string;
  providerRef: string;
  reason?: string;
}

export async function applyProviderEvent(
  providerId: string,
  event: ProviderEvent,
): Promise<Record<string, unknown>> {
  const db = getServiceClient();
  const rpc =
    event.type === 'confirmed' ? 'provider_confirm_deposit' : 'provider_fail_deposit';
  const params: Record<string, string> =
    event.type === 'confirmed'
      ? { p_reference: event.reference, p_provider: providerId, p_provider_ref: event.providerRef }
      : {
          p_reference: event.reference,
          p_provider: providerId,
          p_provider_ref: event.providerRef,
          p_reason: event.reason ?? '',
        };
  const { data, error } = await db.rpc(rpc, params);
  if (error) mapPgError(error.message);
  await auditAllowed(
    `webhook:${providerId}`,
    `deposit.${event.type}`,
    { type: 'deposit', id: event.reference },
    { providerRef: event.providerRef },
  );
  return (data ?? {}) as Record<string, unknown>;
}

export function verifyProviderSignature(
  providerId: string,
  rawBody: string,
  signature: string | undefined,
): boolean {
  if (!env.payments.webhookSecret) return false;
  if (providerId !== env.payments.provider) return false;
  if (!signature) return false;
  const expected = createHmac('sha256', env.payments.webhookSecret)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
