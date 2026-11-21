# Deployment Guide — Meridian Global Accounts

## Target architecture

| Layer | Platform |
|---|---|
| Frontend | Cloudflare Pages, static frontend/ directory |
| Backend API | Cloudflare Workers, Worker name global |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Email | Supabase Auth SMTP for confirmation/recovery; Resend for platform notifications |
| SMS | Twilio for transactional notifications only |

Clerk and the Oracle VM are not part of the target architecture.

## 1. Supabase project and database

1. Create or select the production Supabase project and configure backups/PITR
   appropriate to the project plan.
2. Before changing production, take a database backup and rehearse all
   migrations in a non-production project or a restored production snapshot.
3. Apply migrations in order: 0001 through 0007.
4. Confirm schema_migrations includes 0007_supabase_auth.
5. Confirm profiles.supabase_user_id exists and admin_users.profile_id
   references the existing canonical Meridian profile IDs.
6. Confirm the seeded currencies and receiving-bank data remain present.

Migration 0007 adds a unique nullable link from profiles.supabase_user_id to
auth.users(id), replaces the admin_users Clerk identity column with profile_id,
updates app_current_user_id() for Supabase Auth RLS and adds a service-role-only
bootstrap RPC. The RPC links an Auth user to an existing, unlinked profile only
when its email is confirmed. It preserves the legacy profiles.id value and all
financial foreign keys. New users get a profile and a zero-balance default
currency account.

Before production migration, check that every existing admin holder maps to a
profile. On the pre-migration schema, run:

```sql
SELECT au.clerk_user_id
FROM public.admin_users AS au
LEFT JOIN public.profiles AS p ON p.id = au.clerk_user_id
WHERE p.id IS NULL;
```

Resolve any returned admin identities before applying 0007. Review the
admin_users role list and expected admin holders after the migration.

## 2. Supabase Auth configuration

1. In Authentication → Providers, enable Email and password.
2. Require email confirmation for new registrations. Meridian refuses to
   create or link a profile until Supabase Auth confirms the email.
3. Configure SMTP in Supabase Auth for confirmation and password-reset email.
   This is separate from the Resend API integration used for platform
   notification messages.
4. In Authentication → URL Configuration, add the exact deployed Pages origin
   and redirect URLs for app.html and admin.html. Add approved preview origins
   used for testing. Do not use a broad wildcard in production.
5. Obtain the project URL and anon/publishable key for the browser and Worker.
   Obtain the service-role key for the Worker only.

### Existing Clerk customers

Clerk passwords are not imported. An existing customer must create and confirm
a Supabase Auth identity using the same email address as their existing Meridian
profile. On their first authenticated API request, the backend verifies the
Supabase identity and the database bootstrap RPC links it to the existing
profile by confirmed email. The original profile ID, account IDs and financial
history are retained.

If a customer no longer controls the old email, has a changed email, or has a
duplicate/ambiguous profile, do not link by an unverified email or a browser
supplied profile ID. Use a controlled support identity-recovery procedure.

## 3. Backend — Cloudflare Workers

From the backend directory, install and run checks before deploying:

```bash
cd backend
npm ci
npm run typecheck
npm run lint
npm test

npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Configure optional integrations only when they are enabled:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM_EMAIL
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_FROM_NUMBER
npx wrangler secret put PAYMENT_WEBHOOK_SECRET
```

Clerk secrets and Svix webhook secrets are no longer required by the active
backend. Never place SUPABASE_SERVICE_ROLE_KEY in frontend code, HTML, a public
Pages variable, or a GitHub source file.

Set CORS_ORIGIN in backend/wrangler.toml to the exact deployed frontend origin
or comma-separated list of origins. Confirm the Cloudflare rate-limit bindings
are configured for the Worker.

The Worker entry point uses node:http.createServer() through
cloudflare:node/httpServerHandler. Keep both nodejs_compat and
enable_nodejs_http_server_modules in compatibility_flags. The latter is part
of the pending Worker 1101 fix on the current feature branch.

After review and explicit deployment approval:

```bash
npm run cf:dev
# Verify the API locally
npm run cf:deploy
```

The configured API base is:

```text
https://global.primeage.workers.dev/api/v1
```

## 4. Frontend — Cloudflare Pages

The frontend is static. Cloudflare Pages environment variables are not
automatically injected into classic browser scripts. Before js/config.js
loads in both app.html and admin.html, inject the public values, for example:

```html
<script>
  window.MG_API_BASE_URL = 'https://global.primeage.workers.dev/api/v1';
  window.MG_SUPABASE_URL = 'https://<project-ref>.supabase.co';
  window.MG_SUPABASE_ANON_KEY = '<public-anon-or-publishable-key>';
</script>
<script src="js/config.js"></script>
```

Alternatively, use a controlled build-time injection step to provide these
values. The Supabase anon/publishable key is intended for browser use and relies
on RLS; the service-role key is never a browser value.

Cloudflare Pages settings:

- Root directory: repository root
- Build command: none (unless you add a config injection step)
- Output directory: frontend

## 5. CORS and API health check

Set CORS_ORIGIN to the exact Pages URL, for example:

```text
CORS_ORIGIN=https://<your-pages-host>.pages.dev
```

Then check:

```bash
curl -i https://global.primeage.workers.dev/api/v1/health
```

A 200 response confirms the Worker handles the health request. It does not,
by itself, prove authenticated API access, RLS isolation, SMTP delivery, SMS
delivery or payment-provider callbacks. Test with real test users: signup,
email confirmation, login, profile bootstrap, customer-owned reads, denied
cross-customer reads, admin role checks and password recovery.

## 6. Resend and Twilio

Resend sends platform notifications such as assigned bank details and deposit
or refund status. Configure and verify the sending domain, then add
RESEND_API_KEY and RESEND_FROM_EMAIL as Worker secrets.

Supabase Auth confirmation and password-reset emails use the SMTP provider
configured in the Supabase Auth settings; they do not automatically use the
Resend API integration.

Twilio is optional for transactional SMS. It is not used as an Auth OTP provider
in the current email/password design.

## 7. Rollback and explicit authorization

Worker rollback: use Cloudflare deployment history or Wrangler rollback after
checking data compatibility. Pages rollback: promote a prior Pages deployment.

Migration 0007 is forward-only. Do not reverse it by manually renaming columns
or clearing user-profile links after customers have authenticated. Prepare a
tested forward repair or restore from the approved backup.

Do not merge/deploy the Worker changes, alter production Pages settings, or
apply migration 0007 to production without explicit owner authorization. Use
a preview environment and complete the test gates first.