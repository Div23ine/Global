-- 0021_admin_takeover_sessions.sql
-- Server-controlled administrator account-takeover sessions.
-- Opaque tokens are stored only as SHA-256 hashes. The administrator's own
-- Supabase identity is never replaced by the customer's credentials.

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_takeover_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_profile_id  text NOT NULL REFERENCES public.profiles(id),
  target_profile_id text NOT NULL REFERENCES public.profiles(id),
  token_hash        text NOT NULL,
  reason            text NOT NULL CHECK (char_length(trim(reason)) >= 3 AND char_length(reason) <= 1000),
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'ended', 'expired')),
  started_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  ended_at          timestamptz,
  started_ip        text,
  started_ua        text,
  ended_ip          text,
  ended_ua          text,
  CONSTRAINT admin_takeover_admin_ne_target CHECK (admin_profile_id <> target_profile_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_takeover_active_admin
  ON public.admin_takeover_sessions (admin_profile_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_takeover_token_hash
  ON public.admin_takeover_sessions (token_hash)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_takeover_target
  ON public.admin_takeover_sessions (target_profile_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_takeover_history
  ON public.admin_takeover_sessions (started_at DESC);

-- Takeover permission on roles that perform customer support.
UPDATE public.admin_roles
   SET permissions = (
     SELECT ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['takeover.manage']) AS p ORDER BY 1)
   )
 WHERE id IN ('super_admin', 'support');

INSERT INTO public.schema_migrations (version)
VALUES ('0021_admin_takeover_sessions')
ON CONFLICT (version) DO NOTHING;

COMMIT;
