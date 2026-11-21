/**
 * Twilio SMS — transactional notifications only.
 * OTP / phone verification for authentication is owned by Supabase Auth (which is
 * configured with Twilio itself); this service never sends verification
 * codes, so no code ever appears in logs or payloads.
 *
 * Guardrails: recipient allowlist (dev), hourly cap, retry with backoff,
 * delivery logging with the message body redacted.
 */
import Twilio from 'twilio';
import { env } from '../config/env';
import { notConfigured } from '../utils/httpError';
import { logger } from '../utils/logger';

type TwilioClient = ReturnType<typeof Twilio>;

export interface SmsResult {
  to: string;
  sid: string | null;
  status: 'sent' | 'failed' | 'skipped';
}

export interface SmsClient {
  send(to: string, body: string): Promise<SmsResult>;
}

const sentTimestamps: number[] = [];

function hourlyBudgetAvailable(): boolean {
  const now = Date.now();
  while (sentTimestamps.length > 0 && now - sentTimestamps[0] > 3_600_000) {
    sentTimestamps.shift();
  }
  return sentTimestamps.length < env.twilio.smsPerHour;
}

class TwilioSmsClient implements SmsClient {
  private client: TwilioClient | null = null;

  private twilio(): TwilioClient {
    if (!env.twilio.accountSid || !env.twilio.authToken || !env.twilio.fromNumber) {
      throw notConfigured('Twilio');
    }
    if (!this.client) {
      this.client = Twilio(env.twilio.accountSid, env.twilio.authToken);
    }
    return this.client;
  }

  async send(to: string, body: string): Promise<SmsResult> {
    if (!/^\+[1-9]\d{6,14}$/.test(to)) {
      return { to, sid: null, status: 'skipped' };
    }
    if (env.twilio.allowedRecipients.length > 0 && !env.twilio.allowedRecipients.includes(to)) {
      return { to, sid: null, status: 'skipped' };
    }
    if (!hourlyBudgetAvailable()) {
      logger.warn({ to: '[redacted]' }, 'SMS hourly budget exhausted — skipped');
      return { to, sid: null, status: 'skipped' };
    }
    const client = this.twilio();
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const msg = await client.messages.create({ to, from: env.twilio.fromNumber, body });
        sentTimestamps.push(Date.now());
        logger.info({ to: '[redacted]', sid: msg.sid }, 'SMS delivered to provider');
        return { to, sid: msg.sid, status: 'sent' };
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));
      }
    }
    logger.error({ err: String(lastError) }, 'SMS delivery failed after retries');
    return { to, sid: null, status: 'failed' };
  }
}

let smsClient: SmsClient | null = null;

/** Test seam. */
export function setSmsClientForTests(c: SmsClient | null): void {
  smsClient = c;
}

export function sms(): SmsClient {
  return smsClient ?? new TwilioSmsClient();
}
