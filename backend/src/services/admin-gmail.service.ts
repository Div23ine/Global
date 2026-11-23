/**
 * Per-administrator Gmail integration for internal request alerts.
 * OAuth refresh tokens are encrypted at rest with AES-256-GCM. The app only
 * requests gmail.send + email identity scopes and never stores Gmail passwords.
 */
import { env } from '../config/env';
import { getServiceClient } from './supabase.service';
import { logger } from '../utils/logger';

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';

function configured(): boolean {
  return Boolean(env.gmail.clientId && env.gmail.clientSecret &&
    env.gmail.redirectUri && env.gmail.tokenEncryptionKey);
}
function b64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
function unb64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function base64Url(value: string): string {
  return b64(new TextEncoder().encode(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function sha256(value: string): Promise<string> {
  return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
async function encryptionKey(): Promise<CryptoKey> {
  if (!configured()) throw new Error('Gmail integration is not configured.');
  const raw = unb64(env.gmail.tokenEncryptionKey);
  if (raw.byteLength !== 32) throw new Error('GMAIL_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function encryptToken(token: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(),
    new TextEncoder().encode(token));
  return { ciphertext: b64(new Uint8Array(encrypted)), iv: b64(iv) };
}
async function decryptToken(ciphertext: string, iv: string): Promise<string> {
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) },
    await encryptionKey(), unb64(ciphertext));
  return new TextDecoder().decode(decrypted);
}

export async function gmailConnectionStatus(profileId: string) {
  const db = getServiceClient();
  const { data, error } = await db.from('admin_email_connections')
    .select('email, connected_at, last_used_at, last_error')
    .eq('profile_id', profileId).maybeSingle();
  if (error) throw new Error(error.message);
  return {
    configured: configured(),
    connected: Boolean(data),
    email: data?.email ?? null,
    connectedAt: data?.connected_at ?? null,
    lastUsedAt: data?.last_used_at ?? null,
    lastError: data?.last_error ?? null,
  };
}

export async function beginGmailConnection(profileId: string): Promise<string> {
  if (!configured()) throw new Error('Gmail integration is not configured on the Meridian API.');
  const state = base64Url(crypto.randomUUID() + '.' + crypto.randomUUID());
  const stateHash = await sha256(state);
  const db = getServiceClient();
  const { error: cleanupError } = await db.from('admin_gmail_oauth_states')
    .delete().lt('expires_at', new Date().toISOString());
  if (cleanupError) throw new Error(cleanupError.message);
  const { error } = await db.from('admin_gmail_oauth_states').insert({
    state_hash: stateHash,
    profile_id: profileId,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) throw new Error(error.message);

  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set('client_id', env.gmail.clientId);
  url.searchParams.set('redirect_uri', env.gmail.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email ' + GMAIL_SEND_SCOPE + ' ' + EMAIL_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent select_account');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function completeGmailConnection(
  profileId: string, code: string, state: string,
): Promise<{ email: string }> {
  if (!configured()) throw new Error('Gmail integration is not configured on the Meridian API.');
  if (!state || state.length > 500 || !code || code.length > 4096) throw new Error('Invalid Google OAuth callback.');
  const db = getServiceClient();
  const stateHash = await sha256(state);
  const { data: stateRow, error: stateError } = await db.from('admin_gmail_oauth_states')
    .delete().eq('state_hash', stateHash).gt('expires_at', new Date().toISOString())
    .select('profile_id').maybeSingle();
  if (stateError) throw new Error(stateError.message);
  if (!stateRow || stateRow.profile_id !== profileId) throw new Error('Google connection expired or did not match this administrator.');

  const tokenResponse = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: env.gmail.clientId, client_secret: env.gmail.clientSecret,
      redirect_uri: env.gmail.redirectUri, grant_type: 'authorization_code',
    }),
  });
  const token = await tokenResponse.json() as {
    access_token?: string; refresh_token?: string; scope?: string; error?: string;
  };
  if (!tokenResponse.ok || !token.access_token) {
    logger.warn({ status: tokenResponse.status, error: token.error }, 'Google OAuth token exchange failed');
    throw new Error('Google could not complete the Gmail connection. Please try again.');
  }

  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: 'Bearer ' + token.access_token },
  });
  const user = await userResponse.json() as { email?: string; verified_email?: boolean };
  const email = String(user.email ?? '').trim().toLowerCase();
  if (!userResponse.ok || !user.verified_email || !email) {
    throw new Error('Google did not return a verified Gmail account address.');
  }

  let refreshToken = token.refresh_token;
  if (!refreshToken) {
    const { data: existing } = await db.from('admin_email_connections')
      .select('refresh_token_ciphertext, refresh_token_iv')
      .eq('profile_id', profileId).maybeSingle();
    if (existing) refreshToken = await decryptToken(existing.refresh_token_ciphertext, existing.refresh_token_iv);
  }
  if (!refreshToken) throw new Error('Google did not issue an offline refresh token. Disconnect the old connection and try again.');
  const encrypted = await encryptToken(refreshToken);
  const { error } = await db.from('admin_email_connections').upsert({
    profile_id: profileId, email, provider: 'google',
    refresh_token_ciphertext: encrypted.ciphertext, refresh_token_iv: encrypted.iv,
    scopes: String(token.scope ?? '').split(' ').filter(Boolean),
    connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    last_error: null,
  }, { onConflict: 'profile_id' });
  if (error) throw new Error(error.message);
  return { email };
}

