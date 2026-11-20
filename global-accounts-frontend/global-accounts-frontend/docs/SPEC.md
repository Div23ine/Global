# SPEC — Meridian Global Accounts · Three Frontend Design Prototypes

International multi-currency account platform. **Frontend-only prototype**: no real backend,
no real money, no real OTP. All data is demonstration data stored in the browser.

Three independently implemented design concepts share this document so they stay
**functionally identical** while being **visually distinct**:

| # | Concept | Folder | Direction |
|---|---------|--------|-----------|
| 1 | Swiss Private Banking | `customer/swiss/` + `admin/swiss/` | Minimalist, white, deep navy, serif headings, hairline borders, generous spacing |
| 2 | Hong Kong International Fintech | `customer/hongkong/` + `admin/hongkong/` | White + blue, dark navy sidebar, rounded cards, gradient hero, charts, compact SaaS |
| 3 | Premium Global Financial Platform | `customer/premium/` + `admin/premium/` | Charcoal/ivory dark+light toggle, serif display, sheen cards, restrained blue |

Brand (all designs): **Meridian Global Accounts** · tagline “One account. Five currencies. Global access.”

---

## 1. Non-negotiable rules

1. **Honest framing, everywhere.** The platform provides *platform accounts*, NOT bank accounts,
   and NOT actual offshore accounts. Never imply real funds, real payments or regulated banking.
   Every financial screen shows a demo marker (e.g. “Demo data”). Footer of every public page:
   “Design prototype — not a live financial service.”
2. **Same behaviour in all three designs.** Use the shared engine (`shared/app-core.js`) and
   shared mock API (`shared/api.js`) exactly as documented below. Do NOT reimplement flows,
   do NOT bypass the engine, do NOT modify files under `shared/`.
3. **Every visible control works.** No decorative buttons, no dead links. If it renders, it acts.
4. **Responsive 360px → 1920px.** No horizontal overflow. Sidebar collapses to an off-canvas
   drawer with scrim on mobile; tables scroll in `.table-wrap` or become stacked cards.
5. **States**: every async view shows a skeleton while loading, an empty state when there is
   no data (new users have empty histories!), and error handling via `GL.fail(err)` toasts.
6. **Accessibility**: semantic landmarks, `<label for>`, focus-visible styles, `aria-expanded`
   on disclosure buttons, toasts `role=status`, modals `role=dialog aria-modal`.
7. No external dependencies except Google Fonts (`<link>` with system-font fallbacks).
   No build step for customer sites — plain HTML/CSS/JS, classic scripts (no ES modules).
8. Avoid heavy animation. Transitions ≤ 250ms. Respect `prefers-reduced-motion`.

## 2. File layout per design (customer side)

```
customer/<design>/
├── index.html                 home
├── about.html                 about
├── what-is-offshore.html      what is an offshore account?
├── how-it-works.html          how it works
├── currencies.html            supported currencies
├── features.html              account features
├── faq.html                   FAQ
├── contact.html               contact
├── terms.html                 terms & conditions
├── privacy.html               privacy policy
├── app.html                   customer application (auth + dashboard, hash-routed)
└── assets/
    ├── theme.css              FULL design system for this concept (site + app)
    ├── components.js          injects site header/footer into public pages
    ├── views.js               app.html views part 1 (frame, skeleton, auth, core dashboard)
    └── views-more.js          app.html views part 2 (remaining dashboard views)
```

### Public page shell (exact)

```html
<!DOCTYPE html>
<html lang="en" data-concept="<design>">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>… — Meridian Global Accounts</title>
  <meta name="description" content="…">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=<design fonts>" rel="stylesheet">
  <link rel="stylesheet" href="assets/theme.css">
</head>
<body data-page="home"><!-- home|about|what-is-offshore|how-it-works|currencies|features|faq|contact|terms|privacy -->
  <a class="skip-link" href="#main">Skip to content</a>
  <div id="gl-header"></div>
  <main id="main"> … page content only … </main>
  <div id="gl-footer"></div>
  <script src="../../shared/icons.js"></script>
  <script src="../../shared/data.js"></script>
  <script src="../../shared/api.js"></script>
  <script src="../../shared/site-core.js"></script>
  <script src="assets/components.js"></script>
  <script src="../../shared/demo-panel.js"></script>
</body>
</html>
```

