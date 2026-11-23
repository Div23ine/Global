-- 0016_provision_super_admin_gospelu214.sql
-- Provision the platform's configured super administrator: gospelu214@gmail.com.
--
-- Resolves audit finding F-6 (issue #5): the intended administrator could not
-- sign in because no Supabase Auth identity existed for the address — every
-- admin magic-link request returned HTTP 422 "Signups not allowed for otp".
-- Admin sign-in deliberately uses shouldCreateUser:false, so the identity
-- must already exist in auth.users. This migration guarantees it.
--
-- Steps (all idempotent, safe to re-run):
--   1. Point the configured super-admin trigger (migration 0009) at
--      gospelu214@gmail.com instead of the initial placeholder holder.
--   2. Ensure a Supabase Auth identity exists for that exact email with the
--      address confirmed (magic-link capable; no password is set — admin
--      authentication is magic-link only by design).
--   3. Link the identity to a canonical Meridian profile through the
--      production bootstrap path (legacy link or new profile + default
--      account), which fires the 0009 super-admin trigger.
--   4. Assert the role grant end-state so a partially-provisioned run can
--      never silently succeed.
--
-- Nothing is revoked: an existing admin_users row for any other holder (e.g.
-- the initial 0009 address) is left untouched and can be revoked through the
-- admin console (roles.revoke) if the owner wishes.
--
-- Equivalent non-SQL alternative (documented for the operator): create the
-- user via the Supabase Auth admin API (admin.createUser) with the same email
-- and a confirmed address, then rely on the 0009 trigger at first sign-in.

BEGIN;

-- 1. The configured super-admin email now points at the intended owner.
INSERT INTO public.app_settings (key, value)
VALUES ('platform.admin_email', to_jsonb('gospelu214@gmail.com'::text))
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

-- 2.-4. Ensure the Auth identity, link the profile, grant the role.
DO $provision$
DECLARE
  v_admin_email text := 'gospelu214@gmail.com';
  v_user_id     uuid;
  v_profile_id  text;
  v_status      text;
BEGIN
  -- Exactly one Auth identity may own the configured email.
  SELECT u.id
    INTO v_user_id
    FROM auth.users AS u
   WHERE lower(trim(u.email)) = v_admin_email
   ORDER BY u.email_confirmed_at NULLS LAST, u.id
   LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Magic-link-capable identity: no password is ever set for administrators.
    -- Column set deliberately limited to what both a real Supabase auth.users
    -- table and the integration-test double provide.
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
    VALUES (v_user_id, v_admin_email, now(), '{}'::jsonb);
  ELSE
    -- Confirm the existing identity's email if verification never completed
    -- (the 0009 trigger and requireAuth both require a confirmed address).
    UPDATE auth.users
       SET email_confirmed_at = COALESCE(email_confirmed_at, now())
     WHERE id = v_user_id
       AND email_confirmed_at IS NULL;
  END IF;

  -- Production profile-linking path: legacy link by confirmed email, or a new
  -- profile with the default account. Fires the 0009 super-admin trigger.
  v_profile_id := public.bootstrap_supabase_profile(v_user_id);

  SELECT status INTO v_status FROM public.profiles WHERE id = v_profile_id;
  IF v_status IS NULL OR v_status <> 'active' THEN
    RAISE EXCEPTION
      'ADMIN_PROFILE_NOT_ACTIVE: profile % has status % — resolve the profile before provisioning',
      v_profile_id, v_status;
  END IF;

  -- Idempotent end-state grant, mirroring assign_configured_super_admin()
  -- (covers the case where the profile link already existed, so neither an
  -- INSERT nor an UPDATE fired the 0009 trigger in this run).
  INSERT INTO public.admin_users (profile_id, display_name, role_id, assigned_by, assigned_at)
  SELECT p.id,
         COALESCE(NULLIF(p.full_name, ''), v_admin_email),
         'super_admin',
         'system:verified-admin-email',
         now()
    FROM public.profiles AS p
   WHERE p.id = v_profile_id
     AND lower(trim(p.email)) = v_admin_email
     AND p.supabase_user_id = v_user_id
     AND p.status = 'active'
     AND EXISTS (
       SELECT 1 FROM auth.users AS u
        WHERE u.id = v_user_id
          AND lower(trim(u.email)) = v_admin_email
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
       AND lower(trim(p.email)) = v_admin_email
       AND a.role_id = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'ADMIN_PROVISIONING_INCOMPLETE: role grant did not land';
  END IF;

  RAISE NOTICE 'super admin provisioned: % (profile %)', v_admin_email, v_profile_id;
END
$provision$;

INSERT INTO public.schema_migrations (version)
VALUES ('0016_provision_super_admin_gospelu214')
ON CONFLICT (version) DO NOTHING;

COMMIT;
