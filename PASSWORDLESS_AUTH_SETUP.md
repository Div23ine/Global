# Meridian passwordless email authentication

Meridian uses separate customer and administrator authentication flows. Customer registration stores a password but verifies email and phone ownership; customer login uses an email magic link followed by a second email OTP. Admin login uses an email magic link only. Password sign-in, customer/admin self-registration for admins, and password-recovery screens are not part of these login flows.

## Supabase dashboard configuration

In the Meridian Supabase project (`mcblvbjhfckjwfsqqknv`):

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to `https://meridian.uk.com`.
3. Add `https://meridian.uk.com/**` to the redirect URL allow list. Add any other production hostname only if it is actually used by the deployment.
4. Open **Authentication → Email Templates**.

Update both templates below. Supabase's `{{ .ConfirmationURL }}` creates the clickable magic link and `{{ .Token }}` provides the six-digit code that the Meridian screens accept.

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

### Customer sign-in (magic link then OTP)

Subject: `Your Meridian sign-in code`

```html
<h2>Sign in to Meridian Global Accounts</h2>
<p>Use the secure link below to sign in:</p>
<p><a href="{{ .ConfirmationURL }}">Sign in to Meridian</a></p>
<p>Or enter this one-time code in the sign-in screen:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>This code and link are single-use. If you did not request them, ignore this email.</p>
```

5. Save the templates. In **Authentication → Providers → Email**, ensure email signups/confirmations are enabled. Use a verified custom SMTP provider before public launch for reliable delivery.\n6. In **Authentication → Providers → Phone**, enable phone authentication and configure the Supabase project's SMS provider (Twilio credentials and message template). The backend's transactional SMS settings do not configure Supabase Auth phone OTP.

## Initial administrator

The configured initial administrator is `raysallinone00@gmail.com`. Migration `0009_configure_super_admin_email` stores this address in `platform.admin_email` and installs a database trigger.

The first time this exact address completes email verification and the backend bootstraps its Meridian profile, the trigger grants the `super_admin` role. No admin privilege is granted merely because someone types the address into a form. Supabase Auth must confirm ownership of the email.

## Sign-in behavior

- Customer app: enter an email address, then either open the emailed magic link or enter the emailed OTP.
- Admin console: same passwordless flow; the configured administrator email is prefilled. The backend still checks the database role and permissions for every admin request.
- New customer registration: collect profile details, then confirm using the magic link or OTP.
- OTP verification uses Supabase `verifyOtp({ email, token, type: 'email' })`.

## Important

The database migration and frontend code are committed to the `development` branch. The Supabase hosted email templates and URL allow list are project-level Auth settings and are not changed by SQL migrations. Configure those dashboard settings before testing production email delivery.
