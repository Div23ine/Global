# PROJECT STATUS — Meridian Global Accounts

Last updated: 2026-11-23 (SMS-OTP removal + email-OTP signup fix + second
super admin + offshore-copy removal pass complete; published to
`origin/development` via the GitHub contents API. The paired
lockfile/workflow CI files remain local-only: GitHub rejects workflow-file
writes for this token — see "Push" below. Nothing deployed or migrated.)

## Current state

Cloudflare-native frontend/API, Supabase PostgreSQL and Supabase Auth.
PRs #1–#3 (Worker compatibility groundwork, Supabase Auth migration) are
MERGED into `development`; the feature branches are fully contained. The
Supabase Auth code — browser client, backend token verification, canonical
profile mapping, migration 0007 — is the active implementation on
`development`. Production is still running the older Worker build; no deploy
or production cutover has happened since these changes.

### Hosting and services

| Component | Platform / status |
|---|---|
| Frontend | Cloudflare Pages, custom domain https://meridian.uk.com |
| Backend API | Cloudflare Worker named global, custom domain https://api.meridian.uk.com |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth (email magic-link sign-in + second email OTP; email/password registration with email OTP — the SMS/phone OTP step was removed with the Twilio pass) |
| Email notifications | Resend; Auth confirmation/recovery SMTP configured separately in Supabase |
| SMS | Removed — `twilio.service.ts` deleted, `notifyWithSms` gone, no SMS OTP anywhere (customer verification is email-only) |

## Issue #4 pass (2026-11-22/23): what changed on `development`

Local commits (NOT pushed — pushing requires explicit owner authorization):

1. `fix(ci)` — regenerated `backend/package-lock.json`; `npm ci` now completes.
   This was the recorded Worker-CI blocker (workflow run 44956097936).
2. `fix(db)` — migration 0008 is now guarded on the presence of
   `public.rls_auto_enable()`. That function was provisioned directly in the
   live Supabase project and exists in no migration, so every fresh database
   (CI, rehearsal) failed at 0008 and silently skipped the entire 22-test
   integration suite. Fresh replays now work; live environments keep the
   hardening.
3. `fix(db)` — migration 0013 seeds one clearly-labeled OPERATIONAL PLACEHOLDER
   receiving bank per supported currency, only when the currency has no active
   receiving account. Production rows (owner-verified bank details entered
   through the admin console) are never touched; no bank detail numbers are
   invented (account_number/iban/swift_bic stay NULL). Fixes fresh-environment
   bank-transfer flow and un-skips three admin RPC integration tests.
4. `fix(db)` — migration 0014 RESTORES the deposit transition state machine
   that migration 0006 had silently dropped: the database accepted arbitrary
   status rewinds (completed → pending/failed), allowing a completed deposit
   to be re-opened and re-credited. Terminal states are now final; the full
   matrix used by the manual bank-transfer workflow and legacy provider
   webhooks is enforced in the trigger; regression test added.
5. `fix(auth)` — money-moving admin endpoints (deposit assign-bank /
   verify-credit / reject, receiving-bank writes, refund create / approve /
   reject) were gated only by `deposits.read`, so the read-only `compliance`
   and `finance_readonly` roles could credit balances, approve refunds and
   edit receiving bank details. They now require `deposits.manage` /
   `refunds.manage` per the seeded role matrix. `requireAdmin()` attaches
   `requiredPermissions` and a contract test locks the matrix
   (`tests/unit/admin-permissions.test.ts`).
6. `fix(api)` — router-level auth gates were unscoped (`router.use(requireAuth)`
   on routers mounted at `/`), so every unknown `/api/v1` path returned 401
   instead of 404 and gates fired on paths that never matched. Gates are now
   scoped to their path prefixes; authorization coverage is unchanged and
   contract-tested. `API_SPECIFICATION.md` corrected: `GET /currencies` is a
   customer endpoint (its `activeForMe` flags need the verified profile).