### app.html shell (exact)

```html
<!DOCTYPE html>
<html lang="en" data-concept="<design>">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meridian Global Accounts — Customer Application</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=<design fonts>" rel="stylesheet">
  <link rel="stylesheet" href="assets/theme.css">
</head>
<body data-page="app">
  <a class="skip-link" href="#gl-main">Skip to content</a>
  <div id="gl-app" aria-live="polite"></div>
  <div id="gl-toasts" class="gl-toasts" aria-live="polite"></div>
  <div id="gl-modal" class="gl-modal-root" hidden></div>
  <script src="../../shared/icons.js"></script>
  <script src="../../shared/data.js"></script>
  <script src="../../shared/api.js"></script>
  <script src="../../shared/charts.js"></script>
  <script src="assets/views.js"></script>
  <script src="assets/views-more.js"></script>
  <script src="../../shared/app-core.js"></script>
  <script src="../../shared/demo-panel.js"></script>
</body>
</html>
```

`components.js` (per design) renders `<header data-site-header>` + mobile panel into `#gl-header`
and `<footer data-site-footer>` into `#gl-footer`, using each design’s own markup/classes.
Site nav links: Home, About, What Is an Offshore Account?, How It Works, Currencies, Features,
FAQ, Contact · actions: “Sign in” → `app.html#/login`, “Create Account” → `app.html#/register`.
If `GL.api.session.get()` exists, “Sign in” becomes “Dashboard” → `app.html#/overview`.

---

## 3. The GL.Views contract (app.html)

`views.js` defines `GL.Views = { frame, skeleton, notFound, … }`; `views-more.js` adds the rest.
Every view is `GL.Views[viewId](S) → html string`. The engine renders
`root.innerHTML = GL.Views.frame(S, content)` then calls `GL.Views.bind(root)` (optional).

### Engine state `S` (read-only for views)

| Field | Meaning |
|---|---|
| `S.view`, `S.param`, `S.title` | current route (`TITLES` map in app-core) |
| `S.user` | sanitized user (or `null`) |
| `S.me` | `{ accounts:[{code,name,symbol,status,balance,txCount,equivalentUsd,openedAt}], totalUsd, rates, mode }` |
| `S.takeover` | truthy while in admin takeover mode → frame must show the takeover banner |
| `S.dep` | deposit wizard (`null` or `{step:'form'\|'gateway'\|'processing'\|'result', currency, amount, method, methodName, fee, ref, result, balanceAfter, message, duplicate}`) |
| `S.data.*` | per-view caches (see route table) |
| `S.txnFilters` | `{search, currency, status, from, to, page}` |
| `S.demoOtp`, `S.verified`, `S.reset`, `S.frozenReason` | auth-flow handoff data |
| `S.intended` | post-login destination (engine-managed) |

### Routes (engine `PROTECTED` set + auth views)

