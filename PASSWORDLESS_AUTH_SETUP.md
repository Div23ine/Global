# Meridian customer and administrator authentication

This branch implements two separate Supabase Auth flows:

- **Customers:** register with profile details and a password; verify email by OTP, then verify phone by SMS. Customer sign-in is an email magic link followed by a second email OTP. Optional TOTP authenticator MFA can be enabled or disabled by the customer.
- **Administrators:** sign in using an email magic link only. There is no admin self-registration, password screen, separate email OTP screen, or SMS step. Server-side role and permission checks remain mandatory.

## Supabase project configuration

In the Meridian Supabase project:

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to `https://meridian.uk.com`.
3. Add `https://meridian.uk.com/**` to the redirect URL allow list. Add other production hostnames only when they are actually used.
4. Open **Authentication → Email Templates**.

### Confirm signup

Subject: `Confirm your Meridian account`

```html
<h2>Welcome to Meridian Global Accounts</h2>
<p>Confirm your email address using the secure link below:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm email and open Meridian</a></p>
<p>Or enter this one-time code in Meridian:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>If you did not request this account, you can ignore this email.</p>
```

### Magic link or OTP

Subject: `Your Meridian sign-in code`

```html
<h2>Sign in to Meridian Global Accounts</h2>
<p>Use the secure link below to sign in:</p>
<p><a href="{{ .ConfirmationURL }}">Sign in to Meridian</a></p>
<p>Or enter this one-time code in Meridian:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>This code and link are single-use. If you did not request them, ignore this email.</p>
```

5. Save the templates. Under **Authentication → Providers → Email**, enable email signups and confirmations. Use verified custom SMTP before public launch.
6. Under **Authentication → Providers → Phone**, enable phone authentication and configure the Supabase Auth SMS provider (Twilio credentials and message template). The backend's transactional SMS configuration does not configure Supabase Auth phone OTP.

## Customer registration

The form collects all of these as separate values:

- Full name
- Email address
- Country
- ISO country code (for example, `NG`)
- Country calling code (for example, `+234`)
- Phone number
- Password and confirmation

The frontend submits the email/password identity and profile metadata to Supabase. Supabase sends the email signup OTP. After that code is verified, the authenticated session is used to attach the phone number and request the SMS phone-change OTP. The user must verify both channels before the account can use the banking API. The backend rejects an identity whose Auth phone exists but is not confirmed.

**Provider constraint:** Supabase's built-in email signup and phone-change APIs do not dispatch both verification codes in one simultaneous signup request. This implementation verifies email first and SMS second; both are mandatory before protected API access.

## Customer sign-in

1. Customer enters their registered email.
2. Supabase sends a magic link.
3. The customer opens the link; the callback URL marks the customer sign-in flow even if the link opens on another device.
4. Meridian requests a second email OTP and displays the code-entry screen.
5. If the customer has enabled TOTP MFA, Meridian then challenges the authenticator app.
6. The customer enters the required code(s) before the banking app is shown.

## Administrator sign-in

1. Admin enters the authorized email address.
2. Supabase sends an email magic link.
3. Admin opens the link and enters the admin console.

There is no admin signup or OTP entry screen. The backend continues to authorize every admin request against the database role and permission tables; knowing or entering an email address never grants admin access.

The initial configured super-admin email remains managed by migration `0009_configure_super_admin_email`. It receives the role only after the exact email is confirmed by Supabase Auth and the backend links the Auth identity to a Meridian profile.

## Optional customer MFA

Customers can enable or disable TOTP authenticator MFA under **Account → Security**. It is opt-in, not mandatory for accounts without an enrolled factor. Once enrolled, the customer must complete the authenticator challenge during sign-in. The backend validates AAL2 for enrolled customer factors rather than relying on the frontend alone. Admin accounts retain the magic-link-only flow.

## Required database migration

Before enabling the updated registration flow, apply `backend/migrations/0012_customer_country_details.sql` to the Supabase database (after migrations `0001`–`0011`). It adds `country_name` and `country_calling_code` to customer profiles and updates profile bootstrap so both values are persisted for new registrations and linked legacy profiles. The API deployment does not automatically execute SQL migrations.

## Deployment and verification

The frontend and backend changes are committed to the `development` branch. The Supabase email templates, redirect allow list, Email provider and Phone/SMS provider are project-level settings and must be configured in the Supabase dashboard before end-to-end testing. Cloudflare deployment requires a valid Pages API token with the correct project permissions and a successful Worker typecheck.
