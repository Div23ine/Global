# TEST REPORT — Meridian Global Accounts

Date: 2026-11-20 · Branch: `development` · Runner: Vitest 2.1.9 on Node 24
· Database: genuine PostgreSQL 18.7 (embedded-postgres) with the production
migrations applied.

## Summary

| Gate | Result |
|---|---|
| `npm run typecheck` (tsc --noEmit) | **PASS** — 0 errors |
| `npm run lint` (ESLint + typescript-eslint) | **PASS** — 0 errors, 0 warnings |
| `npm test` (Vitest) | **PASS** — 21/21 tests, 3 files |
| `frontend/check.sh` (node --check + esbuild parse) | **PASS** — 14/14 scripts |
| Browser render verification (L4) | **PASS** — 12/12 pages, 0 console errors |

## Backend unit tests

| File | Tests | Verified behaviour |
|---|---|---|
| `tests/unit/money.test.ts` | 4 | Amount parsing rejects malformed input; accepts European comma decimals; addition/subtraction without float drift (`0.1+0.2=0.3`); comparisons |
| `tests/unit/signature.test.ts` | 5 | Payment webhook HMAC verification: accepts correct signatures; rejects wrong secret, tampered payload, unknown provider, missing signature, non-hex garbage |

## Backend integration tests — real PostgreSQL (L3)

`tests/integration/database.test.ts` (12 tests). The suite boots a real
PostgreSQL 18 server, applies the five production migrations, and exercises
the actual schema, triggers, RPCs and RLS:

| Area | Tests | Verified behaviour |
|---|---|---|
| Migrations + seed | 3 | European currency set (EUR/GBP/USD/CHF/PLN, **no NGN**); admin roles + permission matrix; country→currency defaults (DE→EUR, GB→GBP, PL→PLN, US→USD) |
| Profile bootstrap | 1 | `bootstrap_profile` creates profile + default-currency account; idempotent on duplicate webhook delivery |
| Currency activation | 1 | Activates with zero balance; rejects duplicates (`ALREADY_ACTIVE`), unavailable (`CURRENCY_UNAVAILABLE`) and unknown currencies |
| Ledger + balance projection | 1 | Credits post and project; debits within funds work; overdraft refused (`insufficient funds`); zero/negative refused; references unique |
| Deposit state machine | 2 | pending→completed posts exactly one ledger entry + notification and credits the balance; duplicate webhook = `duplicate_ignored` with no double credit; illegal transitions and amount edits rejected by triggers; failure path credits nothing; customer cancel only while pending; cross-user cancel refused |
| **RLS two-user isolation** | 1 | User A sees only own profile/accounts/transactions; user B sees none of A's; client INSERT into the ledger rejected; client UPDATE of balances affects 0 rows; audit_logs/admin tables return 0 rows to clients; public currency reads work; anonymous sees no profiles |
| Anonymization | 1 | PII cleared, status `deleted`, financial records retained count-for-count |
| Statement opening balance | 1 | `ledger_sum_before` computes posted sums before a point in time; 0 for earlier |
| Account close guard | 1 | Non-zero balance cannot be closed |

**Defects found and fixed by this suite during development** (the tests did
their job):
1. `project_account_balance` trigger was missing `SUM` — failed with two or
   more posted entries ("more than one row returned by a subquery").
2. `app_current_user_id()` cast `''` to json when no JWT claims were present
   — crashed anonymous sessions instead of returning no identity.

## Frontend verification (L4 — real Chromium 1.57 via Playwright)

| Check | Result |
|---|---|
| 10 public pages render, correct h1 content per page | PASS |
| `app.html` + `admin.html` render the honest configuration screen without services | PASS |
| Console errors across all 12 pages | **0** |
| Horizontal overflow at 1366×900 | None detected |
| FAQ accordion interaction (aria-expanded toggles) | PASS |
| Design palette present (sampled pixels): surfaces #FFFFFF, background #F4F7FD, primary #1F6FEB, navy #0A1B3D | PASS — matches Design 02 tokens |

## Honest status of what is NOT verified

Per AGENTS.md verification-ladder rules, the following are **not verified**
because they require credentials or external services not present in this
environment:

1. **Live Clerk integration** — JWT verification, mounted sign-in, lifecycle
   webhooks: unit-mocked only. Requires a Clerk instance (sandbox keys are an
   external requirement).
2. **Live Supabase round-trips via supabase-js** — the SQL layer is verified
   against real PostgreSQL with the identical migrations; the PostgREST
   transport path is not.
3. **Twilio delivery** — retry/limit/redaction logic implemented; no live SMS
   sent.
4. **Payment provider webhook end-to-end** — signature logic and idempotent
   state machine verified at unit + database level; the partner contract is
   an external requirement.
5. **Production build of the frontend** — none exists by design (no build
   step); the check.sh + browser verification covers the shipped artefacts.
6. **Deployment** — no production DNS/VM operations were performed (owner
   authorization required).

## Reproduction commands

```bash
cd backend
npm ci
npm run typecheck && npm run lint && npm test

cd ../frontend && ./check.sh
# Browser check: node /home/z/my-project/scripts/verify-frontend.cjs
# (serves frontend/ on :4188, renders 12 pages, asserts 0 console errors)
```
