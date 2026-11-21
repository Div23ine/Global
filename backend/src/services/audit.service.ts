/**
 * Append-only audit log. Every administrative action, every denied attempt
 * and every webhook event is recorded. The audit_logs table has no client
 * policies at all (RLS deny-by-default) — this service is the only writer,
 * via the service-role client.
 */
import { getServiceClient, setServiceClientForTests } from './supabase.service';

export type AuditResult = 'allowed' | 'denied';

export interface AuditEntry {
  actorId: string;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  detail?: Record<string, unknown> | null;
  result: AuditResult;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditClient {
  write(entry: AuditEntry): Promise<void>;
}

/** Default implementation: Supabase service-role insert into audit_logs. */
class SupabaseAuditClient implements AuditClient {
  async write(entry: AuditEntry): Promise<void> {
    const db = getServiceClient();
    const { error } = await db.from('audit_logs').insert({
      actor_id: entry.actorId,
      actor_role: entry.actorRole ?? null,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      detail: entry.detail ?? null,
      result: entry.result,
      ip: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
    });
    if (error) {
      // Audit failures are logged but must never break the request path —
      // the caller's outcome is unchanged. (Postgres denies UPDATE/DELETE on
      // audit_logs by design; INSERT failures are surfaced in logs.)
      throw new Error(`audit insert failed: ${error.message}`);
    }
  }
}

let auditClient: AuditClient | null = null;

/** Test seam. */
export function setAuditClientForTests(c: AuditClient | null): void {
  auditClient = c;
}

export async function audit(entry: AuditEntry): Promise<void> {
  const client = auditClient ?? new SupabaseAuditClient();
  try {
    await client.write(entry);
  } catch {
    // Never mask the primary outcome with an audit failure; the structured
    // logger captures the loss for operational follow-up.
    console.error('AUDIT_WRITE_FAILED', entry.action, entry.actorId, entry.result);
  }
}

export async function auditAllowed(
  actorId: string,
  action: string,
  target?: { type?: string; id?: string },
  detail?: Record<string, unknown>,
  ctx?: { role?: string | null; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await audit({
    actorId,
    actorRole: ctx?.role ?? null,
    action,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    detail: detail ?? null,
    result: 'allowed',
    ip: ctx?.ip ?? null,
    userAgent: ctx?.userAgent ?? null,
  });
}

export async function auditDenied(
  actorId: string,
  action: string,
  reason: string,
  target?: { type?: string; id?: string },
  ctx?: { role?: string | null; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  await audit({
    actorId,
    actorRole: ctx?.role ?? null,
    action,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    detail: { reason },
    result: 'denied',
    ip: ctx?.ip ?? null,
    userAgent: ctx?.userAgent ?? null,
  });
}

export { setServiceClientForTests };