7. `fix(frontend)` — `js/admin/main.jsx` was missing one closing parenthesis;
   Babel Standalone failed to parse it at runtime and the ENTIRE admin console
   rendered blank in production. Fixed and verified in a real browser.
   Registration placeholders Nigeria/NG/+234 → Germany/DE/+49 per the
   documented European positioning.
8. CI — Worker workflow now runs `npm ci`; both workflows validated as YAML.

## Verification status after this pass

| Check | Status |
|---|---|
| `npm ci` in backend | PASS |
| `npm run typecheck` | PASS (0 errors) |
| `npm run lint` | PASS (0 findings) |
| `npm test` (unit + real-Postgres integration) | PASS — 41/41 (integration suite runs again; 3 admin-RPC tests un-skipped) |
| frontend `check.sh` (node --check + esbuild parse) | PASS — all modules |
| API runtime (local) | PASS — boots; `/api/v1/health` 200; `/public-config` honest `SERVICE_NOT_CONFIGURED` without secrets; protected routes 401; unknown paths 404 |
| Browser — customer app (local harness) | PASS — sign-in and registration render with all 8 required fields; weak-password / mismatch / ISO-code validation observed; mobile viewport no horizontal overflow; no console errors |
| Browser — admin console (local harness) | PASS — sign-in renders after the JSX fix; magic-link form errors surface correctly; no console errors |
| Visual vs prototype (public pages) | PASS — Design 02 identity preserved (badge, hero mockup, buttons, typography); EUR-first wording and NGN removal match the documented product decisions; "not a bank" disclaimer present |
| Live Supabase Auth journeys (email OTP, magic-link callback, TOTP) | BLOCKED — requires live Supabase credentials; environment intentionally has none |
| Live two-user RLS against the production Supabase project | BLOCKED — same credential requirement (two-user isolation IS covered by the embedded-Postgres integration tests) |
| Production deployment / migration application | NOT PERFORMED — requires owner authorization |

## Exact next tasks

1. Owner review of the local `development` commits; push when authorized.
2. Rehearse migrations 0008–0014 against a production-like backup, then apply
   0013/0014 (and the live-DB behavior of 0008) during the coordinated
   maintenance window together with the new Worker deploy.
3. Configure Worker secrets (Supabase trio), Pages public config, Supabase
   Auth SMTP + redirect allow-list; deploy Worker + Pages; verify
   `/api/v1/health` and real auth journeys on the deployed system.
4. Complete Journeys A–D from issue #4 against the deployed environment
   (new-customer registration with email+phone OTP, magic-link + second OTP
   sign-in, optional TOTP, admin login, cross-tenant access denial).

## Decisions ledger (issue #4 pass)

- The event-trigger function `rls_auto_enable()` stays OUT of migration
  history (0008 references it via a guarded revoke). Rationale: its definition
  lives only in the live Supabase project; inventing a replacement and
  CREATE-OR-REPLACE-ing it could silently change live behavior. A guarded
  no-op keeps migration replay deterministic everywhere.
- Receiving-bank seeding inserts placeholders with NULL bank details rather
  than fabricated IBANs. Rationale: never manufacture financial-looking data;
  a fresh environment must still be able to exercise the assignment flow, and
  real instructions may only come from owner-verified console entry.
- The deposit transition matrix in 0014 encodes exactly the transitions the
  backend code performs (verified against deposits.service.ts and the 0006/0007
  RPCs), not a superset. Rationale: deny by default; widening later is a
  reviewed migration, silent permissiveness now would defeat the guard.
- `/currencies` stays authenticated and the spec was corrected instead of
  adding an unauthenticated variant. Rationale: the response's `activeForMe`
  flags require the verified profile, and changing an auth surface without
  owner sign-off is a stop condition.

---

# Post-audit remediation pass (2026-11-23, issue #5 follow-up — owner-authorized)

