-- 0004_functions_triggers.sql — integrity machinery.

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Balance projection: accounts.balance is always the sum of POSTED ledger
-- entries (credit positive, debit negative). Maintained transactionally.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION project_account_balance() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_account uuid;
BEGIN
  v_account := COALESCE(NEW.account_id, OLD.account_id);
  UPDATE accounts a
     SET balance = COALESCE((
           SELECT SUM(CASE WHEN t.direction = 'credit' THEN t.amount ELSE -t.amount END)
             FROM transactions t
            WHERE t.account_id = v_account AND t.status = 'posted'
         ), 0)
   WHERE a.id = v_account;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_transactions_project_balance
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION project_account_balance();

-- ---------------------------------------------------------------------------
-- Deposit state machine: legal transitions only.
--   pending -> cancelled (customer-side, service role enforces the caller)
--   pending -> completed | failed (signed provider webhook, service role)
-- Amount/currency/account are immutable after creation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_deposit_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reference <> OLD.reference THEN
    RAISE EXCEPTION 'deposit reference is immutable';
  END IF;
  IF NEW.amount <> OLD.amount OR NEW.currency_code <> OLD.currency_code
     OR NEW.account_id::text <> OLD.account_id::text OR NEW.profile_id <> OLD.profile_id THEN
    RAISE EXCEPTION 'deposit amount, currency, account and owner are immutable';
  END IF;
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD.status = 'pending' AND NEW.status IN ('cancelled','completed','failed'))
  ) THEN
    RAISE EXCEPTION 'illegal deposit transition % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.status IN ('completed','failed') AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deposits_guard BEFORE UPDATE ON deposits
  FOR EACH ROW EXECUTE FUNCTION guard_deposit_transition();

-- ---------------------------------------------------------------------------
-- Account close guard: zero balance required.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_account_close() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.closed_at IS NOT NULL AND OLD.closed_at IS NULL AND NEW.balance <> 0 THEN
    RAISE EXCEPTION 'account cannot be closed with a non-zero balance';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounts_close_guard BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION guard_account_close();

-- ---------------------------------------------------------------------------
-- Reference generation helpers (sequence-based, collision-safe in tx).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_txn_reference() RETURNS text
LANGUAGE sql AS $$
  SELECT 'TXN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('txn_reference_seq')::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION next_dep_reference() RETURNS text
LANGUAGE sql AS $$
  SELECT 'DEP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('dep_reference_seq')::text, 6, '0');
$$;