| Route | View id | Data ready in | Requirements |
|---|---|---|---|
| `#/login` | login | — | `loginForm` (email,password); demo-user quick-fill chips via `data-action="loginDemo" data-email="…"` (list `GL.DEMO_CREDENTIALS.customers`, password `GL.DEMO_CREDENTIALS.customerPassword`); links to forgot/register |
| `#/register` | register | — | `registerForm` (fullName,email,country,phone,password,confirm,agree). Country `<select>` from `GL.COUNTRIES`, label `“Nigeria — NGN default”`. Demo-notice checkbox `agree`. Note: “codes are simulated and shown on screen” |
| `#/verifyEmail` | verifyEmail | — | OTP block + `verifyEmailForm`; demo-code hint from `GL.api.demo.pendingOtp()` (`.emailOtp`) or `S.demoOtp.email`; resend `data-action="otp:resend" data-channel="email"` + `<span data-countdown="otp-email">`; wrong code → `.otp-err` (engine fills) |
| `#/verifyPhone` | verifyPhone | — | same, channel `phone`, hint `.phoneOtp` |
| `#/verified` | verified | — | success screen: “Your `S.verified.currency` account is active with a zero balance”, account id `S.verified.accountId`, CTA `data-action="verified:go"` |
| `#/verifyFailed` | verifyFailed | — | locked state (5 wrong attempts): resend (`otp:resend`)+ back to sign in |
| `#/forgot` | forgot | — | `forgotForm` (email). On success engine redirects to reset |
| `#/reset` | reset | — | `resetForm` (password, confirm) + readonly display of `S.reset.token` (demo token) |
| `#/gate` | gate | — | “Please log in or create an account to access this feature.” + both buttons |
| `#/frozen` | frozen | — | reason (`S.frozenReason` or `S.user.freezeReason`), support link, `unfreeze:self` ONLY if `S.user.frozenBy==='Customer (self)'`, else “an administrator froze this account — contact support” |
| `#/adminNotice` | adminNotice | — | “signed in as administrator — use Account Takeover from the admin console”, button `data-action="admin:console"` |
| `notFound` | notFound | — | 404 card |
| `#/overview` | overview | `S.data.recentTxns`, `S.data.notifs`, `S.data.security` | total balance hero (`S.me.totalUsd`, usd), currency cards from `S.me.accounts`, quick actions (Deposit→`#/deposits`, Activate currency→`#/activate`), recent transactions (6), notifications preview (3), security summary (MFA on/off, active sessions count, suspicious events count). Optional: donut chart of currency distribution via `GL.charts.donut` |
| `#/accounts` | accounts | `S.me` | every account card: code, name, status badge, balance, txCount, equivalentUsd, “View account”→`#/account/CODE`; un-activated supported currencies → “Activate”→`#/activate` |
| `#/account/:code` | account | `S.data.account` = `{account, transactions, deposits}` (`S.data.accountError` on 404) | account header (balance, opened date, equivalent), transaction table, deposit records list, back to accounts |
| `#/activate` | activate | `S.data.currencies` | card per currency with the 4 states: **available** → `data-action="activate:currency" data-code="USD"`; **active** (`activeForMe`) → “Active” + link `#/account/CODE` (already-activated state); **unavailable** (`status!=='active'`) → disabled + note (temporarily-unavailable state); **unsupported** → “Request a currency” `currencyRequest` form (input `name="code"`) — engine surfaces `UNSUPPORTED_CURRENCY` errors in `.field-err`/`[data-currency-request-note]`. Show default-currency badge (`isDefault`). New accounts start at zero — say so |
| `#/deposits` | deposits | `S.data.deposits` | if `S.takeover` → restriction notice instead of wizard. `S.dep===null` → landing: active-account picker (`data-action="dep:new"`), deposit history table (ref, currency, amount, method, status badge, date). `S.dep.step` states: **form** → `depForm` (currency select of ACTIVE accounts, amount, method radio cards from `GL.DEPOSIT_METHODS` filtered by currency incl. fee note, limits from `GL.DEPOSIT_LIMITS`); **gateway** → `gatewayForm` (cardName/cardNumber/cardExpiry/cardCvc, prefilled demo values `4242 4242 4242 4242`, `12/28`, `123`) or bank-transfer instructions; summary of ref/amount/fee/method; “Pay now” submits, “Cancel payment” = `data-action="dep:gateway-cancel"`; **processing** → spinner panel; **result** → by `S.dep.result.status`: successful (green, credited, new balance `S.dep.balanceAfter` via `GL.fmt.money(x, currency)`), pending (amber, NOT credited), failed (red, retry `dep:retry`), cancelled (grey, retry), plus on every result a subtle demo link `data-action="dep:duplicate"` “Attempt duplicate (demo)” and `data-action="dep:done"` Done. `S.dep.duplicate===true` → duplicate screen (409 text). Always label the gateway “Simulated payment — no real money moves” |
| `#/transactions` | transactions | `S.data.transactions` = `{items,total,page,pages}` | filter bar `txnFilters` (input `search`, select `currency`, select `status` [successful,pending,failed,cancelled], dates `from`/`to`, Clear = `data-action="txn:clear"`), results count, table (ref, description, currency, amount, status badge, date — row links `#/txn/REF`), pagination `data-action="txn:page" data-page="n"`, empty state |
| `#/txn/:ref` | txn | `S.data.txn` / `S.data.txnError` | detail card (all fields + method label) + back link |
| `#/statements` | statements | `S.data.statements` | row per statement (period, currency, opening→closing, count, `data-action="statement:download" data-id="…"`); “Preview” calls `GL.api.statements.get(id)` then `GL.modal` with the lines; note “demo text file”; empty state for new users |
| `#/profile` | profile | `S.me` | `profileForm` (firstName,lastName,phone,address) prefilled; read-only: email, country, account id, default currency; takeover note if `S.takeover` |
| `#/security` | security | `S.data.security` = `{mfaEnabled, events, loginHistory, suspicious}` | MFA card + `data-action="mfa:toggle"`; suspicious alerts list; temporary freeze (`freeze:self`, or `unfreeze:self` when frozen by self); account recovery card (link `#/forgot`); `passwordForm` (current,next,confirm); security event history table |
| `#/sessions` | sessions | `S.data.sessionsData` = `{active, history}` | active sessions (device, browser+os, ip, location, last active, “This device” badge for `current`), revoke `data-action="session:revoke" data-id`; history section |
| `#/notifications` | notifications | `S.data.notifs` | unread emphasis, per-item “Mark read” `data-action="notif:read" data-id`, “Mark all read” `data-action="notif:read" data-id="all"`, relative time `GL.fmt.timeAgo`, empty state |
| `#/support` | support | `S.data.tickets` | `supportForm` (subject, category select [General,Deposits,Currencies,Security,Account], message) + ticket threads (customer/support bubbles, status badge); success toast; empty state |
| `#/settings` | settings | `S.me` | `prefsForm` (checkboxes emailNotifs, pushNotifs, weeklySummary from `S.user.prefs`), account summary card, links row (Profile, Security, Sessions) |

