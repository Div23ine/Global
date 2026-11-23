# ARCHITECTURE — Meridian Global Accounts

Status: Supabase Auth migration prepared on fix/worker-http-server-compat; typecheck,
integration tests, browser tests, migration rehearsal and live verification pending.

## 1. System overview

```text
Cloudflare Pages (static frontend)          Cloudflare Worker (Express API)
  index.html / app.html / admin.html  --->  /api/v1/*
  React 18 + Babel Standalone                - Supabase Auth token validation
  Supabase JS browser client                 - canonical profile mapping
              |                              - server-side admin permissions
              | Bearer Supabase Auth JWT     - Supabase service/user-scoped access
              v                              - signed payment-provider webhooks
       Supabase Auth + PostgreSQL (RLS)       Resend email
```

| Decision | Choice | Rationale |
|---|---|---|
| Frontend | React 18 via CDN + Babel Standalone | Static deployment and preservation of the approved Design 02 experience. |
| Backend | Express 5 + TypeScript on Cloudflare Workers | One typed API surface and Cloudflare-native hosting. |
| Database | Supabase PostgreSQL | Managed relational database, migrations, RLS and transactional money functions. |
| Authentication | Supabase Auth | Email/password registration and sign-in, email confirmation, password recovery, password updates and Auth user administration. |
| Auth-to-data link | Supabase Auth UUID → profiles.supabase_user_id → canonical profiles.id | Preserves existing financial foreign keys while allowing RLS to use auth.uid(). |
| Notifications | Resend email | Supabase Auth SMTP handles verification/recovery mail separately from platform notifications. SMS delivery was removed together with the Twilio integration. |
| Admin | React SPA with API-enforced role checks | UI gating is cosmetic; every privileged endpoint checks the profile role and permissions on the server. |

## 2. Frontend architecture

```text
frontend/
  app.html / admin.html
  js/config.js                 API_BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY
  js/services/supabase-auth.js Supabase JS client, state, token, sign-in/up
  js/services/http.js          bearer token, refresh, API envelope/errors
  js/services/api.js           customer and admin API clients
  js/app/                      customer views
  js/admin/                    administrator views
```

The Supabase browser SDK is loaded before supabase-auth.js. Browser configuration
contains only the Supabase project URL and anon/publishable key. The service-role
key is backend-only and must never be placed in HTML, JavaScript, or public Pages
configuration.

Customer and administrator sign-in use Supabase Auth email/password. Registration
requires email confirmation. Password recovery and password changes use Supabase
Auth. The API client obtains the current access token from Supabase Auth and sends
it as an Authorization: Bearer token.

Session controls support local sign-out, sign-out of other sessions, and global
sign-out. A detailed device/session inventory and per-session revocation screen
are not implemented. MFA enrollment and challenge screens are not implemented
and must not be represented as enabled in Meridian.

Without API_BASE_URL, SUPABASE_URL or SUPABASE_ANON_KEY, the app displays an
explicit configuration screen; it never falls back to simulated account data.

## 3. Backend authentication and authorization

Each protected API request follows this sequence:

1. Read the Authorization Bearer access token.
2. Call Supabase Auth getUser(accessToken) so the token is checked by the Auth
   service; do not authorize from locally decoded JWT claims alone.
3. Resolve the Auth UUID against profiles.supabase_user_id. If no mapping exists,
   call the service-role-only bootstrap_supabase_profile(uuid) RPC.
4. Require a confirmed email at bootstrap and require the linked profile to have
   status = active on every request.
5. Attach the canonical profiles.id, Supabase Auth UUID, verified email and
   verified JWT to the Express request context.
6. For admin routes, resolve admin_users.profile_id and the associated
   admin_roles.permissions on the server. Deny by default.

The verified Supabase JWT is forwarded by the user-scoped Supabase client, so
PostgreSQL RLS applies to customer-facing reads. The service-role client is
confined to backend code and privileged operations after code-level
authorization.

## 4. Identity mapping and legacy customer continuity

- auth.users.id is the Supabase Auth UUID.
- profiles.supabase_user_id is a unique nullable FK to auth.users(id).
- profiles.id remains the canonical Meridian profile key. Existing values
  are preserved exactly; new profiles use the Supabase Auth UUID as text.
- Migration 0007_supabase_auth.sql links an Auth user to an unlinked legacy
  profile only when the Auth email is confirmed and matches the profile email.
- A link does not change profiles.id or any account, transaction, deposit,
  statement, notification, support, security-event or audit ownership key.
- If there is no legacy profile, the service-only bootstrap RPC creates a new
  profile and its zero-balance default-currency account.
- admin_users.profile_id identifies the canonical Meridian profile, not the
  provider-specific Auth UUID.
- public.app_current_user_id() maps auth.uid() to an active canonical profile
  ID. Existing RLS policies call this helper.
- Deletion removes the Auth identity, clears the mapping, anonymizes profile
  PII and retains financial records attached to the canonical profile.

Clerk passwords are not imported. Existing customers must establish and confirm
a Supabase Auth identity using the same verified email address so that the
backend can link it to their existing Meridian profile. Accounts with changed,
duplicated or inaccessible email addresses need a controlled support recovery
process; they must not be linked by an unverified email or by a browser-supplied
profile ID.

## 5. Domain invariants

1. Meridian is a platform account product, not a bank. Real money movement
   requires an appropriately licensed financial partner.
2. Money uses numeric(19,4); balances are derived from posted ledger entries.
3. Deposits never auto-succeed. Only a signed provider webhook may complete
   a deposit and post its ledger transaction.
4. Audit logs are append-only and written through the service-role backend.
5. Profile status is checked on every authenticated API request, so suspensions,
   bans and deletions block requests even while an access JWT remains unexpired.
6. Admin authorization is checked server-side on every privileged request.

## 6. Deployment and external requirements

- Frontend: Cloudflare Pages, static directory frontend/.
- Backend: Cloudflare Worker named global, configured from backend/wrangler.toml.
- Database and identity: Supabase PostgreSQL and Supabase Auth.
- Worker secrets: SUPABASE_URL, SUPABASE_ANON_KEY and
  SUPABASE_SERVICE_ROLE_KEY. Optional Resend and payment secrets are
  configured only when those integrations are enabled.
- Frontend public config: API_BASE_URL, SUPABASE_URL and SUPABASE_ANON_KEY.
- Auth email confirmation and password-recovery SMTP are configured in Supabase
  Auth; Resend remains for Meridian platform notification messages.
- Migration 0007 must be rehearsed against a production-like backup and reviewed
  before production application because it changes the admin identity column and
  installs the Supabase Auth profile link.
- Supabase Auth MFA UI, detailed session inventory, live email delivery,
  production migration rehearsal and live deployment verification remain open.

See SECURITY_REVIEW.md, DATABASE_DESIGN.md and DEPLOYMENT_GUIDE.md.