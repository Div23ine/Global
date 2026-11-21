# DEPLOYMENT GUIDE — Meridian Global Accounts

Status: v1.0 · Targets: Cloudflare Pages (frontend), Oracle Cloud VM
(backend), Supabase (database), Clerk (identity), Twilio (SMS).

> Rule from AGENTS.md: production DNS changes, production database writes and
> VM modifications require owner authorization. This guide is the runbook for
> when that authorization is given.

## 0. Prerequisites (owner-provided)

| Item | Where obtained |
|---|---|
| Cloudflare account + zone for the product domain | Cloudflare dashboard |
| Oracle Cloud VM SSH access + public IP | Oracle Cloud console |
| Supabase project (region: EU, PITR enabled) | supabase.com |
| Clerk application (production instance) | dashboard.clerk.com |
| Twilio account + sender number | twilio.com |
| Licensed payment partner (for deposits) | Contract — external requirement |

## 1. Database — Supabase

1. Create the project in an EU region; enable Point-In-Time Recovery.
2. Save `Project URL`, `anon key`, `service_role key` (Settings → API).
3. Apply migrations **in order** (SQL editor or `supabase db push`):
   `backend/migrations/0001_extensions.sql` → `0002_schema.sql` →
   `0003_rls.sql` → `0004_functions_triggers.sql` → `0005_seed.sql`.
4. Configure the Clerk ↔ Supabase integration (Clerk docs, "Integrate Clerk
   with Supabase"): create a Clerk JWT template named `supabase` with claims
   `{ "sub": "{{user.id}}", "role": "authenticated" }` and paste the Supabase
   JWT signing secret into Clerk.
5. Verify: `SELECT * FROM schema_migrations;` shows 5 rows; RLS is enabled on
   all 16 tables (`SELECT relname, relrowsecurity FROM pg_class ...`).
6. Backups: PITR (automatic) + nightly `pg_dump` to object storage
   (cron script in section 5); restore rehearsal is a release gate.

## 2. Identity — Clerk

1. Create the production Clerk application; note `pk_...` (publishable) and
   `sk_...` (secret) keys.
2. Configure sign-up fields: first name, last name, email (required),
   phone (required), and capture the **country** into `publicMetadata.country`
   (a Clerk sign-up custom field) — the backend webhook uses it for the
   default-currency mapping.
3. Configure email + SMS providers (SMTP of choice; Twilio credentials).
4. Create a webhook endpoint pointing at
   `https://<api-domain>/api/v1/webhooks/clerk` and subscribe to
   `user.created`, `user.updated`, `user.deleted`. Store the svix signing
   secret.
5. Enable session lifetime / MFA options per policy.

## 3. SMS — Twilio

1. Note Account SID, Auth Token and the sender number.
2. Enter them in the Clerk SMS settings (verification codes) AND in the
   backend environment (transactional notifications only).
3. Leave `TWILIO_ALLOWED_RECIPIENTS` empty in production.

## 4. Backend — Oracle Cloud VM

```bash
# as the deployment user
sudo useradd -m -s /bin/bash meridian || true
sudo apt-get update && sudo apt-get install -y nodejs npm nginx   # Node 20 LTS
sudo -u meridian git clone -b development <REPO_URL> /home/meridian/app
cd /home/meridian/app/backend
sudo -u meridian npm ci
sudo -u meridian npm run build
sudo -u meridian npm test          # gate: all tests green before deploy
```

Create `/home/meridian/app/backend/.env` (owner `meridian`, mode 600):

```
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://<frontend-domain>
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+...
PAYMENT_PROVIDER=<partner-id>
PAYMENT_WEBHOOK_SECRET=<partner-secret>
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
```

Systemd unit `/etc/systemd/system/meridian-api.service`:

```ini
[Unit]
Description=Meridian Global Accounts API
After=network-online.target

[Service]
User=meridian
WorkingDirectory=/home/meridian/app/backend
ExecStart=/usr/bin/node dist/server.js
EnvironmentFile=/home/meridian/app/backend/.env
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/home/meridian/app/backend

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now meridian-api
curl -s http://127.0.0.1:4000/api/v1/health   # expect {"status":"ok",...}
```

Reverse proxy (nginx) — TLS via certificates of choice (or run Caddy):

```nginx
server {
  listen 443 ssl http2;
  server_name <api-domain>;
  ssl_certificate     /etc/ssl/meridian/fullchain.pem;
  ssl_certificate_key /etc/ssl/meridian/privkey.pem;
  location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_read_timeout 30s;
    client_max_body_size 256k;
  }
}
```

VM firewall: allow 80/443 + SSH only. Verify `/api/v1/health` from outside.

## 5. Frontend — Cloudflare Pages

1. Cloudflare dashboard → Pages → Create project → connect the GitHub repo.
2. Build settings: **none** (static output). Output directory: `frontend`.
3. Environment variables:
   - Not needed server-side; set the runtime values in `js/config.js` on the
     deployment branch, or serve `js/config.local.js` via a Pages override:
     `API_BASE_URL=https://<api-domain>/api/v1`,
     `CLERK_PUBLISHABLE_KEY=pk_live_...`
4. Custom domain: attach the product domain; Cloudflare issues TLS.
5. Post-deploy checks: open `/app.html` (Clerk sign-in mounts), sign in,
   confirm `/api/v1/health` reachable from the browser (no CORS errors).

## 6. Payment partner integration (when contracted)

1. Implement the partner's SDK/server flow behind the existing
   `PaymentProvider` seam in `src/services/deposits.service.ts`.
2. Register the webhook secret; point the partner's webhook at
   `https://<api-domain>/api/v1/webhooks/payments/<partner-id>`.
3. Keep `PAYMENT_PROVIDER` pointing at the licensed partner. Remove the
   `manual-review` provider from the live configuration.
4. Test with the partner's sandbox: confirmed / failed / duplicate delivery.

## 7. Nightly database backup (VM cron)

```cron
30 2 * * * PGPASSWORD=... pg_dump "postgres://postgres:<pw>@<ref>.supabase.co:5432/postgres" \
  -Fc -f /home/meridian/backups/meridian-$(date +\%F).dump && \
  find /home/meridian/backups -mtime +14 -delete
```

(Sync to object storage with rclone; retention per jurisdiction policy.)

## 8. Rollback procedures

| Component | Procedure |
|---|---|
| Frontend | Cloudflare Pages → previous deployment → Instant rollback (atomic) |
| Backend | `git checkout <previous-tag> && npm ci && npm run build && sudo systemctl restart meridian-api`; systemd keeps the old `dist/` until restart |
| Database | Supabase PITR restore to a timestamp before the incident (practise quarterly); destructive migrations follow expand-then-contract so rollback = stop new code |
| Identity | Clerk dashboard user actions are reversible except deletion (which is why deletion is confirm-gated + audited) |

## 9. Monitoring runbook

- `GET /api/v1/health` (liveness + dependency status) — wire to uptime checks.
- Structured JSON logs on stdout → journald; ship to a log platform.
- Alert on: 5xx rate, `AUDIT_WRITE_FAILED` log entries, webhook signature
  failures (`signature_invalid` attempts), rate-limit spikes on auth routes.
- Review `audit_logs` for `result='denied'` clusters weekly.
