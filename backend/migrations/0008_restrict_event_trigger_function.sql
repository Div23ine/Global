-- 0008_restrict_event_trigger_function.sql
-- The event-trigger handler is invoked by PostgreSQL's event-trigger system,
-- not by application clients. Remove direct RPC execution privileges.
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
