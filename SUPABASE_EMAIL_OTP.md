# Meridian email OTP — customers and administrators

Meridian customer and administrator sign-in use six-digit email one-time passwords (OTPs), not magic links.

Supabase's `signInWithOtp()` method uses the **Magic Link or OTP** email template. Although the method is named "OTP", Supabase sends a magic link when that template contains `{{ .ConfirmationURL }}`. To deliver a numeric code, the template must display `{{ .Token }}`.

## Required Supabase Dashboard configuration

Open **Authentication → Email Templates → Magic Link** (also called **Magic Link or OTP**).

**Subject:** `Your Meridian sign-in code`

**Body:**
```html
<h2>Your Meridian sign-in code</h2>
<p>Enter this six-digit one-time code in Meridian Global Accounts:</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:700">{{ .Token }}</p>
<p>This code expires and can only be used once. If you did not request it, ignore this email.</p>
```

Remove sign-in links or buttons that use `{{ .ConfirmationURL }}`. Save the template.

Also open **Authentication → Email Templates → Confirm sign up** and use `{{ .Token }}` instead of `{{ .ConfirmationURL }}` if that template is used by any signup/confirmation route.

Keep the Email provider enabled. Email confirmation policy should remain enabled as required by the project. Configure verified custom SMTP for production delivery.

## Application behaviour

| Action | Supabase call | Verification |
|---|---|---|
| Customer registration | `signInWithOtp({ shouldCreateUser: true })` | `verifyOtp({ type: 'email' })`, then set the chosen password |
| Customer sign-in | `signInWithOtp({ shouldCreateUser: false })` | `verifyOtp({ type: 'email' })` |
| Administrator sign-in | `signInWithOtp({ shouldCreateUser: false })` | `verifyOtp({ type: 'email' })` |
| Resend code | Repeat the relevant `signInWithOtp()` call | Supabase rate limits apply |

No `emailRedirectTo` is passed for these sign-in requests. The application has no magic-link callback step or magic-link verification fallback. Optional customer TOTP MFA remains a separate second factor after email OTP.

Administrator sign-in uses `shouldCreateUser: false`: the Auth identity must already exist. Successful OTP verification does not grant administrator privileges; the backend checks the linked active profile and role permissions.

## Verify

1. Save the Magic Link / OTP template with `{{ .Token }}`.
2. Request customer sign-in and confirm the email contains a six-digit code, not a sign-in button.
3. Enter the code in the customer app.
4. Repeat from the administrator console using an already-provisioned administrator Auth identity.
5. Verify that invalid/expired codes fail and non-admin users remain blocked from administrator APIs.

If the message still contains a link, the Supabase Magic Link / OTP template has not been changed or saved correctly. Updating frontend code alone cannot change the email body sent by Supabase.
