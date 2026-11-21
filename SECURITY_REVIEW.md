# SECURITY REVIEW — Meridian Global Accounts

Status: v1.0 (development branch) · Method: STRIDE per surface, following the
threat-modelling workflow adapted into AGENTS.md. Every category below has a
recorded decision: **mitigated**, **accepted** or **deferred**, with a code
pointer where mitigated.

## 1. Scope and trust boundaries

```
Browser (React CDN app, Clerk publishable key)
   │  TLS                    trust boundary 1: public internet
   ▼
Cloudflare edge (DNS, CDN, TLS, WAF-capable)
   │                          trust boundary 2
   ▼
Oracle Cloud VM: Express API (Clerk JWT verification, Zod validation,
   │  rate limits, audit logging)
   ▼                          trust boundary 3: service credentials
Supabase PostgreSQL (RLS) · Clerk Backend API · Twilio API · Payment partner
```

Assets: customer PII (names, emails, phones), financial records (ledger,
deposits, balances), session tokens (Clerk), service credentials (Clerk
secret, Supabase service-role, Twilio auth token, webhook secrets).

## 2. STRIDE — REST API surface (Express)

| Threat | Decision | Mitigation / note |
|---|---|---|
| **S**poofing (forged requests) | **mitigated** | Every protected route verifies the Clerk JWT (`src/middleware/auth.ts` → `verifyToken` against Clerk JWKS). No home-grown tokens. 401 on any failure. |
| **S**poofing (webhook forgery) | **mitigated** | Clerk webhooks: svix signature verification over the raw body (`src/routes/webhooks.routes.ts`; raw-body capture mounted before JSON parsing in `src/app.ts`). Payment webhooks: HMAC-SHA256 with timing-safe compare (`verifyProviderSignature`, `src/services/deposits.service.ts`). Unknown providers rejected before parsing. |
| **T**ampering (request bodies) | **mitigated** | Zod schema validation at the boundary for every mutating route (`src/middleware/validate.ts`); unknown fields rejected (`.strict()`); body size capped at 256 kb. |
| **T**ampering (money records) | **mitigated** | The ledger is written exclusively by the SQL RPC `post_ledger_entry` under row locks; deposits transition only via `provider_confirm_deposit` / `provider_fail_deposit` (signed webhook path). There is no admin endpoint that mutates money — by construction, not by hidden buttons (`src/routes/admin.routes.ts` contains no such route). |
| **R**epudiation | **mitigated** | Append-only `audit_logs`: every admin action, every denied attempt, every webhook effect; no UPDATE/DELETE policies; RLS denies all client access; the table is written only via the service role (`src/services/audit.service.ts`). |
| **I**nformation disclosure | **mitigated** | Uniform error envelope without stack traces (`src/middleware/error.ts`); pino redaction for authorization headers, tokens, passwords (`src/utils/logger.ts`); secrets only in VM environment; `.env.example` committed with placeholders only. |
| **I** (cross-customer data) | **mitigated** | Ownership enforced twice: code-level (queries always scoped by `req.auth.userId`) and RLS (`auth.jwt() ->> 'sub'`), verified by two-user integration tests (`backend/tests/integration/database.test.ts`). |
| **D**enial of service | **mitigated (layered)** | Per-IP global bucket + per-user mutation buckets (`src/middleware/rateLimit.ts`), 256 kb body cap, 20 s request timeout in the frontend, Cloudflare WAF/rate rules available at the edge. **Accepted residual**: in-memory limiter is per-process; move to Redis when horizontally scaled (documented in DEPLOYMENT_GUIDE). |
| **E**levation of privilege | **mitigated** | `requireAdmin(...permissions)` resolves the role from `admin_users` per request; deny-by-default; permission matrix in the database (`migrations/0005_seed.sql`); frontend role UI is cosmetic only — the backend re-checks on every endpoint. Role assignment verifies the Clerk user exists first. |

## 3. STRIDE — database (Supabase PostgreSQL)

