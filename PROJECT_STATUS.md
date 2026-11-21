# PROJECT STATUS — Meridian Global Accounts

Last updated: 2026-11-21 (deposit/refund upgrade + SPA wiring)

## Current state: MANUAL BANK-TRANSFER DEPOSIT + INTERNAL REFUND SYSTEM — BACKEND + ADMIN/CUSTOMER SPA

Administrator-controlled manual bank-transfer deposit workflow and internal
Meridian balance refund system are implemented end-to-end (backend + SPA).
Design 02 preserved. Nigeria/NGN absent.

### Backend
- Migration 0006: receiving banks, deposit_payments, unmatched_payments, refunds, atomic RPCs
- deposits.service rewritten for create → assign bank → report → verify-credit
- refunds.service for internal balance refunds
- Admin routes: deposit queue, assign-bank, verify-credit, reject, refunds CRUD
- Customer routes: report-payment, bank details on deposit list/detail
- Webhook path mismatch fixed
- Statement floating-point fixed
- Pages workflow publishes frontend/

### Frontend SPA
- Admin Deposit Management: full queue, assign bank, verify & credit with confirmation modal, reject
- Admin Refund Management: list, review, approve (credits Meridian balance) / reject with confirmation
- Customer Deposit: request form (no method/bank choice), status-aware detail with assigned bank details, report-payment action
- API client extended for all new endpoints
- Nav includes Refund Management

### Remaining
1. Apply migration 0006 to Supabase
2. Seed receiving bank accounts
3. Live Clerk/Supabase/Twilio credentials
4. Expanded automated tests
5. Oracle VM + Cloudflare Pages deployment (authorization required)
6. SRI for CDN scripts

| Integration | Status |
|-------------|--------|
| Clerk | CODE IMPLEMENTED, EXTERNAL CONFIGURATION REQUIRED |
| Supabase | CODE IMPLEMENTED, EXTERNAL CONFIGURATION REQUIRED |
| Twilio | CODE IMPLEMENTED, EXTERNAL CONFIGURATION REQUIRED |
| Manual deposit workflow | CODE IMPLEMENTED (backend + SPA) |
| Internal refund workflow | CODE IMPLEMENTED (backend + SPA) |
| Cloudflare Pages path | FIXED |
| Oracle VM | CODE READY, DEPLOYMENT PENDING AUTHORIZATION |
