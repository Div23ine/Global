-- 0001_extensions.sql — extensions and migration bookkeeping
-- Meridian Global Accounts · forward-only migrations

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
