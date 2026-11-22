/**
 * Supabase Auth integration.
 *
 * Access tokens are validated against the Auth service with getUser(); JWT
 * payload decoding alone is not sufficient. Service-role admin operations
 * are server-only and never exposed to the browser.
 */
import { createClient } from '@supabase/supabase-js';
import { env, supabaseConfigured } from '../config/env';
import { getServiceClient } from './supabase.service';
import { notConfigured, notFound } from '../utils/httpError';

export interface SupabaseJwtClaims {
  sub: string;
  email?: string;
}

export interface LinkedAuthProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  supabase_user_id: string;
  status: string;
}

/** Validate an Authorization header using Supabase Auth's user endpoint. */
export async function verifySupabaseAccessToken(headerValue: string): Promise<SupabaseJwtClaims> {
  if (!supabaseConfigured()) throw notConfigured('Supabase Auth');
  const match = /^Bearer\s+([^\s]+)$/i.exec(headerValue);
  if (!match) throw new Error('Missing bearer access token');

  const authClient = createClient(env.supabase.url, env.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(match[1]);
  if (error || !data.user || !data.user.email || !data.user.email_confirmed_at) {
    throw new Error('Invalid token or unverified email');
  }
  // New Meridian registrations require verified email and phone ownership.
  // Existing accounts without an Auth phone remain compatible; once a phone
  // is attached to an Auth identity, it must be confirmed before API access.
  if (data.user.phone && !data.user.phone_confirmed_at) {
    throw new Error('Phone number has not been verified');
  }

  // If the customer enrolled a verified TOTP factor, every protected API
  // request must carry an AAL2 token. The browser UI is not the security
  // boundary; this check prevents bypassing the MFA challenge with AAL1.
  const userWithFactors = data.user as typeof data.user & {
    factors?: Array<{ factor_type?: string; status?: string }>;
  };
  const hasVerifiedTotp = Boolean(
    userWithFactors.factors?.some(
      (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
    ),
  );
  if (hasVerifiedTotp) {
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(match[1]);
    if (claimsError || claimsData?.claims?.aal !== 'aal2') {
      throw new Error('Additional multi-factor verification is required');
    }
  }

  return { sub: data.user.id, email: data.user.email };
}

/** Resolve an active, already-linked Supabase Auth user for admin role assignment. */
export async function getLinkedProfileByEmail(email: string): Promise<LinkedAuthProfile> {
  const db = getServiceClient();
  const normalizedEmail = email.trim().toLowerCase();

  // PostgREST ilike patterns treat '%' and '_' as wildcards. Escape them so
  // a role assignment always targets the literal email the admin supplied.
  const emailPattern = normalizedEmail.replace(/[\\%_]/g, '\\$&');
  const { data, error } = await db
    .from('profiles')
    .select('id, email, first_name, last_name, supabase_user_id, status')
    .ilike('email', emailPattern)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.supabase_user_id || data.status !== 'active') {
    throw notFound('An active Supabase Auth user with this verified email must sign in before a role can be assigned.');
  }

  // Re-check the currently confirmed Auth email; profile email values can be
  // stale after an identity changes its email address.
  const { data: authResult, error: authError } =
    await db.auth.admin.getUserById(data.supabase_user_id);
  if (authError) throw new Error(authError.message);
  const authUser = authResult.user;
  if (
    !authUser?.email ||
    !authUser.email_confirmed_at ||
    authUser.email.trim().toLowerCase() !== normalizedEmail
  ) {
    throw notFound('The Supabase Auth user must have this exact confirmed email before a role can be assigned.');
  }

  return {
    ...data,
    email: authUser.email,
  } as LinkedAuthProfile;
}

/** Apply an Auth ban in addition to the profile-status request guard. */
export async function setSupabaseUserBan(profileId: string, banned: boolean): Promise<void> {
  const db = getServiceClient();
  const { data: profile, error } = await db
    .from('profiles')
    .select('supabase_user_id')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw notFound('User profile not found.');
  if (!profile.supabase_user_id) return;

  const { error: authError } = await db.auth.admin.updateUserById(profile.supabase_user_id, {
    ban_duration: banned ? '876000h' : 'none',
  });
  if (authError) throw new Error(authError.message);
}

/** Delete the linked Auth identity; callers should mark the profile deleted first. */
export async function deleteSupabaseUserForProfile(profileId: string): Promise<void> {
  const db = getServiceClient();
  const { data: profile, error } = await db
    .from('profiles')
    .select('supabase_user_id')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw notFound('User profile not found.');
  if (!profile.supabase_user_id) return;

  const { error: authError } = await db.auth.admin.deleteUser(profile.supabase_user_id);
  if (authError) throw new Error(authError.message);
}
