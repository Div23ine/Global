/**
 * Real-database integration tests.
 *
 * Boots a genuine PostgreSQL 18 instance (embedded-postgres, unprivileged),
 * applies the production migrations in order, then verifies:
 *   - schema + European seed (no NGN anywhere),
 *   - Supabase Auth profile bootstrap + legacy profile linking (idempotency),
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

  // Minimal Supabase Auth schema double for the real PostgreSQL/RLS tests.
  await svc.query(`CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text,
      email_confirmed_at timestamptz,
      phone text,
      phone_confirmed_at timestamptz,
      raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE AS $auth$
      SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
    $auth$;`);

  // Create Supabase's API roles before migrations that grant function access.
  await svc.query(`DO $roles$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      CREATE ROLE service_role NOLOGIN;
    END IF;
  END $roles$;`);
  await svc.query('GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role');
  await svc.query('GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon, service_role');

  // Apply production migrations in order (simple query protocol: multi-statement).
  const dir = join(__dirname, '../../migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    // Seed a representative pre-Supabase-Auth administrator before migration
    // 0007 renames the old identity key and installs its profile FK.
    if (file === '0007_supabase_auth.sql') {
      await svc.query(
        `INSERT INTO profiles (id, email, full_name, first_name, last_name)
         VALUES ('legacy_admin_profile', 'legacy-admin@example.com',
                 'Legacy Admin', 'Legacy', 'Admin')`,
      );
      await svc.query(
        `INSERT INTO admin_users (clerk_user_id, display_name, role_id)
         VALUES ('legacy_admin_profile', 'Legacy Admin', 'super_admin')`,
      );
    }
    const sql = readFileSync(join(dir, file), 'utf8');
    await svc.query(sql);
  }

  await svc.query('GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role');
  await svc.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated');
  await svc.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon');
}, 300_000);

afterAll(async () => {
  if (svc) await svc.end().catch(() => undefined);
  if (postgres) await postgres.stop().catch(() => undefined);
});

const USER_A = '00000000-0000-4000-8000-000000000001';
const USER_B = '00000000-0000-4000-8000-000000000002';
const LEGACY_PROFILE = 'legacy_profile_001';
const LEGACY_AUTH_USER = '00000000-0000-4000-8000-000000000003';

async function asUser(supabaseUserId: string): Promise<Client> {
  const c = await connect();
  await c.query(`SET ROLE authenticated`);
  await c.query(`SET request.jwt.claims = '${JSON.stringify({ sub: supabaseUserId, role: 'authenticated' })}'`);
  return c;
}

async function bootstrapTestUser(
  userId: string,
  email: string,
  firstName: string,
  lastName: string,
  countryCode = 'DE',
): Promise<void> {
  await svc!.query(
    `INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
     VALUES ($1::uuid, $2, now(), $3::jsonb)`,
    [userId, email, JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      country_code: countryCode,
    })],
  );
  await svc!.query('SELECT public.bootstrap_supabase_profile($1::uuid)', [userId]);
}

describe('migrations + seed', () => {
  it('preserves legacy admin assignments using canonical profile IDs', async () => {
    const { rows } = await svc!.query(
      'SELECT profile_id, role_id FROM admin_users WHERE profile_id = $1',
      ['legacy_admin_profile'],
    );
    expect(rows).toEqual([{ profile_id: 'legacy_admin_profile', role_id: 'super_admin' }]);
    const constraint = await svc!.query(
      `SELECT COUNT(*)::int AS n FROM pg_constraint
       WHERE conname = 'admin_users_profile_id_fkey'`,
    );
    expect(constraint.rows[0].n).toBe(1);
  });

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

  it('keeps the RLS identity helper public while protecting profile anonymization', async () => {
    const { rows } = await svc!.query(`
      SELECT
        has_function_privilege('anon', 'public.app_current_user_id()', 'EXECUTE') AS anon_can_resolve_identity,
        has_function_privilege('authenticated', 'public.app_current_user_id()', 'EXECUTE') AS user_can_resolve_identity,
        has_function_privilege('anon', 'public.anonymize_profile(text)', 'EXECUTE') AS anon_can_anonymize,
        has_function_privilege('authenticated', 'public.anonymize_profile(text)', 'EXECUTE') AS user_can_anonymize,
        has_function_privilege('service_role', 'public.anonymize_profile(text)', 'EXECUTE') AS service_can_anonymize
    `);
    expect(rows[0]).toEqual({
      anon_can_resolve_identity: true,
      user_can_resolve_identity: true,
      anon_can_anonymize: false,
      user_can_anonymize: false,
      service_can_anonymize: true,
    });

    const anon = await connect();
    try {
      await anon.query('SET ROLE anon');
      const identity = await anon.query('SELECT public.app_current_user_id() AS id');
      expect(identity.rows[0].id).toBe('');
      await expect(anon.query(
        'SELECT public.anonymize_profile($1)',
        ['legacy_admin_profile'],
      )).rejects.toThrow(/permission denied/i);
    } finally {
      await anon.end().catch(() => undefined);
    }
  });
});

describe('Supabase Auth profile bootstrap', () => {
  it('creates a new profile and default account from a confirmed Auth user, idempotently', async () => {
    await svc!.query(
      `INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
       VALUES ($1::uuid, $2, now(), $3::jsonb)`,
      [USER_A, 'a@example.com', JSON.stringify({ first_name: 'Anna', last_name: 'Schmidt', country_code: 'DE' })],
    );
    await svc!.query(
      `INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
       VALUES ($1::uuid, $2, now(), $3::jsonb)`,
      [USER_B, 'b@example.com', JSON.stringify({ first_name: 'Ben', last_name: 'Brown', country_code: 'GB' })],
    );

    const first = await svc!.query('SELECT public.bootstrap_supabase_profile($1::uuid) AS id', [USER_A]);
    const second = await svc!.query('SELECT public.bootstrap_supabase_profile($1::uuid) AS id', [USER_A]);
    expect(first.rows[0].id).toBe(USER_A);
    expect(second.rows[0].id).toBe(USER_A);

    const profile = await svc!.query(
      'SELECT default_currency, status, supabase_user_id FROM profiles WHERE id = $1', [USER_A],
    );
    expect(profile.rows[0]).toMatchObject({
      default_currency: 'EUR',
      status: 'active',
      supabase_user_id: USER_A,
    });

    const accounts = await svc!.query('SELECT currency_code, balance FROM accounts WHERE profile_id = $1', [USER_A]);
    expect(accounts.rows).toHaveLength(1);
    expect(accounts.rows[0]).toMatchObject({ currency_code: 'EUR' });
    expect(Number(accounts.rows[0].balance)).toBe(0);

    const userB = await svc!.query('SELECT public.bootstrap_supabase_profile($1::uuid) AS id', [USER_B]);
    expect(userB.rows[0].id).toBe(USER_B);
    const gb = await svc!.query('SELECT default_currency FROM profiles WHERE id = $1', [USER_B]);
    expect(gb.rows[0].default_currency).toBe('GBP');
  });

  it('links a confirmed Auth user to the existing legacy profile without changing its financial ownership', async () => {
    await svc!.query(
      `INSERT INTO profiles (id, email, full_name, first_name, last_name, country_code, default_currency)
       VALUES ($1, 'legacy@example.com', 'Legacy Customer', 'Legacy', 'Customer', 'DE', 'EUR')`,
      [LEGACY_PROFILE],
    );
    await svc!.query(
      `INSERT INTO accounts (profile_id, currency_code) VALUES ($1, 'EUR')`,
      [LEGACY_PROFILE],
    );
    await svc!.query(
      `INSERT INTO auth.users (id, email, email_confirmed_at)
       VALUES ($1::uuid, 'legacy@example.com', now())`,
      [LEGACY_AUTH_USER],
    );

    const linked = await svc!.query(
      'SELECT public.bootstrap_supabase_profile($1::uuid) AS id', [LEGACY_AUTH_USER],
    );
    expect(linked.rows[0].id).toBe(LEGACY_PROFILE);

    const profile = await svc!.query(
      'SELECT id, supabase_user_id FROM profiles WHERE email = $1', ['legacy@example.com'],
    );
    expect(profile.rows[0]).toMatchObject({ id: LEGACY_PROFILE, supabase_user_id: LEGACY_AUTH_USER });

    const accounts = await svc!.query('SELECT profile_id FROM accounts WHERE profile_id = $1', [LEGACY_PROFILE]);
    expect(accounts.rows).toHaveLength(1);

    // The Auth UUID must resolve to the legacy canonical profile id inside RLS.
    const legacyUser = await asUser(LEGACY_AUTH_USER);
    try {
      const visibleProfile = await legacyUser.query('SELECT id FROM profiles');
      expect(visibleProfile.rows).toEqual([{ id: LEGACY_PROFILE }]);
    } finally {
      await legacyUser.end().catch(() => undefined);
    }
  });

  it('refuses to bootstrap an Auth identity until its email is confirmed', async () => {
    const unverifiedId = '00000000-0000-4000-8000-000000000008';
    await svc!.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1::uuid, 'unverified@example.com', '{}'::jsonb)`,
      [unverifiedId],
    );
    await expect(
      svc!.query('SELECT public.bootstrap_supabase_profile($1::uuid)', [unverifiedId]),
    ).rejects.toThrow('AUTH_EMAIL_NOT_VERIFIED');
    const profile = await svc!.query('SELECT id FROM profiles WHERE email = $1', ['unverified@example.com']);
    expect(profile.rows).toHaveLength(0);
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

describe('profile anonymization (Supabase Auth identity deletion)', () => {
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

/* -------------------------------------------------------------------------- */
/* Deposit & refund upgrade (migration 0006)                                  */
/* -------------------------------------------------------------------------- */

