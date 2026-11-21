-- 0003_rls.sql — Row Level Security keyed on the Clerk "sub" claim.
-- The Clerk <-> Supabase integration issues JWTs whose "sub" is the Clerk
-- user id. PostgREST exposes the verified claims via the request.jwt.claims
-- GUC, which also works on plain PostgreSQL for local testing (set it with
-- `SET request.jwt.claims = '{"sub":"user_..."}'`).
--
-- Enforced policy (defense in depth):
--   * The frontend performs ALL writes through the backend REST API, which
--     authorizes in code and uses the service role.
--   * Client-side (anon key + Clerk JWT) access is READ-ONLY and row-scoped:
--     a customer can read only their own rows on interactive tables.
--   * Money tables, admin tables, audit_logs and settings have no client
--     write policies at all — deny by default.
--   * currencies / country_defaults are publicly readable.

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_defaults   ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings       ENABLE ROW LEVEL SECURITY;

-- Helper: current caller's Clerk user id ('' when not authenticated).
-- Uses request.jwt.claims (works on Supabase PostgREST AND plain Postgres).
-- The empty fallback must live OUTSIDE the json cast: casting '' to json is
-- an error, while NULL::json is NULL.
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'sub',
    ''
  );
$$;

-- ---------------------------------------------------------------- profiles
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (id = app_current_user_id());
-- No client INSERT/UPDATE/DELETE policies: profile creation and updates are
-- performed by the backend (webhooks + PATCH /profile) via the service role.

-- ------------------------------------------------------------- currencies
CREATE POLICY currencies_public_read ON currencies
  FOR SELECT USING (true);

CREATE POLICY country_defaults_public_read ON country_defaults
  FOR SELECT USING (true);

-- --------------------------------------------------------------- accounts
CREATE POLICY accounts_select_own ON accounts
  FOR SELECT USING (profile_id = app_current_user_id());

-- ---------------------------------------------------------- transactions
CREATE POLICY transactions_select_own ON transactions
  FOR SELECT USING (profile_id = app_current_user_id());
-- The ledger is written only by the backend (service role) inside posting
-- transactions via post_ledger_entry(). No client write policy exists.

-- -------------------------------------------------------------- deposits
CREATE POLICY deposits_select_own ON deposits
  FOR SELECT USING (profile_id = app_current_user_id());
-- Creation, cancellation and provider transitions all run through the
-- backend. No client write policy exists (a direct PostgREST write would
-- bypass validation, limits and provider handoff).

-- ------------------------------------------------------- payment_attempts
-- No client policy: backend-only observability table.

-- ------------------------------------------------------------- statements
CREATE POLICY statements_select_own ON statements
  FOR SELECT USING (
    account_id IN (SELECT id FROM accounts WHERE profile_id = app_current_user_id())
  );

-- ---------------------------------------------------------- notifications
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT USING (profile_id = app_current_user_id());
-- Mark-read runs through the backend (service role).

-- ---------------------------------------------------------------- support
CREATE POLICY tickets_select_own ON support_tickets
  FOR SELECT USING (profile_id = app_current_user_id());

CREATE POLICY messages_select_own ON support_messages
  FOR SELECT USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE profile_id = app_current_user_id())
  );
-- Ticket/message creation runs through the backend.

-- --------------------------------------------------------- security_events
CREATE POLICY security_events_select_own ON security_events
  FOR SELECT USING (profile_id = app_current_user_id());
-- Written by the backend only.

-- ------------------------------------------------------- admin / settings
-- admin_roles, admin_users, app_settings, audit_logs:
-- NO client policies at all. The backend reads them with the service role
-- after verifying the caller's role. This is deny-by-default.
