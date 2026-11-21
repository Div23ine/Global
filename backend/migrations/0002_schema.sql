-- 0002_schema.sql — core schema
-- Money: numeric(19,4). Timestamps: timestamptz.
-- Identity: Clerk user ids are TEXT (e.g. "user_2abc...") — the profiles PK
-- and every profile_id FK are text. Internal entity ids are uuid.

-- ---------------------------------------------------------------------------
-- currencies: the supported currency set (data-driven availability).
-- ---------------------------------------------------------------------------
CREATE TABLE currencies (
  code          text PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
  name          text NOT NULL,
  symbol        text NOT NULL,
  minor_units   integer NOT NULL DEFAULT 2 CHECK (minor_units BETWEEN 0 AND 4),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','unavailable')),
  display_order integer NOT NULL DEFAULT 100
);

-- ---------------------------------------------------------------------------
-- country_defaults: configurable country -> default currency mapping.
-- ---------------------------------------------------------------------------
CREATE TABLE country_defaults (
  country_code  text PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
  country_name  text NOT NULL,
  currency_code text NOT NULL REFERENCES currencies(code),
  dial_code     text NOT NULL
);

-- ---------------------------------------------------------------------------
-- profiles: application record of a Clerk user. id = Clerk "sub" claim (text).
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
  id               text PRIMARY KEY,
  email            text NOT NULL,
  full_name        text NOT NULL DEFAULT '',
  first_name       text NOT NULL DEFAULT '',
  last_name        text NOT NULL DEFAULT '',
  phone            text,
  country_code     text NOT NULL DEFAULT '',
  default_currency text NOT NULL DEFAULT 'EUR' REFERENCES currencies(code),
  status           text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','suspended','banned','deleted')),
  kyc_status       text NOT NULL DEFAULT 'not_started'
                   CHECK (kyc_status IN ('not_started','pending','verified','rejected')),
  prefs            jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_profiles_email ON profiles(lower(email));

-- ---------------------------------------------------------------------------
-- accounts: one row per (customer, currency).
-- ---------------------------------------------------------------------------
CREATE TABLE accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    text NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  currency_code text NOT NULL REFERENCES currencies(code),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  balance       numeric(19,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  opened_at     timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz,
  CONSTRAINT accounts_unique_currency UNIQUE (profile_id, currency_code)
);
CREATE INDEX idx_accounts_profile ON accounts(profile_id);

-- ---------------------------------------------------------------------------
-- deposits: customer deposit requests. State machine enforced by trigger
-- (0004). pending -> cancelled (customer) | completed/failed (signed
-- provider webhook only). No administrator path exists by design.
-- ---------------------------------------------------------------------------
CREATE TABLE deposits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       text NOT NULL UNIQUE,
  profile_id      text NOT NULL REFERENCES profiles(id),
  account_id      uuid NOT NULL REFERENCES accounts(id),
  currency_code   text NOT NULL,
  amount          numeric(19,4) NOT NULL CHECK (amount > 0),
  fee             numeric(19,4) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  method          text NOT NULL CHECK (method IN ('card','bank_transfer','gateway')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','completed','failed','cancelled')),
  provider        text,
  provider_ref    text,
  idempotency_key text UNIQUE,
  requested_at    timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);
CREATE INDEX idx_deposits_profile ON deposits(profile_id, requested_at DESC);
CREATE INDEX idx_deposits_status ON deposits(status);

-- ---------------------------------------------------------------------------
-- transactions: the immutable ledger (source of truth for balances).
-- ---------------------------------------------------------------------------
CREATE TABLE transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference          text NOT NULL UNIQUE,
  account_id         uuid NOT NULL REFERENCES accounts(id),
  profile_id         text NOT NULL REFERENCES profiles(id),
  type               text NOT NULL CHECK (type IN
                       ('deposit','withdrawal','fee','adjustment','transfer_in','transfer_out')),
  direction          text NOT NULL CHECK (direction IN ('credit','debit')),
  amount             numeric(19,4) NOT NULL CHECK (amount > 0),
  currency_code      text NOT NULL,
  description        text NOT NULL DEFAULT '',
  status             text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','pending','failed','cancelled')),
  method             text,
  related_deposit_id uuid REFERENCES deposits(id),
  value_date         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_account_time ON transactions(account_id, created_at DESC);
CREATE INDEX idx_transactions_profile_time ON transactions(profile_id, created_at DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_deposit ON transactions(related_deposit_id);

-- ---------------------------------------------------------------------------
-- payment_attempts: observability for every payment interaction.
-- ---------------------------------------------------------------------------
CREATE TABLE payment_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL REFERENCES deposits(id),
  provider   text NOT NULL,
  outcome    text NOT NULL CHECK (outcome IN
             ('initiated','confirmed','failed','duplicate_ignored','signature_invalid','cancelled')),
  detail     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_attempts_deposit ON payment_attempts(deposit_id);
CREATE INDEX idx_payment_attempts_time ON payment_attempts(created_at DESC);

-- ---------------------------------------------------------------------------
-- statements: generated per account and period (deterministic content).
-- ---------------------------------------------------------------------------
CREATE TABLE statements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id),
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  opening_balance numeric(19,4) NOT NULL,
  closing_balance numeric(19,4) NOT NULL,
  entry_count     integer NOT NULL DEFAULT 0,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT statements_unique_period UNIQUE (account_id, period_start, period_end),
  CONSTRAINT statements_period_order CHECK (period_end > period_start)
);
CREATE INDEX idx_statements_account ON statements(account_id);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text NOT NULL REFERENCES profiles(id),
  type       text NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','security')),
  title      text NOT NULL,
  body       text NOT NULL,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_profile ON notifications(profile_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- support
-- ---------------------------------------------------------------------------
CREATE TABLE support_tickets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text NOT NULL REFERENCES profiles(id),
  subject    text NOT NULL,
  category   text NOT NULL CHECK (category IN ('general','deposits','currencies','security','account')),
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_profile ON support_tickets(profile_id, updated_at DESC);
CREATE INDEX idx_tickets_status ON support_tickets(status);

CREATE TABLE support_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender     text NOT NULL CHECK (sender IN ('customer','support')),
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_ticket ON support_messages(ticket_id, created_at);

-- ---------------------------------------------------------------------------
-- security events
-- ---------------------------------------------------------------------------
CREATE TABLE security_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text NOT NULL REFERENCES profiles(id),
  type       text NOT NULL,
  severity   text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  detail     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_security_events_profile ON security_events(profile_id, created_at DESC);
CREATE INDEX idx_security_events_time ON security_events(created_at DESC);

-- ---------------------------------------------------------------------------
-- administrative roles and holders
-- ---------------------------------------------------------------------------
CREATE TABLE admin_roles (
  id          text PRIMARY KEY,
  description text NOT NULL DEFAULT '',
  permissions text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE admin_users (
  clerk_user_id text PRIMARY KEY,
  display_name  text NOT NULL DEFAULT '',
  role_id       text NOT NULL REFERENCES admin_roles(id),
  assigned_by   text,
  assigned_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- audit logs (append-only; no client policies — see 0003)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    text NOT NULL,
  actor_role  text,
  action      text NOT NULL,
  target_type text,
  target_id   text,
  detail      jsonb,
  result      text NOT NULL CHECK (result IN ('allowed','denied')),
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_time ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);

-- ---------------------------------------------------------------------------
-- application settings
-- ---------------------------------------------------------------------------
CREATE TABLE app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- reference sequences (TXN-, DEP-)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS txn_reference_seq START 1;
CREATE SEQUENCE IF NOT EXISTS dep_reference_seq START 1;