### frame(S, content)

- Auth views (list in app-core `AUTH_VIEWS`) → centered card layout, brand link `index.html`,
  preview note. No sidebar.
- Signed-in shell: `.shell` grid with `.sidenav` (brand, nav groups “Banking”: overview, accounts,
  activate, deposits, transactions, statements; “Account”: notifications, profile, security,
  sessions, support, settings; active item = current view, notification badge via `GL.unreadCount()`),
  `.topbar` (menu button `[data-shell-nav-toggle]`, `<h1 id="gl-viewtitle" tabindex="-1">S.title</h1>`,
  preview chip, bell → `#/notifications`, user chip with initials `GL.fmt.initials`),
  `<main class="content" id="gl-main">content</main>`, `.scrim`.
- **Takeover banner** (when `S.takeover`): sticky top bar — “ADMINISTRATIVE TAKEOVER — You are
  viewing {`S.user.name`}’s account · read + permitted edits · the customer is not notified” +
  End takeover button `data-action="end:takeover"`.
- Maintenance mode: if `GL.db().settings.maintenanceMode` → thin notice bar “Scheduled platform
  maintenance (demo)”.
- Demo marker visible in the shell (preview chip “Demo environment”).

### skeleton(view)

Generic shimmer: page title bar + 4 stat blocks + 2 panels, using `.skel` blocks
(typed per view if you wish). Engine shows it while loading.

