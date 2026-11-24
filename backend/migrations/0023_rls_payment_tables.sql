-- 0023_rls_payment_tables.sql
-- Close the row-level-security gap on the payment-operations tables created by
-- migration 0006. Those tables were never covered by 0003_rls.sql, so any
-- Supabase project rebuilt from the migration history exposed them to
-- anon/authenticated clients through Supabase's default table grants.
--
-- The API touches these tables exclusively through the service-role client
-- with code-level authorization (refunds.service.ts, deposits.service.ts),
-- so deny-by-default is the correct posture:
--   * RLS enabled with no policies  -> RLS denies every client role,
--   * explicit REVOKE                -> no inherited table privileges either.
-- service_role bypasses RLS and retains its privileges via 0010
-- (GRANT ALL ... + ALTER DEFAULT PRIVILEGES).

BEGIN;

ALTER TABLE public.receiving_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unmatched_payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds                 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.receiving_bank_accounts FROM anon, authenticated;
REVOKE ALL ON public.deposit_payments        FROM anon, authenticated;
REVOKE ALL ON public.unmatched_payments      FROM anon, authenticated;
REVOKE ALL ON public.refunds                 FROM anon, authenticated;

INSERT INTO public.schema_migrations (version)
VALUES ('0023_rls_payment_tables')
ON CONFLICT (version) DO NOTHING;

COMMIT;