Mode: `fix` (defects found by the issue #5 audit) + `git push` authorized by
the owner ("fix the issues found and check for it again and if there isn't
then git push"). No deployment, no migration application, no production touch.

## Defects fixed in this pass

1. **F-7 (P2) — `PATCH /profile` corrupted `full_name`.** A `firstName`-only
   patch rebuilt `full_name` from the request's absent `lastName`, erasing the
   stored last name; a `lastName`-only patch never recomputed it. Both the
   customer and admin patch paths now share `computeFullName`
   (`backend/src/utils/name.ts`), which merges STORED parts plus patched
   parts. Regression: `backend/tests/unit/name.test.ts` (7 tests, both
   corruption modes pinned).
2. **F-8 (P2) — disallowed CORS origin produced HTTP 500 + error log.** The
   origin callback now denies cleanly (`cb(null, false)` — no CORS headers, no
   error); browser-side denial is unchanged. Regression:
   `backend/tests/unit/cors.test.ts` (5 supertest contract cases: allowed
   origin gets headers; disallowed origin never gets headers and never 500;
   preflight terminated cleanly).
3. **F-3 (P1) — admin console had no controls for suspend / ban / unban /
   delete user / create refund.** User detail view gained an "Account status"
   card (status-aware: Suspend+Ban+Delete for active; Reactivate for
   suspended/banned; read-only note for deleted; reasons enforced at 3–500
   chars client- and server-side; irreversible delete double-confirmed with a
   consequences list). Refund Management gained a "New refund request" form
   (transaction UUID + amount + reason + optional notes, idempotency-keyed,
   client validation) — split into the new `views-refunds.jsx` module
   (file-size ratchet: views-ops.jsx 717 → 635 lines). Transactions gained a
   "Copy ID" action that feeds the refund workflow. All actions still rely on
   the existing server-side permission gates (users.ban / users.delete /
   refunds.manage) and audit logging — the UI adds reachability, not
   authority.
4. **F-17 (P2) — zod GHSA-mrhx-c7xc-m3w5 (high).** Upgraded zod 3.23.8 →
   4.6.7; `npm audit` now clean. No v4-breaking API was in use (simple
   object/union/enum schemas); typecheck/lint/full suite green on 4.6.7.
5. **New latent defect found during L4 verification — shared `ui.jsx` hook
   wiring was inert.** `var x = useState(v)[0]; var setX = useState(v)[1];`
   makes TWO useState calls reading different slots than they write:
   ConfirmProvider dialogs, ToastHost toasts, RestrictedPanel feedback and
   useFetch/useDebounced could NEVER update state (confirm dialogs never
   opened, toasts never rendered). Fixed with single-call pairs. This is why
   the new moderation confirms surfaced the defect immediately.
6. `MG.util.copyText` helper (clipboard with execCommand fallback) and a
   `copy` icon added to the shared icon set.

## Verification after this pass

| Check | Status |
|---|---|
| `npm run typecheck` (backend) | PASS — 0 errors (on zod 4.6.7) |
| `npm run lint` (backend) | PASS — 0 findings |
| `npm test` (backend) | PASS — 53/53 (was 41/41; +7 name, +5 CORS) incl. real-Postgres integration suite |
| `npm audit` (backend, prod deps) | PASS — 0 vulnerabilities (zod advisory resolved) |
| frontend `check.sh` | PASS — 16/16 modules incl. new views-refunds.jsx |
| L2 runtime (local API on :4100) | PASS — boots; health 200 honest; PATCH /profile unauthenticated 401; disallowed-origin preflight/actual requests: no CORS headers, never 500 |
| L4 render harness (admin views, transport stubbed — no service claims) | PASS — moderation card status-aware; suspend flow records `suspendUser(id, reason)`; short-reason guard blocks; delete double-confirm records `deleteUser(id)` and navigates back; refund form rejects invalid UUID, submits exact schema payload + idempotency key, closes on success; transactions Copy ID lands the UUID on the clipboard; toasts and confirm dialogs render (previously inert) |
| Real admin.html / app.html loads | PASS — every script loads (incl. views-refunds.jsx), honest not-configured state, zero console errors |
| zod 4 schema behaviour | PASS — all request schemas parse as before (route-level 400 contract unchanged; integration suite green) |
| Live Supabase/Cloudflare | BLOCKED — unchanged (owner credentials + authorization required) |

## Push (owner-authorized)

This environment has no git push credentials, so the remediation content was
published to `origin/development` through the GitHub contents API in a series
of commits (e339a06 backend F-7/F-8/F-17 fixes, 381f8e2 admin moderation/refund
UI + ui.jsx hook repair, 59eabbf Copy ID + refunds split, 32db690 restored
missing views-refunds.jsx + exact ui.jsx bytes, 42be300 European registration
placeholders + settings icon segment, 41f3a2d shared computeFullName in the
admin patch + settings icon arc, 45e304d docs). Byte-level file diffs were
re-verified after each commit; two API-emission regressions in ui.jsx
(skeleton class names, settings icon path) were caught by the re-check and
fixed.

Two files remain LOCAL-ONLY and need a real `git push` from any clone with
credentials (one command, no conflicts expected — remote package.json already
declares zod ^4.6.7 while the remote lockfile still records 3.x trees):

- `backend/package-lock.json` — regenerated for zod 4.6.7 (the contents API
  cannot carry the 235 KB file reliably in one write; `npm ci` on a fresh
  clone of remote fails until this lands; `npm install` still works).
- `.github/workflows/workers.yml` — CI switched to `npm ci`, which must land
  together with the lockfile or CI would fail.

No force-push; `main` untouched; nothing deployed; no migration applied to any
live database.

## Exact next tasks

1. Owner: run `git push` from a clone of `development` to publish the two
   remaining local files (lockfile + workers.yml), then review the pushed
   commits on `origin/development`.
2. Unchanged from the previous pass: deploy Worker + Pages (F-1 production
   blank admin console), register the normal-user test
   account (F-6 — closed by the 0016/0017 provisioning migrations), migration
   rehearsal 0008–0014. (F-4 configure-Twilio is obsolete: the Twilio
   integration was removed with the SMS OTP pass — nothing to configure.)
3. F-10 (`unmatched_payments` dead table: build a resolution workflow or drop
   the table) and the www-522 (F-14) remain owner decisions — not executable
   without either a product decision or Cloudflare access.

## Decisions ledger (remediation pass)

- Refund creation form generates a fresh idempotency key per logical request
  (regenerated after success) rather than a global constant, so double-click
  and network retry cannot duplicate a request while separate refund requests
  remain independent.
- `views-ops.jsx` was split (refunds view → `views-refunds.jsx`) instead of
  growing the already-oversized file — per the file-size ratchet.
- zod was upgraded to the advisory-fixed major (4.6.7) after confirming no
  breaking v4 API was in use and the full suite passed; the alternative
  (vendoring a patched v3) was rejected as worse hygiene for the same risk.
- The dead confirm/toast/restricted-panel hooks in `ui.jsx` were repaired in
  place (single-call useState pairs) rather than refactoring the whole
  component — minimum fix preserving all call sites.
- F-10 (unmatched_payments) intentionally NOT touched: dropping a table is a
  destructive migration (AGENTS.md stop condition) and building a workflow is
  a product decision; recorded for the owner instead.

---

# Owner PR #6 verification + regression-test alignment (2026-11-23)

The owner merged PR #6 (deposits.service atomicity fix + migration 0015
production hardening) after the remediation push. Re-running the gates on the
combined tree surfaced ONE red: the integration regression test still asserted
the pre-0015 RLS helper contract (`anon_can_resolve_identity: true`).

Resolution (agent altered NO RLS — the owner did, via their own PR):
- Verified all nine helper-using policies are SELECT policies now altered
  `TO authenticated`, so anon default-deny without evaluating the helper; the
  revoked anon EXECUTE is unreachable. Behaviorally proven on the real
  migrated database (anon profiles read = 0 rows no error; direct helper call
  denied; currencies public read still open).
- The regression test was aligned with the tightened contract and strengthened
  (privilege matrix + anon default-deny + direct-call denial + public reads).
- SECURITY_REVIEW.md: §5 helper bullet rewritten to the post-0015 contract;
  §12 records this verification.

Final gates on the combined tree: typecheck 0, lint 0, Vitest 53/53, npm audit
0 vulnerabilities, frontend check.sh 16/16. Local branch = origin/development
+ one commit (`chore: sync backend lockfile with zod 4.6.7 and switch CI to
npm ci`) awaiting the owner's real `git push`.

---

# Super-admin provisioning pass (2026-11-23) — F-6 closed

Owner instruction: "Provision gospelu214@gmail.com to be super admin and make
sure that it's has an Auth identity." This closes audit finding F-6 (the
intended administrator had no Supabase Auth account — admin magic-link requests
returned HTTP 422 "Signups not allowed for otp") and the audit's open question
"decide the intended admin explicitly" (0009 had seeded the placeholder
`raysallinone00@gmail.com`).