### OTP markup contract (engine wires it)

```html
<form data-form="verifyEmailForm" novalidate>
  <div class="otp-input" aria-label="6-digit code">
    <input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 1">
    … × 6
  </div>
  <input type="hidden" name="otp" value="">
  <p class="otp-err" hidden></p>
  <button class="btn btn-primary btn-block" type="submit">Verify</button>
</form>
```

Demo hint: `var p = GL.api.demo.pendingOtp();` → show `p.emailOtp` / `p.phoneOtp` in a
`.preview-note` (“Demo mode — your code is 123456”).

## 4. CSS classes every theme must style (behaviour contract)

`GL.toast/modal` inject: `.gl-toast.tone-ok|.tone-err|.tone-info` (+`.out`), `.gl-modal-root`,
`.gl-modal-backdrop`, `.gl-modal`, `.gl-modal-body`, `.gl-modal-actions`.
Engine/forms use: `.field`, `.field-err`, `.otp-input`, `.otp-box`, `.otp-err`,
`.btn` (+`.btn-primary .btn-ghost .btn-danger .btn-block .btn-lg .btn-sm`), `.icon-btn`,
`.is-busy` (submit buttons get this while pending — style a spinner), `.skel` (skeleton blocks),
`.gl-loading`, `.empty` (empty states), `.badge` + `.b-successful .b-pending .b-failed
.b-cancelled .b-duplicate .b-active .b-frozen .b-unavailable .b-open .b-resolved .b-read`,
`.table-wrap`, `.takeover-banner`, `.preview-chip`, `.skip-link`, `.scrim`, `.gate-wrap/.gate-card`,
`.auth-wrap/.auth-card`, `.nav-item.active`, `.acc-item/.acc-btn/.acc-body` (FAQ accordion),
`.tick-item` (currency ticker), `.gl-chart-tip` is self-styled by charts.js.
Status badge helper suggestion: `function badge(st){return '<span class="badge b-'+st+'">'+st+'</span>';}`.

## 5. Public site content (all 10 pages per design)

Shared substance comes from `GL.DATA` — render it in your design’s language:

- **home** — hero (headline + subcopy + CTAs “Create your account”→`app.html#/register`,
  “See how it works”→`how-it-works.html`), optional sample account card (clearly “sample figures”),
  stats strip from `GL.PLATFORM_STATS` (marked demo), features preview (top 4 of `GL.FEATURES`),
  how-it-works (top 3 `GL.HOW_STEPS`), currencies strip (5 supported + “JPY unavailable”),
  security section, CTA band. Optional `[data-currency-ticker]` (site-core fills it).
- **about** — demo company story, values cards, team placeholder-free (no fake photos),
  “what this prototype is” callout.
- **what-is-offshore** — `GL.WHAT_IS_OFFSHORE.intro` + `sections` grid +
  misconceptions accordion + prominent callout: “Meridian provides platform accounts — not
  bank accounts, and not actual offshore banking services.”
- **how-it-works** — `GL.HOW_STEPS` as a timeline; note that OTP codes are simulated and shown
  on screen in this prototype.
- **currencies** — cards per `GL.CURRENCIES` (JPY shows the unavailable state + note), rates
  table (`GL.RATES` + `GL.RATES_NOTE`), country→default-currency table from `GL.COUNTRIES`
  (+ `GL.COUNTRY_NOTE`).
- **features** — `GL.FEATURES` grid + 2–3 deeper sections.
- **faq** — `<div data-faq-list></div>` (site-core renders the accordion from `GL.FAQ`).
- **contact** — `[data-contact-form]` form (name, email, topic select, message) + success
  block `[data-form-success] hidden` + demo support details (`GL.db().settings.supportEmail`).
- **terms / privacy** — render `GL.TERMS_SECTIONS` / `GL.PRIVACY_SECTIONS` as headed sections.
  No lorem ipsum, no placeholders.

