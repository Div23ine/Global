-- 0018_approved_receiving_bank_workflow.sql
-- Receiving accounts are never customer-visible/assignable until an
-- administrator explicitly approves their submitted details.
ALTER TABLE public.receiving_bank_accounts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Existing active accounts were entered through the old admin workflow.
-- Re-submit them for explicit approval under the new auditable process.
UPDATE public.receiving_bank_accounts
   SET status = 'pending',
       is_active = false,
       approved_by = NULL,
       approved_at = NULL,
       rejection_reason = NULL,
       updated_at = now();

ALTER TABLE public.receiving_bank_accounts
  ADD CONSTRAINT receiving_bank_active_matches_approval
    CHECK (is_active = (status = 'approved')),
  ADD CONSTRAINT receiving_bank_approval_has_details
    CHECK (status <> 'approved' OR
      ((account_number IS NOT NULL AND length(trim(account_number)) > 0)
       OR (iban IS NOT NULL AND length(trim(iban)) > 0)));

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS customer_bank_reference text;

CREATE INDEX IF NOT EXISTS idx_receiving_banks_status_currency
  ON public.receiving_bank_accounts(status, currency_code, display_order);

-- A receiving bank's statement reference is a second idempotency key when
-- the bank does not supply a separate transaction ID.
CREATE UNIQUE INDEX IF NOT EXISTS uq_deposit_payment_bank_reference
  ON public.deposit_payments(receiving_bank_id, lower(bank_transaction_ref))
  WHERE bank_transaction_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_credit_deposit_payment(
  p_deposit_id uuid,
  p_amount numeric,
  p_currency text,
  p_receiving_bank_id uuid,
  p_bank_txn_id text,
  p_bank_txn_ref text,
  p_verified_by text,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dep deposits%ROWTYPE;
  v_bank receiving_bank_accounts%ROWTYPE;
  v_payment_id uuid;
  v_ledger_id uuid;
  v_ref text;
  v_new_credited numeric;
  v_new_status text;
  v_req_amt numeric;
BEGIN
  SELECT * INTO v_dep FROM deposits WHERE id = p_deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEPOSIT_NOT_FOUND'; END IF;
  IF v_dep.status NOT IN ('awaiting_payment','payment_reported','under_verification','partially_fulfilled') THEN
    RAISE EXCEPTION 'DEPOSIT_NOT_CREDITABLE: status=%', v_dep.status;
  END IF;
  IF p_currency <> v_dep.currency_code THEN RAISE EXCEPTION 'CURRENCY_MISMATCH'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF p_bank_txn_id IS NULL AND p_bank_txn_ref IS NULL THEN
    RAISE EXCEPTION 'BANK_TRANSACTION_REFERENCE_REQUIRED';
  END IF;
  IF v_dep.assigned_bank_id IS NULL OR p_receiving_bank_id IS DISTINCT FROM v_dep.assigned_bank_id THEN
    RAISE EXCEPTION 'RECEIVING_BANK_MISMATCH';
  END IF;
  SELECT * INTO v_bank FROM receiving_bank_accounts
   WHERE id = p_receiving_bank_id AND status = 'approved' AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECEIVING_BANK_NOT_APPROVED'; END IF;
  IF p_bank_txn_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM deposit_payments WHERE bank_transaction_id = p_bank_txn_id
  ) THEN RAISE EXCEPTION 'DUPLICATE_BANK_TRANSACTION'; END IF;
  IF p_bank_txn_ref IS NOT NULL AND EXISTS (
    SELECT 1 FROM deposit_payments
     WHERE receiving_bank_id = p_receiving_bank_id
       AND lower(bank_transaction_ref) = lower(p_bank_txn_ref)
  ) THEN RAISE EXCEPTION 'DUPLICATE_BANK_TRANSACTION'; END IF;

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
    p_currency, 'Deposit credit — ' || v_dep.reference ||
      CASE WHEN p_bank_txn_ref IS NOT NULL THEN ' / ' || p_bank_txn_ref ELSE '' END,
    'posted', 'bank_transfer', p_deposit_id, now()
  ) RETURNING id INTO v_ledger_id;

  UPDATE deposit_payments SET ledger_transaction_id = v_ledger_id WHERE id = v_payment_id;
  v_new_status := CASE WHEN v_new_credited >= v_req_amt THEN 'completed' ELSE 'partially_fulfilled' END;
  UPDATE deposits SET credited_amount = v_new_credited,
    received_amount = received_amount + p_amount,
    status = v_new_status,
    completed_at = CASE WHEN v_new_status = 'completed' THEN now() ELSE completed_at END,
    admin_notes = COALESCE(p_notes, admin_notes)
  WHERE id = p_deposit_id;

  RETURN jsonb_build_object(
    'deposit_id', p_deposit_id, 'payment_id', v_payment_id,
    'ledger_transaction_id', v_ledger_id, 'credited_this_payment', p_amount,
    'total_credited', v_new_credited, 'requested', v_req_amt,
    'status', v_new_status, 'reference', v_dep.reference
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_credit_deposit_payment(uuid,numeric,text,uuid,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_deposit_payment(uuid,numeric,text,uuid,text,text,text,text)
  TO service_role;

INSERT INTO public.schema_migrations(version)
VALUES ('0018_approved_receiving_bank_workflow')
ON CONFLICT (version) DO NOTHING;
