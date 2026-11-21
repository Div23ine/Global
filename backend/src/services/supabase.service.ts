/**
 * Supabase access layer.
 *
 * Two clients:
 *  - service client: service-role key, bypasses RLS. Used ONLY by the backend
 *    after code-level authorization. All money mutations go through this
 *    client and the SQL functions in migration 0004.
 *  - user client: anon key + the caller's Clerk JWT forwarded as the
 *    Authorization header, so PostgREST evaluates the RLS policies from
 *    migration 0003 (defense in depth for customer reads).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, supabaseConfigured } from '../config/env';
import { notConfigured } from '../utils/httpError';

export interface DbRow {
  [key: string]: unknown;
}

let serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!supabaseConfigured()) throw notConfigured('Supabase');
  if (!serviceClient) {
    serviceClient = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

/** Per-request client bound to the caller's Clerk JWT (RLS enforced). */
export function getUserClient(clerkJwt: string): SupabaseClient {
  if (!supabaseConfigured()) throw notConfigured('Supabase');
  return createClient(env.supabase.url, env.supabase.anonKey, {
    global: { headers: { Authorization: `Bearer ${clerkJwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Test seam: replace the singleton (integration tests inject a fake). */
export function setServiceClientForTests(client: SupabaseClient | null): void {
  serviceClient = client;
}

/**
 * Execute a read through the user-scoped client with a service-role fallback
 * for fields RLS deliberately hides. Used by customer GET endpoints.
 */
export async function userRead<T extends DbRow>(
  clerkJwt: string,
  table: string,
  query: (c: SupabaseClient) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const client = getUserClient(clerkJwt);
  const { data, error } = await query(client);
  if (error) throw new Error(`Supabase read failed on ${table}: ${error.message}`);
  return data ?? [];
}
