# CHANGELOG — Meridian Global Accounts

All notable changes on the `development` branch. Format: Keep a Changelog;
this project follows semantic versioning at release time.

## [Unreleased] — 2026-11-20

### Upgrade of the approved prototype into a full-stack platform

**Repository**
- Moved the three-design prototype to `prototype/` (git mv; history
  preserved). The approved design remains **Design 02 — Hong Kong
  International Fintech**; the prototype stays as the design reference and is
  still deployed to GitHub Pages.
- Added the project documentation set: AGENTS.md (autonomous development
  methodology synthesized from CodeAlive-AI/ai-driven-development,
  shihabshahrier/softco and dzhng/skills — references maintained),
  ARCHITECTURE.md, DATABASE_DESIGN.md, API_SPECIFICATION.md,
  IMPLEMENTATION_PLAN.md, PROJECT_STATUS.md, SECURITY_REVIEW.md,
  DEPLOYMENT_GUIDE.md, TEST_REPORT.md, this CHANGELOG.
- Fixed the GitHub Pages workflow deploy path after the restructure.

**Backend (new: `backend/`)** — Express 5 + TypeScript REST API
- Health/readiness endpoint with honest dependency status.
- Clerk integration: JWT verification middleware, admin role/permission gate,
  svix-verified lifecycle webhooks (created/updated/deleted) with
  anonymizing deletion that retains financial records.
- Supabase integration: user-scoped (RLS) client for customer reads +
  service client for authorized mutations.
- Customer endpoints: profile (permitted-field patch), sessions (Clerk),
  accounts, currency activation with guards, deposits (idempotent create,
  customer cancel), transactions with filters/pagination, statements
  (deterministic generation + text download), notifications, support tickets.
- Payments seam: `PaymentProvider` interface; signed, idempotent provider
  webhook; atomic SQL RPCs (`provider_confirm_deposit`,
  `provider_fail_deposit`, `post_ledger_entry`) so ledger posting, deposit
  state, balance projection and notification commit together.
- Admin surface: overview, users (search/filter), user viewer with permitted
  edits, suspend/ban/unban (Clerk-enforced), delete (identity + anonymize),
  manual notification, currency availability, read-only deposits/
  transactions/payments, security events + freeze, reports, support,
  roles + permission matrix, audit query, settings. **No money-mutation
  endpoints exist by construction.**
- Twilio SMS service (transactional notifications only — never verification
  codes), with hourly budget, recipient allowlist, retry, redacted logs.
- Cross-cutting: security headers, strict CORS, request ids, structured
  logging with redaction, Zod validation, layered rate limiting, uniform
  error envelope, graceful shutdown.
- Five forward-only SQL migrations: extensions, 16-table schema
  (text Clerk-sub identity keys, `numeric(19,4)` money), RLS keyed on
  `request.jwt.claims.sub`, triggers + atomic RPCs, European seed.
- Tests: 21 passing (unit + real-PostgreSQL integration; the integration
  suite caught and fixed two real migration bugs).

**Frontend (new: `frontend/`)** — React 18 via CDN + Babel Standalone
- No build step by requirement; Vite migration path documented, not executed.
- 10 public pages in the approved design language with production copy:
  European positioning, EUR default, five currencies EUR/GBP/USD/CHF/PLN,
  honest platform-account framing (no banking claims, no fabricated metrics,
  Nigeria/NGN removed).
- `app.html` customer SPA: ClerkJS-mounted authentication, hash router,
  approved shell (sidenav/topbar), 15 views each with loading/empty/error/
  populated states.
- `admin.html` console: backend role gate, 12 views; financially read-only
  administrative language carried into the UI.
- Service layer: `config.js` (non-secret), ClerkJS loader, fetch wrapper
  (envelope, bearer token, 401 refresh, timeout, single retry),
  typed-by-contract API client.
- Honest configuration screen when services are not configured — the
  production apps never run on simulated data.
- `check.sh` syntax gate (node --check + esbuild) — 14/14 passing.

**Decisions**
- Admin "Account Takeover" (prototype demo) is not replicated as session
  impersonation in production; the equivalent capability is the audited
  Account Viewer + permitted edits + full audit trail. Rationale recorded in
  PROJECT_STATUS.md (decisions ledger).
- Fifth currency: PLN (replaces NGN) to preserve the "five currencies"
  brand promise with European relevance.