## 6. Mock API quick reference (full source: `shared/api.js`)

Envelope `{success, message, data, meta}`; rejections carry `{code, status, message, data}`.
Key codes: `INVALID_CREDENTIALS, VERIFICATION_REQUIRED(data.stage), ACCOUNT_FROZEN(data.reason),
OTP_LOCKED, INVALID_OTP, DUPLICATE_REFERENCE, UNSUPPORTED_CURRENCY, CURRENCY_UNAVAILABLE,
ALREADY_ACTIVE, TAKEOVER_FINANCIAL_BLOCKED, FORBIDDEN_FINANCIAL, NON_ZERO_BALANCE, OTP…`

Important: currency availability is live — the demo panel (and admin) can switch a currency to
“temporarily unavailable” and the customer Activate page must reflect it (engine re-fetches on
storage events; also on route). Deposit outcome forcing: `GL.api.demo.forcedOutcome()` — the
gateway must NOT hardcode outcomes; the engine asks the API.

## 7. Admin app (React + Vite, per design)

```
admin/<design>/
├── package.json          react ^18.3.1, react-dom ^18.3.1, vite ^5.4.8, @vitejs/plugin-react ^4.3.1
├── vite.config.js        base:'./', plugins:[react()]
├── index.html            <div id="root"> + <script type="module" src="/src/main.jsx">
└── src/
    ├── main.jsx          createRoot(<App/>)
    ├── App.jsx           shell: login gate, sidebar (14 sections), topbar, hash router
    ├── components.jsx    Icon (uses window.GL.icon), Badge, StatCard, Table, Skeleton, Toast, Confirm…
    ├── pages-core.jsx    Dashboard, Users, UserViewer, Takeover
    ├── pages-ops.jsx     Currencies, Deposits, Transactions, Payments
    ├── pages-sys.jsx     Security, Reports, Support, Roles, Audit, Settings
    └── styles.css        the design’s admin styling (same language as its customer app)
```

`package.json` scripts: `"dev": "vite", "build": "vite build", "preview": "vite preview"`.
Import the shared layer as side-effect modules FIRST in `main.jsx`:

```js
import '../../../shared/icons.js';
import '../../../shared/data.js';
import '../../../shared/api.js';
import '../../../shared/charts.js';
import '../../../shared/demo-panel.js';
```

…then use `window.GL.*` everywhere (`GL.api.admin.*`, `GL.fmt`, `GL.icon`, `GL.charts`).
The shared db makes admin actions (freeze, currency availability, replies) visible in the
customer apps on the same origin.

### Admin pages

