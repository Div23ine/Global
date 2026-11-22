-- 0009_configure_super_admin_email.sql
-- Configure the initial Meridian super administrator by a verified email.
-- The role is granted only after Supabase Auth confirms ownership of the exact
-- configured email and the backend links that Auth UUID to a Meridian profile.

BEGIN;

INSERT INTO public.app_settings (key, value)
VALUES ('platform.admin_email', to_jsonb('raysallinone00@gmail.com'::text))
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

CREATE OR REPLACE FUNCTION public.assign_configured_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_email text;
  v_auth_email text;
  v_confirmed_at timestamptz;
BEGIN
  SELECT lower(trim(s.value #>> '{}'))
    INTO v_admin_email
    FROM public.app_settings AS s
   WHERE s.key = 'platform.admin_email';

  IF v_admin_email IS NULL
     OR lower(trim(COALESCE(NEW.email, ''))) <> v_admin_email
     OR NEW.supabase_user_id IS NULL
     OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT lower(trim(u.email)), u.email_confirmed_at
    INTO v_auth_email, v_confirmed_at
    FROM auth.users AS u
   WHERE u.id = NEW.supabase_user_id;

  IF v_auth_email IS NULL
     OR v_auth_email <> v_admin_email
     OR v_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.admin_users (profile_id, display_name, role_id, assigned_by, assigned_at)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.full_name, ''), v_admin_email),
    'super_admin',
    'system:verified-admin-email',
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        role_id = 'super_admin',
        assigned_by = EXCLUDED.assigned_by,
        assigned_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_configured_super_admin() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_assign_configured_super_admin ON public.profiles;
CREATE TRIGGER trg_assign_configured_super_admin
AFTER INSERT OR UPDATE OF email, supabase_user_id, status
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_configured_super_admin();

INSERT INTO public.schema_migrations (version)
VALUES ('0009_configure_super_admin_email')
ON CONFLICT (version) DO NOTHING;

COMMIT;
