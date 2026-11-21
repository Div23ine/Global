# PROJECT STATUS — Meridian Global Accounts

Last updated: 2026-11-21 (Supabase Auth migration prepared; deployment pending)

## Current state

Cloudflare-native frontend/API, Supabase PostgreSQL and Supabase Auth. The
Supabase Auth conversion is prepared on branch
feat/supabase-auth-migration and is not merged or deployed. The initial Worker
runtime fix was already merged into development via PR #1; the updated
complete node:http flags are included in this authentication branch.

### Hosting and services

| Component | Platform / status |
|---|---|
| Frontend | Cloudflare Pages, static frontend/ directory |
| Backend API | Cloudflare Worker named global |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth (email/password; email confirmation required) |
| Email notifications | Resend; Auth confirmation/recovery SMTP configured separately in Supabase |
| SMS | Twilio for transactional notifications only; not an Auth OTP provider |

Oracle Cloud VM and Clerk are no longer part of the target architecture.

## Supabase Auth migration

- Frontend customer and admin apps use the Supabase JS client via
  frontend/js/services/supabase-auth.js.
- Signup, sign-in, email confirmation, password recovery and password changes
  are handled by Supabase Auth.
- Frontend API requests send Supabase Auth access tokens. The backend verifies
  tokens using Supabase Auth getUser(accessToken).
- Auth UUIDs map to canonical profiles.id values through the unique
  profiles.supabase_user_id column.
- Migration 0007_supabase_auth.sql preserves legacy profiles.id values and
  existing account/ledger ownership, links only confirmed matching emails,
  updates admin_users to profile_id and replaces the RLS identity helper.
- Existing Clerk passwords are not transferred. Existing customers must
  establish a confirmed Supabase Auth identity using the same email address
  or go through controlled support recovery if that is not possible.
- Admin authorization remains server-side and uses admin_users.profile_id
  with the existing role/permission matrix.
- Clerk browser client, backend service, lifecycle webhook route and package
  dependencies have been removed from active production source.
- Detailed session inventory/per-session revoke and MFA screens are deferred.
  Supabase Auth scope-based sign-out controls are present.

### Required Supabase configuration

Worker secrets required:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

Frontend public configuration required:
- MG_API_BASE_URL (defaults to the Worker API base below)
- MG_SUPABASE_URL
- MG_SUPABASE_ANON_KEY

Configure Supabase Auth Email provider, require email confirmation, SMTP for
confirmation/recovery, and exact redirect URLs for the Cloudflare Pages
app.html/admin.html origins. Never expose the service-role key in the frontend.

## Cloudflare Worker incident

- Production Worker tail showed: [unenv] http.createServer is not implemented yet!
- Root cause: backend/src/worker.ts uses node:http.createServer() with
  cloudflare:node/httpServerHandler, but backend/wrangler.toml had only
  nodejs_compat on the older compatibility date.
- The feature branch retains nodejs_compat and enables both
enable_nodejs_http_modules and enable_nodejs_http_server_modules for the
complete node:http implementation used by the adapter. This additional flag
configuration is not deployed.
- API base configured in frontend/js/config.js:
  https://global.primeage.workers.dev/api/v1
- The earlier production log also reported missing Clerk and Supabase secrets.
  Clerk secrets are obsolete after this migration; the Supabase trio above
  remain required.
- Set CORS_ORIGIN to the exact deployed Pages origin(s).

## Changes on the feature branch

- Worker compatibility flag and API base URL.
- Supabase Auth browser client, customer/admin login, signup and recovery.
- Backend Supabase Auth token verification and canonical profile mapping.
- Supabase user-scoped database client forwarding the verified bearer JWT.
- Admin role assignment by confirmed Supabase Auth email; suspend/ban/unban
  and deletion use Supabase Auth admin operations plus profile-status checks.
- Migration 0007 for Supabase Auth identity linkage and RLS mapping.
- Integration tests updated for confirmed Auth users, legacy profile linkage,
  RLS mapping, and function privilege boundaries.
- Migration 0007 explicitly grants anon execution of the safe RLS identity helper
  and restricts SECURITY DEFINER profile anonymization to service_role.
- The frontend HTTP client now caps both network retries and Supabase token
  refresh to prevent an unbounded retry loop.
- Active Clerk code and dependencies removed; architecture, security and
  deployment documentation updated.

## Still required before release

1. Review the complete branch and pull request; do not merge until code review
   and tests pass.
2. Run backend npm ci, npm run typecheck, npm run lint and npm test.
3. Run frontend/check.sh and browser tests for customer/admin sign-in, signup,
   recovery, profile linking, role gate and sign-out scopes.
4. Rehearse migrations 0001–0007 against a production-like database backup.
   Verify every existing admin holder maps to a profiles.id before migration.
5. Configure Supabase Auth SMTP and redirect URLs, Worker secrets, frontend
   public config and exact CORS origins.
6. Deploy to a preview Worker and verify /api/v1/health returns HTTP 200.
   Test real Supabase Auth and two-user RLS isolation before production.
7. Only after explicit owner approval, merge/deploy and apply migration 0007
   to production using the approved backup/rollback plan.

## Verification status

| Check | Status |
|---|---|
| Source inspection and migration design | Completed on feature branch |
| Wrangler runtime fix | Prepared, not deployed |
| Supabase Auth frontend/backend changes | Prepared, not deployed |
| Migration 0007 | Added to branch, not applied |
| Backend typecheck/lint/tests after migration | NOT RUN; regression coverage added for function ACLs |
| Frontend syntax/browser checks after migration | NOT RUN; HTTP retry logic updated |
| Live Supabase Auth verification | NOT RUN |
| Production deployment | NOT PERFORMED |

## Pull request

Review branch: feat/supabase-auth-migration
Base: development
Pull request: to be opened after rebasing the changes onto the current development head.

Do not report the current live Worker as fixed until the compatible Worker
configuration is deployed and the health/auth flows are verified.