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
import { emailManualDepositBankDetails, emailDepositCredited } from './resend.service';

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

/**
 * Opening / first deposit floor — cross-border fee structure requires initial
 * funding of at least USD 20,000 equivalent before smaller top-ups are allowed.
 *
 * INDICATIVE_USD rates = units of local currency per 1 USD (ops policy table,
 * not live market quotes). Minimums are rounded up to 2 decimals so the floor
 * does not fall under $20,000 at these rates.
 */
const FIRST_DEPOSIT_MIN_USD = 20_000;
/** Local currency units per 1 USD (indicative, policy). */
const INDICATIVE_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.95,   // ≈ $1 → €0.95  → min €19,000
  GBP: 0.82,   // ≈ $1 → £0.82  → min £16,400
  CHF: 0.90,   // ≈ $1 → CHF0.90 → min CHF18,000
  PLN: 4.10,   // ≈ $1 → zł4.10  → min zł82,000
};

function firstDepositMin(currencyCode: string): Money | null {
  const rate = INDICATIVE_USD_RATES[currencyCode];
  if (rate == null || rate <= 0) return null;
  // Round up to 2 decimal places (cent-safe for display currencies).
  const raw = FIRST_DEPOSIT_MIN_USD * rate;
  const cents = Math.ceil(raw * 100) / 100;
  return cents.toFixed(4) as Money;
}

function formatMinDisplay(min: Money, currencyCode: string): string {
  return `${Number(min).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`;
}

const MAX_AMOUNT: Money = '250000.0000'; // raised so USD-equivalent first deposits in weaker units fit

/** True when the customer has never had a deposit fully or partially credited. */
async function isFirstDeposit(userId: string): Promise<boolean> {
  const db = getServiceClient();
  const { count, error } = await db
    .from('deposits')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', userId)
    .in('status', ['completed', 'partially_fulfilled']);
  if (error) throw new Error(error.message);
  return (count ?? 0) === 0;
}

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
  if (message.includes('RECEIVING_BANK_NOT_APPROVED') || message.includes('RECEIVING_BANK_MISMATCH')) throw invalidState('The receiving bank account is not approved for this deposit.');
  if (message.includes('BANK_TRANSACTION_REFERENCE_REQUIRED')) throw badRequest('A bank transaction ID or reference is required.');
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
  const first = await isFirstDeposit(userId);
  const firstMin = first ? firstDepositMin(input.currencyCode) : null;
  const regularMin = MIN_AMOUNT[input.currencyCode] ?? '1.0000';
  const min = firstMin ?? regularMin;

  if (Number(amount) < Number(min)) {
    if (firstMin) {
      throw badRequest(
        `Your first deposit must be at least ${formatMinDisplay(firstMin, input.currencyCode)} ` +
          `(USD 20,000 equivalent at indicative rates) to cover cross-border processing fees. ` +
          `Subsequent deposits can be smaller.`,
      );
    }
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
  payload: { notes?: string; receiptUrl?: string; bankTransactionRef?: string },
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
  if (!payload.bankTransactionRef?.trim()) throw badRequest('Enter the bank transaction reference from your transfer receipt.');

  const { data: updated, error: updErr } = await db
    .from('deposits')
    .update({
      status: 'payment_reported',
      payment_reported_at: new Date().toISOString(),
      payment_notes: payload.notes ?? dep.payment_notes,
      receipt_url: payload.receiptUrl ?? dep.receipt_url,
      customer_bank_reference: payload.bankTransactionRef ?? dep.customer_bank_reference,
    })
    .eq('id', dep.id)
    .select('*')
    .single();
  if (updErr) throw new Error(updErr.message);

  await auditAllowed(userId, 'deposit.report_payment', { type: 'deposit', id: reference }, {
    notes: payload.notes, bankTransactionRef: payload.bankTransactionRef, hasReceipt: Boolean(payload.receiptUrl),
  }, { ip: ctx?.ip, userAgent: ctx?.userAgent });

  return updated as DepositRecord;
}

