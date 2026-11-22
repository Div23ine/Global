-- 0010_grant_service_role_privileges.sql
-- Restore the server-side privileges required by the Meridian API.
--
-- The backend uses the Supabase service_role key exclusively on the server.
-- Client access remains governed by RLS; no anon/authenticated grants or
-- customer-facing RLS policies are added here.
--
-- Supabase service_role has BYPASSRLS, but it still needs PostgreSQL object
-- privileges. Without these grants, PostgREST returns 403
-- "permission denied for table ..." even when the backend uses service_role.

BEGIN;

GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Ensure objects created by the migration owner in future migrations are
-- also accessible to the server-side service role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

COMMIT;
