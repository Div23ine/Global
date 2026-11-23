# API SPECIFICATION — Meridian Global Accounts Backend

Base URL: `https://<api-host>/api/v1` · JSON only · UTC timestamps (ISO 8601).

## Conventions

**Success envelope** (carried over from the prototype contract):

```json
{ "success": true, "message": "Deposit request recorded", "data": { }, "meta": { } }
```

**Error envelope**:

```json
{ "success": false, "code": "CURRENCY_UNAVAILABLE", "message": "..." }
```

Stable error codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401),
`FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `INVALID_STATE`
(422), `RATE_LIMITED` (429), `INTERNAL` (500).

**Auth**: `Authorization: Bearer <Supabase Auth access token>` — verified with
Supabase Auth `getUser()` on every protected route. The verified Auth UUID is
resolved to a canonical `profiles.id`; profile status is checked on every request. **Idempotency**: POST endpoints that
create records accept `Idempotency-Key`; replays return the original result.

**Pagination**: `?page=1&pageSize=20` → `meta: { page, pageSize, total, pages }`.

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | none | `{ status, uptime, version, checks: { database, auth } }` |

## Profile

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/profile` | customer | own profile + default currency + status |
| PATCH | `/profile` | customer | permitted fields: `firstName`, `lastName`, `phone` (E.164), `prefs` |

## Accounts & currencies

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/currencies` | customer | available currencies + `activeForMe` flags (auth is required because the per-caller activation flags need the verified profile) |
| GET | `/accounts` | customer | all own accounts with balances, txCount, equivalents (EUR base) |
| GET | `/accounts/:currency` | customer | one account + recent transactions + deposits |
| POST | `/accounts/activate` | customer | `{ currencyCode }` → activates (guards: unavailable, already active, duplicate) |
| POST | `/accounts/:currency/close` | customer | requires zero balance (NON_ZERO_BALANCE 422 otherwise) |

## Deposits

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/deposits` | customer | `{ currencyCode, amount, method }` + Idempotency-Key → creates PENDING deposit, returns provider handoff (partner-dependent) |
| GET | `/deposits` | customer | own deposit history (paginated, filterable) |
| POST | `/deposits/:reference/cancel` | customer | cancel while PENDING |
| POST | `/webhooks/payments/:provider` | provider signature | state transition: `confirmed`/`failed` + provider ref; idempotent; posts ledger entry transactionally |

Deposit state machine: `pending → cancelled` (customer) | `pending → completed|failed` (signed webhook only). **No admin endpoint can alter a deposit.**

## Transactions & statements

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/transactions` | customer | filters: `search`, `currency`, `status`, `from`, `to` + pagination |
| GET | `/transactions/:reference` | customer | detail (ownership enforced) |
| GET | `/statements` | customer | generated statement list |
| POST | `/statements/generate` | customer | `{ accountId, periodStart, periodEnd }` → deterministic statement |
| GET | `/statements/:id/download` | customer | text/plain download (provisional format) |

## Notifications & support

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications` | customer | paginated, unread count in meta |
| POST | `/notifications/:id/read` | customer | mark one/all read |
| GET | `/support/tickets` | customer | own tickets with messages |
| POST | `/support/tickets` | customer | `{ subject, category, message }` |

## Admin (role permission in brackets)

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/overview` | any admin role — KPIs, charts data |
| GET | `/admin/users` | `users.read` — search `q`, filters `status`, `country`, pagination |
| GET | `/admin/users/:id` | `users.read` — profile, accounts, recent transactions, deposits, security events |
| PATCH | `/admin/users/:id` | `users.edit` — permitted fields only (names, phone); **validated server-side against a whitelist** |
| POST | `/admin/users/:id/suspend` | `users.ban` — Supabase Auth ban + `profiles.status='suspended'` |
| POST | `/admin/users/:id/ban` | `users.ban` — Supabase Auth ban + `profiles.status='banned'` + security event + audit |
| POST | `/admin/users/:id/unban` | `users.ban` — Supabase Auth unban + status restore + audit |
| DELETE | `/admin/users/:id` | `users.delete` — Supabase Auth identity deletion + profile anonymization (financial records retained) |
| POST | `/admin/users/:id/notify` | `users.edit` — manual in-app notification (explicitly manual) |
| GET | `/admin/currencies` | `currencies.manage` or read |
| PATCH | `/admin/currencies/:code` | `currencies.manage` — availability changes (audit) |
| GET | `/admin/deposits` | `deposits.read` — filters, pagination (no mutation endpoints exist) |
| GET | `/admin/transactions` | `transactions.read` |
| GET | `/admin/payments` | `payments.read` — payment attempts + outcome stats |
| GET | `/admin/security/events` | `security.read` |
| POST | `/admin/security/freeze` | `security.freeze` — `{ userId, reason }` suspend + security event |
| GET | `/admin/reports` | `reports.read` — aggregates + CSV-ready rows |
| GET | `/admin/support/tickets` | `support.manage` |
| POST | `/admin/support/tickets/:id/reply` | `support.manage` |
| POST | `/admin/support/tickets/:id/resolve` | `support.manage` |
| GET | `/admin/roles` | `roles.manage` — roles + permission matrix + holders |
| POST | `/admin/roles/assign` | `roles.manage` — `{ email, roleId }` (confirmed Supabase Auth user already linked to a profile) |
| POST | `/admin/roles/revoke` | `roles.manage` — `{ profileId }` |
| GET | `/admin/audit` | `audit.read` — search, result filter, pagination |
| GET | `/admin/settings` | `settings.manage` (read: any admin) |
| PATCH | `/admin/settings` | `settings.manage` — maintenance mode, support email |

## Webhooks

| Method | Path | Protection |
|---|---|---|
| POST | `/webhooks/payments/:provider` | per-provider secret (HMAC or static token) |

## Rate limits (defaults)

`/api/v1/deposits` 10/min/user · `/api/v1/support/tickets` 5/min/user ·
auth-adjacent reads 120/min/user · global per-IP 300/min. Responses include
`Retry-After` on 429.

## Versioning

`/api/v1` prefix; breaking changes ship as `/api/v2` with overlap; additive
changes (new optional fields, new endpoints) are non-breaking within v1.
