/**
 * Supabase Auth integration. Tokens are accepted here only inside the API;
 * the browser receives neither access nor refresh credentials.
 */
import { createClient } from '@supabase/supabase-js';
import { env, supabaseConfigured } from '../config/env';
import { getServiceClient } from './supabase.service';
import { notConfigured, notFound } from '../utils/httpError';

export interface SupabaseJwtClaims { sub: string; email?: string; }
export interface VerifySupabaseOptions { enforceAal2?: boolean; }
export interface LinkedAuthProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  supabase_user_id: string;
  status: string;
}

export async function verifySupabaseAccessToken(
  headerValue: string,
  options: VerifySupabaseOptions = {},
): Promise<SupabaseJwtClaims> {
  if (!supabaseConfigured()) throw notConfigured('Supabase Auth');
  const match = /^Bearer\s+([^\s]+)$/i.exec(headerValue);
  if (!match) throw new Error('Missing access token');

  const authClient = createClient(env.supabase.url, env.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await authClient.auth.getUser(match[1]);
  if (error || !data.user || !data.user.email || !data.user.email_confirmed_at) {
    throw new Error('Invalid token or unverified email');
  }

  const db = getServiceClient();
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id')
    .eq('supabase_user_id', data.user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  let isAdmin = false;
  if (profile) {
    const { data: admin, error: adminError } = await db
      .from('admin_users')
      .select('profile_id')
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (adminError) throw new Error(adminError.message);
    isAdmin = Boolean(admin);
  }

  const userWithFactors = data.user as typeof data.user & {
    factors?: Array<{ factor_type?: string; status?: string }>;
  };
  const hasVerifiedTotp = Boolean(userWithFactors.factors?.some(
    (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
  ));

  // AAL1 is allowed only on the private auth/MFA controller while it is
  // completing step-up; all normal protected customer APIs require AAL2.
  if (options.enforceAal2 !== false && hasVerifiedTotp && !isAdmin) {
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(match[1]);
    if (claimsError || claimsData?.claims?.aal !== 'aal2') {
      throw new Error('Additional multi-factor verification is required');
    }
  }
  return { sub: data.user.id, email: data.user.email };
}

export async function getLinkedProfileByEmail(email: string): Promise<LinkedAuthProfile> {
  const db = getServiceClient();
  const normalizedEmail = email.trim().toLowerCase();
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

  const { data: authResult, error: authError } = await db.auth.admin.getUserById(data.supabase_user_id);
  if (authError) throw new Error(authError.message);
  const authUser = authResult.user;
  if (!authUser?.email || !authUser.email_confirmed_at ||
      authUser.email.trim().toLowerCase() !== normalizedEmail) {
    throw notFound('The Supabase Auth user must have this exact confirmed email before a role can be assigned.');
  }
  return { ...data, email: authUser.email } as LinkedAuthProfile;
}

export async function setSupabaseUserBan(profileId: string, banned: boolean): Promise<void> {
  const db = getServiceClient();
  const { data: profile, error } = await db.from('profiles')
    .select('supabase_user_id').eq('id', profileId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw notFound('User profile not found.');
  if (!profile.supabase_user_id) return;
  const { error: authError } = await db.auth.admin.updateUserById(profile.supabase_user_id, {
    ban_duration: banned ? '876000h' : 'none',
  });
  if (authError) throw new Error(authError.message);
}

export async function deleteSupabaseUserForProfile(profileId: string): Promise<void> {
  const db = getServiceClient();
  const { data: profile, error } = await db.from('profiles')
    .select('supabase_user_id').eq('id', profileId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw notFound('User profile not found.');
  if (!profile.supabase_user_id) return;
  const { error: authError } = await db.auth.admin.deleteUser(profile.supabase_user_id);
  if (authError) throw new Error(authError.message);
}
