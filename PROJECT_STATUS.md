# PROJECT STATUS — Meridian Global Accounts

Last updated: 2026-11-21 (Cloudflare Workers backend + Resend email)

## Current state: CLOUDFLARE-NATIVE (Pages + Workers) + RESEND EMAIL

### Hosting
| Component | Platform |
|-----------|----------|
| Frontend | Cloudflare Pages (`frontend/`) |
| Backend API | Cloudflare Workers (`backend/src/worker.ts`, `wrangler.toml`) |
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
- `backend/src/worker.ts` — Express via `cloudflare:node` `httpServerHandler` + `nodejs_compat`
- `backend/wrangler.toml` — name `meridian-api`, vars + secret list
- Scripts: `npm run cf:dev`, `npm run cf:deploy`
- CI: `.github/workflows/workers.yml` (needs `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)

### Still required from owner
1. Apply migration 0006 on Supabase
2. `wrangler secret put` for Clerk, Supabase, Resend, Twilio
3. Set `CORS_ORIGIN` to Pages origin
4. Cloudflare Pages project + optional Worker custom domain
5. GitHub secrets for CI deploy (optional)
6. Live verification with real credentials

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
| Cloudflare Workers API | CODE IMPLEMENTED, DEPLOY PENDING SECRETS |