## What changed

1. **`backend/migrations/0016_provision_super_admin_gospelu214.sql` (new)**
   - re-points `app_settings.platform.admin_email` at `gospelu214@gmail.com`
     (the 0009 trigger source of truth);
   - guarantees a Supabase Auth identity for that exact email — created if
     missing with the address already confirmed and NO password (admins are
     magic-link only; `shouldCreateUser: false` in the frontend means the
     identity must pre-exist, which is exactly why F-6 happened);
   - links the identity to a canonical Meridian profile via the production
     `bootstrap_supabase_profile()` path (legacy link or new profile +
     default EUR account), which fires the 0009 super-admin trigger;
   - asserts the `super_admin` grant end-state and profile `status='active'` —
     a run that fails to provision fails the migration instead of pretending;
   - fully idempotent; registers itself in `schema_migrations`.
2. **`backend/tests/integration/database.test.ts`** — three new integration
   tests (25 total in the file): provisioned state (identity + confirmed
   email + linked active profile + `super_admin` row + configured email
   setting), trigger re-fire idempotency (still exactly one row), and no role
   for a confirmed identity with a different email.
3. **`backend/package-lock.json` + `.github/workflows/workflows npm ci switch`**
   (the paired CI reproducibility fix) — regenerated and committed LOCALLY
   (commit `chore(ci): sync backend lockfile with zod 4.6.7 and switch CI to
   npm ci`) but still NOT publishable through the contents API (234 kB exceeds
   the reliable emission path; the same wall the previous pass hit). Both files
   are delivered alongside this pass for the owner to commit from any
   credentialed clone — they must land together or CI would fail.
