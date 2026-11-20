# Meridian Global Accounts — Three Frontend Design Prototypes

An **International Multi-Currency Account Platform** presented as three complete,
independently implemented frontend design concepts, built so a client can explore
each one end-to-end and select a direction before production development begins.

> **This is a frontend-only prototype.** There is no backend, no database and no
> real money. Every user, balance, transaction, statement, payment and statistic
> is demonstration data stored in your browser. Meridian is a placeholder brand.
> The platform provides *platform accounts* — not bank accounts, and not actual
> offshore banking services.

---

## 1. Open it

**Easiest:** double-click `index.html` (the design-selection page). Everything
works from the filesystem in Chrome, Edge or Firefox.

**Recommended for full cross-app demos** (admin ↔ customer live sync via
`localStorage`): serve the folder over http:

```bash
cd global-accounts-frontend
python3 -m http.server 4173
# → http://localhost:4173/
```

The Next.js scaffold in this workspace also serves a copy at
`/public/global-accounts-frontend/` when running `npm run dev`.

## 2. The three designs

| # | Concept | Customer site & app | Admin console (React) |
|---|---------|--------------------|------------------------|
| 1 | **Swiss Private Banking** — white, deep navy, serif, hairline precision | `customer/swiss/` | `admin/swiss/dist/index.html` |
| 2 | **Hong Kong International Fintech** — white + blue, dark navy sidebar, gradient hero, charts | `customer/hongkong/` | `admin/hongkong/dist/index.html` |
| 3 | **Premium Global Financial Platform** — charcoal/ivory, dark + light toggle, serif display | `customer/premium/` | `admin/premium/dist/index.html` |

All three implement **identical functionality** (same flows, same mock API, same
demo data) so the visual experience can be compared fairly. `index.html` shows
side-by-side previews and records the client's choice via **Choose this design**
(stored in `localStorage`).

## 3. Demo accounts

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Customer | `amara.okafor@example.com` | `Demo1234!` | Nigeria · NGN + USD, active history |
| Customer | `james.whitfield@example.com` | `Demo1234!` | UK · GBP + EUR + USD |
| Customer | `elsa.baumann@example.com` | `Demo1234!` | Switzerland · **frozen** (security demo) |
| Customer | `remy.laurent@example.com` | `Demo1234!` | France · EUR only |
| Customer | `adaeze.nwosu@example.com` | `Demo1234!` | Nigeria · phone verification pending |
| Administrator | `nadia.farouk@meridian.example` | `Admin1234!` | Super Administrator |

Admin email is exactly `nadia.farouk@meridian.example`. Or register a brand-new
account — the country you pick determines the default currency
(NG→NGN, US→USD, GB→GBP, CH→CHF, eurozone→EUR, others→USD), activated
automatically after simulated email + phone OTP.

## 4. What each design includes

**Public website (10 pages):** Home · About · What Is an Offshore Account? ·
How It Works · Supported Currencies · Account Features · FAQ · Contact · Terms ·
Privacy — plus Sign in / Create account (in `app.html`).

**Customer application (`app.html`, 25 screens):** login, registration with
simulated email/phone OTP, forgot/reset password, verification success/failure,
account overview, My Accounts, per-currency account detail, **Activate Currency**
(available / already-active / temporarily-unavailable / unsupported states),
**Deposits** (4 methods; mock gateway returning SUCCESS, PENDING, FAILED,
CANCELLED and DUPLICATE), Transactions (search + currency/status/date filters,
pagination, detail view), Statements (preview + demo download), Profile,
Security (MFA, suspicious alerts, temporary freeze, recovery), Login Sessions,
Notifications, Support, Settings.

**Admin console (React, 15 screens):** login, dashboard (KPIs + charts),
User Management, Individual Account Viewer, **Account Takeover**, Currency
Management (live availability toggles), Deposit Management, Transactions,
Payment Monitoring, Security Monitoring (freeze/unfreeze with reason), Reports
(+ CSV export), Support, Admin Roles, Audit Logs, Settings (maintenance mode
shows a banner in the customer apps).

