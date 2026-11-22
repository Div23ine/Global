-- 0014_restore_deposit_state_machine.sql
-- Restores the deposit transition guard that migration 0006 dropped.
--
-- Root cause: 0006 widened the deposit status set for the manual
-- bank-transfer workflow but replaced guard_deposit_transition() with a
-- version that only protects reference/amount immutability. The state
-- machine from 0004 was lost, so the database accepted arbitrary status
-- rewinds (completed -> pending, completed -> failed, ...) and a completed
-- deposit could be re-opened and re-credited. The trigger is the last line
-- of defense for the invariants "no double credit" and "terminal states are
-- final"; the application-level checks alone are not sufficient.
--
-- This migration reinstalls the guard with the complete matrix actually used
-- by the backend (deposits.service.ts, admin_credit_deposit_payment RPC,
-- provider_*_deposit RPCs):
--
--   terminal — no outgoing transitions: completed, cancelled, rejected
--   pending              -> completed | failed | cancelled | rejected
--                           (legacy provider-webhook flow)
--   pending_admin_action -> awaiting_payment | cancelled | rejected
--   awaiting_payment     -> payment_reported | under_verification
--                         | partially_fulfilled | completed
--                         | cancelled | rejected
--   payment_reported     -> under_verification | partially_fulfilled
--                         | completed | rejected
--   under_verification   -> partially_fulfilled | completed | rejected
--   partially_fulfilled  -> payment_reported | under_verification
--                         | completed | rejected
--   expired              -> rejected
--   unmatched_payment    -> rejected | cancelled
--   failed               -> rejected
--
-- Status-unchanged updates (idempotent replays, field-only edits) stay
-- allowed. completed_at is defaulted when a deposit first reaches a
-- terminal/failed-like state. Reference and amount immutability checks are
-- preserved unchanged from 0006.

CREATE OR REPLACE FUNCTION public.guard_deposit_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reference <> OLD.reference THEN
    RAISE EXCEPTION 'deposit reference is immutable';
  END IF;
  IF NEW.amount <> OLD.amount OR NEW.currency_code <> OLD.currency_code
     OR NEW.account_id::text <> OLD.account_id::text
     OR NEW.profile_id <> OLD.profile_id THEN
    RAISE EXCEPTION 'deposit amount/currency/account/profile are immutable';
  END IF;
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD.status = 'pending'              AND NEW.status IN
       ('completed','failed','cancelled','rejected')) OR
    (OLD.status = 'pending_admin_action' AND NEW.status IN
       ('awaiting_payment','cancelled','rejected')) OR
    (OLD.status = 'awaiting_payment'     AND NEW.status IN
       ('payment_reported','under_verification','partially_fulfilled',
        'completed','cancelled','rejected')) OR
    (OLD.status = 'payment_reported'     AND NEW.status IN
       ('under_verification','partially_fulfilled','completed','rejected')) OR
    (OLD.status = 'under_verification'   AND NEW.status IN
       ('partially_fulfilled','completed','rejected')) OR
    (OLD.status = 'partially_fulfilled'  AND NEW.status IN
       ('payment_reported','under_verification','completed','rejected')) OR
    (OLD.status = 'expired'              AND NEW.status IN
       ('rejected')) OR
    (OLD.status = 'unmatched_payment'    AND NEW.status IN
       ('rejected','cancelled')) OR
    (OLD.status = 'failed'               AND NEW.status IN
       ('rejected'))
  ) THEN
    RAISE EXCEPTION 'illegal deposit transition % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.completed_at IS NULL AND NEW.status IN
     ('completed','failed','rejected','expired') THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

INSERT INTO schema_migrations (version) VALUES ('0014_restore_deposit_state_machine')
ON CONFLICT (version) DO NOTHING;
