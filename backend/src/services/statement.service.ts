/**
 * Statements — deterministic generation from the ledger.
 * A statement for (account, period) is fully determined by the posted
 * entries in that window, so regeneration is safe (upsert) and the stored
 * row is a cache. The download format is a provisional text format until a
 * licensed statement provider is contracted.
 */
import { getServiceClient } from './supabase.service';
import { conflict, notFound } from '../utils/httpError';
import { env } from '../config/env';
import { addMoney, subMoney, type Money } from '../utils/money';

export interface StatementRow {
  id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  opening_balance: string;
  closing_balance: string;
  entry_count: number;
  generated_at: string;
}

export async function generateStatement(
  userId: string,
  accountId: string,
  periodStart: string,
  periodEnd: string,
): Promise<StatementRow> {
  const db = getServiceClient();

  const { data: account } = await db
    .from('accounts')
    .select('id, profile_id, currency_code')
    .eq('id', accountId)
    .maybeSingle();
  if (!account || account.profile_id !== userId) throw notFound('Account not found.');

  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw conflict('Invalid statement period.');
  }

  // Opening balance = ledger sum strictly before the period start.
  const { data: opening } = await db.rpc('ledger_sum_before', {
    p_account_id: accountId,
    p_before: start.toISOString(),
  });
  // Entries in the period.
  const { data: entries } = await db
    .from('transactions')
    .select('reference, direction, amount, currency_code, description, created_at, status, type, method')
    .eq('account_id', accountId)
    .eq('status', 'posted')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at', { ascending: true });

  const list = entries ?? [];
  const openingBalance: Money = String(opening ?? '0');
  let closingBalance: Money = openingBalance;
  for (const e of list) {
    if (e.direction === 'credit') {
      closingBalance = addMoney(closingBalance, String(e.amount) as Money);
    } else {
      closingBalance = subMoney(closingBalance, String(e.amount) as Money);
    }
  }

  const { data: row, error } = await db
    .from('statements')
    .upsert(
      {
        account_id: accountId,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        entry_count: list.length,
      },
      { onConflict: 'account_id,period_start,period_end' },
    )
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return row as StatementRow;
}

export function renderStatementText(
  statement: StatementRow,
  account: { currency_code: string },
  entries: {
    reference: string;
    direction: string;
    amount: string;
    description: string;
    created_at: string;
  }[],
  holder: { full_name: string; email: string },
): string {
  const lines: string[] = [
    'MERIDIAN GLOBAL ACCOUNTS — ACCOUNT STATEMENT',
    env.statementNote,
    '',
    `Holder: ${holder.full_name} <${holder.email}>`,
    `Currency account: ${account.currency_code}`,
    `Period: ${statement.period_start} to ${statement.period_end}`,
    `Opening balance: ${statement.opening_balance} ${account.currency_code}`,
    `Closing balance: ${statement.closing_balance} ${account.currency_code}`,
    `Entries: ${statement.entry_count}`,
    '',
    'REFERENCE        DATE                 DIRECTION  AMOUNT        DESCRIPTION',
    '---------------  -------------------  ---------  ------------  -----------',
  ];
  for (const e of entries) {
    lines.push(
      [
        e.reference.padEnd(17),
        e.created_at.padEnd(21),
        e.direction.padEnd(11),
        `${e.direction === 'credit' ? '+' : '-'}${e.amount}`.padEnd(15),
        e.description,
      ].join(''),
    );
  }
  lines.push('', 'Platform accounts are not bank accounts. Meridian Global Accounts.');
  return lines.join('\n');
}
