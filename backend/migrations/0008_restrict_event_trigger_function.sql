-- 0008_restrict_event_trigger_function.sql
-- The event-trigger handler is invoked by PostgreSQL's event-trigger system,
-- not by application clients. Remove direct RPC execution privileges.
--
-- The handler function was provisioned directly in the live Supabase project
-- and is intentionally NOT part of this forward-only migration history, so it
-- does not exist on databases built purely from these migrations (CI,
-- rehearsal). Guard the REVOKE on its presence: no-op on fresh databases,
-- still hardens environments where the function exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rls_auto_enable'
  ) THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END
$$;
