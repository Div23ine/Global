# CHANGELOG — Meridian Global Accounts

All notable changes on the `development` branch. Format: Keep a Changelog;
this project follows semantic versioning at release time.

## [Unreleased]

### Removed (SMS-OTP removal pass, 2026-11-23)
- **Twilio is out of the picture.** `backend/src/services/twilio.service.ts` deleted; `notifyWithSms` and the `alsoSms` request flag removed from `POST /admin/users/:id/notify` (and the admin console "Also send by SMS" toggle); `twilio` env block, `/health` check, `wrangler.toml`/`.env.example` secrets and the npm dependency removed (lockfile regenerated without it). No SMS is sent anywhere and no SMS OTP step exists: customer registration ends after the email OTP (phone-verification screen, `beginPhoneVerification`/`verifyPhoneOtp` and the backend phone-verification gate all removed; the phone number remains profile contact data).

### Changed (SMS-OTP removal pass, 2026-11-23)
- Signup email now documents an OTP-only "Confirm signup" template (no `{{ .ConfirmationURL }}` link) so the customer receives the six-digit code the app asks for, instead of a "confirm your email address" link; `PASSWORDLESS_AUTH_SETUP.md` updated accordingly (phone provider step removed).
- Website copy: every "not an offshore account / not offshore banking services" disclaimer removed from the frontend (about, terms, home, footer, what-is-offshore page framing); verification wording now email-only.
- `.github/workflows/workers.yml`: `npm ci` + lockfile-sync job landed with the regenerated lockfile (zod 4.6.7, twilio removed) and the branch trigger restored to the correct main-and-development list.

### Added (second super admin pass, 2026-11-23)
- Migration `0017_add_second_super_admin_raysallinone00`: configures BOTH repository super-admin addresses — `raysallinone00@gmail.com` (the original 0009 holder) and `gospelu214@gmail.com` — as `app_settings.platform.admin_emails`, rewrites the grant trigger to honour the list (legacy single-key fallback preserved), provisions the raysallinone00 confirmed Auth identity + linked profile, and idempotently re-asserts the gospelu214 grant. Five integration tests pin the two-admin state.

### Added (super-admin provisioning pass, 2026-11-23)
- Migration `0016_provision_super_admin_gospelu214`: points the configured super-admin email at `gospelu214@gmail.com`, guarantees a confirmed Supabase Auth identity for that address (magic-link capable, no password — admin sign-in uses `shouldCreateUser: false`), links it to a canonical profile through the production bootstrap path and asserts the `super_admin` grant end-state; resolves audit finding F-6. Three integration regression tests pin the provisioned state, trigger idempotency and no role leakage to other emails.

### Fixed (super-admin provisioning pass, 2026-11-23)
- `backend/package-lock.json` regenerated in sync with `package.json` (zod 4.6.7, wrangler/workers-types trees) so `npm ci` succeeds on a fresh clone; `.github/workflows/workers.yml` switched to `npm ci` — the pairing the previous pass intended but could not publish. Committed on the local development clone and delivered as files for the owner to push (must land together).

### Fixed (post-audit remediation pass, 2026-11-23)
- `PATCH /profile` no longer corrupts `full_name`: partial name patches are merged with the stored parts through a shared `computeFullName` helper (customer and admin paths); regression-tested (audit F-7).
- CORS denies disallowed origins cleanly (no CORS headers, no spurious HTTP 500); supertest contract added (audit F-8).
- Admin console gained moderation and refund controls: account-status card (suspend with reason, ban, reactivate, irreversible delete with consequences confirmation) on the user detail view; refund-request creation form (transaction UUID, amount, reason, notes, idempotency-keyed) on Refund Management; "Copy ID" action on Transactions rows (audit F-3).
- Shared `ui.jsx` hook wiring repaired: `useState(v)[0]`/`useState(v)[1]` twin-call pattern left ConfirmProvider dialogs, ToastHost toasts, RestrictedPanel feedback, useFetch and useDebounced permanently inert — replaced with single-call pairs; confirm dialogs and toasts now actually render.
- `MG.util.copyText` clipboard helper with execCommand fallback for insecure contexts.

### Security
- zod upgraded 3.23.8 → 4.6.7 (GHSA-mrhx-c7xc-m3w5, high — memory exhaustion on oversized constrained collections); `npm audit` clean; full suite green on the new major.

### Changed
- Production frontend uses https://meridian.uk.com and API requests use https://api.meridian.uk.com/api/v1.
- Worker CORS allowlist is configured for the production root domain and www alias; deployment guide and project status document the Cloudflare Pages/Worker custom-domain setup.
- Authentication provider: replace Clerk with Supabase Auth for customer and admin identity.
- API bearer-token validation now uses Supabase Auth getUser; authorization maps Auth UUIDs to canonical Meridian profile IDs.
- Migration 0007 preserves existing financial ownership while linking confirmed Supabase Auth identities and migrating admin role IDs.
- Replace Clerk session/password controls with Supabase Auth password recovery and scoped session sign-out.
- Remove Clerk lifecycle webhooks, browser/backend clients and Clerk/Svix runtime dependencies.
- Enable the Cloudflare Node.js HTTP server compatibility flag used by the Express Worker; deployment remains pending.

### Added
- Cloudflare Workers deployment for the API (`backend/src/worker.ts`, `wrangler.toml`)
- Resend email service: bank-details assignment, deposit credited, refund completed
- GitHub Actions workflow `.github/workflows/workers.yml`

### Changed
- Deployment target: Cloudflare Pages + Workers (Oracle Cloud VM removed)
- `env.ts` supports Worker secret bindings via `applyWorkerEnv`

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

## 2026-11-24 — Deposit minimums & exchange rates

- **Preserved** first initial deposit floor: **USD 20,000** equivalent (indicative policy rates).
- **Added** subsequent deposit floor: **USD 10,000** equivalent using server-side FX rates.
- FX admin: manual rates or live Frankfurter (ECB) refresh; `fx.manage` permission; audit on changes.
- Deposit rows store FX eligibility snapshot (`fx_*`, `min_policy`).
- Customer deposit UI loads `/deposits/policy` for rate, minimum and USD estimate.
- Migration: `0022_exchange_rates_and_deposit_snapshots.sql` (not applied to production by this change).