4. Docs: `PASSWORDLESS_AUTH_SETUP.md` (0009+0016 super-admin paragraph,
   required-migration note), `CHANGELOG.md`, this file.

## Verification (all fresh on this pass)

- `npm ci` (fresh install from the regenerated lockfile): OK.
- `npm run typecheck`: 0 errors. `npm run lint`: 0 findings.
- `npm test`: **56/56** (integration 25 incl. the three new provisioning
  tests, executed against real embedded PostgreSQL 18 with migrations
  `0001`–`0016` applied in order).
- `npm audit --omit=dev`: 0 vulnerabilities.
- `frontend/check.sh`: 16/16 (no frontend files touched).
- NOT RUN / BLOCKED (needs live credentials, per AGENTS.md stop conditions):
  applying `0016` to the live Supabase project, the live admin magic-link
  round-trip for gospelu214@gmail.com, Cloudflare deployment.

## Decisions ledger (this pass)

- The configured super-admin email is REPLACED (raysallinone00 → gospelu214)
  per the owner's explicit instruction; no existing `admin_users` row is
  revoked or deleted — the previous holder (if granted on the live project)
  keeps access until revoked through the admin console. Non-destructive by
  design; destructive revocation would need its own owner decision.
- The Auth identity is created inside the migration via a guarded
  `INSERT INTO auth.users` limited to columns that exist both in real
  Supabase and the integration-test double; the equivalent operator
  alternative (Supabase Auth admin API `admin.createUser`) is documented in
  the migration header and PASSWORDLESS_AUTH_SETUP.md.
- Confirming `email_confirmed_at` of an existing identity inside the
  migration is accepted because the migration itself is the trusted operator
  action; every runtime path (0009 trigger, requireAuth) still demands the
  confirmed address.
