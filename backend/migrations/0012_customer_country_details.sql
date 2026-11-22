-- 0012 persist customer country name and calling code
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country_calling_code text NOT NULL DEFAULT '';

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
  v_country_name text;
  v_country_calling_code text;
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
  v_country_name := trim(COALESCE(v_auth_user.raw_user_meta_data ->> 'country_name', v_auth_user.raw_user_meta_data ->> 'country', ''));
  v_country_calling_code := trim(COALESCE(v_auth_user.raw_user_meta_data ->> 'country_calling_code', ''));

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
    phone, country_code, country_name, country_calling_code, default_currency
  )
  VALUES (
    p_user_id::text, p_user_id, v_email, v_full_name, v_first_name,
    v_last_name, v_phone, v_country, v_country_name, v_country_calling_code, v_currency
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

INSERT INTO public.schema_migrations (version)
VALUES ('0012_customer_country_details')
ON CONFLICT (version) DO NOTHING;

COMMIT;
