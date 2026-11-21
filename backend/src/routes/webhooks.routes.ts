/**
 * Clerk lifecycle webhooks (svix-signed).
 * user.created / user.updated / user.deleted keep Supabase profiles in sync.
 * Deletion ANONYMIZES the profile (PII cleared) while financial records are
 * retained under the pseudonymized id — no auto-erasure of audit trails.
 */
import { Router } from 'express';
import type { Request } from 'express';
import { Webhook } from 'svix';
import { env } from '../config/env';
import { getServiceClient } from '../services/supabase.service';
import { logger } from '../utils/logger';

export const clerkWebhookRouter = Router();

interface ClerkEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: { email_address: string }[];
    primary_email_address?: { email_address: string } | null;
    first_name?: string | null;
    last_name?: string | null;
    phone_numbers?: { phone_number: string }[];
    primary_phone_number?: { phone_number: string } | null;
    public_metadata?: Record<string, unknown>;
    unsafe_metadata?: Record<string, unknown>;
  };
}

clerkWebhookRouter.post('/clerk', (req: Request, res) => {
  void (async () => {
    const raw = (req as Request & { rawBody?: string }).rawBody ?? '';
    const headers = {
      'svix-id': String(req.headers['svix-id'] ?? ''),
      'svix-timestamp': String(req.headers['svix-timestamp'] ?? ''),
      'svix-signature': String(req.headers['svix-signature'] ?? ''),
    };

    let event: ClerkEvent;
    try {
      const wh = new Webhook(env.clerk.webhookSigningSecret || 'unset');
      event = wh.verify(raw, headers) as ClerkEvent;
    } catch (err) {
      logger.warn({ err: String(err) }, 'clerk webhook signature invalid');
      res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Invalid signature' });
      return;
    }

    try {
      const db = getServiceClient();
      const d = event.data;
      const email =
        d.primary_email_address?.email_address ?? d.email_addresses?.[0]?.email_address ?? '';
      const fullName = [d.first_name, d.last_name].filter(Boolean).join(' ').trim();
      const phone = d.primary_phone_number?.phone_number ?? d.phone_numbers?.[0]?.phone_number ?? '';

      switch (event.type) {
        case 'user.created': {
          const country = String((d.public_metadata?.country as string | undefined) ?? '');
          const { error } = await db.rpc('bootstrap_profile', {
            p_user_id: d.id,
            p_email: email,
            p_full_name: fullName,
            p_phone: phone,
            p_country: country,
          });
          if (error) throw new Error(error.message);
          logger.info({ userId: d.id }, 'clerk user.created -> profile bootstrapped');
          break;
        }
        case 'user.updated': {
          const { error } = await db
            .from('profiles')
            .update({
              email,
              full_name: fullName,
              first_name: d.first_name ?? '',
              last_name: d.last_name ?? '',
              ...(phone ? { phone } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq('id', d.id);
          if (error) throw new Error(error.message);
          logger.info({ userId: d.id }, 'clerk user.updated -> profile synced');
          break;
        }
        case 'user.deleted': {
          // Retain financial records; clear PII (GDPR erasure of personal
          // data while preserving legally required audit records).
          const { error } = await db.rpc('anonymize_profile', { p_profile_id: d.id });
          if (error) throw new Error(error.message);
          await db.from('audit_logs').insert({
            actor_id: `webhook:clerk`,
            action: 'user.deleted',
            target_type: 'profile',
            target_id: d.id,
            result: 'allowed',
            detail: { note: 'profile anonymized; financial records retained' },
          });
          logger.info({ userId: d.id }, 'clerk user.deleted -> profile anonymized');
          break;
        }
        default:
          logger.debug({ type: event.type }, 'clerk webhook ignored');
      }
      res.json({ success: true, message: 'Webhook processed', data: null, meta: {} });
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'clerk webhook processing failed');
      res.status(500).json({ success: false, code: 'INTERNAL', message: 'Processing failed' });
    }
  })();
});