- `workers.yml` kept the existing main/development branch trigger list
  (an earlier terminal render suggested corruption; byte-level `od -c` proved
  the file was already correct — no change made beyond `npm ci`).

## Exact next tasks

0. Owner: publish the paired CI fix (`backend/package-lock.json` +
   `.github/workflows/workers.yml` `npm ci` switch — files delivered with
   this pass) from any credentialed clone; they must land together.
1. Owner: apply migration `0016` to the live Supabase project (SQL editor),
   then sign in at `/admin` with gospelu214@gmail.com — magic link should
   dispatch and the console should render (still also blocked by F-1 deploy
   in production; works against local/dev).
2. Owner: deploy Worker + Pages (F-1), rehearse
   migrations 0008–0017 against a backup (F-2-era rehearsal, range extended).
   (F-4 configure-Twilio is obsolete: removed with the SMS OTP pass.)
3. Still open owner decisions: F-10 (unmatched_payments), F-14 (www-522),
   optional revocation of the previous super-admin holder.


## SMS-OTP removal + second super admin pass (2026-11-23)

### What changed

- **Twilio fully removed:** `backend/src/services/twilio.service.ts` deleted;
  `notifyWithSms` and the `alsoSms` flag removed from the admin notify route
  (and from the admin console UI + `MG.api.notifyUser`); the `twilio` env
  block, health check, `wrangler.toml`/`.env.example` secrets and the npm
  dependency are gone (lockfile regenerated).
- **No more SMS OTP:** customer signup now ends after the email OTP — the
  phone-verification screen, `beginPhoneVerification`/`verifyPhoneOtp` and
  the backend `verifySupabaseAccessToken` phone gate were removed. The phone
  number stays as profile/contact data.
- **Signup email delivers the OTP, not a confirm link:** the documented
  Supabase "Confirm signup" template in `PASSWORDLESS_AUTH_SETUP.md` is now
  OTP-only (no `{{ .ConfirmationURL }}`), matching the code-entry screen the
  app shows after registration.
- **Second super admin added:** migration
  `0017_add_second_super_admin_raysallinone00` configures BOTH repository
  addresses — `raysallinone00@gmail.com` (the original 0009 holder) and
  `gospelu214@gmail.com` — under `app_settings.platform.admin_emails`,
  rewrites the grant trigger to honour the list, provisions the raysallinone00
  Auth identity/profile and re-asserts the gospelu214 grant. Five new
  integration tests pin the two-admin state.
- **Website copy:** every "not an offshore account / not offshore banking"
  disclaimer removed from `frontend/` (about, terms, footer, home,
  what-is-offshore page framing); phone/SMS verification wording updated to
  email-only.
- **CI pairing NOT publishable through the API:** the regenerated
  `backend/package-lock.json` (zod 4.6.7, now without twilio) and the
  `workers.yml` `npm ci` + lockfile-sync change are committed on the local
  development clone but GitHub rejected the workflow-file write
  (403 "Resource not accessible by integration" — tokens without the
  workflow scope cannot modify `.github/workflows/*`). Both files ship with
  this pass for the owner to push from any credentialed clone. CI impact:
  the remote workflow still runs `npm install` (works with the drifted
  lockfile), so CI stays green until the owner lands the pair.

### Verification on this pass

- `npm run typecheck` (tsc --noEmit) green after the Twilio/env/service removals.
- Unit test suite green; full integration suite (embedded PostgreSQL, all
  migrations 0001–0017) green including the new two-super-admin tests.
- Frontend auth files syntax-checked (`node --check`) after the SMS step removal.

## Exact next tasks (this pass)

0. Owner: apply migration `0017` to the live Supabase project after `0016`
   (both idempotent), then sign in at `/admin` with either
   `raysallinone00@gmail.com` or `gospelu214@gmail.com` — magic link should
   dispatch and the console should render.
1. Owner: replace the Supabase "Confirm signup" email template with the
   OTP-only version documented in `PASSWORDLESS_AUTH_SETUP.md` (dashboard
   change — the email currently leads with a "confirm your email address"
   link).
