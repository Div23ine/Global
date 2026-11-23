-- Per-administrator Gmail connections for admin-only request alerts.
-- Refresh tokens are encrypted by the API before they are stored.
CREATE TABLE IF NOT EXISTS public.admin_email_connections (
  profile_id text PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  provider text NOT NULL DEFAULT 'google' CHECK (provider = 'google'),
  refresh_token_ciphertext text NOT NULL,
  refresh_token_iv text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  last_error text
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_email_connections_email
  ON public.admin_email_connections (lower(email));

CREATE TABLE IF NOT EXISTS public.admin_gmail_oauth_states (
  state_hash text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_gmail_oauth_states_expiry
  ON public.admin_gmail_oauth_states (expires_at);

ALTER TABLE public.admin_email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_gmail_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_email_connections, public.admin_gmail_oauth_states
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_email_connections,
  public.admin_gmail_oauth_states TO service_role;

INSERT INTO public.schema_migrations(version)
VALUES ('0020_admin_gmail_notifications')
ON CONFLICT (version) DO NOTHING;
