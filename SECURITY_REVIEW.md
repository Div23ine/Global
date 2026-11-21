# SECURITY REVIEW — Meridian Global Accounts

Status: Supabase Auth migration prepared on feat/supabase-auth-migration;
code review and verification still pending.
Method: STRIDE per surface. Decisions identify the owner and the code/migration
that enforces the control.

## 1. Scope and trust boundaries

```text
Browser (React app; Supabase URL + anon/publishable key)
  | TLS; Authorization: Bearer Supabase Auth access JWT
Cloudflare Pages / Cloudflare edge
  |
Cloudflare Worker (Express API; Auth getUser validation; Zod; rate limits)
  | service-role credential held only in Worker secrets
Supabase Auth + PostgreSQL (RLS) | Resend | Twilio | payment partner
```

Protected assets: customer PII, financial records, access/refresh tokens,
service-role credentials and provider/webhook secrets. The Supabase anon or
publishable key is public browser configuration; it is not an authorization
boundary. The service-role key is privileged and must remain server-side.

## 2. STRIDE — API, identity and authorization

| Threat | Decision | Mitigation, owner and code pointer |
|---|---|---|
| Spoofing: forged, expired or revoked bearer token | Mitigated by design; live tests pending | Backend calls Supabase Auth getUser(accessToken), rather than trusting locally decoded claims. Owner: backend. backend/src/services/supabase-auth.service.ts and backend/src/middleware/auth.ts. |
| Spoofing: claim a legacy customer's profile | Mitigated by design; migration rehearsal pending | Bootstrap requires an Auth identity with a confirmed email, uses a service-role-only RPC, links only an unlinked matching email, and enforces a unique Auth UUID. Owner: database/backend. backend/migrations/0007_supabase_auth.sql. |
| Tampering: request bodies | Mitigated | Zod validates mutation payloads; strict schemas reject unknown fields and request bodies are size-capped. Owner: backend. backend/src/middleware/validate.ts and route schemas. |
| Tampering: financial records | Mitigated | Ledger posting and deposit transitions remain database RPC/state-machine controlled. No browser money-writing path was introduced. Owner: backend/database. backend/migrations/0004_functions_triggers.sql and backend/src/routes/admin.routes.ts. |
| Repudiation | Mitigated | Audit logs remain append-only and service-role written; privileged actions and denials are audited. Owner: backend. backend/src/services/audit.service.ts. |
| Information disclosure: service credentials | Mitigated by design; deployment scan pending | Service-role key stays in Worker secrets; browser receives only URL + anon/publishable key. Logger redaction covers credentials and tokens. Owner: platform operator/backend. backend/.env.example and backend/src/utils/logger.ts. |
| Cross-customer access / RLS bypass | Mitigated by design; real Supabase verification pending | Backend maps Auth UUID to canonical profile ID and forwards the verified user's JWT for RLS reads. RLS maps auth.uid() through profiles.supabase_user_id. Owner: database/backend. backend/src/middleware/auth.ts, backend/src/services/supabase.service.ts and migration 0007. |
| Denial of service | Mitigated (layered) | Cloudflare rate-limit bindings, body-size limits and frontend request timeout remain. Owner: platform operator. backend/src/middleware/rateLimit.ts and backend/wrangler.toml. |
| Elevation of privilege | Mitigated by design; role migration rehearsal pending | Admin roles are resolved from admin_users.profile_id and admin_roles on protected API requests. Role assignment requires an active profile linked to a confirmed Supabase Auth identity. Owner: backend. backend/src/middleware/auth.ts and backend/src/routes/admin.routes.ts. |

## 3. STRIDE — Auth lifecycle and sessions

| Threat | Decision | Mitigation, owner and code pointer |
|---|---|---|
| Password theft or storage | Mitigated by provider boundary | Signup, sign-in, email confirmation, recovery and password updates are handled by Supabase Auth; Meridian does not store passwords. Owner: Supabase project owner. frontend/js/services/supabase-auth.js and Supabase Auth settings. |
| Session theft | Accepted residual risk with mitigations | HTTPS, token redaction, Supabase-managed refresh handling and server-side getUser validation are required. A stolen unexpired access JWT can remain usable until expiry unless profile status/link checks deny it. Owner: platform operator/backend. frontend/js/services/supabase-auth.js and backend/src/middleware/auth.ts. |
| Suspend/ban while a JWT is still valid | Mitigated by request-time profile status check | Admin changes profile status before applying an Auth ban. requireAuth rejects any profile not active on every request. Owner: backend. backend/src/routes/admin.routes.ts and backend/src/middleware/auth.ts. |
| Delete identity while a JWT is still valid | Mitigated by profile status + identity unlink | Deletion first marks the profile deleted, removes the linked Auth user, then anonymizes profile PII. The mapping is cleared and every request checks the profile. Financial records remain attached to the canonical profile. Owner: backend/database. backend/src/routes/admin.routes.ts and migration 0007. |
| Session revocation | Mitigated with provider scopes; detailed inventory deferred | UI exposes local, others and global sign-out scopes. Supabase does not immediately invalidate already-issued access JWTs; they remain valid until expiry, so profile-status checks remain essential. Owner: backend/product. frontend/js/services/supabase-auth.js and frontend/js/app/views-account.jsx. |
| Per-device session inventory and individual revoke | Deferred | This migration removes the old Clerk-specific session endpoints. The application does not claim to enumerate or individually revoke sessions. Owner: product/backend. frontend/js/app/views-account.jsx. |
| MFA enrollment and challenge | Deferred | MFA UI and required assurance-level checks have not been implemented. Do not claim MFA is enabled in Meridian until the full flow and policies are configured and tested. Owner: product/backend. |
| OTP/SMS ownership | Mitigated by scope; phone verification not migrated | Email/password plus confirmed email is the current Auth path. Twilio sends transactional notifications only; it is not used to send Auth OTPs. A profile phone number is contact data, not an authentication factor. Owner: platform operator. backend/src/services/twilio.service.ts and Supabase Auth settings. |
| Email recovery abuse | Mitigated by provider controls; configuration pending | Supabase Auth reset-password email, configured redirect allow-list and Auth rate limits are required. Configure SMTP and exact Pages redirect URLs before release. Owner: Supabase project owner. frontend/js/services/supabase-auth.js and DEPLOYMENT_GUIDE.md. |

