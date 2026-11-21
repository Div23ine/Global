/**
 * Real-database integration tests.
 *
 * Boots a genuine PostgreSQL 18 instance (embedded-postgres, unprivileged),
 * applies the production migrations in order, then verifies:
 *   - schema + European seed (no NGN anywhere),
 *   - profile bootstrap (country -> default currency, idempotency),
 *   - currency activation guards,
 *   - ledger posting + balance projection + insufficient-funds guard,
 *   - the deposit state machine (confirm/fail/cancel/idempotency/immutability),
 *   - Row Level Security with TWO different users (ownership isolation,
 *     no client writes on money tables),
 *   - profile anonymization retaining financial records,
 *   - statement opening-balance computation.
 *
 * This is L3 evidence per AGENTS.md (real engine, real schema, behavior
 * observed in the database).
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from 'pg';

const PORT = 54329;
const DB = 'meridian_test';
const CONN = `postgres://postgres:postgres@127.0.0.1:${PORT}/${DB}`;

let postgres: { initialise(): Promise<void>; start(): Promise<void>; createDatabase(name: string): Promise<void>; stop(): Promise<void> } | null = null;
let svc: Client | null = null; // service-role stand-in (table owner = superuser)

async function connect(): Promise<Client> {
  const c = new Client({ connectionString: CONN });
  await c.connect();
  return c;
}

beforeAll(async () => {
  const t = (m: string) => console.error(`[hook] ${new Date().toISOString()} ${m}`);
  t('importing embedded-postgres');
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  t('constructing');
  postgres = new EmbeddedPostgres({
    databaseDir: join(tmpdir(), `meridian-pg-${Date.now()}`),
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: false,
  }) as never;
  t('initialise');
  await postgres.initialise();
  t('start');
  await postgres.start();
  t('createDatabase');
  await postgres.createDatabase(DB);
  t('connect');
  svc = await connect();
  t('connected');

  // Apply production migrations in order (simple query protocol: multi-statement).
  const dir = join(__dirname, '../../migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dir, file), 'utf8');
    await svc.query(sql);
  }

  // Simulate the Supabase role model for RLS tests: authenticated + anon.
  await svc.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      CREATE ROLE anon NOLOGIN;
    END IF;
  END $$;`);
  await svc.query('GRANT USAGE ON SCHEMA public TO authenticated, anon');
  await svc.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated');
  await svc.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon');
}, 300_000);

afterAll(async () => {
  if (svc) await svc.end().catch(() => undefined);
  if (postgres) await postgres.stop().catch(() => undefined);
});

const USER_A = 'user_test0000000000000000001';
const USER_B = 'user_test0000000000000000002';

async function asUser(clerkUserId: string): Promise<Client> {
  const c = await connect();
  await c.query(`SET ROLE authenticated`);
  await c.query(`SET request.jwt.claims = '${JSON.stringify({ sub: clerkUserId })}'`);
  return c;
}

describe('migrations + seed', () => {
  it('applies the European currency set with EUR default and no NGN', async () => {
    const { rows } = await svc!.query('SELECT code FROM currencies ORDER BY display_order');
    expect(rows.map((r) => r.code)).toEqual(['EUR', 'GBP', 'USD', 'CHF', 'PLN']);
    const settings = await svc!.query(
      "SELECT value FROM app_settings WHERE key = 'presentation.default_currency'",
    );
    expect(settings.rows[0].value).toBe('EUR');
  });

  it('seeds admin roles with a permission matrix', async () => {
    const { rows } = await svc!.query('SELECT id FROM admin_roles ORDER BY id');
    expect(rows.map((r) => r.id)).toEqual(['compliance', 'finance_readonly', 'super_admin', 'support']);
  });

  it('maps countries to default currencies (DE->EUR, GB->GBP, PL->PLN, US->USD)', async () => {
    for (const [country, currency] of [['DE', 'EUR'], ['GB', 'GBP'], ['PL', 'PLN'], ['US', 'USD']] as const) {
      const { rows } = await svc!.query(
        'SELECT currency_code FROM country_defaults WHERE country_code = $1', [country],
      );
      expect(rows[0].currency_code).toBe(currency);
    }
  });
});

describe('profile bootstrap (Clerk user.created)', () => {
  it('creates the profile and the default-currency account, idempotently', async () => {
    await svc!.query('SELECT bootstrap_profile($1,$2,$3,$4,$5)',
      [USER_A, 'a@example.com', 'Anna Schmidt', '+4917000000', 'DE']);
    await svc!.query('SELECT bootstrap_profile($1,$2,$3,$4,$5)',
      [USER_A, 'a@example.com', 'Anna Schmidt', '+4917000000', 'DE']);

    const profile = await svc!.query('SELECT default_currency, status FROM profiles WHERE id = $1', [USER_A]);
    expect(profile.rows[0].default_currency).toBe('EUR');
    expect(profile.rows[0].status).toBe('active');

    const accounts = await svc!.query('SELECT currency_code, balance FROM accounts WHERE profile_id = $1', [USER_A]);
    expect(accounts.rows).toHaveLength(1);
    expect(accounts.rows[0]).toMatchObject({ currency_code: 'EUR' });
    expect(Number(accounts.rows[0].balance)).toBe(0);
  });
});

describe('currency activation', () => {
  it('activates with zero balance and rejects duplicates + unavailable currencies', async () => {
    const ok = await svc!.query('SELECT activate_currency($1,$2)', [USER_A, 'GBP']);
    expect(ok.rows[0].activate_currency).toMatchObject({ currency_code: 'GBP' });
    expect(Number(ok.rows[0].activate_currency.balance)).toBe(0);

    await expect(svc!.query('SELECT activate_currency($1,$2)', [USER_A, 'GBP']))
      .rejects.toThrow('ALREADY_ACTIVE');

    await svc!.query("UPDATE currencies SET status = 'unavailable' WHERE code = 'CHF'");
    await expect(svc!.query('SELECT activate_currency($1,$2)', [USER_A, 'CHF']))
      .rejects.toThrow('CURRENCY_UNAVAILABLE');
    await expect(svc!.query('SELECT activate_currency($1,$2)', [USER_A, 'ZZZ']))
      .rejects.toThrow('CURRENCY_UNKNOWN');
    await svc!.query("UPDATE currencies SET status = 'active' WHERE code = 'CHF'");
  });
});

describe('ledger and balance projection', () => {
  it('posts credits, projects the balance, refuses overdrafts', async () => {
    const acc = await svc!.query('SELECT id FROM accounts WHERE profile_id = $1 AND currency_code = $2',
      [USER_A, 'EUR']);
    const accountId = acc.rows[0].id as string;

    await svc!.query('SELECT post_ledger_entry($1,$2,$3,$4,$5,$6,$7)',
      [accountId, USER_A, 'deposit', 'credit', '100.0000', 'EUR', 'Test deposit 1']);

    let balance = await svc!.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    expect(Number(balance.rows[0].balance)).toBe(100);

    // Debit within funds works.
    await svc!.query('SELECT post_ledger_entry($1,$2,$3,$4,$5,$6,$7)',
      [accountId, USER_A, 'fee', 'debit', '30.0000', 'EUR', 'Fee']);
    balance = await svc!.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    expect(Number(balance.rows[0].balance)).toBe(70);

    // Debit beyond funds is refused.
    await expect(svc!.query('SELECT post_ledger_entry($1,$2,$3,$4,$5,$6,$7)',
      [accountId, USER_A, 'withdrawal', 'debit', '70.0001', 'EUR', 'Overdraft attempt']))
      .rejects.toThrow('insufficient funds');

    // Zero/negative amounts are refused.
    await expect(svc!.query('SELECT post_ledger_entry($1,$2,$3,$4,$5,$6,$7)',
      [accountId, USER_A, 'fee', 'debit', '0', 'EUR', 'Zero']))
      .rejects.toThrow('positive');

    // References are unique and sequential-shaped.
    const refs = await svc!.query('SELECT reference FROM transactions ORDER BY created_at');
    expect(refs.rows.every((r) => /^TXN-\d{4}-\d{6}$/.test(r.reference))).toBe(true);
  });
});

describe('deposit state machine', () => {
  it('full lifecycle: pending -> completed with ledger + notification, idempotent replay', async () => {
    const acc = await svc!.query('SELECT id FROM accounts WHERE profile_id = $1 AND currency_code = $2',
      [USER_A, 'EUR']);
    const accountId = acc.rows[0].id as string;
    const before = await svc!.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    const beforeBalance = Number(before.rows[0].balance);

    const ref = await svc!.query('SELECT next_dep_reference() AS r');
    const reference = ref.rows[0].r as string;
    await svc!.query(
      `INSERT INTO deposits (reference, profile_id, account_id, currency_code, amount, method, status)
       VALUES ($1, $2, $3, 'EUR', '50.0000', 'card', 'pending')`,
      [reference, USER_A, accountId],
    );

    const confirmed = await svc!.query('SELECT provider_confirm_deposit($1,$2,$3)',
      [reference, 'manual-review', 'prov-123']);
    const result = confirmed.rows[0].provider_confirm_deposit;
    expect(result.status).toBe('completed');
    expect(result.duplicate).toBe(false);

    const after = await svc!.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    expect(Number(after.rows[0].balance)).toBe(beforeBalance + 50);

    // Ledger entry linked to the deposit exists exactly once.
    const ledger = await svc!.query(
      'SELECT count(*)::int AS n FROM transactions WHERE related_deposit_id = (SELECT id FROM deposits WHERE reference = $1)',
      [reference],
    );
    expect(ledger.rows[0].n).toBe(1);

    // Notification was created.
    const notif = await svc!.query(
      'SELECT count(*)::int AS n FROM notifications WHERE profile_id = $1 AND title = $2',
      [USER_A, 'Deposit confirmed'],
    );
    expect(notif.rows[0].n).toBeGreaterThanOrEqual(1);

    // Duplicate webhook delivery: recorded as duplicate_ignored, no double credit.
    const replay = await svc!.query('SELECT provider_confirm_deposit($1,$2,$3)',
      [reference, 'manual-review', 'prov-123']);
    expect(replay.rows[0].provider_confirm_deposit.duplicate).toBe(true);
    const finalBalance = await svc!.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    expect(Number(finalBalance.rows[0].balance)).toBe(beforeBalance + 50);

    // Illegal transition attempts are blocked by the trigger.
    await expect(svc!.query(
      "UPDATE deposits SET status = 'pending' WHERE reference = $1", [reference],
    )).rejects.toThrow('illegal deposit transition');

    // Amount immutability.
    await expect(svc!.query(
      'UPDATE deposits SET amount = 999 WHERE reference = $1', [reference],
    )).rejects.toThrow('immutable');
  });

  it('failure path: no credit; cancellation only while pending', async () => {
    const acc = await svc!.query('SELECT id FROM accounts WHERE profile_id = $1 AND currency_code = $2',
      [USER_A, 'EUR']);
    const accountId = acc.rows[0].id as string;
    const before = await svc!.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);

    const ref = await svc!.query('SELECT next_dep_reference() AS r');
    const reference = ref.rows[0].r as string;
    await svc!.query(
      `INSERT INTO deposits (reference, profile_id, account_id, currency_code, amount, method, status)
       VALUES ($1, $2, $3, 'EUR', '25.0000', 'bank_transfer', 'pending')`,
      [reference, USER_A, accountId],
    );

    const failed = await svc!.query('SELECT provider_fail_deposit($1,$2,$3,$4)',
      [reference, 'manual-review', 'prov-456', 'card declined']);
    expect(failed.rows[0].provider_fail_deposit.status).toBe('failed');

    const after = await svc!.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    expect(Number(after.rows[0].balance)).toBe(Number(before.rows[0].balance));

    // Cancelling a failed deposit is illegal.
    await expect(svc!.query('SELECT cancel_deposit($1,$2)', [USER_A, reference]))
      .rejects.toThrow('DEPOSIT_NOT_PENDING');

    // A pending deposit CAN be cancelled by its owner.
    const ref2 = await svc!.query('SELECT next_dep_reference() AS r');
    const reference2 = ref2.rows[0].r as string;
    await svc!.query(
      `INSERT INTO deposits (reference, profile_id, account_id, currency_code, amount, method, status)
       VALUES ($1, $2, $3, 'EUR', '10.0000', 'gateway', 'pending')`,
      [reference2, USER_A, accountId],
    );
    const cancelled = await svc!.query('SELECT cancel_deposit($1,$2)', [USER_A, reference2]);
    expect(cancelled.rows[0].cancel_deposit.status).toBe('cancelled');

    // Another user's deposit cannot be cancelled.
    await svc!.query('SELECT bootstrap_profile($1,$2,$3,$4,$5)',
      [USER_B, 'b@example.com', 'Ben Brown', '', 'GB']);
    await expect(svc!.query('SELECT cancel_deposit($1,$2)', [USER_B, reference2]))
      .rejects.toThrow('DEPOSIT_NOT_FOUND');
  });
});

describe('Row Level Security (two-user isolation)', () => {
  it('a customer sees only their own rows and cannot write money tables', async () => {
    const a = await asUser(USER_A);
    const b = await asUser(USER_B);
    try {
      // Own profile visible; other user's profile invisible.
      const aProfile = await a.query('SELECT id FROM profiles');
      expect(aProfile.rows).toHaveLength(1);
      expect(aProfile.rows[0].id).toBe(USER_A);

      const aAccounts = await a.query('SELECT profile_id, currency_code FROM accounts');
      expect(aAccounts.rows.every((r) => r.profile_id === USER_A)).toBe(true);

      const aTx = await a.query('SELECT profile_id FROM transactions');
      expect(aTx.rows.length).toBeGreaterThan(0);
      expect(aTx.rows.every((r) => r.profile_id === USER_A)).toBe(true);

      const bTx = await b.query('SELECT profile_id FROM transactions');
      expect(bTx.rows).toHaveLength(0); // B has no ledger entries

      // Client INSERT into the ledger is denied (no policy).
      await expect(a.query(
        `INSERT INTO transactions (reference, account_id, profile_id, type, direction, amount, currency_code, status)
         VALUES ('TXN-HACK-1', (SELECT id FROM accounts WHERE profile_id = $1 LIMIT 1), $1, 'deposit', 'credit', 1000000, 'EUR', 'posted')`,
        [USER_A],
      )).rejects.toThrow();

      // Client UPDATE of account balance affects 0 rows (RLS: no policy = deny).
      const hackUpdate = await a.query(
        'UPDATE accounts SET balance = 999999 WHERE profile_id = $1', [USER_A],
      );
      expect(hackUpdate.rowCount).toBe(0);
      const balancesAfter = await a.query('SELECT balance FROM accounts');
      expect(balancesAfter.rows.every((r) => Number(r.balance) < 999999)).toBe(true);

      // Client cannot read audit logs / admin tables at all (0 rows or denied).
      const audit = await a.query('SELECT * FROM audit_logs');
      expect(audit.rows).toHaveLength(0);
      const adminUsers = await a.query('SELECT * FROM admin_users');
      expect(adminUsers.rows).toHaveLength(0);

      // Public read of currencies works for both.
      const currencies = await b.query('SELECT count(*)::int AS n FROM currencies');
      expect(currencies.rows[0].n).toBe(5);
    } finally {
      await a.end().catch(() => undefined);
      await b.end().catch(() => undefined);
    }

    // Anonymous (no claims) sees no profiles.
    const anon = await connect();
    await anon.query('SET ROLE anon');
    const anonProfiles = await anon.query('SELECT * FROM profiles');
    expect(anonProfiles.rows).toHaveLength(0);
    await anon.end();
  });
});

describe('profile anonymization (Clerk user.deleted)', () => {
  it('clears PII but retains financial records', async () => {
    const txBefore = await svc!.query('SELECT count(*)::int AS n FROM transactions WHERE profile_id = $1', [USER_A]);
    expect(txBefore.rows[0].n).toBeGreaterThan(0);

    await svc!.query('SELECT anonymize_profile($1)', [USER_A]);

    const p = await svc!.query('SELECT email, full_name, phone, status FROM profiles WHERE id = $1', [USER_A]);
    expect(p.rows[0].email).toContain('anonymized.invalid');
    expect(p.rows[0].full_name).toBe('Deleted customer');
    expect(p.rows[0].phone).toBeNull();
    expect(p.rows[0].status).toBe('deleted');

    const txAfter = await svc!.query('SELECT count(*)::int AS n FROM transactions WHERE profile_id = $1', [USER_A]);
    expect(txAfter.rows[0].n).toBe(txBefore.rows[0].n);
  });
});

describe('statement opening balance', () => {
  it('computes ledger sums before a point in time', async () => {
    const acc = await svc!.query('SELECT id FROM accounts WHERE profile_id = $1 AND currency_code = $2',
      [USER_B, 'GBP']);
    const accountId = acc.rows[0].id as string;
    await svc!.query('SELECT post_ledger_entry($1,$2,$3,$4,$5,$6,$7)',
      [accountId, USER_B, 'deposit', 'credit', '200.0000', 'GBP', 'Statement test']);
    const sum = await svc!.query('SELECT ledger_sum_before($1, now() + interval \'1 hour\') AS s', [accountId]);
    expect(Number(sum.rows[0].s)).toBe(200);
    const empty = await svc!.query('SELECT ledger_sum_before($1, now() - interval \'1 hour\') AS s', [accountId]);
    expect(Number(empty.rows[0].s)).toBe(0);
  });
});

describe('account close guard', () => {
  it('refuses to close an account with a non-zero balance', async () => {
    await expect(svc!.query(
      'UPDATE accounts SET closed_at = now() WHERE profile_id = $1 AND currency_code = $2',
      [USER_B, 'GBP'],
    )).rejects.toThrow('non-zero balance');
  });
});
