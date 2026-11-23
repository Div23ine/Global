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
- The RLS identity helper is executable by authenticated and service_role.
  Migration 0015 (owner hardening, 2026-11-23) revoked anon/PUBLIC EXECUTE and
  altered the nine customer *_select_own policies TO authenticated, so
  anonymous queries on customer tables default-deny WITHOUT evaluating the
  helper, and anonymous direct calls are denied. The earlier anon-grant
  contract (helper executable by anon because RLS expressions invoke it) no
  longer applies: no policy that calls the helper remains applicable to anon.
  Locked by the integration regression test (privilege matrix + anon
  default-deny + direct-call denial + public catalog reads still open).
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
## 8. Permission and deposit state-machine hardening (2026-11-23, issue #4 pass)

STRIDE review of the surfaces changed in this pass. Owner for all follow-ups:
repository/project owner.

| Threat | Decision | Mitigation, owner and code pointer |
|---|---|---|
| Spoofing — read-only admin roles invoke money movement | Mitigated | assign-bank, verify-credit, deposit rejection, receiving-bank writes and refund create/approve/reject now require deposits.manage / refunds.manage server-side (previously deposits.read, which the compliance and finance_readonly roles hold). Route-permission contract test introspects the real router stack. Owner: backend. backend/src/routes/admin.routes.ts, backend/src/middleware/auth.ts, backend/tests/unit/admin-permissions.test.ts. |
| Tampering — deposit ledger rewind via status rewrite | Mitigated | Migration 0014 restores the deposit transition guard that 0006 had dropped; terminal states (completed, cancelled, rejected) accept no outgoing transitions and completed_at is defaulted on terminal entry. Regression test locks terminal-state finality. Owner: database/backend. backend/migrations/0014_restore_deposit_state_machine.sql, backend/tests/integration/database.test.ts. |
| Repudiation — audit trail bypass through new deposit states | Accepted (unchanged surface) | All money-movement mutations still flow exclusively through service-layer functions that call audit-logged atomic RPCs (admin_credit_deposit_payment, process_internal_refund); the trigger only adds a lower-level guard. Owner: backend. backend/src/services/deposits.service.ts. |
| Information disclosure — unknown endpoints answered 401 | Mitigated | Router-level auth gates are scoped to their real path prefixes; unmatched /api/v1 paths now return 404 NOT_FOUND while the same routes keep the same requireAuth/requireAdmin gates. Owner: backend. backend/src/routes/*.routes.ts. |
| Denial of service — fresh-database bootstrap failure | Mitigated | Migration 0008 is now a no-op on databases without the rls_auto_enable event-trigger function, so migration replay and the integration suite run everywhere. Owner: database. backend/migrations/0008_restrict_event_trigger_function.sql. |
| Elevation of privilege — placeholder receiving banks mistaken for real instructions | Accepted with controls | Migration 0013 seeds one clearly-labeled placeholder receiving account per supported currency only when the currency has no active receiving account; account_number/iban/swift_bic stay NULL and production databases with verified details are untouched. Owner: platform operator. backend/migrations/0013_seed_receiving_banks.sql. |

## 9. Verification status (2026-11-23 update)

- Backend: npm ci green (lockfile regenerated), typecheck clean, ESLint clean,
  Vitest 41/41 green including the real-database integration suite (which had
  been silently skipped since migration 0008 broke fresh-database replay).
- Frontend: node --check / esbuild parse green for every classic script and
  JSX module; admin console renders in a real browser with no console errors.
- Local runtime: API boots, /api/v1/health returns 200, /api/v1/public-config
  returns honest SERVICE_NOT_CONFIGURED without secrets, protected routes
  return 401, unknown /api/v1 paths return 404.
- Browser (local harness): customer sign-in and registration render with all
  required fields; client-side validation (password length, mismatch, ISO
  country code) verified; admin sign-in renders; mobile viewport shows no
  horizontal overflow.
- Still blocked: live Supabase Auth journeys (email OTP, SMS OTP, magic-link
  callback, TOTP), live two-user RLS verification against the production
  project, and any deployment verification. They require the Supabase,
  Twilio and Cloudflare credentials that are intentionally absent from this
  environment. No production deployment, migration application or
  authentication cutover was performed.

## 10. Post-audit remediation pass (2026-11-23, issue #5 follow-up)

STRIDE review of the surfaces changed while fixing the audit findings F-3,
F-7, F-8, F-17 and the newly discovered shared-UI hook defect. Owner for all
follow-ups: repository/project owner.

| Threat | Decision | Mitigation, owner and code pointer |
|---|---|---|
| Tampering — partial profile patches corrupt full_name (F-7) | Mitigated | PATCH /profile (and the admin PATCH /admin/users/:id path, now sharing one helper) recomputes full_name from the STORED parts plus the patched parts, so a firstName-only patch can no longer erase the stored last name and a lastName-only patch can no longer leave full_name stale. Unit suite pins both corruptions as regressions. Owner: backend. backend/src/utils/name.ts, backend/src/routes/profile.routes.ts, backend/src/routes/admin.routes.ts, backend/tests/unit/name.test.ts. |
| Repudiation — moderation actions unreachable from the console invite unlogged API misuse (F-3) | Mitigated | Suspend/ban/unban/delete and refund creation now have console controls; every action still goes through the existing server-side permission gates (users.ban / users.delete / refunds.manage) and audit logging — the UI adds reachability, never authority. Frontend render test (stubbed transport) verified calls, reason validation and the double-confirm for irreversible delete. Owner: frontend. frontend/js/admin/views-core.jsx, frontend/js/admin/views-refunds.jsx. |
| DoS — disallowed CORS origin triggered a 500 + error log entry (F-8) | Mitigated | Origin callback now denies cleanly (cb(null, false): no CORS headers, no error). Browser-side denial is unchanged; the spurious INTERNAL response and log noise are gone. Supertest contract locks allowed-origin headers, denial without headers and the never-500 property. Owner: backend. backend/src/app.ts, backend/tests/unit/cors.test.ts. |
| DoS — zod GHSA-mrhx-c7xc-m3w5 (memory exhaustion on oversized constrained collections) | Mitigated | zod upgraded 3.23.8 → 4.6.7 (npm audit clean, 0 vulnerabilities). All schemas are simple object/union/enum surfaces — no v4-breaking API in use; typecheck, lint and the full 53-test suite passed on the upgraded library. In-place mitigations (256 kb body cap, global rate limit) remain. Owner: backend. backend/package.json, backend/package-lock.json. |
| Tampering/DoS — shared UI components never re-rendered on state updates (new finding during L4 verification) | Mitigated | ui.jsx used `var x = useState(v)[0]; var setX = useState(v)[1];` — TWO hook calls reading/writing different slots, leaving ConfirmProvider dialogs, ToastHost toasts, RestrictedPanel feedback, useFetch/useDebounced permanently inert. Fixed to single-call pairs. Render test confirmed dialogs and toasts now function; both apps (customer + admin) load with zero console errors. Owner: frontend. frontend/js/components/ui.jsx. |
| Elevation of privilege — clipboard copy of transaction UUID | Accepted | Read-only convenience for the refund workflow; clipboard content is the transaction id the admin can already see; writeText is not exposed to other tabs. No credential or secret ever copied. Owner: frontend. frontend/js/util.js (MG.util.copyText with execCommand fallback). |

## 11. Verification status (2026-11-23 remediation pass)

- Backend: typecheck 0 errors, ESLint 0 findings, Vitest 53/53 (was 41/41 —
  added 7 full_name and 5 CORS contract tests) including the real-PostgreSQL
  integration suite; `npm audit` now reports 0 vulnerabilities (zod
  GHSA-mrhx-c7xc-m3w5 resolved).
- Local runtime L2: API boots; /api/v1/health 200; PATCH /profile
  unauthenticated → 401; disallowed-origin preflight/actual requests return
  without CORS headers and never 500.
- Frontend L0: check.sh green for all 16 modules (node --check + esbuild
  parse), including the new views-refunds.jsx.
- Frontend L4 (scratch render harness with the transport stubbed to
  fixtures — no service claims): user-view moderation card renders with
  status-aware controls; suspend with reason, short-reason guard, irreversible
  delete double-confirm (consequences list) and navigation all verified with
  the expected MGA.api calls recorded; refunds view create-form validates the
  transaction UUID and amount, submits an idempotency key and closes on
  success; transactions view Copy ID puts the UUID on the clipboard; confirm
  dialogs and toasts now actually render (they were silently dead before the
  ui.jsx hook fix). The real admin.html and app.html load every script and
  reach their honest not-configured states with zero console errors.
- Still blocked (unchanged): live Supabase/Twilio journeys, production
  migration rehearsal, Cloudflare deployment — all require owner credentials
  and explicit authorization.

## 12. Owner PR #6 hardening verification + regression-test alignment (2026-11-23)

The owner merged PR #6 (`fix/meridian-production-hardening`: deposits.service
atomicity fix, migration 0015 production security/performance hardening) after
the remediation push. The re-run verification gates caught one red: the
integration regression test still asserted the PRE-0015 contract
(`anon_can_resolve_identity: true`).

Analysis (no RLS change made by the agent — the owner altered the policies):
- All nine policies that call `app_current_user_id()` are SELECT policies and
  were all altered `TO authenticated` by 0015. With no anon-applicable policy,
  anonymous queries on those tables default-deny WITHOUT evaluating the policy
  expression, so the revoked anon EXECUTE is never exercised.
- Verified behaviorally on the real migrated database: anon
  `SELECT * FROM profiles` returns zero rows without error; direct
  `SELECT app_current_user_id()` as anon is permission-denied; anon public
  catalog reads (currencies) still work.

| Threat | Decision | Mitigation, owner and code pointer |
|---|---|---|
| Tampering — regression suite left red after an owner RLS change hides future regressions | Mitigated | The stale assertion was aligned with the post-0015 contract and STRENGTHENED: the test now locks the tightened privilege matrix, anon default-deny on customer tables (zero rows, no error), direct helper-call denial for anon, and that public catalog reads remain open. Owner: backend. backend/tests/integration/database.test.ts, backend/migrations/0015_production_security_performance_hardening.sql. |
| DoS/behavior — anon queries erroring instead of cleanly returning empty | Accepted (not reachable) | Would only occur if a policy calling the helper remained applicable to anon; none does after 0015. If a future migration re-introduces an anon-applicable policy using the helper, it must re-grant EXECUTE to anon in the same migration. Owner: database. |

Result: typecheck 0 errors, lint 0 findings, Vitest 53/53 (incl. real-Postgres
integration), `npm audit` 0 vulnerabilities, frontend check.sh 16/16 — on the
tree combining the owner's PR #6 with the remediation work and the local
lockfile/workflow commit.