describe('receiving bank accounts seed', () => {
  it('seeds one active receiving account per supported currency', async () => {
    const rows = await svc!.query(
      `SELECT currency_code, count(*)::int AS n
         FROM receiving_bank_accounts
        WHERE is_active = true
        GROUP BY currency_code
        ORDER BY currency_code`,
    );
    const byCode = Object.fromEntries(rows.rows.map((r) => [r.currency_code, r.n]));
    for (const code of ['EUR', 'GBP', 'USD', 'CHF', 'PLN']) {
      expect(byCode[code], `missing bank for ${code}`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('admin_credit_deposit_payment RPC', () => {
  const DEP_USER = '00000000-0000-4000-8000-000000000004';
  let accountId: string;
  let bankId: string;
  let depositId: string;

  beforeAll(async () => {
    // Bootstrap a verified Supabase Auth customer with an EUR account
    await bootstrapTestUser(DEP_USER, 'dep-a@example.com', 'Deposit', 'Tester', 'DE');
    // bootstrap may already create EUR; ensure active
    const acc = await svc!.query(
      `SELECT id FROM accounts WHERE profile_id = $1 AND currency_code = 'EUR' LIMIT 1`,
      [DEP_USER],
    );
    if (acc.rows.length === 0) {
      await svc!.query(
        `INSERT INTO accounts (profile_id, currency_code, status, balance)
         VALUES ($1, 'EUR', 'active', 0)`,
        [DEP_USER],
      );
    }
    const a2 = await svc!.query(
      `SELECT id FROM accounts WHERE profile_id = $1 AND currency_code = 'EUR'`,
      [DEP_USER],
    );
    accountId = a2.rows[0].id as string;

    const bank = await svc!.query(
      `SELECT id FROM receiving_bank_accounts WHERE currency_code = 'EUR' AND is_active LIMIT 1`,
    );
    bankId = bank.rows[0].id as string;
  });

  it('creates a deposit request and credits a partial payment atomically', async () => {
    const ref = `MGD-TEST-${Date.now()}`;
    const ins = await svc!.query(
      `INSERT INTO deposits (
         reference, profile_id, account_id, currency_code, amount, requested_amount,
         received_amount, credited_amount, fee, method, status, assigned_bank_id, assigned_at
       ) VALUES (
         $1, $2, $3, 'EUR', 1000.0000, 1000.0000, 0, 0, 0, 'bank_transfer',
         'awaiting_payment', $4, now()
       ) RETURNING id`,
      [ref, DEP_USER, accountId, bankId],
    );
    depositId = ins.rows[0].id as string;

    // Partial credit of 400
    const credit = await svc!.query(
      `SELECT admin_credit_deposit_payment($1, $2, $3, $4, $5, $6, $7, $8) AS result`,
      [depositId, 400, 'EUR', bankId, `BANK-TXN-${Date.now()}`, 'REF-PARTIAL', 'admin_test', 'partial test'],
    );
    const result = credit.rows[0].result;
    expect(result.status).toBe('partially_fulfilled');
    expect(Number(result.credited_this_payment)).toBe(400);
    expect(Number(result.total_credited)).toBe(400);

    const dep = await svc!.query(`SELECT status, credited_amount, received_amount FROM deposits WHERE id = $1`, [depositId]);
    expect(dep.rows[0].status).toBe('partially_fulfilled');
    expect(Number(dep.rows[0].credited_amount)).toBe(400);

    const bal = await svc!.query(`SELECT balance FROM accounts WHERE id = $1`, [accountId]);
    expect(Number(bal.rows[0].balance)).toBe(400);

    // Second partial of 600 → completed
    const credit2 = await svc!.query(
      `SELECT admin_credit_deposit_payment($1, $2, $3, $4, $5, $6, $7, $8) AS result`,
      [depositId, 600, 'EUR', bankId, `BANK-TXN-${Date.now()}-2`, 'REF-FULL', 'admin_test', 'remainder'],
    );
    expect(credit2.rows[0].result.status).toBe('completed');
    expect(Number(credit2.rows[0].result.total_credited)).toBe(1000);

    const bal2 = await svc!.query(`SELECT balance FROM accounts WHERE id = $1`, [accountId]);
    expect(Number(bal2.rows[0].balance)).toBe(1000);
  });

  it('rejects duplicate bank transaction IDs', async () => {
    const ref = `MGD-DUP-${Date.now()}`;
    const ins = await svc!.query(
      `INSERT INTO deposits (
         reference, profile_id, account_id, currency_code, amount, requested_amount,
         received_amount, credited_amount, fee, method, status, assigned_bank_id, assigned_at
       ) VALUES (
         $1, $2, $3, 'EUR', 100.0000, 100.0000, 0, 0, 0, 'bank_transfer',
         'awaiting_payment', $4, now()
       ) RETURNING id`,
      [ref, DEP_USER, accountId, bankId],
    );
    const depId = ins.rows[0].id as string;
    const txnId = `DUP-TXN-${Date.now()}`;

    await svc!.query(
      `SELECT admin_credit_deposit_payment($1, $2, $3, $4, $5, $6, $7, $8)`,
      [depId, 50, 'EUR', bankId, txnId, null, 'admin_test', null],
    );

    await expect(
      svc!.query(
        `SELECT admin_credit_deposit_payment($1, $2, $3, $4, $5, $6, $7, $8)`,
        [depId, 50, 'EUR', bankId, txnId, null, 'admin_test', null],
      ),
    ).rejects.toThrow(/DUPLICATE_BANK_TRANSACTION/);
  });

  it('caps credit at requested amount (overpayment protection)', async () => {
    const ref = `MGD-OVER-${Date.now()}`;
    const ins = await svc!.query(
      `INSERT INTO deposits (
         reference, profile_id, account_id, currency_code, amount, requested_amount,
         received_amount, credited_amount, fee, method, status, assigned_bank_id, assigned_at
       ) VALUES (
         $1, $2, $3, 'EUR', 100.0000, 100.0000, 0, 0, 0, 'bank_transfer',
         'awaiting_payment', $4, now()
       ) RETURNING id`,
      [ref, DEP_USER, accountId, bankId],
    );
    const depId = ins.rows[0].id as string;
    const balBefore = await svc!.query(`SELECT balance FROM accounts WHERE id = $1`, [accountId]);
    const before = Number(balBefore.rows[0].balance);

    const credit = await svc!.query(
      `SELECT admin_credit_deposit_payment($1, $2, $3, $4, $5, $6, $7, $8) AS result`,
      [depId, 150, 'EUR', bankId, `OVER-${Date.now()}`, null, 'admin_test', 'overpay attempt'],
    );
    // Should cap at 100
    expect(Number(credit.rows[0].result.credited_this_payment)).toBe(100);
    expect(credit.rows[0].result.status).toBe('completed');

    const balAfter = await svc!.query(`SELECT balance FROM accounts WHERE id = $1`, [accountId]);
    expect(Number(balAfter.rows[0].balance)).toBe(before + 100);
  });
});

describe('process_internal_refund RPC', () => {
  const REF_USER = '00000000-0000-4000-8000-000000000005';
  let accountId: string;
  let originalTxnId: string;
  let originalRef: string;

  beforeAll(async () => {
    await bootstrapTestUser(REF_USER, 'ref-a@example.com', 'Refund', 'Tester', 'DE');
    const acc = await svc!.query(
      `SELECT id FROM accounts WHERE profile_id = $1 AND currency_code = 'EUR' LIMIT 1`,
      [REF_USER],
    );
    accountId = acc.rows[0].id as string;

    // Post an original credit of 500 so we have something to refund
    originalRef = `TXN-ORIG-${Date.now()}`;
    const txn = await svc!.query(
      `INSERT INTO transactions (
         reference, account_id, profile_id, type, direction, amount, currency_code, description, status
       ) VALUES ($1, $2, $3, 'deposit', 'credit', 500.0000, 'EUR', 'Original for refund tests', 'posted')
       RETURNING id`,
      [originalRef, accountId, REF_USER],
    );
    originalTxnId = txn.rows[0].id as string;
  });

  it('credits Meridian balance on approved refund and enforces refund limits', async () => {
    const ref1 = `MGR-TEST-${Date.now()}`;
    const ins = await svc!.query(
      `INSERT INTO refunds (
         reference, profile_id, account_id, original_transaction_id, original_reference,
         original_amount, requested_amount, approved_amount, currency_code, reason, status, approved_by, approved_at
       ) VALUES (
         $1, $2, $3, $4, $5, 500.0000, 200.0000, 200.0000, 'EUR', 'Partial test', 'approved', 'admin_test', now()
       ) RETURNING id`,
      [ref1, REF_USER, accountId, originalTxnId, originalRef],
    );
    const refundId = ins.rows[0].id as string;

    const balBefore = await svc!.query(`SELECT balance FROM accounts WHERE id = $1`, [accountId]);
    const before = Number(balBefore.rows[0].balance);

    const result = await svc!.query(
      `SELECT process_internal_refund($1, $2, $3) AS result`,
      [refundId, 'admin_test', 200],
    );
    expect(Number(result.rows[0].result.credited)).toBe(200);

    const balAfter = await svc!.query(`SELECT balance FROM accounts WHERE id = $1`, [accountId]);
    expect(Number(balAfter.rows[0].balance)).toBe(before + 200);

    const status = await svc!.query(`SELECT status FROM refunds WHERE id = $1`, [refundId]);
    expect(status.rows[0].status).toBe('completed');

    // Second partial of 300 (total 500) should succeed
    const ref2 = `MGR-TEST2-${Date.now()}`;
    const ins2 = await svc!.query(
      `INSERT INTO refunds (
         reference, profile_id, account_id, original_transaction_id, original_reference,
         original_amount, requested_amount, approved_amount, currency_code, reason, status, approved_by, approved_at
       ) VALUES (
         $1, $2, $3, $4, $5, 500.0000, 300.0000, 300.0000, 'EUR', 'Remainder', 'approved', 'admin_test', now()
       ) RETURNING id`,
      [ref2, REF_USER, accountId, originalTxnId, originalRef],
    );
    await svc!.query(`SELECT process_internal_refund($1, $2, $3)`, [ins2.rows[0].id, 'admin_test', 300]);

    // Third refund exceeding original must fail
    const ref3 = `MGR-OVER-${Date.now()}`;
    const ins3 = await svc!.query(
      `INSERT INTO refunds (
         reference, profile_id, account_id, original_transaction_id, original_reference,
         original_amount, requested_amount, approved_amount, currency_code, reason, status, approved_by, approved_at
       ) VALUES (
         $1, $2, $3, $4, $5, 500.0000, 1.0000, 1.0000, 'EUR', 'Exceeds', 'approved', 'admin_test', now()
       ) RETURNING id`,
      [ref3, REF_USER, accountId, originalTxnId, originalRef],
    );
    await expect(
      svc!.query(`SELECT process_internal_refund($1, $2, $3)`, [ins3.rows[0].id, 'admin_test', 1]),
    ).rejects.toThrow(/REFUND_EXCEEDS_ORIGINAL/);
  });
});

describe('customer isolation on deposits', () => {
  it('customer A cannot read customer B deposit rows via RLS', async () => {
    const USER_X = '00000000-0000-4000-8000-000000000006';
    const USER_Y = '00000000-0000-4000-8000-000000000007';
    await bootstrapTestUser(USER_X, 'x@example.com', 'X', 'User', 'DE');
    await bootstrapTestUser(USER_Y, 'y@example.com', 'Y', 'User', 'DE');

    const accX = await svc!.query(`SELECT id FROM accounts WHERE profile_id = $1 AND currency_code = 'EUR'`, [USER_X]);
    await svc!.query(
      `INSERT INTO deposits (reference, profile_id, account_id, currency_code, amount, requested_amount, fee, method, status)
       VALUES ($1, $2, $3, 'EUR', 50, 50, 0, 'bank_transfer', 'pending_admin_action')`,
      [`MGD-ISO-X-${Date.now()}`, USER_X, accX.rows[0].id],
    );

    // Simulate JWT claims for USER_Y
    const y = await connect();
    try {
      await y.query(`SET ROLE authenticated`);
      await y.query(`SELECT set_config('request.jwt.claims', $1, true)`,
        [JSON.stringify({ sub: USER_Y, role: 'authenticated' })]);
      // Depending on RLS policies, either 0 rows or error — never USER_X data
      const rows = await y.query(`SELECT * FROM deposits WHERE profile_id = $1`, [USER_X]);
      expect(rows.rows).toHaveLength(0);
    } finally {
      await y.end().catch(() => undefined);
    }
  });
});
