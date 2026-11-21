# PROJECT STATUS — Meridian Global Accounts

Last updated: 2026-11-21 (SPA wiring confirmed, bank seeds, expanded tests, config)

## Current state: DEPOSIT + REFUND WORKFLOWS COMPLETE (BACKEND + SPA)

### Completed this cycle
- Admin SPA Deposit Management + Refund Management (confirmation screens with customer, reference, amount, impact) — already on `development`
- Customer Deposit section: assigned bank details + report-payment action — already on `development`
- Sample receiving bank accounts for EUR, GBP, USD, CHF, PLN seeded in migration 0006
- Admin role permissions expanded (`deposits.manage`, `refunds.manage`)
- Integration tests: partial deposits, duplicate bank txn rejection, overpayment cap, refund limits, customer isolation
- Unit tests: deposit/refund amount invariants
- Frontend config: deployment-oriented placeholders with `window.MG_*` / `config.local.js` inject points (no secrets)

### Not done (external dependencies)
| Item | Status |
|------|--------|
| Live Clerk / Supabase / Twilio verification | **CODE IMPLEMENTED, EXTERNAL CONFIGURATION REQUIRED** — provide sandbox credentials |
| Oracle VM backend deployment | **Requires explicit authorization** |
| Cloudflare Pages production deploy | **Requires explicit authorization** (workflow already points at `frontend/`) |
| Apply migration 0006 on live Supabase | Owner action |

### Integration status
| Integration | Status |
|-------------|--------|
| Clerk | CODE IMPLEMENTED, EXTERNAL CONFIGURATION REQUIRED |
| Supabase | CODE IMPLEMENTED, EXTERNAL CONFIGURATION REQUIRED |
| Twilio | CODE IMPLEMENTED, EXTERNAL CONFIGURATION REQUIRED |
| Manual deposit workflow | CODE IMPLEMENTED (backend + SPA) |
| Internal refund workflow | CODE IMPLEMENTED (backend + SPA) |
| Cloudflare Pages path | FIXED |
| Oracle VM | CODE READY, DEPLOYMENT PENDING AUTHORIZATION |

### How to run tests locally
```bash
cd backend && npm ci && npm test
```
Integration tests use embedded-postgres and apply all migrations including 0006.
