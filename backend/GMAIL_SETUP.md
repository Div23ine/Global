# Meridian administrator Gmail alerts

Meridian can send request alerts to each administrator's own connected Google mailbox. Each admin connects their account from **Admin → Settings → Gmail request alerts**. When a customer submits a deposit request, reports a payment, opens a support ticket, or requests a refund, Meridian sends the alert to every connected administrator mailbox. The request remains in Meridian for any authorized administrator to process.

## Google Cloud setup

1. In Google Cloud Console, create or select a project and enable the **Gmail API**.
2. Configure the OAuth consent screen. Add the administrators who will test the integration as test users while the app is in testing. Google may require OAuth verification before a public/external app can be used broadly because `gmail.send` is a sensitive scope.
3. Create an OAuth 2.0 **Web application** client.
4. Add this exact Authorized redirect URI:
   `https://YOUR_API_HOST/api/v1/admin/email/gmail/callback`
   Replace `YOUR_API_HOST` with the actual API hostname used by the frontend. It must match `GMAIL_REDIRECT_URI` exactly.
5. Add the following values to the Cloudflare Worker named `global` (Worker Settings → Variables and Secrets):
   - `GMAIL_CLIENT_ID` — Google OAuth client ID (text variable)
   - `GMAIL_CLIENT_SECRET` — Google OAuth client secret (secret)
   - `GMAIL_REDIRECT_URI` — exact callback URL (text variable)
   - `GMAIL_TOKEN_ENCRYPTION_KEY` — base64-encoded 32-byte key (secret)

Generate the encryption key locally with:

```sh
openssl rand -base64 32
```

Never put the client secret, encryption key, or OAuth refresh tokens in frontend code, Git, screenshots, or chat. Save the values directly in Cloudflare and redeploy the Worker after setting them.

## What the integration does

- Uses Google OAuth; Meridian never asks for or stores Gmail passwords.
- Requests only Google identity and Gmail send permissions.
- Encrypts each administrator's refresh token with AES-256-GCM before storing it in Supabase.
- Sends an alert from each connected Gmail account to that same mailbox, so each administrator receives the notification in their own inbox.
- Does not use Resend for these administrator alerts.
- Keeps customer-facing transactional email (for example, sending deposit bank details to a customer) on its existing email delivery path; this integration does not silently change customer email delivery.
- Keeps in-app notifications and the existing admin work queues as the source of truth. Email is an alert, not an approval or financial action.

## Database

Apply `backend/migrations/0020_admin_gmail_notifications.sql` to the Meridian Supabase project before deploying the Worker/frontend changes. The migration creates the per-admin connection table and short-lived, one-time OAuth state table. It grants access only to `service_role`; browser clients cannot read or write OAuth tokens.
