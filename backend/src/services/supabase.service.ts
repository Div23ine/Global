/**
 * Supabase access layer.
 *
 * - service client: service-role key, bypasses RLS. Used only by backend code
 *   after code-level authorization; money mutations use the database RPCs.
 * - user client: anon key plus the verified caller's Supabase Auth JWT, so
 *   PostgREST evaluates the ownership RLS policies in migration 0003/0007.
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

/** Per-request client bound to the caller's verified Supabase Auth JWT. */
export function getUserClient(supabaseJwt: string): SupabaseClient {
  if (!supabaseConfigured()) throw notConfigured('Supabase');
  return createClient(env.supabase.url, env.supabase.anonKey, {
    global: { headers: { Authorization: `Bearer ${supabaseJwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Test seam: replace the singleton (integration tests inject a fake). */
export function setServiceClientForTests(client: SupabaseClient | null): void {
  serviceClient = client;
}

/** Execute a read through the RLS-scoped user client. */
export async function userRead<T extends DbRow>(
  supabaseJwt: string,
  table: string,
  query: (client: SupabaseClient) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const client = getUserClient(supabaseJwt);
  const { data, error } = await query(client);
  if (error) throw new Error(`Supabase read failed on ${table}: ${error.message}`);
  return data ?? [];
}