export async function sendManualDepositBankDetails(
  adminId: string, depositId: string,
  input: { bankName: string; accountNumber: string; narration?: string },
  ctx?: { ip?: string | null; userAgent?: string | null },
): Promise<{ reference: string; email: string; status: string }> {
  const db = getServiceClient();
  const { data: dep, error } = await db.from('deposits').select('*').eq('id', depositId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!dep) throw notFound('Deposit not found.');
  if (!['pending_admin_action', 'awaiting_payment'].includes(dep.status)) {
    throw invalidState('Bank details can only be sent for a deposit awaiting bank instructions.');
  }
  const { data: profile, error: profileError } = await db.from('profiles')
    .select('email, full_name, first_name').eq('id', dep.profile_id).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile?.email) throw badRequest('This customer does not have an email address on their account.');

  const narration = input.narration?.trim() || dep.reference;
  const sent = await emailManualDepositBankDetails({
    to: profile.email, customerName: profile.full_name || profile.first_name || '',
    reference: dep.reference, amount: String(dep.requested_amount ?? dep.amount),
    currency: dep.currency_code, bankName: input.bankName.trim(),
    accountNumber: input.accountNumber.trim(), narration,
  });
  if (!sent) throw invalidState('The bank-details email could not be sent. Check email delivery configuration and try again.');

  const { error: updateError } = await db.from('deposits').update({
    status: 'awaiting_payment', assigned_bank_id: null, assigned_at: null, assigned_by: null,
  }).eq('id', depositId);
  if (updateError) throw new Error(updateError.message);

  const { error: notificationError } = await db.from('notifications').insert({
    profile_id: dep.profile_id, type: 'success', title: 'Bank details for your deposit',
    body: 'Bank: ' + input.bankName.trim() + '. Account number: ' + input.accountNumber.trim() +
      '. Amount: ' + String(dep.requested_amount ?? dep.amount) + ' ' + dep.currency_code +
      '. Transfer narration: ' + narration +
      '. Your balance will be credited after the payment is verified.',
  });
  if (notificationError) throw new Error(notificationError.message);

  await auditAllowed(adminId, 'deposit.send_bank_details', { type: 'deposit', id: dep.reference }, {
    bankName: input.bankName.trim(), email: profile.email,
  }, { ip: ctx?.ip, userAgent: ctx?.userAgent });
  return { reference: dep.reference, email: profile.email, status: 'awaiting_payment' };
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
  if (!input.bankTransactionId?.trim() && !input.bankTransactionRef?.trim()) {
    throw badRequest('Enter the receiving-bank transaction ID or reference after verifying the funds in the receiving account.');
  }

  // The credit RPC locks the deposit and performs the status transition in the
  // same transaction as the payment + ledger inserts. Do not pre-update here:
  // a failed RPC must not strand the deposit in under_verification.

  const { data, error: rpcErr } = await db.rpc('admin_credit_deposit_payment', {
    p_deposit_id: depositId,
    p_amount: amount,
    p_currency: input.currencyCode,
    p_receiving_bank_id: input.receivingBankId ?? dep.assigned_bank_id ?? null,
    p_bank_txn_id: input.bankTransactionId?.trim() || null,
    p_bank_txn_ref: input.bankTransactionRef?.trim() || null,
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

  try {
    const { data: profile } = await db
      .from('profiles')
      .select('email, full_name, first_name')
      .eq('id', dep.profile_id)
      .maybeSingle();
    if (profile?.email) {
      await emailDepositCredited({
        to: profile.email,
        customerName: profile.full_name || profile.first_name || '',
        reference: dep.reference,
        amount: String(result.credited_this_payment ?? amount),
        currency: input.currencyCode,
      });
    }
  } catch { /* non-blocking */ }

  await auditAllowed(adminId, 'deposit.verify_credit', { type: 'deposit', id: dep.reference }, {
    amount, currency: input.currencyCode, bankTxnId: input.bankTransactionId, bankTxnRef: input.bankTransactionRef, result,
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
  if (activeOnly) q = q.eq('is_active', true).eq('status', 'approved');
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
    displayOrder?: number;
  },
) {
  const db = getServiceClient();
  const row = {
    label: payload.label, bank_name: payload.bankName,
    beneficiary_name: payload.beneficiaryName,
    account_number: payload.accountNumber ?? null,
    iban: payload.iban ?? null, swift_bic: payload.swiftBic ?? null,
    country_code: payload.countryCode, currency_code: payload.currencyCode,
    transfer_instructions: payload.transferInstructions ?? '',
    status: 'pending', is_active: false, approved_by: null, approved_at: null,
    rejection_reason: null, display_order: payload.displayOrder ?? 100,
    updated_at: new Date().toISOString(),
  };
  if (payload.id) {
    const { data: existing, error: findErr } = await db.from('receiving_bank_accounts')
      .select('id, status').eq('id', payload.id).maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!existing) throw notFound('Receiving bank account not found.');
    if (existing.status === 'approved') throw invalidState('Approved bank accounts cannot be edited. Add a new account and submit it for approval instead.');
    const { data, error } = await db.from('receiving_bank_accounts')
      .update(row).eq('id', payload.id).select('*').single();
    if (error) throw new Error(error.message);
    await auditAllowed(adminId, 'bank_account.resubmit', { type: 'receiving_bank', id: payload.id }, {
      currency: row.currency_code, bankName: row.bank_name,
      accountNumberProvided: Boolean(row.account_number), ibanProvided: Boolean(row.iban),
    });
    return data;
  }
  const { data, error } = await db.from('receiving_bank_accounts')
    .insert({ ...row, created_by: adminId }).select('*').single();
  if (error) throw new Error(error.message);
  await auditAllowed(adminId, 'bank_account.submit', { type: 'receiving_bank', id: data.id }, {
    currency: row.currency_code, bankName: row.bank_name,
    accountNumberProvided: Boolean(row.account_number), ibanProvided: Boolean(row.iban),
  });
  return data;
}

export async function approveReceivingBank(
  adminId: string, bankId: string, ctx?: { ip?: string | null; userAgent?: string | null },
) {
  const db = getServiceClient();
  const { data: bank, error } = await db.from('receiving_bank_accounts').select('*').eq('id', bankId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!bank) throw notFound('Receiving bank account not found.');
  if (bank.status !== 'pending') throw invalidState('Only pending receiving bank accounts can be approved.');
  if (!bank.account_number?.trim() && !bank.iban?.trim()) throw badRequest('A verified account number or IBAN is required before approval.');
  if (/placeholder|unassigned/i.test([bank.label, bank.bank_name, bank.beneficiary_name].join(' '))) {
    throw badRequest('Placeholder receiving details cannot be approved.');
  }
  const now = new Date().toISOString();
  const { data, error: updateErr } = await db.from('receiving_bank_accounts')
    .update({ status: 'approved', is_active: true, approved_by: adminId, approved_at: now, rejection_reason: null, updated_at: now })
    .eq('id', bankId).eq('status', 'pending').select('*').maybeSingle();
  if (updateErr) throw new Error(updateErr.message);
  if (!data) throw invalidState('This receiving account was changed by another administrator. Refresh and try again.');
  await auditAllowed(adminId, 'bank_account.approve', { type: 'receiving_bank', id: bankId }, {
    currency: bank.currency_code, bankName: bank.bank_name,
  }, { ip: ctx?.ip, userAgent: ctx?.userAgent });
  return data;
}

export async function rejectReceivingBank(
  adminId: string, bankId: string, reason: string, ctx?: { ip?: string | null; userAgent?: string | null },
) {
  const db = getServiceClient();
  const { data, error } = await db.from('receiving_bank_accounts')
    .update({ status: 'rejected', is_active: false, rejection_reason: reason, approved_by: null, approved_at: null, updated_at: new Date().toISOString() })
    .eq('id', bankId).eq('status', 'pending').select('*').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw invalidState('Only pending receiving bank accounts can be rejected.');
  await auditAllowed(adminId, 'bank_account.reject', { type: 'receiving_bank', id: bankId }, { reason }, {
    ip: ctx?.ip, userAgent: ctx?.userAgent,
  });
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