export async function disconnectGmail(profileId: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from('admin_email_connections').delete().eq('profile_id', profileId);
  if (error) throw new Error(error.message);
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.gmail.clientId, client_secret: env.gmail.clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
  });
  const body = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error || 'Gmail token refresh failed.');
  return body.access_token;
}

function base64Utf8(value: string): string {
  return b64(new TextEncoder().encode(value));
}
async function sendViaConnection(connection: {
  profile_id: string; email: string; refresh_token_ciphertext: string; refresh_token_iv: string;
}, subject: string, body: string): Promise<void> {
  const refreshToken = await decryptToken(connection.refresh_token_ciphertext, connection.refresh_token_iv);
  const accessToken = await getAccessToken(refreshToken);
  const mime = [
    'To: ' + connection.email,
    'From: Meridian Global Admin Alerts <' + connection.email + '>',
    'Subject: =?UTF-8?B?' + base64Utf8(subject) + '?=',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Utf8(body),
  ].join('\r\n');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: base64Url(mime) }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error('Gmail API returned HTTP ' + response.status + ': ' + detail.slice(0, 300));
  }
  const db = getServiceClient();
  await db.from('admin_email_connections').update({
    last_used_at: new Date().toISOString(), last_error: null,
  }).eq('profile_id', connection.profile_id);
}

/** Best-effort fan-out: all connected, currently authorized Meridian admins receive the same alert. */
export async function notifyAdminsByEmail(input: {
  subject: string; body: string; eventType: string;
}): Promise<void> {
  if (!configured()) return;
  try {
    const db = getServiceClient();
    const [{ data: admins, error: adminError }, { data: connections, error: connectionError }] = await Promise.all([
      db.from('admin_users').select('profile_id'),
      db.from('admin_email_connections').select('profile_id, email, refresh_token_ciphertext, refresh_token_iv'),
    ]);
    if (adminError) throw new Error(adminError.message);
    if (connectionError) throw new Error(connectionError.message);
    const adminIds = new Set((admins ?? []).map((a) => String(a.profile_id)));
    const recipients = (connections ?? []).filter((c) => adminIds.has(String(c.profile_id)));
    const unique = new Map<string, typeof recipients[number]>();
    for (const connection of recipients) unique.set(String(connection.email).toLowerCase(), connection);
    const results = await Promise.allSettled(Array.from(unique.values()).map((connection) =>
      sendViaConnection(connection, input.subject, input.body)));
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed) logger.warn({ eventType: input.eventType, failed, total: results.length }, 'Some administrator Gmail alerts failed');
  } catch (error) {
    logger.warn({ eventType: input.eventType, error: error instanceof Error ? error.message : String(error) },
      'Administrator Gmail alert fan-out failed');
  }
}
