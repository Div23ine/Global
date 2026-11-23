-- 0017_add_second_super_admin_raysallinone00.sql
-- Configure and provision BOTH platform super administrators.
--
-- Migration 0009 configured raysallinone00@gmail.com as the single
-- configured super-admin email; migration 0016 re-pointed that single
-- setting at gospelu214@gmail.com. The platform's intent is that the two
-- addresses are BOTH super administrators, so this migration:
--
--   1. Introduces app_settings.platform.admin_emails (jsonb array) listing
--      both addresses, and rewrites the 0009 grant trigger to grant the
--      role when the profile email matches ANY configured address (with a
--      legacy fallback to the single platform.admin_email key).
--   2. Restores app_settings.platform.admin_email to its original
--      raysallinone00@gmail.com holder for compatibility with anything
--      still reading the single-address key.
--   3. Provisions raysallinone00@gmail.com with a confirmed Supabase Auth
--      identity (magic-link capable, no password) and a linked active
--      profile — mirroring migration 0016 for gospelu214@gmail.com.
--   4. Idempotently re-asserts gospelu214@gmail.com's existing grant, so
--      the two-address end-state always holds after the migration runs.
--
-- All steps are idempotent and safe to re-run. Nothing is revoked: any
-- other admin_users row is left untouched and can be revoked through the
-- admin console (roles.revoke) if the owner wants only the two configured
-- administrators.

BEGIN;

-- 1. The authoritative configured super-admin list: both addresses.
INSERT INTO public.app_settings (key, value)
VALUES ('platform.admin_emails',
        to_jsonb('["raysallinone00@gmail.com","gospelu214@gmail.com"]'::jsonb))
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

-- 2. Legacy single-address key restored to the original holder.
INSERT INTO public.app_settings (key, value)
VALUES ('platform.admin_email', to_jsonb('raysallinone00@gmail.com'::text))
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

-- 3. The grant trigger now honours the configured address list.
CREATE OR REPLACE FUNCTION public.assign_configured_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_emails text[];
  v_profile_email text;
  v_auth_email text;
  v_confirmed_at timestamptz;
BEGIN
  SELECT lower(trim(COALESCE(NEW.email, '')))
    INTO v_profile_email;

  SELECT ARRAY(
    SELECT lower(trim(e))
      FROM jsonb_array_elements_text(
        (SELECT s.value
           FROM public.app_settings AS s
          WHERE s.key = 'platform.admin_emails')
      ) AS e
  )
    INTO v_emails;

  -- Legacy fallback: honour the single-address key when the list is absent.
  IF v_emails IS NULL OR array_length(v_emails, 1) IS NULL THEN
    SELECT ARRAY[lower(trim(COALESCE(s.value #>> '{}', '')))]
      INTO v_emails
      FROM public.app_settings AS s
     WHERE s.key = 'platform.admin_email';
    IF v_emails = ARRAY[''] OR v_emails IS NULL THEN
      v_emails := NULL;
    END IF;
  END IF;

  IF v_emails IS NULL
     OR NOT (v_profile_email = ANY (v_emails))
     OR NEW.supabase_user_id IS NULL
     OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT lower(trim(u.email)), u.email_confirmed_at
    INTO v_auth_email, v_confirmed_at
    FROM auth.users AS u
   WHERE u.id = NEW.supabase_user_id;

  IF v_auth_email IS NULL
     OR v_auth_email <> v_profile_email
     OR v_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.admin_users (profile_id, display_name, role_id, assigned_by, assigned_at)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.full_name, ''), v_profile_email),
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

-- 4. Provision both configured addresses end-to-end (idempotent).
DO $provision$
DECLARE
  v_admin_emails text[] := ARRAY['raysallinone00@gmail.com', 'gospelu214@gmail.com'];
  v_email text;
  v_user_id uuid;
  v_profile_id text;
  v_status text;
BEGIN
  FOREACH v_email IN ARRAY v_admin_emails LOOP
    -- Exactly one Auth identity may own each configured email.
    SELECT u.id
      INTO v_user_id
      FROM auth.users AS u
     WHERE lower(trim(u.email)) = v_email
     ORDER BY u.email_confirmed_at NULLS LAST, u.id
     LIMIT 1;

    IF v_user_id IS NULL THEN
      -- Magic-link-capable identity: no password is ever set for administrators.
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
      VALUES (v_user_id, v_email, now(), '{}'::jsonb);
    ELSE
      -- Confirm the existing identity's email if verification never completed
      -- (the grant trigger and requireAuth both require a confirmed address).
      UPDATE auth.users
         SET email_confirmed_at = COALESCE(email_confirmed_at, now())
       WHERE id = v_user_id
         AND email_confirmed_at IS NULL;
    END IF;

    -- Production profile-linking path: legacy link by confirmed email, or a
    -- new profile with the default account. Fires the configured-email trigger.
    v_profile_id := public.bootstrap_supabase_profile(v_user_id);

    SELECT status INTO v_status FROM public.profiles WHERE id = v_profile_id;
    IF v_status IS NULL OR v_status <> 'active' THEN
      RAISE EXCEPTION
        'ADMIN_PROFILE_NOT_ACTIVE: profile % for % has status % — resolve the profile before provisioning',
        v_profile_id, v_email, v_status;
    END IF;

    -- Idempotent end-state grant, mirroring assign_configured_super_admin()
    -- (covers the case where the profile link already existed, so neither an
    -- INSERT nor an UPDATE fired the trigger in this run).
    INSERT INTO public.admin_users (profile_id, display_name, role_id, assigned_by, assigned_at)
    SELECT p.id,
           COALESCE(NULLIF(p.full_name, ''), v_email),
           'super_admin',
           'system:verified-admin-email',
           now()
      FROM public.profiles AS p
     WHERE p.id = v_profile_id
       AND lower(trim(p.email)) = v_email
       AND p.supabase_user_id = v_user_id
       AND p.status = 'active'
       AND EXISTS (
         SELECT 1 FROM auth.users AS u
          WHERE u.id = v_user_id
            AND lower(trim(u.email)) = v_email
            AND u.email_confirmed_at IS NOT NULL
       )
    ON CONFLICT (profile_id) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          role_id = 'super_admin',
          assigned_by = EXCLUDED.assigned_by,
          assigned_at = now();

    -- The provisioning contract must actually hold or the migration is a no-op
    -- that claims success — never allow that.
    IF NOT EXISTS (
      SELECT 1
        FROM public.admin_users AS a
        JOIN public.profiles AS p ON p.id = a.profile_id
       WHERE p.supabase_user_id = v_user_id
         AND lower(trim(p.email)) = v_email
         AND a.role_id = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'ADMIN_PROVISIONING_INCOMPLETE: role grant for % did not land', v_email;
    END IF;

    RAISE NOTICE 'super admin provisioned: % (profile %)', v_email, v_profile_id;
  END LOOP;
END
$provision$;

INSERT INTO public.schema_migrations (version)
VALUES ('0017_add_second_super_admin_raysallinone00')
ON CONFLICT (version) DO NOTHING;

COMMIT;
