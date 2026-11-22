-- 0011_grant_authenticated_rls_reads.sql
-- PostgreSQL GRANT privileges and RLS policies are separate controls.
-- The customer API uses the caller's Supabase Auth JWT for read-only queries.
-- The policies in 0003/0007 restrict these SELECT grants to the caller's own
-- rows. No customer write privileges or admin/financial-table access is added.

BEGIN;

GRANT SELECT ON TABLE
  public.profiles,
  public.accounts,
  public.transactions,
  public.deposits,
  public.statements,
  public.notifications,
  public.support_tickets,
  public.support_messages,
  public.security_events
TO authenticated;

-- Reference data is intentionally public-read under the existing RLS policies.
GRANT SELECT ON TABLE
  public.currencies,
  public.country_defaults
TO anon, authenticated;

COMMIT;
