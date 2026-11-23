# Supabase must send OTP codes (not magic links)

The app uses **email OTP only** for customer sign-up and sign-in.  
Supabase still **generates both** a token and a link; **what the customer sees is controlled only by your email templates**.

If the inbox still shows “Confirm your email” with a button/link, the template still uses `{{ .ConfirmationURL }}` and not `{{ .Token }}`.

---

## Required dashboard changes (do these now)

### 1. Authentication → Providers → Email
- Email provider **enabled**
- **Confirm email** can stay ON

### 2. Authentication → Email Templates → **Magic Link**
This template is used by `signInWithOtp` (login **and** OTP registration).

**Subject:** `Your Meridian one-time code`

**Body (example):**
```html
<h2>Your Meridian code</h2>
<p>Enter this one-time code in the app:</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:700">{{ .Token }}</p>
<p>This code expires in about an hour. If you did not request it, ignore this email.</p>
```

**Remove** (or do not rely on) any button that uses `{{ .ConfirmationURL }}`.

### 3. Authentication → Email Templates → **Confirm sign up**
Same OTP body with `{{ .Token }}` only (no confirm button).

### 4. Save templates and retry registration

---

## App behaviour (after this fix)

| Action | API |
|--------|-----|
| Register | `signInWithOtp({ shouldCreateUser: true })` → enter OTP → set password |
| Sign in | `signInWithOtp({ shouldCreateUser: false })` → enter OTP |
| Resend | same `signInWithOtp` again |

No `emailRedirectTo` is passed, so the product flow never depends on opening a link.

---

## Verify

1. Register a new address.
2. Open the email — you must see a **6-digit code**, not a “Confirm your email” button.
3. Enter the code in the app.

If the email still has only a link, the Magic Link template was not saved with `{{ .Token }}`.
