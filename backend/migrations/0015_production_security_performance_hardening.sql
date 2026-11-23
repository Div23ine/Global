-- 0015_production_security_performance_hardening.sql
-- Tighten customer-owned RLS policies, pin function search paths, and index
-- foreign-key columns. No customer-facing data or receiving-bank rows created.

-- Customer-owned reads require a real Supabase-authenticated user.
ALTER POLICY accounts_select_own ON public.accounts TO authenticated;
ALTER POLICY deposits_select_own ON public.deposits TO authenticated;
ALTER POLICY notifications_select_own ON public.notifications TO authenticated;
ALTER POLICY profiles_select_own ON public.profiles TO authenticated;
ALTER POLICY security_events_select_own ON public.security_events TO authenticated;
ALTER POLICY statements_select_own ON public.statements TO authenticated;
ALTER POLICY messages_select_own ON public.support_messages TO authenticated;
ALTER POLICY tickets_select_own ON public.support_tickets TO authenticated;
ALTER POLICY transactions_select_own ON public.transactions TO authenticated;

-- app_current_user_id() is used by the customer RLS policies. Anonymous
-- callers have no legitimate use for it; authenticated users and the
-- trusted backend retain EXECUTE.
REVOKE EXECUTE ON FUNCTION public.app_current_user_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.app_current_user_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.app_current_user_id() TO authenticated, service_role;

-- Pin every function flagged by the advisor. The public schema CREATE
-- privilege is revoked from anon/authenticated/service_role, and pg_temp is
-- explicitly last so temporary objects cannot shadow application objects.
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.project_account_balance() SET search_path = public, pg_temp;
ALTER FUNCTION public.guard_account_close() SET search_path = public, pg_temp;
ALTER FUNCTION public.ledger_sum_before(uuid, timestamptz) SET search_path = public, pg_temp;
ALTER FUNCTION public.next_ref_reference() SET search_path = public, pg_temp;
ALTER FUNCTION public.next_txn_reference() SET search_path = public, pg_temp;
ALTER FUNCTION public.next_dep_reference() SET search_path = public, pg_temp;
ALTER FUNCTION public.guard_deposit_transition() SET search_path = '';
ALTER FUNCTION public.post_ledger_entry(uuid, text, text, text, numeric, text, text, text, text, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.provider_confirm_deposit(text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.provider_fail_deposit(text, text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.cancel_deposit(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.activate_currency(text, text) SET search_path = public, pg_temp;

-- Cover every foreign key identified by the production performance advisor.
CREATE INDEX IF NOT EXISTS idx_accounts_currency_code ON public.accounts(currency_code);
CREATE INDEX IF NOT EXISTS idx_admin_users_role_id ON public.admin_users(role_id);
CREATE INDEX IF NOT EXISTS idx_country_defaults_currency_code ON public.country_defaults(currency_code);
CREATE INDEX IF NOT EXISTS idx_deposit_payments_ledger_transaction_id ON public.deposit_payments(ledger_transaction_id);
CREATE INDEX IF NOT EXISTS idx_deposit_payments_receiving_bank_id ON public.deposit_payments(receiving_bank_id);
CREATE INDEX IF NOT EXISTS idx_deposits_account_id ON public.deposits(account_id);
CREATE INDEX IF NOT EXISTS idx_deposits_assigned_bank_id ON public.deposits(assigned_bank_id);
CREATE INDEX IF NOT EXISTS idx_profiles_default_currency ON public.profiles(default_currency);
CREATE INDEX IF NOT EXISTS idx_receiving_bank_accounts_currency_code ON public.receiving_bank_accounts(currency_code);
CREATE INDEX IF NOT EXISTS idx_refunds_account_id ON public.refunds(account_id);
CREATE INDEX IF NOT EXISTS idx_refunds_ledger_transaction_id ON public.refunds(ledger_transaction_id);
CREATE INDEX IF NOT EXISTS idx_unmatched_payments_matched_deposit_id ON public.unmatched_payments(matched_deposit_id);
CREATE INDEX IF NOT EXISTS idx_unmatched_payments_receiving_bank_id ON public.unmatched_payments(receiving_bank_id);

INSERT INTO public.schema_migrations(version)
VALUES ('0015_production_security_performance_hardening')
ON CONFLICT (version) DO NOTHING;
