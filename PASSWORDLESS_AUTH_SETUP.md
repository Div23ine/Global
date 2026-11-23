# Meridian customer and administrator authentication

Both customer and administrator passwordless sign-in use **six-digit email OTP codes**. No sign-in flow requires opening a magic link. Customers register with profile details and a password, verify their email by OTP, and may optionally enable TOTP authenticator MFA. Phone numbers are profile/contact data only; SMS verification has been removed.

## Supabase email template configuration

Supabase's `signInWithOtp()` method sends the **Magic Link or OTP** email template. The method name does not guarantee a numeric code: Supabase chooses whether the email contains a link or a code based on the template content. The template must contain `{{ .Token }}` and must not use `{{ .ConfirmationURL }}` as the sign-in action.

In the Supabase Dashboard, open **Authentication → Email Templates → Magic Link** (sometimes labelled **Magic Link or OTP**).

**Subject:** `Your Meridian sign-in code`

**Body:**
```html
<h2>Your Meridian sign-in code</h2>
<p>Enter this six-digit one-time code in Meridian Global Accounts:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>This code expires and can only be used once. If you did not request it, ignore this email.</p>
```

Remove any sign-in button or link using `{{ .ConfirmationURL }}`. Save the template.

Also configure **Authentication → Email Templates → Confirm sign up** to use `{{ .Token }}` (not `{{ .ConfirmationURL }}`) for any signup/confirmation path that uses that template:

```html
<h2>Welcome to Meridian Global Accounts</h2>
<p>Enter this six-digit code to verify your email:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p>
<p>If you did not request this account, ignore this email.</p>
```

Keep the Email provider enabled and email confirmation enabled as required by the project's account policy. Configure verified custom SMTP before public launch.

## Customer registration

The registration form collects full name, email address, country, ISO country code, country calling code, phone number, password and password confirmation. The phone number is saved as profile/contact data, not used as an authentication factor.

The frontend calls `signInWithOtp({ shouldCreateUser: true })`, asks the customer for the six-digit email code, verifies it with `verifyOtp({ type: 'email' })`, and then sets the password chosen during registration. Resend requests another email OTP. The user does not open a link.

## Customer sign-in

1. Customer enters their registered email.
2. Meridian calls `signInWithOtp({ shouldCreateUser: false })`.
3. Supabase sends the six-digit code using the Magic Link or OTP template.
4. Customer enters the code in Meridian; the client verifies it using `verifyOtp({ type: 'email' })`.
5. If the customer has enrolled TOTP MFA, Meridian then challenges the authenticator app before showing the account.

## Administrator sign-in

1. Administrator enters an authorized email address in the admin console.
2. Meridian calls `signInWithOtp({ shouldCreateUser: false })`.
3. Supabase sends the same six-digit email OTP template.
4. Administrator enters the code; Meridian verifies it using `verifyOtp({ type: 'email' })`.
5. The backend independently checks the linked profile, active status, administrator role and permissions before the console is shown.

There is no administrator self-registration, password form or magic-link fallback. Requesting an OTP never grants an administrative role. The Auth identity must already exist and be eligible to sign in; `shouldCreateUser: false` deliberately prevents creating an identity during administrator login.

Two addresses are configured in the platform super-admin allowlist: `raysallinone00@gmail.com` and `gospelu214@gmail.com`. Their database role configuration is separate from Supabase Auth identity creation and email-template configuration. Each administrator still needs a genuine Supabase Auth identity linked to an active Meridian profile. The configured-email trigger grants the role only when its confirmed-email and profile-link conditions are met.

## Optional customer MFA

Customers may enable or disable TOTP authenticator MFA under **Account → Security**. It is opt-in. Once enrolled, the customer must complete the authenticator challenge after email OTP. The backend enforces the required assurance level for enrolled customer factors rather than relying on the frontend alone. Administrator authorization remains enforced server-side on every protected request.

## Verification checklist

- Magic Link / OTP template contains `{{ .Token }}` and no `{{ .ConfirmationURL }}` sign-in link.
- Confirm sign up template is OTP-based where that template is used.
- Customer login sends one code and accepts the code without opening a link.
- Administrator login sends one code and accepts the code without opening a link.
- Invalid, expired and previously used codes are rejected.
- Resend is subject to Supabase Auth rate limits.
- An authenticated non-admin is denied access to admin APIs; an OTP alone never grants admin permissions.

## Deployment notes

Frontend changes are made on the `development` branch. Email templates are project-level Supabase Auth configuration and must be saved in the Supabase Dashboard (or applied through an authorized Supabase Management API session) separately from Git commits. After the template is updated, deploy the frontend and run the live customer/admin OTP journeys against the target project.