2. Owner: deploy Worker + Pages (F-1) and rehearse migrations 0008–0017.
3. Owner: push the two local-only CI files from any credentialed clone
   (`backend/package-lock.json` regenerated without twilio + the
   `.github/workflows/workers.yml` `npm ci` + lockfile-sync job) — the API
   token cannot write workflow files.
4. Still open owner decisions: F-10 (unmatched_payments), F-14 (www-522).

## Email OTP-only customer + administrator sign-in pass (2026-11-23)

Owner-approved requirement: both customer and administrator sign-in must use a numeric email OTP, not a magic link.

### Code changes on `development`

- `frontend/js/services/supabase-auth.js`: customer and administrator sign-in requests use `signInWithOtp({ shouldCreateUser: false })` without `emailRedirectTo`; added a dedicated six-digit admin OTP verifier; customer email OTP verification no longer falls back to `magiclink` token verification.
- `frontend/js/admin/main.jsx`: replaced the administrator magic-link-only form with email → six-digit OTP → verify/resend flow. The admin console remains gated by backend profile and permission checks.
- `frontend/js/app/main.jsx`: removed the obsolete customer post-magic-link OTP screen; customer login is now one email OTP step, followed by optional TOTP MFA when enrolled.
- `PASSWORDLESS_AUTH_SETUP.md` and `SUPABASE_EMAIL_OTP.md`: documented the shared Magic Link / OTP template requirement and both customer/admin code journeys.
- `SECURITY_REVIEW.md`: added STRIDE assessment for OTP delivery, replay, rate limits and privilege separation.

### Important external configuration

Supabase sends a magic link by default from `signInWithOtp()` when the **Magic Link / OTP** email template uses `{{ .ConfirmationURL }}`. The Supabase Dashboard template must be changed to display `{{ .Token }}` and remove the link before inboxes will receive numeric codes. The connected Supabase management tools do not expose Auth email-template editing, so that project-level setting has not been changed here. Do not claim live OTP delivery until the template is saved and both live sign-in journeys are tested.

### Verification status

- GitHub commits applied to `development`; code changes are committed, not deployed.
- Live Supabase email delivery and template configuration: **NOT VERIFIED / external configuration outstanding**.
- Browser E2E and frontend syntax gates: pending CI result; not claimed complete in this pass.
- Database schema/migrations: no changes required for this authentication-flow change.

### Next actions

1. Change Supabase Authentication → Email Templates → Magic Link / OTP to an OTP-only template containing `{{ .Token }}`.
2. Confirm the Confirm sign up template also contains `{{ .Token }}` where used.
3. Run frontend syntax checks and live customer/admin OTP journeys, including wrong/expired code rejection, resend rate limits, customer TOTP and non-admin denial.
4. Deploy Pages only after the checks pass.


### Follow-up verification note — TOTP session gate

The final auth adjustment also keeps the customer session marked unauthenticated in the app state while an OTP-initiated login is awaiting completion. A session-storage marker preserves this gate across a page refresh; it is cleared only after email OTP succeeds and, when enrolled, the TOTP challenge succeeds, or when the sign-in request fails/sign-out completes. The backend AAL2/role checks remain authoritative.

The Pages workflow was triggered by frontend commits. Its first completed attempt (commit `b1077db8`) failed at the Cloudflare Pages API request with authentication error `10000` for the configured `CLOUDFLARE_API_TOKEN`. This is a deployment credential failure, not evidence of a frontend syntax failure; the workflow does not run `frontend/check.sh`. The latest frontend commit's deployment workflow was still queued at the time of this status update. No successful production deployment or live OTP test is claimed.


## HttpOnly session-cookie security rollout (2026-11-23)

### Code committed on `development`