| Route | Page | API | Must include |
|---|---|---|---|
| `#/login` | Login | `admin.login` | demo credentials card (`GL.DEMO_CREDENTIALS.admin`) with quick-fill; error states |
| `#/dashboard` | Overview | `admin.dashboard` | KPI cards (users, active, frozen, pending deposits, volume USD, open tickets, suspicious events), 30-day deposits area chart, outcome-mix bars, currency distribution donut (`GL.charts.*` with your palette), recent users table, pending deposits list |
| `#/users` | User Management | `admin.users` | search + status filter (active/frozen) + country filter, table (name, email, country, currencies, status badge, joined, volume), row → viewer; empty state |
| `#/users/:id` | Individual Account Viewer | `admin.user` | profile card (with permitted-edit form → `admin.updateProfile`), accounts + balances, recent transactions, deposits, sessions, security events; **Takeover** button (confirm → `admin.takeover(id, '<design>')` → `window.location.href = res.data.redirect`); currency activate/deactivate (`admin.setUserCurrency`); freeze/unfreeze with reason (`admin.freezeUser/unfreezeUser`); optional manual notification (`admin.notifyUser`) — labelled “manual — users are not notified automatically”; **financial restrictions panel**: five attempt buttons (edit balance, withdraw, transfer, alter deposit, edit ledger) calling `admin.attemptRestricted` → each shows the 403 rejection inline |
| `#/takeover` | Account Takeover | `admin.users` + audit | search + “Enter takeover” per user; active-takeover card; takeover history from audit log (`action:takeover_start/end`); explains read+permitted-edit policy |
| `#/currencies` | Currency Management | `admin.currencies`, `admin.setCurrencyAvailability` | table (code, name, customers, status) with availability toggle → audit + live effect on customer side; JPY seeded unavailable |
| `#/deposits` | Deposit Management | `admin.deposits` | status filter, table; deposit detail modal; **explicit notice**: administrators cannot confirm or alter deposits (demonstrate via `admin.attemptRestricted('alter_deposit')`) |
| `#/transactions` | Transactions | `admin.transactions` | search + status + currency filters, table with user column |
| `#/payments` | Payment Monitoring | `admin.payments` | outcome filter, attempts table (reference, user, method, amount, outcome, duration, forced flag), outcome stats |
| `#/security` | Security Monitoring | `admin.securityEvents` | events feed w/ suspicious filter, freeze/unfreeze panel (select user + reason) |
| `#/reports` | Reports | `admin.reports` | charts (deposits by method, outcome mix, users by country) + tables + CSV export via `GL.util.downloadText` + `GL.util.toCsv` |
| `#/support` | Support | `admin.tickets`, `admin.replyTicket`, `admin.resolveTicket` | ticket list, thread view, reply box, resolve toggle |
| `#/roles` | Admin Roles | `admin.roles` | role cards + permission matrix table (`matrix.rows`, `matrix.columns`) — note “Blocked = enforced in service layer” |
| `#/audit` | Audit Logs | `admin.auditLog` | search + result filter (allowed/denied), table (time, actor, action, target, detail, result badge); denied rows highlighted |
| `#/settings` | Settings | `admin.settings`, `admin.updateSettings` | platform name, maintenance-mode toggle (shows banner in customer apps), support email; save → toast + audit |

Admin shell: sidebar with grouped nav + section labels, topbar (title, demo chip, admin chip),
mobile off-canvas nav, toasts, confirm dialogs, skeletons on every page, empty states, sign-out
(`GL.api.auth.logout` → back to `#/login`).

## 8. Acceptance checklist (per design)

- [ ] All 10 public pages render with working nav, mobile drawer, footer, demo disclaimers
- [ ] Registration: full name/email/country/intl phone/password → email OTP → phone OTP → verified
      (default currency auto-activated, zero balance)
- [ ] Login: wrong password error; unverified routing; frozen screen with reason; demo quick-fill works
- [ ] Forgot/reset password flow works end-to-end (demo token)
- [ ] Overview/accounts/account views with correct balances (`GL.fmt.money`)
- [ ] Activate Currency shows all four states; activation succeeds and appears everywhere
- [ ] Deposits: form → review/gateway → result for all five outcomes; success credits the right
      currency only; pending/failed/cancelled/duplicate never credit; history updates
- [ ] Transactions: search + filters + pagination + detail; statements list/preview/download
- [ ] Profile edits, password change, prefs, MFA toggle, session revoke, freeze/unfreeze self
- [ ] Notifications and support tickets work
- [ ] Admin: login, dashboard, users/viewer, takeover → customer app with banner, permitted edits,
      blocked financial ops (403s), audit entries, freeze/unfreeze, currency config, payments
      monitoring, reports, tickets, roles, audit, settings
- [ ] Mobile 390px: drawer nav, no horizontal overflow, readable tables
- [ ] No console errors; no TODO/placeholder text; no dead buttons

## 9. Verification commands

```bash
node --check customer/<design>/assets/views.js
node --check customer/<design>/assets/views-more.js
node --check customer/<design>/assets/components.js
cd admin/<design> && npm install && npm run build   # dist/ opens directly
```