-- ---------------------------------------------------------------------------
-- Ledger posting function: the ONLY sanctioned way to move money.
-- Locks the account row, verifies funds for debits, inserts the ledger entry.
-- The balance projection trigger maintains accounts.balance.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION post_ledger_entry(
  p_account_id uuid,
  p_profile_id text,
  p_type text,
  p_direction text,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_status text DEFAULT 'posted',
  p_method text DEFAULT NULL,
  p_related_deposit_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  v_balance numeric(19,4);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'ledger amount must be positive';
  END IF;

  SELECT balance INTO v_balance FROM accounts WHERE id = p_account_id FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'account % not found', p_account_id;
  END IF;

  IF p_direction = 'debit' AND p_status = 'posted' AND v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient funds: balance %, debit %', v_balance, p_amount;
  END IF;

  INSERT INTO transactions (reference, account_id, profile_id, type, direction,
                            amount, currency_code, description, status, method,
                            related_deposit_id, value_date)
  VALUES (next_txn_reference(), p_account_id, p_profile_id, p_type, p_direction,
          p_amount, p_currency, p_description, p_status, p_method,
          p_related_deposit_id, now())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Anonymize profile (called by the backend on Clerk user.deleted).
-- PII is cleared; the row and all financial records are retained.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION anonymize_profile(p_profile_id text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
     SET email = 'deleted+' || p_profile_id || '@anonymized.invalid',
         full_name = 'Deleted customer',
         first_name = '',
         last_name = '',
         phone = NULL,
         status = 'deleted',
         deleted_at = now()
   WHERE id = p_profile_id;
END;
$$;

-- ===========================================================================
-- Atomic service RPCs — the only sanctioned mutation paths. Each runs in a
-- single database transaction with row locks; the backend calls these with
-- the service role after code-level authorization.
-- ===========================================================================

-- Provider webhook: confirm a deposit (post ledger + notify, idempotent).
CREATE OR REPLACE FUNCTION provider_confirm_deposit(
  p_reference text,
  p_provider text,
  p_provider_ref text
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  d deposits;
  v_txn uuid;
  v_balance numeric(19,4);
BEGIN
  SELECT * INTO d FROM deposits WHERE reference = p_reference FOR UPDATE;
  IF d.id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_FOUND';
  END IF;

  IF d.status = 'completed' THEN
    INSERT INTO payment_attempts (deposit_id, provider, outcome, detail)
    VALUES (d.id, p_provider, 'duplicate_ignored',
            jsonb_build_object('provider_ref', p_provider_ref));
    RETURN jsonb_build_object('reference', d.reference, 'status', 'completed', 'duplicate', true);
  END IF;

  IF d.status <> 'pending' THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_PENDING:%', d.status;
  END IF;

  UPDATE deposits
     SET status = 'completed', provider = p_provider,
         provider_ref = p_provider_ref, completed_at = now()
   WHERE id = d.id;

  INSERT INTO payment_attempts (deposit_id, provider, outcome, detail)
  VALUES (d.id, p_provider, 'confirmed', jsonb_build_object('provider_ref', p_provider_ref));

  v_txn := post_ledger_entry(d.account_id, d.profile_id, 'deposit', 'credit',
                             d.amount, d.currency_code,
                             'Deposit ' || d.reference, 'posted', d.method, d.id);

  SELECT balance INTO v_balance FROM accounts WHERE id = d.account_id;

  INSERT INTO notifications (profile_id, type, title, body)
  VALUES (d.profile_id, 'success', 'Deposit confirmed',
          'Your ' || d.currency_code || ' deposit of ' || d.amount ||
          ' (' || d.reference || ') has been credited.');

  RETURN jsonb_build_object('reference', d.reference, 'status', 'completed',
                            'duplicate', false, 'transaction_id', v_txn,
                            'balance', v_balance);
END;
$$;

-- Provider webhook: fail a deposit (no ledger effect), idempotent.
CREATE OR REPLACE FUNCTION provider_fail_deposit(
  p_reference text,
  p_provider text,
  p_provider_ref text,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  d deposits;
BEGIN
  SELECT * INTO d FROM deposits WHERE reference = p_reference FOR UPDATE;
  IF d.id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_FOUND';
  END IF;

  IF d.status <> 'pending' THEN
    INSERT INTO payment_attempts (deposit_id, provider, outcome, detail)
    VALUES (d.id, p_provider, 'duplicate_ignored',
            jsonb_build_object('provider_ref', p_provider_ref, 'reason', p_reason));
    RETURN jsonb_build_object('reference', d.reference, 'status', d.status, 'duplicate', true);
  END IF;

  UPDATE deposits
     SET status = 'failed', provider = p_provider,
         provider_ref = p_provider_ref, completed_at = now()
   WHERE id = d.id;

  INSERT INTO payment_attempts (deposit_id, provider, outcome, detail)
  VALUES (d.id, p_provider, 'failed',
          jsonb_build_object('provider_ref', p_provider_ref, 'reason', p_reason));

  INSERT INTO notifications (profile_id, type, title, body)
  VALUES (d.profile_id, 'warning', 'Deposit not completed',
          'Your ' || d.currency_code || ' deposit of ' || d.amount ||
          ' (' || d.reference || ') was not completed by the payment provider.');

  RETURN jsonb_build_object('reference', d.reference, 'status', 'failed', 'duplicate', false);
END;
$$;

-- Customer cancellation (only while pending, only own deposit).
CREATE OR REPLACE FUNCTION cancel_deposit(p_profile_id text, p_reference text) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  d deposits;
BEGIN
  SELECT * INTO d FROM deposits
   WHERE reference = p_reference AND profile_id = p_profile_id FOR UPDATE;
  IF d.id IS NULL THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_FOUND';
  END IF;
  IF d.status <> 'pending' THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_PENDING:%', d.status;
  END IF;
  UPDATE deposits SET status = 'cancelled', completed_at = now() WHERE id = d.id;
  INSERT INTO payment_attempts (deposit_id, provider, outcome)
  VALUES (d.id, COALESCE(d.provider, 'customer'), 'cancelled');
  RETURN jsonb_build_object('reference', d.reference, 'status', 'cancelled');
END;
$$;

-- Currency activation (availability + duplicate guards, zero-balance start).
CREATE OR REPLACE FUNCTION activate_currency(p_profile_id text, p_currency text) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  c currencies;
  v_acc accounts;
BEGIN
  SELECT * INTO c FROM currencies WHERE code = p_currency;
  IF c.code IS NULL THEN
    RAISE EXCEPTION 'CURRENCY_UNKNOWN';
  END IF;
  IF c.status <> 'active' THEN
    RAISE EXCEPTION 'CURRENCY_UNAVAILABLE';
  END IF;
  INSERT INTO accounts (profile_id, currency_code)
  VALUES (p_profile_id, p_currency)
  ON CONFLICT (profile_id, currency_code) DO NOTHING
  RETURNING * INTO v_acc;
  IF v_acc.id IS NULL THEN
    RAISE EXCEPTION 'ALREADY_ACTIVE';
  END IF;
  RETURN to_jsonb(v_acc);
END;
$$;

-- Clerk user.created bootstrap: idempotent profile + default-currency account.
CREATE OR REPLACE FUNCTION bootstrap_profile(
  p_user_id text, p_email text, p_full_name text,
  p_phone text, p_country text
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_currency text;
BEGIN
  SELECT COALESCE(MAX(currency_code), 'EUR') INTO v_currency
    FROM country_defaults WHERE country_code = p_country;

  INSERT INTO profiles (id, email, full_name, phone, country_code, default_currency)
  VALUES (p_user_id, p_email, p_full_name, NULLIF(p_phone, ''), p_country, v_currency)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        phone = COALESCE(NULLIF(EXCLUDED.phone, ''), profiles.phone),
        updated_at = now();

  INSERT INTO accounts (profile_id, currency_code)
  VALUES (p_user_id, v_currency)
  ON CONFLICT (profile_id, currency_code) DO NOTHING;
END;
$$;

-- Opening-balance helper for statement generation: posted ledger sum before
-- a point in time.
CREATE OR REPLACE FUNCTION ledger_sum_before(p_account_id uuid, p_before timestamptz)
RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(
    CASE WHEN direction = 'credit' THEN amount ELSE -amount END
  ), 0)
  FROM transactions
  WHERE account_id = p_account_id AND status = 'posted' AND created_at < p_before;
$$;
