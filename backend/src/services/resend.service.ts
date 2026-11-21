/**
 * Resend email delivery (transactional).
 * Used for deposit bank-detail assignment, deposit credited, refunds, etc.
 * Fails soft when unconfigured — never blocks the financial path.
 */
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: { name: string; value: string }[];
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!env.resend.apiKey || !env.resend.fromEmail) {
    logger.warn({ to: payload.to, subject: payload.subject }, 'Resend not configured — email skipped');
    return { ok: false, error: 'SERVICE_NOT_CONFIGURED' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resend.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.resend.fromName
          ? `${env.resend.fromName} <${env.resend.fromEmail}>`
          : env.resend.fromEmail,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        tags: payload.tags,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body }, 'Resend API error');
      return { ok: false, error: `RESEND_${res.status}` };
    }

    const data = (await res.json()) as { id?: string };
    logger.info({ id: data.id, to: payload.to, subject: payload.subject }, 'Email sent via Resend');
    return { ok: true, id: data.id };
  } catch (err) {
    logger.error({ err }, 'Resend request failed');
    return { ok: false, error: 'RESEND_NETWORK' };
  }
}

/** Bank-details assignment email to the customer. */
export async function emailBankDetailsAssigned(opts: {
  to: string;
  customerName: string;
  reference: string;
  amount: string;
  currency: string;
  bankName: string;
  beneficiaryName: string;
  iban?: string | null;
  accountNumber?: string | null;
  swiftBic?: string | null;
  transferInstructions?: string | null;
}): Promise<void> {
  const lines = [
    `Hello ${opts.customerName || 'Customer'},`,
    '',
    `Receiving bank details are ready for your deposit request ${opts.reference}.`,
    '',
    `Amount: ${opts.amount} ${opts.currency}`,
    `Bank: ${opts.bankName}`,
    `Beneficiary: ${opts.beneficiaryName}`,
    opts.iban ? `IBAN: ${opts.iban}` : null,
    opts.accountNumber ? `Account number: ${opts.accountNumber}` : null,
    opts.swiftBic ? `SWIFT/BIC: ${opts.swiftBic}` : null,
    '',
    `IMPORTANT: Include reference ${opts.reference} in the transfer narration.`,
    opts.transferInstructions || null,
    '',
    'Your Meridian balance is credited only after an administrator verifies the incoming payment.',
    '',
    '— Meridian Global Accounts',
  ].filter((l) => l !== null);

  const html = `
    <p>Hello ${escapeHtml(opts.customerName || 'Customer')},</p>
    <p>Receiving bank details are ready for your deposit request <strong>${escapeHtml(opts.reference)}</strong>.</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:4px 12px 4px 0"><strong>Amount</strong></td><td>${escapeHtml(opts.amount)} ${escapeHtml(opts.currency)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0"><strong>Bank</strong></td><td>${escapeHtml(opts.bankName)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0"><strong>Beneficiary</strong></td><td>${escapeHtml(opts.beneficiaryName)}</td></tr>
      ${opts.iban ? `<tr><td style="padding:4px 12px 4px 0"><strong>IBAN</strong></td><td><code>${escapeHtml(opts.iban)}</code></td></tr>` : ''}
      ${opts.accountNumber ? `<tr><td style="padding:4px 12px 4px 0"><strong>Account</strong></td><td><code>${escapeHtml(opts.accountNumber)}</code></td></tr>` : ''}
      ${opts.swiftBic ? `<tr><td style="padding:4px 12px 4px 0"><strong>SWIFT/BIC</strong></td><td><code>${escapeHtml(opts.swiftBic)}</code></td></tr>` : ''}
      <tr><td style="padding:4px 12px 4px 0"><strong>Reference</strong></td><td><code>${escapeHtml(opts.reference)}</code></td></tr>
    </table>
    <p><strong>Always include the deposit reference in the bank transfer narration.</strong></p>
    ${opts.transferInstructions ? `<p>${escapeHtml(opts.transferInstructions)}</p>` : ''}
    <p style="color:#666">Your Meridian balance is credited only after an administrator verifies the incoming payment. Reporting a payment does not auto-credit funds.</p>
    <p>— Meridian Global Accounts</p>
  `;

  await sendEmail({
    to: opts.to,
    subject: `Bank details ready — deposit ${opts.reference}`,
    html,
    text: lines.join('\n'),
    tags: [
      { name: 'category', value: 'deposit_bank_details' },
      { name: 'reference', value: opts.reference },
    ],
  });
}

export async function emailDepositCredited(opts: {
  to: string;
  customerName: string;
  reference: string;
  amount: string;
  currency: string;
}): Promise<void> {
  const html = `
    <p>Hello ${escapeHtml(opts.customerName || 'Customer')},</p>
    <p>Your deposit <strong>${escapeHtml(opts.reference)}</strong> has been verified.</p>
    <p><strong>${escapeHtml(opts.amount)} ${escapeHtml(opts.currency)}</strong> has been credited to your Meridian balance.</p>
    <p>— Meridian Global Accounts</p>
  `;
  await sendEmail({
    to: opts.to,
    subject: `Deposit credited — ${opts.reference}`,
    html,
    text: `Deposit ${opts.reference} credited: ${opts.amount} ${opts.currency}`,
    tags: [{ name: 'category', value: 'deposit_credited' }],
  });
}

export async function emailRefundCompleted(opts: {
  to: string;
  customerName: string;
  reference: string;
  amount: string;
  currency: string;
  originalReference: string;
}): Promise<void> {
  const html = `
    <p>Hello ${escapeHtml(opts.customerName || 'Customer')},</p>
    <p>Refund <strong>${escapeHtml(opts.reference)}</strong> has been completed.</p>
    <p><strong>${escapeHtml(opts.amount)} ${escapeHtml(opts.currency)}</strong> has been credited to your Meridian balance
    (original transaction ${escapeHtml(opts.originalReference)}).</p>
    <p>This is an internal Meridian balance credit — not an external bank payout.</p>
    <p>— Meridian Global Accounts</p>
  `;
  await sendEmail({
    to: opts.to,
    subject: `Refund completed — ${opts.reference}`,
    html,
    text: `Refund ${opts.reference}: ${opts.amount} ${opts.currency} credited to your Meridian balance.`,
    tags: [{ name: 'category', value: 'refund_completed' }],
  });
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
