-- 0006_deposit_refund_upgrade.sql
-- Administrator-controlled manual bank-transfer deposit workflow +
-- internal Meridian balance refund system.

CREATE TABLE IF NOT EXISTS receiving_bank_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label             text NOT NULL,
  bank_name         text NOT NULL,
  beneficiary_name  text NOT NULL,
  account_number    text,
  iban              text,
  swift_bic         text,
  country_code      text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  currency_code     text NOT NULL REFERENCES currencies(code),
  transfer_instructions text NOT NULL DEFAULT '',
  is_active         boolean NOT NULL DEFAULT true,
  display_order     integer NOT NULL DEFAULT 100,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receiving_banks_active ON receiving_bank_accounts(is_active, currency_code);

ALTER TABLE deposits
  ADD COLUMN IF NOT EXISTS requested_amount   numeric(19,4),
  ADD COLUMN IF NOT EXISTS received_amount    numeric(19,4) NOT NULL DEFAULT 0 CHECK (received_amount >= 0),
  ADD COLUMN IF NOT EXISTS credited_amount    numeric(19,4) NOT NULL DEFAULT 0 CHECK (credited_amount >= 0),
  ADD COLUMN IF NOT EXISTS outstanding_amount numeric(19,4) GENERATED ALWAYS AS (
      GREATEST(COALESCE(requested_amount, amount) - credited_amount, 0)
    ) STORED,
  ADD COLUMN IF NOT EXISTS assigned_bank_id   uuid REFERENCES receiving_bank_accounts(id),
  ADD COLUMN IF NOT EXISTS assigned_at        timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by        text,
  ADD COLUMN IF NOT EXISTS payment_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_notes      text,
  ADD COLUMN IF NOT EXISTS receipt_url        text,
  ADD COLUMN IF NOT EXISTS admin_notes        text,
  ADD COLUMN IF NOT EXISTS rejected_reason    text,
  ADD COLUMN IF NOT EXISTS expires_at         timestamptz;

UPDATE deposits SET requested_amount = amount WHERE requested_amount IS NULL;
ALTER TABLE deposits ALTER COLUMN requested_amount SET NOT NULL;

ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
ALTER TABLE deposits ADD CONSTRAINT deposits_status_check
  CHECK (status IN (
    'pending','pending_admin_action','awaiting_payment','payment_reported',
    'under_verification','partially_fulfilled','completed','rejected',
    'expired','unmatched_payment','failed','cancelled'
  ));
ALTER TABLE deposits ALTER COLUMN status SET DEFAULT 'pending_admin_action';

