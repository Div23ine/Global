# Supabase email OTP (customer registration)

Customer sign-up must send a **numeric one-time code**, not a “Confirm your email address” magic link.

## Dashboard settings

1. **Authentication → Providers → Email**
   - Enable email confirmations.
2. **Authentication → Email Templates → Confirm sign up**
   - Subject: e.g. `Your Meridian verification code`
   - Body must include the OTP token, for example:

```html
<h2>Your Meridian code</h2>
<p>Enter this one-time code to activate your account:</p>
<p style="font-size:24px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
<p>This code expires shortly. If you did not request it, ignore this email.</p>
```

   - Prefer **not** relying on `{{ .ConfirmationURL }}` for customer registration.

3. **Authentication → Rate Limits** — leave email OTP limits at defaults unless abuse appears.

## Application behaviour

- `MG.auth.signUp` registers with email/password and **does not** set `emailRedirectTo`.
- The UI asks for the OTP and calls `verifyOtp` with type `signup` (fallback `email`).
- `MG.auth.resendSignupOtp` resends the signup OTP.
- SMS / Twilio is not used.
