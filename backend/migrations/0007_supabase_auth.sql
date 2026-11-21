-- 0007_supabase_auth.sql
-- Move identity from Clerk to Supabase Auth without changing canonical
-- profiles.id values or reassigning any account/ledger ownership.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supabase_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_supabase_user_id
  ON public.profiles(supabase_user_id)
  WHERE supabase_user_id IS NOT NULL;

-- Admin role holders are now keyed by the canonical Meridian profile id.
ALTER TABLE public.admin_users
  RENAME COLUMN clerk_user_id TO profile_id;

-- Admin role holders must map to a real canonical Meridian profile.
-- The pre-migration orphan check is documented in DEPLOYMENT_GUIDE.md.
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- Resolve the Supabase Auth UUID to the canonical profile id used by the
-- existing schema. SECURITY DEFINER avoids recursive RLS when reading profiles.
CREATE OR REPLACE FUNCTION public.app_current_user_id() RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT p.id
      FROM public.profiles AS p
     WHERE p.supabase_user_id = auth.uid()
       AND p.status = 'active'
     LIMIT 1
  ), '');
$$;

REVOKE ALL ON FUNCTION public.app_current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_current_user_id() TO anon, authenticated, service_role;

-- This is called only by the backend using the service-role client after it
-- has independently verified the bearer token with Supabase Auth getUser().
-- The function independently checks auth.users and requires a confirmed
-- email before linking an old profile or creating a new one.
CREATE OR REPLACE FUNCTION public.bootstrap_supabase_profile(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_user auth.users%ROWTYPE;
  v_profile_id text;
  v_email text;
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_phone text;
  v_country text;
  v_currency text;
BEGIN
  SELECT *
    INTO v_auth_user
    FROM auth.users
   WHERE id = p_user_id
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_USER_NOT_FOUND';
  END IF;

  v_email := lower(trim(COALESCE(v_auth_user.email, '')));
  IF v_email = '' OR v_auth_user.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'AUTH_EMAIL_NOT_VERIFIED';
  END IF;

  -- Existing linkage is idempotent.
  SELECT p.id
    INTO v_profile_id
    FROM public.profiles AS p
   WHERE p.supabase_user_id = p_user_id;

  IF FOUND THEN
    RETURN v_profile_id;
  END IF;

  -- Link an existing legacy account by confirmed email. The canonical profile
  -- id is preserved, so every existing financial foreign key remains intact.
  SELECT p.id
    INTO v_profile_id
    FROM public.profiles AS p
   WHERE lower(p.email) = v_email
     AND p.supabase_user_id IS NULL
     AND p.deleted_at IS NULL
     AND p.status <> 'deleted'
   FOR UPDATE;

  IF FOUND THEN
    UPDATE public.profiles
       SET supabase_user_id = p_user_id,
           updated_at = now()
     WHERE id = v_profile_id;
    RETURN v_profile_id;
  END IF;

  v_first_name := COALESCE(NULLIF(v_auth_user.raw_user_meta_data ->> 'first_name', ''), '');
  v_last_name := COALESCE(NULLIF(v_auth_user.raw_user_meta_data ->> 'last_name', ''), '');
  v_full_name := COALESCE(
    NULLIF(v_auth_user.raw_user_meta_data ->> 'full_name', ''),
    trim(v_first_name || ' ' || v_last_name),
    ''
  );
  v_phone := COALESCE(NULLIF(v_auth_user.phone, ''), NULLIF(v_auth_user.raw_user_meta_data ->> 'phone', ''));
  v_country := upper(COALESCE(v_auth_user.raw_user_meta_data ->> 'country_code', ''));

  IF v_country !~ '^[A-Z]{2}$' THEN
    v_country := '';
  END IF;

  SELECT cd.currency_code
    INTO v_currency
    FROM public.country_defaults AS cd
   WHERE cd.country_code = v_country;

  v_currency := COALESCE(v_currency, 'EUR');

  INSERT INTO public.profiles (
    id, supabase_user_id, email, full_name, first_name, last_name,
    phone, country_code, default_currency
  )
  VALUES (
    p_user_id::text, p_user_id, v_email, v_full_name, v_first_name,
    v_last_name, v_phone, v_country, v_currency
  )
  RETURNING id INTO v_profile_id;

  INSERT INTO public.accounts (profile_id, currency_code)
  VALUES (v_profile_id, v_currency)
  ON CONFLICT (profile_id, currency_code) DO NOTHING;

  RETURN v_profile_id;
EXCEPTION
  WHEN unique_violation THEN
    -- In particular, do not silently attach a second Auth identity to an email
    -- already linked to a different Supabase user.
    RAISE EXCEPTION 'AUTH_EMAIL_ALREADY_LINKED';
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_supabase_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_supabase_profile(uuid) TO service_role;

-- Profile deletion/anonymization disconnects the Auth identity as an
-- additional guard against still-valid stateless access JWTs.
CREATE OR REPLACE FUNCTION public.anonymize_profile(p_profile_id text) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
     SET email = 'deleted+' || p_profile_id || '@anonymized.invalid',
         full_name = 'Deleted customer',
         first_name = '',
         last_name = '',
         phone = NULL,
         supabase_user_id = NULL,
         status = 'deleted',
         deleted_at = now()
   WHERE id = p_profile_id;
END;
$;

-- This SECURITY DEFINER function can clear customer PII and unlink an Auth
-- identity. It must be callable only by the trusted backend service role.
-- CREATE OR REPLACE preserves the legacy function's existing grants, so
-- explicitly remove PUBLIC/client execution inherited from migration 0004.
REVOKE ALL ON FUNCTION public.anonymize_profile(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_profile(text) TO service_role;

-- Remove the Clerk-only bootstrap function; historical rows remain untouched.
DROP FUNCTION IF EXISTS public.bootstrap_profile(text, text, text, text, text);

INSERT INTO public.schema_migrations (version)
VALUES ('0007_supabase_auth')
ON CONFLICT (version) DO NOTHING;

COMMIT;
