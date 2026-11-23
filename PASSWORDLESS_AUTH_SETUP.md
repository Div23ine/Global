# Meridian customer and administrator authentication

This branch implements two separate Supabase Auth flows:

- **Customers:** register with profile details and a password, then verify the email address with a one-time code. There is no SMS step — phone delivery was removed together with the Twilio integration. Customer sign-in is an email magic link followed by a second email OTP. Optional TOTP authenticator MFA can be enabled or disabled by the customer.
- **Administrators:** sign in using an email magic link only. There is no admin self-registration, password screen or separate email OTP screen. Server-side role and permission checks remain mandatory.

## Supabase project configuration

In the Meridian Supabase project:

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to `https://meridian.uk.com`.
3. Add `https://meridian.uk.com/**` to the redirect URL allow list. Add other production hostnames only when they are actually used.
4. Open **Authentication → Email Templates**.

### Confirm signup

The signup email must deliver the one-time code, not a confirmation link — the
registration screen only accepts the six-digit code:

Subject: `Your Meridian verification code`

```html
<h2>Welcome to Meridian Global Accounts</h2>
<p>Use this one-time code to verify your email and activate your account:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>The code can only be used once. If you did not request this account, you can ignore this email.</p>
```

Do not include `{{ .ConfirmationURL }}` in this template: a link-only "confirm
your email address" email leaves the customer without the code the app asks
for.

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

## Customer registration

The form collects all of these as separate values:

- Full name
- Email address
- Country
- ISO country code (for example, `NG`)
- Country calling code (for example, `+234`)
- Phone number
- Password and confirmation

The frontend submits the email/password identity and profile metadata (including the contact phone number, kept as profile data) to Supabase. Supabase sends the email signup OTP and the customer enters the six-digit code in Meridian. The account is usable as soon as the email address is verified; no SMS/phone verification step exists anymore.

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

Two email addresses are configured as super administrators: `raysallinone00@gmail.com` and `gospelu214@gmail.com`. Migration `0009_configure_super_admin_email` introduced the configured-email trigger for the first address; migration `0016_provision_super_admin_gospelu214` provisioned `gospelu214@gmail.com` with a confirmed Supabase Auth identity (magic-link capable, no password) and a linked profile; migration `0017_add_second_super_admin_raysallinone00` restores `raysallinone00@gmail.com` as a second configured super administrator, provisions its Auth identity the same way, and re-points the grant trigger at the two-address list (`app_settings.platform.admin_emails`). Each address receives the role only after the exact email is confirmed by Supabase Auth and the backend links the Auth identity to a Meridian profile, so admin sign-in with `shouldCreateUser: false` succeeds immediately after the migrations are applied. Any other previously granted admin keeps their existing `admin_users` row; revoke those through the admin console if the owner wants only the two configured administrators.

## Optional customer MFA

Customers can enable or disable TOTP authenticator MFA under **Account → Security**. It is opt-in, not mandatory for accounts without an enrolled factor. Once enrolled, the customer must complete the authenticator challenge during sign-in. The backend validates AAL2 for enrolled customer factors rather than relying on the frontend alone. Admin accounts retain the magic-link-only flow.

## Required database migration

Before enabling the updated registration flow, apply `backend/migrations/0012_customer_country_details.sql` to the Supabase database (after migrations `0001`–`0011`). It adds `country_name` and `country_calling_code` to customer profiles and updates profile bootstrap so both values are persisted for new registrations and linked legacy profiles. The API deployment does not automatically execute SQL migrations. To provision the configured super administrators, apply `backend/migrations/0016_provision_super_admin_gospelu214.sql` and then `backend/migrations/0017_add_second_super_admin_raysallinone00.sql` after `0001`–`0015` (both are idempotent); alternatively create the same confirmed Auth identities through the Supabase Auth admin API and let the configured-email trigger grant the roles at profile-link time.

## Deployment and verification

The frontend and backend changes are committed to the `development` branch. The Supabase email templates, redirect allow list and Email provider are project-level settings and must be configured in the Supabase dashboard before end-to-end testing. Cloudflare deployment requires a valid Pages API token with the correct project permissions and a successful Worker typecheck.