| Threat | Decision | Mitigation / note |
|---|---|---|
| Client-side tampering via PostgREST | **mitigated** | RLS enabled on every table; client policies are read-scoping only; money/admin/audit tables have **no** client policies (deny). Verified by integration tests as `authenticated` and `anon`. |
| Balance corruption | **mitigated** | `accounts.balance` is trigger-maintained from posted ledger entries only (`migrations/0004_functions_triggers.sql`); overdrafts refused with row locks; CHECK constraints on money columns; verified by integration tests. |
| PII retention conflict (GDPR vs financial retention) | **mitigated** | Deletion = Clerk identity removal + `anonymize_profile()` (PII cleared, financial records retained pseudonymized). Documented in the privacy policy; exact retention periods **deferred** pending jurisdiction confirmation (open requirement, PROJECT_STATUS.md). |
| SQL injection | **mitigated** | All backend access goes through supabase-js (parameterized PostgREST); no string-concatenated SQL in application code; the few raw RPCs use parameter binding. |

## 4. STRIDE — identity (Clerk) and SMS (Twilio)

| Threat | Decision | Mitigation / note |
|---|---|---|
| Password/credential handling | **mitigated** | Entirely delegated to Clerk; the application never sees or stores passwords. |
| Session hijacking | **mitigated** | Clerk-managed sessions; ban/unban propagated through Clerk (sessions end immediately); device sessions visible and revocable by the customer (`/profile/sessions`). |
| OTP system conflicts | **mitigated** | Single OTP authority (Clerk, configured with Twilio). The backend Twilio service sends only transactional notifications and **never** verification codes (`src/services/twilio.service.ts`). |
| SMS abuse / cost attacks | **mitigated** | Hourly SMS budget, recipient allowlist in dev, E.164 validation, retry with backoff, redacted logging. |
| Webhook replay | **mitigated** | Deposit confirmations are idempotent (duplicate deliveries recorded as `duplicate_ignored`, no double credit — integration-tested). Clerk events are upserts (idempotent). |

## 5. STRIDE — infrastructure

| Threat | Decision | Mitigation / note |
|---|---|---|
| Secret leakage via repository | **mitigated** | `.gitignore` for `.env`; `.env.example` placeholders only; secret values never appear in the codebase (grep-verified). |
| VM exposure | **mitigated (deployment-time)** | Only 80/443 exposed; API behind a TLS-terminating reverse proxy; systemd hardening options in the unit file (DEPLOYMENT_GUIDE.md). |
| Frontend supply chain | **deferred (accepted for this stage)** | React/Babel/ClerkJS are loaded from unpkg CDN over TLS with SRI planned before production (recorded as next-task: add Subresource Integrity hashes or self-host the vendor files). |
| Production DNS/destructive ops | **mitigated (by policy)** | AGENTS.md stop-conditions: no production DNS, database or VM changes without owner authorization. |

## 6. Findings register

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | HIGH (design) | Original prototype enforced financial restrictions only in browser code | Resolved: moved to backend/DB enforcement (no admin money endpoints; RPC-only state machine) |
| 2 | MEDIUM | Statement download is a provisional plain-text format | Accepted for now (no licensed statement provider yet); documented in the UI |
| 3 | MEDIUM | CDN scripts lack Subresource Integrity attributes | Deferred — next task before production |
| 4 | LOW | In-memory rate limiter is per-process | Accepted at current scale; Redis interface documented |
| 5 | LOW | Admin console served from the same static origin as the customer app | Accepted: no secrets in static assets; all authorization is server-side; `noindex` set on admin.html |

## 7. Never-log list (enforced in code review and pino redaction)

Passwords, tokens, API keys, full card/account numbers, session cookies,
authorization headers, SMS bodies containing codes. Logs carry: request id,
route, method, status, duration, opaque user ids, auth event types.

## 8. Verification evidence

- Two-user RLS isolation, ledger immutability, deposit state machine,
  idempotency, anonymization: `backend/tests/integration/database.test.ts`
  (12 tests, real PostgreSQL 18) — passing.
- Webhook signature rejection paths: `backend/tests/unit/signature.test.ts` — passing.
- Full matrix of code-level checks: see TEST_REPORT.md.