CREATE TABLE IF NOT EXISTS deposit_payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id            uuid NOT NULL REFERENCES deposits(id) ON DELETE RESTRICT,
  amount                numeric(19,4) NOT NULL CHECK (amount > 0),
  currency_code         text NOT NULL,
  receiving_bank_id     uuid REFERENCES receiving_bank_accounts(id),
  bank_transaction_id   text,
  bank_transaction_ref  text,
  verified_by           text NOT NULL,
  verified_at           timestamptz NOT NULL DEFAULT now(),
  verification_notes    text,
  ledger_transaction_id uuid REFERENCES transactions(id),
  status                text NOT NULL DEFAULT 'verified'
                        CHECK (status IN ('verified','reversed','unmatched')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_deposit_payments_deposit ON deposit_payments(deposit_id);

CREATE TABLE IF NOT EXISTS unmatched_payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount                numeric(19,4) NOT NULL CHECK (amount > 0),
  currency_code         text NOT NULL,
  receiving_bank_id     uuid REFERENCES receiving_bank_accounts(id),
  bank_transaction_id   text,
  bank_transaction_ref  text,
  received_at           timestamptz NOT NULL DEFAULT now(),
  reported_by           text,
  notes                 text,
  status                text NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','matched','returned','written_off')),
  matched_deposit_id    uuid REFERENCES deposits(id),
  matched_at            timestamptz,
  matched_by            text,
  resolution_notes      text,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_unmatched_open ON unmatched_payments(status) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS refunds (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference               text NOT NULL UNIQUE,
  profile_id              text NOT NULL REFERENCES profiles(id),
  account_id              uuid NOT NULL REFERENCES accounts(id),
  original_transaction_id uuid NOT NULL REFERENCES transactions(id),
  original_reference      text NOT NULL,
  original_amount         numeric(19,4) NOT NULL CHECK (original_amount > 0),
  requested_amount        numeric(19,4) NOT NULL CHECK (requested_amount > 0),
  approved_amount         numeric(19,4),
  currency_code           text NOT NULL,
  reason                  text NOT NULL,
  status                  text NOT NULL DEFAULT 'requested'
                          CHECK (status IN (
                            'requested','under_review','approved','processing',
                            'completed','rejected','failed','cancelled'
                          )),
  requested_by            text,
  reviewed_by             text,
  reviewed_at             timestamptz,
  approved_by             text,
  approved_at             timestamptz,
  completed_at            timestamptz,
  rejection_reason        text,
  admin_notes             text,
  ledger_transaction_id   uuid REFERENCES transactions(id),
  idempotency_key         text UNIQUE,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_profile ON refunds(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_original ON refunds(original_transaction_id);

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'deposit','withdrawal','fee','adjustment','transfer_in','transfer_out','refund'
  ));

CREATE OR REPLACE FUNCTION next_ref_reference() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_year text := to_char(now() AT TIME ZONE 'UTC', 'YYYY');
  v_seq  bigint;
BEGIN
  v_seq := (EXTRACT(EPOCH FROM now()) * 1000)::bigint % 1000000;
  RETURN 'MGR-' || v_year || '-' || lpad(v_seq::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION admin_credit_deposit_payment(
  p_deposit_id          uuid,
  p_amount              numeric,
  p_currency            text,
  p_receiving_bank_id   uuid,
  p_bank_txn_id         text,
  p_bank_txn_ref        text,
  p_verified_by         text,
  p_notes               text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep           deposits%ROWTYPE;
  v_payment_id    uuid;
  v_ledger_id     uuid;
  v_ref           text;
  v_new_credited  numeric;
  v_new_status    text;
  v_req_amt       numeric;
BEGIN
  SELECT * INTO v_dep FROM deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEPOSIT_NOT_FOUND'; END IF;

  IF v_dep.status NOT IN (
    'awaiting_payment','payment_reported','under_verification','partially_fulfilled'
  ) THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_CREDITABLE: status=%', v_dep.status;
  END IF;

  IF p_currency <> v_dep.currency_code THEN RAISE EXCEPTION 'CURRENCY_MISMATCH'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  IF p_bank_txn_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM deposit_payments WHERE bank_transaction_id = p_bank_txn_id
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_BANK_TRANSACTION';
  END IF;

  v_req_amt := COALESCE(v_dep.requested_amount, v_dep.amount);
  v_new_credited := v_dep.credited_amount + p_amount;

  IF v_new_credited > v_req_amt THEN
    p_amount := v_req_amt - v_dep.credited_amount;
    IF p_amount <= 0 THEN RAISE EXCEPTION 'ALREADY_FULLY_CREDITED'; END IF;
    v_new_credited := v_req_amt;
  END IF;

  INSERT INTO deposit_payments (
    deposit_id, amount, currency_code, receiving_bank_id,
    bank_transaction_id, bank_transaction_ref, verified_by, verification_notes
  ) VALUES (
    p_deposit_id, p_amount, p_currency, p_receiving_bank_id,
    p_bank_txn_id, p_bank_txn_ref, p_verified_by, p_notes
  ) RETURNING id INTO v_payment_id;

  v_ref := next_txn_reference();
  INSERT INTO transactions (
    reference, account_id, profile_id, type, direction, amount,
    currency_code, description, status, method, related_deposit_id, value_date
  ) VALUES (
    v_ref, v_dep.account_id, v_dep.profile_id, 'deposit', 'credit', p_amount,
    p_currency,
    'Deposit credit — ' || v_dep.reference ||
      CASE WHEN p_bank_txn_ref IS NOT NULL THEN ' / ' || p_bank_txn_ref ELSE '' END,
    'posted', 'bank_transfer', p_deposit_id, now()
  ) RETURNING id INTO v_ledger_id;

  UPDATE deposit_payments SET ledger_transaction_id = v_ledger_id WHERE id = v_payment_id;

  IF v_new_credited >= v_req_amt THEN
    v_new_status := 'completed';
  ELSE
    v_new_status := 'partially_fulfilled';
  END IF;

  UPDATE deposits SET
    credited_amount = v_new_credited,
    received_amount = received_amount + p_amount,
    status = v_new_status,
    completed_at = CASE WHEN v_new_status = 'completed' THEN now() ELSE completed_at END,
    admin_notes = COALESCE(p_notes, admin_notes)
  WHERE id = p_deposit_id;

  RETURN jsonb_build_object(
    'deposit_id', p_deposit_id,
    'payment_id', v_payment_id,
    'ledger_transaction_id', v_ledger_id,
    'credited_this_payment', p_amount,
    'total_credited', v_new_credited,
    'requested', v_req_amt,
    'status', v_new_status,
    'reference', v_dep.reference
  );
END;
$$;

CREATE OR REPLACE FUNCTION process_internal_refund(
  p_refund_id     uuid,
  p_approved_by   text,
  p_approved_amount numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref           refunds%ROWTYPE;
  v_orig          transactions%ROWTYPE;
  v_already       numeric;
  v_to_credit     numeric;
  v_ledger_id     uuid;
  v_txn_ref       text;
BEGIN
  SELECT * INTO v_ref FROM refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REFUND_NOT_FOUND'; END IF;

  IF v_ref.status NOT IN ('approved', 'processing') THEN
    RAISE EXCEPTION 'REFUND_NOT_APPROVED: status=%', v_ref.status;
  END IF;

  SELECT * INTO v_orig FROM transactions WHERE id = v_ref.original_transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORIGINAL_TRANSACTION_NOT_FOUND'; END IF;

  SELECT COALESCE(SUM(approved_amount), 0) INTO v_already
    FROM refunds
   WHERE original_transaction_id = v_ref.original_transaction_id
     AND status = 'completed'
     AND id <> p_refund_id;

  v_to_credit := COALESCE(p_approved_amount, v_ref.approved_amount, v_ref.requested_amount);

  IF v_already + v_to_credit > v_orig.amount THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_ORIGINAL: already=%, requested=%, original=%',
      v_already, v_to_credit, v_orig.amount;
  END IF;

  IF v_to_credit <= 0 THEN RAISE EXCEPTION 'INVALID_REFUND_AMOUNT'; END IF;

  v_txn_ref := next_txn_reference();
  INSERT INTO transactions (
    reference, account_id, profile_id, type, direction, amount,
    currency_code, description, status, method, value_date
  ) VALUES (
    v_txn_ref, v_ref.account_id, v_ref.profile_id, 'refund', 'credit', v_to_credit,
    v_ref.currency_code,
    'Internal refund — ' || v_ref.reference || ' (orig ' || v_ref.original_reference || ')',
    'posted', 'internal', now()
  ) RETURNING id INTO v_ledger_id;

  UPDATE refunds SET
    status = 'completed',
    approved_amount = v_to_credit,
    approved_by = p_approved_by,
    approved_at = COALESCE(approved_at, now()),
    completed_at = now(),
    ledger_transaction_id = v_ledger_id,
    updated_at = now()
  WHERE id = p_refund_id;

  RETURN jsonb_build_object(
    'refund_id', p_refund_id,
    'ledger_transaction_id', v_ledger_id,
    'credited', v_to_credit,
    'reference', v_ref.reference,
    'original_reference', v_ref.original_reference
  );
END;
$$;

CREATE OR REPLACE FUNCTION guard_deposit_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reference <> OLD.reference THEN
    RAISE EXCEPTION 'deposit reference is immutable';
  END IF;
  IF NEW.amount <> OLD.amount OR NEW.currency_code <> OLD.currency_code
     OR NEW.account_id::text <> OLD.account_id::text OR NEW.profile_id <> OLD.profile_id THEN
    RAISE EXCEPTION 'deposit amount/currency/account/profile are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_refunds_updated BEFORE UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO schema_migrations (version) VALUES ('0006_deposit_refund_upgrade')
ON CONFLICT (version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- No receiving-bank accounts are seeded here. Production payment instructions
-- must be populated only with bank details independently verified by Meridian.
-- ---------------------------------------------------------------------------

-- These SECURITY DEFINER RPCs mutate deposits and customer ledger balances.
-- They are backend-only and must never be executable by browser roles.
REVOKE ALL ON FUNCTION admin_credit_deposit_payment(uuid, numeric, text, uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_credit_deposit_payment(uuid, numeric, text, uuid, text, text, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION process_internal_refund(uuid, text, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_internal_refund(uuid, text, numeric)
  TO service_role;
