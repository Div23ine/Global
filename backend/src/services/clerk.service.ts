/**
 * Clerk integration — identity system of record.
 * Registration, login, sessions, password recovery, email/phone verification,
 * banning and deletion all happen here. The application never stores
 * passwords and never re-implements credential flows.
 *
 * JWT verification lives in middleware/auth.ts (verifyToken against Clerk
 * JWKS). This service wraps the Backend API for user administration.
 */
import { createClerkClient, verifyToken } from '@clerk/backend';
import { env } from '../config/env';
import { notConfigured } from '../utils/httpError';

export interface ClerkJwtClaims {
  sub: string;
  email?: string;
  [k: string]: unknown;
}

let client: ReturnType<typeof createClerkClient> | null = null;

function clerk(): ReturnType<typeof createClerkClient> {
  if (!env.clerk.secretKey) throw notConfigured('Clerk');
  if (!client) {
    client = createClerkClient({ secretKey: env.clerk.secretKey });
  }
  return client;
}

/** Test seam. */
export function setClerkClientForTests(c: ReturnType<typeof createClerkClient> | null): void {
  client = c;
}

/**
 * Verify a Clerk session JWT and return its claims. Accepts either the raw
 * token or a full "Bearer <token>" header value.
 */
export async function verifySessionToken(headerValue: string): Promise<ClerkJwtClaims> {
  if (!env.clerk.secretKey) throw notConfigured('Clerk');
  const token = headerValue.startsWith('Bearer ') ? headerValue.slice(7) : headerValue;
  const claims = await verifyToken(token, { secretKey: env.clerk.secretKey });
  if (!claims || typeof claims.sub !== 'string' || !claims.sub) {
    throw new Error('Token payload missing sub');
  }
  return claims as ClerkJwtClaims;
}

export interface ClerkUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  banned: boolean;
  publicMetadata: Record<string, unknown>;
}

function mapUser(u: {
  id: string;
  emailAddresses?: { emailAddress: string }[];
  primaryEmailAddress?: { emailAddress: string } | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumbers?: { phoneNumber: string }[];
  primaryPhoneNumber?: { phoneNumber: string } | null;
  banned?: boolean;
  publicMetadata?: Record<string, unknown>;
}): ClerkUser {
  return {
    id: u.id,
    email: u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? '',
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
    phone: u.primaryPhoneNumber?.phoneNumber ?? u.phoneNumbers?.[0]?.phoneNumber ?? null,
    banned: Boolean(u.banned),
    publicMetadata: u.publicMetadata ?? {},
  };
}

export async function getUser(userId: string): Promise<ClerkUser> {
  return mapUser(await clerk().users.getUser(userId));
}

export async function getUserByEmail(email: string): Promise<ClerkUser | null> {
  const list = await clerk().users.getUserList({ emailAddress: [email] });
  const u = list.data?.[0];
  return u ? mapUser(u) : null;
}

export async function banUser(userId: string): Promise<ClerkUser> {
  return mapUser(await clerk().users.banUser(userId));
}

export async function unbanUser(userId: string): Promise<ClerkUser> {
  return mapUser(await clerk().users.unbanUser(userId));
}

export async function deleteUser(userId: string): Promise<void> {
  await clerk().users.deleteUser(userId);
}

export async function listSessions(userId: string): Promise<
  { id: string; lastActiveAt: number | null; status: string; expireAt: number | null }[]
> {
  const res = await clerk().sessions.getSessionList({ userId });
  return res.data.map((s) => ({
    id: s.id,
    lastActiveAt: s.lastActiveAt ?? null,
    status: s.status,
    expireAt: (s as { expireAt?: number | null }).expireAt ?? null,
  }));
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const res = await clerk().sessions.getSessionList({ userId });
  const own = res.data.find((s) => s.id === sessionId);
  if (!own) throw new Error('Session not found for this user');
  await clerk().sessions.revokeSession(sessionId);
}

export async function updatePublicMetadata(
  userId: string,
  metadata: Record<string, unknown>,
): Promise<ClerkUser> {
  return mapUser(await clerk().users.updateUser(userId, { publicMetadata: metadata }));
}
