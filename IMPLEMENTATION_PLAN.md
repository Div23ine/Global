# IMPLEMENTATION PLAN — Meridian Global Accounts upgrade

Status: v1.0 · Branch: `development` · Ordered phases; each phase ends with a
verification checkpoint and a commit.

## Phase 0 — Repository and methodology (DONE)

- [x] Inspect existing repository (three-design prototype, shared mock API seam,
      admin React/Vite apps, GitHub Pages workflow).
- [x] Inspect the three skill repositories; synthesize methodologies into `AGENTS.md`.
- [x] Restructure: `prototype/` (preserved), fix Pages workflow path.
- [x] Author `AGENTS.md`, `ARCHITECTURE.md`, this plan, `DATABASE_DESIGN.md`,
      `API_SPECIFICATION.md`, `PROJECT_STATUS.md`.

## Phase 1 — Database schema and migrations

- [x] `backend/migrations/0001_extensions.sql` — pgcrypto for uuid generation.
- [x] `backend/migrations/0002_schema.sql` — profiles, currencies, accounts,
      transactions (ledger), deposits, payment_attempts, statements,
      notifications, support_tickets, support_messages, admin_roles,
      admin_users, audit_logs, security_events, app_settings.
- [x] `backend/migrations/0003_rls.sql` — Row Level Security keyed on Clerk
      `sub` claim; audit append-only; service-role-only writes on money tables.
- [x] `backend/migrations/0004_functions_triggers.sql` — balance projection
      trigger, updated_at triggers, reference generation, deposit state guard.
- [x] `backend/migrations/0005_seed.sql` — EUR/GBP/USD/CHF/PLN currency set,
      admin roles + permission matrix, European country→currency mapping,
      app settings (dev seed only).
- Verification: SQL syntax review + (when a Supabase project is linked)
  migration rehearsal; local Postgres pass where available.

## Phase 2 — Backend foundation

- [x] Express 5 + TypeScript project: `package.json`, `tsconfig.json`,
      ESLint flat config, `.env.example`, Vitest setup.
- [x] `config/env.ts` — typed config, fail-fast in production.
- [x] Middleware: security headers, CORS, body limits, request id, structured
      logging, uniform error envelope, Zod validation, rate limiting.
- [x] `GET /api/v1/health` — liveness + dependency checks.
- Verification: `npm run typecheck`, `npm run lint`, boot test (L2).

## Phase 3 — Identity integration (Clerk)

- [x] `clerk.service.ts` — Backend API client wrapper (users, ban/unban,
      delete, metadata).
- [x] `requireAuth` middleware — Clerk JWT verification (JWKS), attaches
      `req.auth = { userId, email, role }`.
- [x] `requireAdmin(...roles)` — role resolution from `admin_users`.
- [x] `POST /api/v1/webhooks/clerk` — svix signature verification;
      user.created / user.updated / user.deleted → profile sync (anonymizing
      deletion, retaining financial records).
- [x] Registration bootstrap: profile creation provisions the default-currency
      account (zero balance).
- Verification: unit tests with mocked Clerk; webhook signature test vectors.

## Phase 4 — Customer data domain (Supabase)

- [x] `supabase.service.ts` — user-scoped client (forwards Clerk JWT → RLS)
      and service client (system operations).
- [x] `accounts` endpoints: list with balances, single account, activate
      currency (guards: availability, already-active, duplicates).
- [x] `transactions` endpoints: paginated history with filters; detail by
      reference (ownership enforced).
- [x] `statements`: statement list, on-demand generation from ledger,
      download (text/plain, marked as generated demo format until a licensed
      statement provider is chosen).
- [x] `notifications`: list, mark read.
- [x] `support`: tickets + messages.
- [x] `profile`: get, patch (permitted fields only).
- Verification: integration tests against a real Postgres schema (local),
  authorization tests with two users.

## Phase 5 — Deposits and payments seam

- [x] `deposits.service.ts` — deposit lifecycle: create (idempotent by
      reference), cancel by customer (only while PENDING), list.
- [x] `PaymentProvider` interface + `manual-review` provider (records intent;
      cannot confirm — reserved for the licensed partner integration).
- [x] `POST /api/v1/webhooks/payments/:provider` — signature verification,
      idempotent processing: on `confirmed` → post ledger entry + update
      deposit + balance projection + notification (one DB transaction).
- [x] `twilio.service.ts` — SMS notifications with rate limiting, retry with
      backoff, delivery logging (no message bodies with codes logged).
- Verification: unit + integration tests with a fake provider; duplicate
  webhook delivery test; concurrency test on balance projection.

## Phase 6 — Administrator surface

- [x] Admin endpoints: dashboard metrics, users (search/filter/paginate),
      user detail, permitted profile edits, suspend/ban/unban (Clerk + DB),
      delete (Clerk + anonymize), currency availability management,
      deposits/transactions/payments monitoring, security events, reports,
      support management, roles, audit log query, settings.
- [x] **Financial restriction enforcement**: no admin endpoint can modify
      balances, transactions, deposit confirmations or ledger rows; the only
      deposit state transitions are customer-cancel and provider-webhook.
      Denied attempts are audit-logged.
- [x] Audit logging on every administrative action + every denial.
- Verification: authorization matrix tests (each role × each endpoint).

## Phase 7 — Frontend production build (Design 02 preserved)

- [x] `frontend/assets/theme.css` — carry over Design 02 design system
      (European adjustments: EUR default, remove NGN, remove demo-forced
      markers in production copy).
- [x] Public site: 10 static pages in Design 02 language.
- [x] `js/config.js`, `js/services/clerk.js` (ClerkJS loader), `http.js`
      (envelope + auth), `api.js` (all REST resources).
- [x] `app.html` customer SPA: Clerk-mounted auth; shell (sidenav, topbar);
      views: overview, accounts, account detail, activate, deposits wizard,
      transactions + filters + detail, statements, profile, security,
      sessions (Clerk), notifications, support, settings; four states each.
- [x] `admin.html` admin SPA: role gate; views: dashboard, users, user detail
      (permitted edits, ban/unban/delete, audit), currencies, deposits,
      transactions, payments, security, reports, support, roles, audit,
      settings.
- [x] `frontend/check.sh` — syntax-check every classic script.
- Verification: `node --check` all scripts; render checks in a real browser
      (L4): configuration screen, public pages, prototype parity spot-check.

## Phase 8 — Testing and hardening

- [x] Backend unit tests (services, middleware) and integration tests
      (routes against real schema where available).
- [x] Authorization matrix; RLS two-user tests where a database is reachable.
- [x] Rate limit, idempotency, webhook signature tests.
- [x] `TEST_REPORT.md` with honest verified / not-verified status per area.

## Phase 9 — Security and deployment readiness

- [x] `SECURITY_REVIEW.md` — STRIDE per surface, never-log list, findings.
- [x] `DEPLOYMENT_GUIDE.md` — Cloudflare Pages, Oracle VM (systemd + reverse
      proxy), Supabase, Clerk, Twilio setup runbooks; rollback procedures.
- [x] `CHANGELOG.md`, final `PROJECT_STATUS.md`.

## Out of scope for this stage (documented, not silently dropped)

- Vite migration of the frontend (path prepared — `ARCHITECTURE.md` §8).
- Real payment partner integration (interface + webhook seam ready).
- Kubernetes/microservices (explicitly not justified by current scale).
- Production DNS changes or any deployment to the live VM (requires owner
  authorization and credentials).
