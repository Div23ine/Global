# PROJECT STATUS — Meridian Global Accounts

Last updated: 2026-11-21 (Cloudflare Worker HTTP compatibility incident)

## Current state: CLOUDFLARE-NATIVE (Pages + Workers) + RESEND EMAIL

### Hosting
| Component | Platform |
|-----------|----------|
| Frontend | Cloudflare Pages (`frontend/`) |
| Backend API | Cloudflare Workers (`backend/src/worker.ts`) |
| Database | Supabase PostgreSQL |
| Auth | Clerk |
| SMS | Twilio |
| Email | **Resend** |

Oracle Cloud VM is **no longer** the deployment target.

### Resend notifications
Emails sent (non-blocking; never rolls back financial ops):
- Admin assigns receiving bank → customer receives bank details + reference
- Deposit verified & credited → confirmation email
- Internal refund completed → confirmation email

### Cloudflare Workers
- Live Worker name in `backend/wrangler.toml`: `global`.
- `backend/src/worker.ts` runs Express through `node:http.createServer()` and `cloudflare:node` `httpServerHandler`.
- Root cause of observed 1101: the old `2024-11-12` compatibility date did not enable Node.js HTTP server modules; Wrangler's compatibility polyfill threw `[unenv] http.createServer is not implemented yet!`.
- Fix prepared on branch `fix/worker-http-server-compat`: add `enable_nodejs_http_server_modules` beside `nodejs_compat` in `backend/wrangler.toml`. This is not yet deployed.
- The same production log reported missing secrets: `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. These must be configured in Cloudflare; do not commit them.
- Scripts: `npm run cf:dev`, `npm run cf:deploy`.
- CI: `.github/workflows/workers.yml` (needs `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).

### Still required from owner
1. Review/merge the Worker compatibility fix; deploy only after approval.
2. Set required Worker secrets for Clerk and Supabase (plus Resend/Twilio if those features are enabled).
3. Apply migration 0006 on Supabase.
4. Set `CORS_ORIGIN` to the actual Pages frontend origin(s).
5. Complete live verification: `/api/v1/health` returns 200 and reports real dependency configuration; then test authenticated endpoints.
6. Cloudflare Pages project + optional Worker custom domain.
7. GitHub secrets for CI deploy (optional).

### Integration status
| Integration | Status |
|-------------|--------|
| Clerk | CODE IMPLEMENTED, EXTERNAL CONFIGURATION REQUIRED |
| Supabase | CODE IMPLEMENTED, EXTERNAL CONFIGURATION REQUIRED |
| Twilio | CODE IMPLEMENTED, EXTERNAL CONFIGURATION REQUIRED |
| **Resend** | **CODE IMPLEMENTED, EXTERNAL CONFIGURATION REQUIRED** |
| Manual deposit workflow | CODE IMPLEMENTED (backend + SPA) |
| Internal refund workflow | CODE IMPLEMENTED (backend + SPA) |
| Cloudflare Pages | READY (static `frontend/`) |
| Cloudflare Workers API | DEPLOYED; HTTP runtime compatibility fix prepared but not deployed; required secrets still missing |

### Incident decisions ledger
- 2026-11-21 — Keep the existing compatibility date and explicitly add `enable_nodejs_http_server_modules` rather than changing the date. Reason: Cloudflare documents this compatibility flag as the required opt-in for `http.createServer()` before the 2025-09-01 default, limiting unrelated compatibility changes. Owner approval is required before the production Worker deploy.