**Takeover:** the admin enters a customer's dashboard with a permanent
on-screen indicator, can edit permitted profile fields and manage currency
activation — while **financial operations are enforced as blocked in the mock
service layer** (`403 FORBIDDEN_FINANCIAL`): no balance edits, withdrawals,
transfers, deposit-confirmation changes or ledger edits, for any admin role.
Every administrative action lands in the audit log, including denied attempts.
Users are **not** notified automatically; a manual notification action exists.

## 5. Presentation tools (bottom-right on every page)

- **Simulated OTP codes** for the current registration flow
- **Force next payment outcome** — success / pending / failed / cancelled / duplicate
- **Currency availability toggles** — flips a currency to “temporarily unavailable”
  and watch the customer Activate page react
- **Design switcher** — jump to the same place in another design
- **Reset demo data** — restores the original demo state

## 6. Architecture (the backend seam)

```
global-accounts-frontend/
├── index.html + assets/          design-selection page
├── docs/SPEC.md                  functional contract all three designs implement
├── shared/                       behaviour layer, shared by everything
│   ├── data.js                   demo dataset + seed (balances always = ledger sum)
│   ├── api.js                    MOCK API facade — simulated latency + envelopes
│   ├── app-core.js               customer app engine (router, flows, forms, actions)
│   ├── site-core.js              public-site behaviours (nav, accordions, ticker…)
│   ├── icons.js  charts.js       SVG icon set · canvas charts
│   └── demo-panel.js/.css        presentation controls overlay
├── customer/<design>/            static site + hash-routed app (no build step)
└── admin/<design>/               React + Vite source; dist/ is a single-file build
```

`shared/api.js` is the seam: every screen talks to `GL.api.*` only. When the
backend exists, each method body becomes a `fetch()` to the corresponding
endpoint (`POST /api/v1/auth/register`, `GET /api/v1/accounts/balances`,
`POST /api/v1/deposits`, `POST /api/v1/admin/takeover`, …) and **no screen code
changes**. Response envelope: `{ success, message, data, meta }`; rejections
carry `{ code, status, message }` — e.g. `DUPLICATE_REFERENCE (409)`,
`FORBIDDEN_FINANCIAL (403)`, `CURRENCY_UNAVAILABLE (422)`,
`VERIFICATION_REQUIRED (403)`.

Demo state lives in `localStorage["gl_db_v1"]`; cross-tab changes propagate via
the Storage event (same origin). In production this becomes websockets/polling.

**Admin financial restrictions are enforced in `GL.api.admin`**, not by hiding
buttons — `attemptRestricted()` always rejects and records a denied audit entry.

## 7. Suggested 10-minute client walkthrough

1. `index.html` — the three directions, choose one (recorded).
2. Enter the design → public site → honest “what this is” framing.
3. `app.html#/register` — register with a real country; enter the simulated codes.
4. Overview — country default currency active, zero balance, empty states.
5. Activate another currency; try JPY (temporarily unavailable) and a bogus code
   in “request a currency” (unsupported).
6. Deposit: card → SUCCESS; then force FAILED in demo controls → not credited;
   bank transfer → PENDING; “Attempt duplicate” → 409 screen.
7. Transactions + filters, statement preview + download (demo text file).
8. Admin console → login → dashboard → users → open a customer.
9. Try “Edit balance” → 403 in the UI (and in the service layer).
10. Enter takeover → banner in the customer app, deposits blocked, permitted
    profile edit, end takeover → audit log shows everything.

## 8. Development notes

```bash
# customer apps: no build — open the HTML files directly
# admin apps (React + Vite, single-file build to dist/):
cd admin/swiss && npm install && npm run build     # dist/index.html
cd admin/hongkong && npm install && npm run build
cd admin/premium && npm install && npm run build
```

Verified during the build (see `scripts/` in the workspace): 75 API contract
tests, 19 customer-flow checks × 3 designs, 12 admin-flow checks × 3 designs,
105 page/route render checks — all passing with zero console errors, no
horizontal overflow at 390 px, and ledger integrity (balances always equal the
sum of successful ledger entries).

## 9. Limitations (deliberate)

- No real OTP delivery, no real payments, no real rates — everything is simulated.
- No production security boundary: a frontend prototype cannot enforce anything;
  all restrictions here demonstrate the *intended* enforcement points for the
  backend team.
- Single browser session slot (customer or admin); takeover converts the admin
  session (URL-token handoff makes it work across apps even on `file://`).
