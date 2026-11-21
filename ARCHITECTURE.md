# ARCHITECTURE — Meridian Global Accounts

Status: v1.0 (development branch) · Scope: full-stack upgrade of the approved
frontend prototype into a production platform.

## 1. System overview

```
                        Cloudflare DNS + CDN/TLS
                                  |
             +--------------------+---------------------+
             |                                          |
     Cloudflare Pages                          Cloudflare Workers
     (static frontend)                         (dedicated backend host)
     frontend/                                 backend/ (Node.js + TS + Express)
        index.html  (public site)                 REST API  /api/v1/*
        app.html   (customer SPA)                 - Clerk JWT verification
        admin.html (admin SPA)                    - Supabase access (user + service)
        js/ + assets/                             - Twilio SMS notifications
             |                                    - Clerk webhooks
             |  fetch() + Bearer <Clerk JWT>       - Payment partner webhooks
             +----------------------------------> |
                                                        |
                                               Supabase PostgreSQL
                                               (managed database, RLS)
                                                        |
                                              Clerk (identity)  Twilio (SMS)
```

Key decisions and their rationale:

| Decision | Choice | Why |
|---|---|---|
| Frontend framework | React 18 via CDN + Babel Standalone, HTML entry files | Client requirement: no build step for the initial implementation; simple to run and to deploy on Cloudflare Pages; preserves the prototype's no-tooling philosophy while giving a real component model. Migration path to Vite is prepared (section 8). |
| Backend framework | Express 5 + TypeScript | Massive ecosystem, one framework only (no competing frameworks), mature middleware model for rate limiting / validation / error handling. |
| Database | Supabase PostgreSQL (managed) | Client requirement. No database on the Worker; the API connects to Supabase over HTTPS. |
| Auth | Clerk (system of record for identity) | Client requirement. Clerk owns registration, login, sessions, password recovery, email/phone verification, banning, deletion. The application never stores passwords. |
| Auth-to-data link | Clerk JWT (Supabase JWT template) verified by backend; RLS keyed on `sub` claim | Defense in depth: the backend authorizes every request in code, and the database additionally enforces row ownership via RLS. |
| SMS | Twilio (via Clerk for OTP, via backend for notifications) | Client requirement. One OTP system only (Clerk's); the backend sends transactional notifications. |
| Public site | Static HTML pages (Design 02 visual language) | Marketing pages need no interactivity beyond the prototype's; static = fastest, SEO-friendly, zero JS runtime cost. |
| Admin console | React CDN SPA (`admin.html`) | Same no-build philosophy; role-gated by backend `admin:*` endpoints. |
| Design preservation | `theme.css` carried over from `prototype/customer/hongkong/assets/theme.css` | The approved design is the contract; production components reproduce the same classes and tokens. |

## 2. Frontend architecture (`frontend/`)

```
frontend/
├── index.html                 public site home
├── about.html ... privacy.html   public pages (10 total, static)
├── app.html                   customer application (React CDN SPA)
├── admin.html                 administrator console (React CDN SPA)
├── assets/
│   ├── theme.css              design system (Design 02, European adjustments)
│   └── admin.css              admin console styles (Design 02 admin language)
└── js/
    ├── config.js              API_BASE_URL, CLERK_PUBLISHABLE_KEY (non-secret)
    ├── services/
    │   ├── clerk.js           ClerkJS loader, auth state, token provider
    │   ├── http.js            fetch wrapper: envelopes, auth header, errors
    │   └── api.js             typed-by-contract client for every REST resource
    ├── components/
    │   └── ui.jsx             Badge, Card, Table, Modal, Toast, Skeleton, Stat…
    ├── app/
    │   ├── shell.jsx          authed shell (sidenav, topbar, takeover-free)
    │   └── views-*.jsx        customer views (overview, accounts, deposits…)
    └── admin/
        ├── shell.jsx          admin shell (sidebar, topbar, role gate)
        └── views-*.jsx        admin views (users, deposits, audit…)
```

Rules:
- Classic scripts (no ES modules) so Babel Standalone can transform them in
  order; each file attaches to a single global namespace (`MG` for the app,
  `MGA` for admin) — mirroring the prototype's `GL` pattern.
- Views are React function components rendering the same DOM structure and
  CSS classes as the prototype views, so `theme.css` continues to apply.
- Auth views (sign-in / sign-up / profile management) mount Clerk's own
  components via ClerkJS (`mountSignIn`, `mountSignUp`, `mountUserButton`).
  The application does not reimplement credential flows.
- Every data view implements: loading skeleton, empty state, error state,
  populated state.
- `js/services/http.js` is the only module allowed to call `fetch`. It attaches
  the Clerk session token and normalizes the API envelope
  (`{success, message, data, meta}`) and error codes.
- Without configuration (missing `CLERK_PUBLISHABLE_KEY` or unreachable API),
  `app.html` renders an explicit configuration screen — never fake data.

## 3. Backend architecture (`backend/`)

```
backend/src/
├── server.ts                 bootstrap: env validation, HTTP server, graceful shutdown
├── app.ts                    Express app assembly (order: security → parsing →
│                             rate limit → routes → 404 → error handler)
├── config/env.ts             typed environment, fails fast in production
├── middleware/
│   ├── auth.ts               requireAuth (Clerk JWT), requireAdmin(role…)
│   ├── validate.ts           Zod schema validation per route
│   ├── rateLimit.ts          per-IP and per-user limits
│   ├── audit.ts              audit context attachment
│   └── error.ts              uniform error envelope, no stack leaks
├── routes/
│   ├── health.routes.ts      GET /api/v1/health (liveness + readiness)
│   ├── profile.routes.ts     GET/PATCH /api/v1/profile
│   ├── accounts.routes.ts    GET /accounts, /accounts/:currency, POST activate
│   ├── deposits.routes.ts    POST /deposits, GET /deposits
│   ├── transactions.routes.ts GET /transactions, /transactions/:reference
│   ├── statements.routes.ts  GET /statements, /statements/:id
│   ├── notifications.routes.ts GET/PATCH /notifications
│   ├── support.routes.ts     tickets + messages
│   ├── webhooks.routes.ts    POST /webhooks/clerk, /webhooks/payments/:provider
│   └── admin.routes.ts       admin surface (users, currencies, deposits,
│                             transactions, security, reports, roles, audit,
│                             settings, notifications)
├── services/
│   ├── clerk.service.ts      Clerk Backend API client (users, bans, deletion)
│   ├── supabase.service.ts   user-scoped client (RLS) + service client (system)
│   ├── twilio.service.ts     SMS with rate limit, retry, logging (no codes logged)
│   ├── deposits.service.ts   deposit lifecycle + ledger posting (transactional)
│   ├── statement.service.ts  statement generation over ledger entries
│   ├── notifications.service.ts in-app notifications + optional SMS fan-out
│   └── audit.service.ts      append-only audit log writer
└── utils/                    logger (structured JSON), pagination, money, time
```

Cross-cutting concerns:
- **API envelope**: success `{success:true, message, data, meta}` — carried over
  from the prototype contract so the frontend response handling stays familiar;
  errors `{success:false, code, message}` with stable codes
  (`INVALID_CREDENTIALS`, `FORBIDDEN`, `VALIDATION_ERROR`, `CURRENCY_UNAVAILABLE`,
  `NON_ZERO_BALANCE`, `RATE_LIMITED`, …).
- **Idempotency**: all POST endpoints that create money-adjacent records accept
  an `Idempotency-Key` header; deposit creation is idempotent by reference.
- **Pagination**: cursor-free page/page-size with totals (matches the prototype
  UI); the schema supports migrating to cursors later.
- **Rate limiting**: in-memory buckets per IP+route, with a Redis-ready interface.
- **Audit**: every administrative action, every denied attempt, every webhook
  event → `audit_logs` (append-only; RLS denies client writes).
- **Webhook signature verification**: Clerk (svix) and payment providers
  (per-provider secret) verified before any processing; unverified → 401 + log.
- **Background jobs**: minimal in-process scheduler (statement generation,
  SMS retries); designed to move to a worker when load justifies it.

## 4. Identity architecture (Clerk)

- Clerk is the **only** credential authority. The backend never sees passwords.
- **JWT verification**: every protected route verifies the Clerk session JWT
  (`@clerk/backend` `verifyToken` with the Clerk JWKS). The token's `sub` is
  the user's primary key across the system (`profiles.id`).
- **Roles**: `admin_users` (Supabase) maps Clerk user ids to admin roles
  (`super_admin`, `support`, `compliance`, `finance_readonly`). The backend
  resolves the role per request after JWT verification. Clerk `publicMetadata`
  mirrors the role for quick UI hints only — never as the authorization source.
- **Lifecycle webhooks** (`/webhooks/clerk`):
  - `user.created` → seed `profiles` row (idempotent upsert) + default-currency
    account per country mapping.
  - `user.updated` → sync email/name/phone fields.
  - `user.deleted` → **anonymize** the profile (retain the row and its id) and
    keep financial/audit records under the pseudonymized id; mark
    `deleted_at`. Financial audit records are never auto-erased.
- **Ban/unban**: enforced through Clerk's Backend API (`ban`/`unban`), mirrored
  to `profiles.status` by the admin endpoint in the same operation. A banned
  user loses their Clerk session immediately.
- **Sessions / MFA / password flows**: owned by Clerk; the customer app embeds
  Clerk components; the backend treats a valid JWT as proof of session.

## 5. Data architecture (Supabase)

See `DATABASE_DESIGN.md` for the full schema. Core invariants:

1. **Ledger is the source of truth.** `transactions` rows are immutable ledger
   entries. `accounts.balance` is a cached projection maintained in the same
   database transaction as the ledger entry (trigger + service-level double
   posting under `SELECT ... FOR UPDATE`).
2. **Money**: `numeric(19,4)`; no floats anywhere in the money path.
3. **Ownership**: every user-facing row carries `profile_id uuid` referencing
   `profiles(id)` (= Clerk `sub`). RLS policies compare
   `auth.jwt() ->> 'sub'`.
4. **Deposits never auto-succeed.** `deposits.status` transitions:
   `PENDING → COMPLETED | FAILED | CANCELLED` only via a signed payment
   partner webhook (or an explicit provider SDK callback). There is no admin
   endpoint that confirms a deposit.
5. **Audit append-only**: `audit_logs` has INSERT granted only to the service
   role; no UPDATE/DELETE policies exist; RLS denies client reads except for
   administrators.

## 6. Security architecture

- TLS everywhere (Cloudflare edge for frontend and Workers API).
- Security headers (helmet), strict CORS (single origin), body size caps,
  request timeouts.
- Deny-by-default authorization; every route declares its policy.
- Secrets only in the VM environment; `.env.example` documents every variable.
- Rate limits on auth-adjacent, SMS and mutation endpoints.
- Structured logs with request ids; the never-log list: passwords, tokens,
  keys, full card/account numbers, session cookies, authorization headers.
- See `SECURITY_REVIEW.md` for the STRIDE analysis of each surface.

## 7. Deployment architecture

- **Frontend** → Cloudflare Pages (project linked to the GitHub repository,
  build: none, output dir `frontend`). Environment variables:
  `API_BASE_URL`, `CLERK_PUBLISHABLE_KEY`.
- **Backend** → Oracle Cloud VM: Node 20 LTS, `npm ci && npm run build`,
  systemd unit (`meridian-api.service`), reverse proxy (Caddy or nginx) with
  TLS, `/api/v1/*` only; VM firewall limited to 80/443 + SSH.
- **Database** → Supabase project with point-in-time recovery enabled;
  migrations applied in order via Supabase's SQL tooling; backups per
  `DEPLOYMENT_GUIDE.md`.
- Detailed runbook: `DEPLOYMENT_GUIDE.md`.

## 8. Prepared migration path (not performed in this stage)

The frontend keeps all logic in framework-agnostic modules
(`js/services/*.js` have zero React imports). Migration to Vite:

1. `npm create vite@latest` with the React template;
2. copy `js/**` as-is; convert `MG.App` root into `src/main.jsx`;
3. replace Babel Standalone script tags with an entry bundling the same files
   in the same order;
4. swap `type="text/babel"` for `.jsx` modules with explicit imports.

No application logic changes are required by design.

## 9. External requirements (to be confirmed — not invented)

| Item | Status |
|---|---|
| European operating jurisdiction (license, entity, regulator) | **OPEN** — required before any real money movement; product is configurable by country |
| Licensed payment partner for deposits/settlement | **OPEN** — `PaymentProvider` interface implemented; partner contract required |
| Clerk production instance + SMTP/SMS providers | Configurable via environment; sandbox keys needed for E2E tests |
| Supabase production project | Migrations ready; project provisioning required |
| Twilio production numbers + messaging service | Credentials required |
| Cloudflare account/zone + Pages project | DNS migration is a change-controlled operation |
| Cloudflare API token + account ID | Workers + Pages deploy |
