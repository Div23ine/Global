# Deployment Guide — Meridian Global Accounts

**Target architecture (Cloudflare-native)**

| Layer | Platform |
|-------|----------|
| Frontend | Cloudflare Pages (`frontend/`) |
| Backend API | Cloudflare Workers (`backend/` → `meridian-api`) |
| Database | Supabase PostgreSQL |
| Auth | Clerk |
| SMS | Twilio |
| Email | Resend |

Oracle Cloud VM is **not** used. Both frontend and API run on Cloudflare.

---

## 1. Supabase

1. Create project (EU region recommended). Enable PITR.
2. Apply migrations in order: `0001` → `0006` (SQL editor or CLI).
3. Configure Clerk ↔ Supabase JWT template (`supabase` claim set).
4. Verify `schema_migrations` includes `0006_deposit_refund_upgrade`.
5. Confirm five receiving bank seed rows exist.

## 2. Clerk

1. Create application; note publishable + secret keys.
2. Webhook URL: `https://<worker-host>/api/v1/webhooks/clerk`
   Events: `user.created`, `user.updated`, `user.deleted`.
3. Store svix signing secret as Worker secret `CLERK_WEBHOOK_SIGNING_SECRET`.

## 3. Resend (email)

1. Create API key at https://resend.com.
2. Verify sending domain; set `RESEND_FROM_EMAIL` to an address on that domain.
3. `wrangler secret put RESEND_API_KEY`
4. Trigger path: admin assigns bank details → customer receives email with IBAN/reference.

## 4. Twilio (SMS)

Optional for SMS notifications. Set Account SID, Auth Token, From number as Worker secrets.

## 5. Backend — Cloudflare Workers

```bash
cd backend
npm ci
npm run typecheck
npm test                 # gate before deploy

# One-time: login + set secrets
npx wrangler login
npx wrangler secret put CLERK_SECRET_KEY
npx wrangler secret put CLERK_PUBLISHABLE_KEY
npx wrangler secret put CLERK_WEBHOOK_SIGNING_SECRET
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM_EMAIL
# optional:
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_FROM_NUMBER
npx wrangler secret put PAYMENT_WEBHOOK_SECRET

# Edit wrangler.toml [vars] CORS_ORIGIN to your Pages origin(s)

npm run cf:deploy        # or: npx wrangler deploy
```

Local API against Workers runtime:

```bash
npm run cf:dev
```

Classic Node (still supported for local debugging):

```bash
cp .env.example .env   # fill values
npm run dev
```

Custom domain for the Worker: Cloudflare dashboard → Workers → meridian-api → Triggers → Custom Domains
(e.g. `api.meridian.example.com`).

## 6. Frontend — Cloudflare Pages

```bash
# Connect the GitHub repo in Cloudflare Pages dashboard
# Build settings:
#   Root directory: (repo root)
#   Build command:  (none — static)
#   Output directory: frontend
#
# Or via Wrangler:
npx wrangler pages deploy frontend --project-name=meridian-global
```

**Frontend config (no secrets)**

Set at deploy time (Pages env / inject script):

```html
<script>
  window.MG_API_BASE_URL = 'https://api.meridian.example.com/api/v1';
  window.MG_CLERK_PUBLISHABLE_KEY = 'pk_live_...';
</script>
```

Or write `frontend/js/config.local.js` in CI (gitignored template).

GitHub Actions workflow `.github/workflows/pages.yml` publishes `frontend/` to GitHub Pages as a fallback; prefer Cloudflare Pages for production.

## 7. CORS

Worker `[vars] CORS_ORIGIN` must include every frontend origin, e.g.:

```
CORS_ORIGIN=https://app.meridian.example.com,https://meridian-global.pages.dev
```

## 8. Health check

```bash
curl https://<worker-host>/api/v1/health
```

## 9. Rollback

Workers: `npx wrangler rollback` or redeploy previous version from dashboard.
Pages: promote prior deployment in Cloudflare Pages history.

## 10. Explicit authorization

Do not point live DNS or overwrite production Worker/Pages projects without
owner confirmation. Use preview URLs first.