- New API auth BFF routes for OTP send/verify, session inspection, refresh, logout, password change and TOTP MFA operations.
- API sets host-only `__Host-mg-access`, `__Host-mg-refresh` and `__Host-mg-csrf` cookies with `Secure`, `HttpOnly`, `SameSite=Lax`, and `Path=/` in production. No Domain attribute is set.
- Browser auth facade no longer instantiates Supabase JS, exposes session tokens, stores Supabase sessions, or sends bearer headers. It sends credentialed API requests and only keeps a CSRF nonce in memory.
- Unsafe cookie-authenticated API requests require an allowlisted Origin and double-submit CSRF header/cookie equality.
- Existing browser Supabase session keys are cleared by the new client on startup. After successful Pages deployment, users will need to sign in again.
- Backend TOTP step-up and role/permission checks remain in place. Normal protected customer API routes still require AAL2 where TOTP is enrolled.

### Deployment status

- Cloudflare Worker deploy for commit `b959dab3ac8dfecdd43e99f87e07bfb8795cff82`: **successful**; TypeScript typecheck and unit tests passed.
- Cloudflare Pages deploy for commit `fe46db6e370dc18362df5e9d1bbccbbbdfb75d40`: **failed**, Wrangler received Cloudflare API Authentication error `10000` at `/accounts/{account}/pages/projects/global`.
- GitHub Actions repository secret `CLOUDFLARE_API_TOKEN` must be replaced with a token that has `Account / Cloudflare Pages / Edit` permission in the same Cloudflare account. Then rerun the Pages workflow for `development`.
- Temporary compatibility: until Pages is live, backend accepts old bearer requests only from an exact allowlisted Origin, to avoid breaking the legacy frontend. The new frontend does not use bearer tokens. Remove this fallback immediately after Pages is successfully deployed.
- Therefore **full HttpOnly enforcement in the live browser is not yet verified or complete**. The new backend cookie path is deployed; the new browser app is still waiting on Pages deployment.

### Required post-deploy verification

1. Confirm the browser receives `Set-Cookie` for `__Host-mg-access`, `__Host-mg-refresh`, and `__Host-mg-csrf`, each with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and no `Domain`.
2. Confirm `document.cookie`, localStorage and sessionStorage do not reveal access/refresh tokens.
3. Confirm customer/admin OTP login, TOTP step-up, account/API reads, POST/PATCH/DELETE CSRF protection, refresh rotation and logout.
4. Remove the temporary bearer compatibility fallback, redeploy Worker, and verify legacy Authorization requests are rejected.
5. Previously issued refresh tokens are not automatically revoked by the transport migration; require fresh sign-in after Pages deploy and decide separately if a global session revocation is required.


## 15. Owner-authorized deposit and receiving-bank workflow implementation (2026-11-23)

Mode: `extend` — owner explicitly authorized replacing the previous read-only deposit policy with the controlled manual bank-transfer workflow.

Implementation prepared for `development`:

- Receiving-bank accounts now have pending / approved / rejected states. Admin-submitted details default to pending and inactive; customer deposit assignment only accepts approved accounts. Approvals and rejections are server-side, permission-gated and audit-logged.
- Admins can add receiving accounts for EUR, GBP, USD, CHF and PLN. Approval requires a non-placeholder account number or IBAN. Editing an approved account is blocked; a replacement must be submitted and approved separately.
- Customer payment reporting requires the sender-bank transaction reference and supports an optional evidence URL. Admin review displays the submitted reference, notes and evidence URL.
- Balance credit requires an assigned approved receiving account and a receiving-bank transaction ID or statement reference. The database RPC validates the account/deposit match and prevents duplicate statement references per receiving account; ledger and deposit updates remain atomic.
- Migration 0018 is forward-only. It moves existing receiving accounts to pending/inactive so they must be explicitly re-approved; no account details are seeded or invented. Existing deposit records and ledger entries are not rewritten.

Verification: source changes and route-permission contract were prepared; local typecheck, lint, unit/integration tests, browser flow and migration rehearsal have NOT yet been run in this environment. No production migration or deployment was performed. Next: run CI, inspect failures, rehearse 0018 on an isolated database, then coordinate migration + Worker/Pages deployment.

Decision: receiving-account approval is independent of deposit approval. Approving an account only enables it for future matching-currency requests; it never credits a customer. Customer deposit approval remains a separate operation after checking the actual receiving-bank transaction. Full account numbers are excluded from audit metadata.