## 4. STRIDE — database and infrastructure

| Threat | Decision | Mitigation, owner and code pointer |
|---|---|---|
| Direct PostgREST tampering | Mitigated by RLS design; production verification pending | Client policies are read-scoped; financial, admin and audit tables have no client write policies. Owner: database owner. backend/migrations/0003_rls.sql and 0007_supabase_auth.sql. |
| SQL injection | Mitigated | Application database access uses supabase-js parameterized PostgREST and RPC calls; no dynamic SQL was added in the Auth migration. Owner: backend. Backend service and route files. |
| Credential leakage | Mitigated by repository policy; deployment review pending | Never commit SUPABASE_SERVICE_ROLE_KEY. Only the URL and anon/publishable key belong in browser configuration. Worker secrets hold the service-role key. Owner: repository/Cloudflare administrators. backend/.env.example and backend/wrangler.toml. |
| CDN script compromise | Deferred | React/Babel and the Supabase browser SDK are loaded over HTTPS from a CDN. SRI pinning or self-hosting remains pre-production hardening. Owner: frontend/platform. frontend/app.html and frontend/admin.html. |
| Production schema/deployment error | Deferred pending owner approval | Migration 0007 adds Auth mapping and renames the admin identity column. Rehearse against a production-like backup and inspect existing admin holders before application. Owner: database/project owner. backend/migrations/0007_supabase_auth.sql and DEPLOYMENT_GUIDE.md. |

## 5. Migration-specific controls

- Existing profiles.id values are preserved. Financial foreign keys are not
  rewritten when a legacy identity is linked.
- Only a Supabase Auth user whose email is confirmed by Supabase can be linked.
- The link/bootstrap RPC is executable only by service_role; browser clients
  cannot call it.
- The RLS identity helper is executable by anon, authenticated and
  service_role because RLS expressions invoke it; unauthenticated callers
  resolve to an empty identity and cannot see customer rows.
- Profile anonymization is SECURITY DEFINER but executable only by
  service_role. Migration 0007 explicitly revokes inherited PUBLIC, anon and
  authenticated grants before granting service_role; this is essential because
  CREATE OR REPLACE FUNCTION preserves prior ACLs.
- A unique index prevents one Supabase Auth UUID from being attached to two
  Meridian profiles.
- Existing Clerk passwords are not imported. Customers must establish a
  Supabase Auth identity using the same confirmed email, or use a controlled
  support recovery process if their email changed or is inaccessible.
- admin_users is renamed to profile_id so the permission assignment continues
  to refer to the canonical Meridian profile.
- The migration is forward-only and has not been applied to production.
- Migration 0007 is not backward-compatible with the old Clerk API: the
  admin_users identity column and RLS helper change. Production rollout must
  use a coordinated maintenance window with authenticated traffic paused until
  the new API is deployed and verified.

## 6. Never-log list

Passwords, access/refresh tokens, API keys, service-role credentials, full
bank/account numbers, session cookies, authorization headers and SMS bodies
containing codes. Logs may carry request IDs, route, method, status, duration,
opaque profile IDs and event types.

## 7. Verification status

- Production Wrangler tail showed the prior Worker exception:
  [unenv] http.createServer is not implemented yet!. The compatibility flag
  fix is prepared on the feature branch and is not deployed.
- Supabase Auth source, migration 0007, frontend login/recovery flows, admin
  role mapping and tests have been changed on the feature branch.
- A regression test now asserts that anon can call the safe RLS identity helper
  but neither anon nor authenticated can execute profile anonymization.
- Typecheck, lint, integration test execution, browser testing, migration
  rehearsal and live Supabase Auth verification have not yet been run after
  these changes. No production deployment or database migration was performed.