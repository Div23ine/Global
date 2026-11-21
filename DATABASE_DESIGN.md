# DATABASE DESIGN — Meridian Global Accounts (Supabase PostgreSQL)

Status: v1.0 · All money values are `numeric(19,4)` · All timestamps are
`timestamptz` · Primary keys are `uuid` (gen_random_uuid / pgcrypto) except
natural keys noted below.

## 1. Entity relationship overview

```
profiles 1──* accounts 1──* transactions (ledger entries)
   │             │ 1──* deposits 1──* payment_attempts
   │             │ 1──* statements
   │             ├──* notifications
   │             ├──* support_tickets 1──* support_messages
   │             ├──* security_events
   │             └──* audit_logs (as actor or target)
admin_roles 1──* admin_users (clerk user id → role)
currencies 1──* accounts          app_settings (key/value)
```

## 2. Tables

### profiles
The application record for a Clerk user. `id` = Clerk `sub` (uuid text key).

| column | type | notes |
|---|---|---|
| id | uuid PK | Clerk user id (from JWT `sub`) |
| email | text NOT NULL UNIQUE | synced from Clerk |
| full_name | text NOT NULL DEFAULT '' | |
| first_name / last_name | text | permitted-edit fields |
| phone | text | E.164 |
| country_code | text | ISO 3166-1 alpha-2 |
| default_currency | text FK currencies.code | resolved at registration |
| status | text NOT NULL DEFAULT 'active' | active / suspended / banned / deleted |
| kyc_status | text NOT NULL DEFAULT 'not_started' | not_started / pending / verified / rejected |
| prefs | jsonb NOT NULL DEFAULT '{}' | notification preferences |
| deleted_at | timestamptz NULL | set on anonymizing deletion |
| created_at / updated_at | timestamptz | |

### currencies
| column | type | notes |
|---|---|---|
| code | text PK | ISO 4217 (EUR, GBP, USD, CHF, PLN) |
| name | text NOT NULL | |
| symbol | text NOT NULL | |
| minor_units | int NOT NULL DEFAULT 2 | |
| status | text NOT NULL DEFAULT 'active' | active / unavailable |
| display_order | int NOT NULL | |

Seed set (European positioning, EUR default): EUR, GBP, USD, CHF, PLN.
Availability is data — adding SEK/DKK/NOK/CZK later is an INSERT, not a
code change.

### country_defaults
Country → default currency mapping (configurable, not hardcoded).

| column | type | notes |
|---|---|---|
| country_code | text PK | |
| country_name | text NOT NULL | |
| currency_code | text FK currencies.code | |
| dial_code | text NOT NULL | |

### accounts
One row per (customer, currency). UNIQUE(profile_id, currency_code).

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK profiles(id) ON DELETE RESTRICT | financial records retained |
| currency_code | text FK currencies.code | |
| status | text NOT NULL DEFAULT 'active' | active / suspended / closed |
| balance | numeric(19,4) NOT NULL DEFAULT 0 | projection of the ledger (trigger-maintained) |
| opened_at | timestamptz NOT NULL DEFAULT now() | |
| closed_at | timestamptz NULL | requires balance = 0 |

### transactions (the ledger)
Immutable entries; the source of truth for balances.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| reference | text NOT NULL UNIQUE | e.g. TXN-2026-000123 (sequence-based) |
| account_id | uuid FK accounts(id) | |
| profile_id | uuid FK profiles(id) | denormalized for RLS simplicity |
| type | text NOT NULL | deposit / withdrawal / fee / adjustment / transfer_in / transfer_out |
| direction | text NOT NULL | credit / debit |
| amount | numeric(19,4) NOT NULL CHECK (amount > 0) | always positive |
| currency_code | text NOT NULL | |
| description | text NOT NULL DEFAULT '' | |
| status | text NOT NULL | posted / pending / failed / cancelled |
| method | text | card / bank_transfer / gateway |
| related_deposit_id | uuid FK deposits(id) NULL | |
| value_date | timestamptz | |
| created_at | timestamptz NOT NULL DEFAULT now() | |

Indexes: (account_id, created_at DESC), (profile_id, created_at DESC),
(reference), (status), (related_deposit_id).
CHECK: only `posted` entries count toward the balance (enforced in the
projection trigger and the posting function).

### deposits
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| reference | text NOT NULL UNIQUE | DEP-2026-000123 |
| profile_id | uuid FK profiles(id) | |
| account_id | uuid FK accounts(id) | target account |
| currency_code | text NOT NULL | |
| amount | numeric(19,4) NOT NULL CHECK (amount > 0) | |
| fee | numeric(19,4) NOT NULL DEFAULT 0 | |
| method | text NOT NULL | card / bank_transfer / gateway |
| status | text NOT NULL DEFAULT 'pending' | pending / completed / failed / cancelled |
| provider | text | payment provider id |
| provider_ref | text | provider's transaction reference |
| idempotency_key | text UNIQUE NULL | |
| requested_at | timestamptz NOT NULL DEFAULT now() | |
| completed_at | timestamptz NULL | |

Transitions: `pending → cancelled` (customer, while pending) or
`pending → completed | failed` (signed provider webhook ONLY). No admin path.
A guard trigger rejects illegal transitions.

### payment_attempts
Observability for every payment interaction.

| column | type |
|---|---|
| id | uuid PK |
| deposit_id | uuid FK deposits(id) |
| provider | text NOT NULL |
| outcome | text NOT NULL — initiated / confirmed / failed / duplicate_ignored / signature_invalid |
| detail | jsonb |
| created_at | timestamptz |

### statements
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK accounts(id) | |
| period_start / period_end | timestamptz NOT NULL | |
| opening_balance / closing_balance | numeric(19,4) NOT NULL | |
| entry_count | int NOT NULL | |
| generated_at | timestamptz NOT NULL DEFAULT now() | |
| UNIQUE(account_id, period_start, period_end) | | |

Generated on demand from the ledger; content is deterministic.

### notifications
| column | type |
|---|---|
| id | uuid PK |
| profile_id | uuid FK profiles(id) |
| type | text NOT NULL (info / success / warning / security) |
| title | text NOT NULL |
| body | text NOT NULL |
| read_at | timestamptz NULL |
| created_at | timestamptz |

### support_tickets / support_messages
| tickets | type |
|---|---|
| id | uuid PK |
| profile_id | uuid FK |
| subject | text NOT NULL |
| category | text NOT NULL (general / deposits / currencies / security / account) |
| status | text NOT NULL DEFAULT 'open' (open / pending / resolved) |
| created_at / updated_at | timestamptz |

| messages | type |
|---|---|
| id | uuid PK |
| ticket_id | uuid FK tickets(id) |
| sender | text NOT NULL (customer / support) |
| body | text NOT NULL |
| created_at | timestamptz |

### security_events
| column | type |
|---|---|
| id | uuid PK |
| profile_id | uuid FK |
| type | text NOT NULL (suspicious_login / freeze / unfreeze / ban / password_change / mfa_change) |
| severity | text NOT NULL (info / warning / critical) |
| detail | jsonb |
| created_at | timestamptz |

### admin_roles / admin_users
| roles | type |
|---|---|
| id | text PK (super_admin / support / compliance / finance_readonly) |
| description | text |
| permissions | text[] NOT NULL |

| admin_users | type |
|---|---|
| clerk_user_id | text PK (Clerk sub as text) |
| role_id | text FK admin_roles(id) |
| assigned_by | text |
| assigned_at | timestamptz |

Permission strings: `users.read`, `users.edit`, `users.ban`, `users.delete`,
`currencies.manage`, `deposits.read`, `transactions.read`, `payments.read`,
`security.read`, `security.freeze`, `reports.read`, `support.manage`,
`roles.manage`, `audit.read`, `settings.manage`.

### audit_logs (append-only)
| column | type |
|---|---|
| id | uuid PK |
| actor_id | text (Clerk sub or 'system' / 'webhook:<provider>') |
| actor_role | text |
| action | text NOT NULL |
| target_type | text |
| target_id | text |
| detail | jsonb |
| result | text NOT NULL (allowed / denied) |
| ip | text |
| user_agent | text |
| created_at | timestamptz NOT NULL DEFAULT now() |

No UPDATE/DELETE grants; RLS has no client-select policy (admins read via
service client through the backend).

### app_settings
| column | type |
|---|---|
| key | text PK |
| value | jsonb NOT NULL |
| updated_at | timestamptz |

Seeded: `platform.name`, `platform.maintenance_mode`,
`support.email`, `presentation.default_currency` (EUR).

## 3. Functions and triggers

1. `set_updated_at()` — standard.
2. `project_account_balance()` — AFTER INSERT/UPDATE/DELETE on transactions:
   recomputes `accounts.balance` as
   `SUM(CASE WHEN status='posted' THEN CASE direction WHEN 'credit' THEN amount ELSE -amount END ELSE 0 END)`.
   The posting service also locks the account row (`SELECT ... FOR UPDATE`)
   inside the same transaction — trigger + lock = integrity under concurrency.
3. `next_reference(prefix text)` — sequence-based reference generation.
4. `guard_deposit_transition()` — BEFORE UPDATE on deposits: rejects any
   transition not in the legal set; rejects any change to
   amount/currency/account after creation.
5. `guard_account_close()` — BEFORE UPDATE on accounts: `closed_at` requires
   balance = 0.
6. `anonymize_profile()` — invoked by the backend on user deletion: clears
   PII columns, sets `status='deleted'`, `deleted_at=now()`; keeps the row and
   all financial records (retention).

## 4. Row Level Security

All tables `ENABLE ROW LEVEL SECURITY`. Clerk issues the JWT; Supabase
validates it via the Clerk JWT template (claims: `sub`, `role='authenticated'`).
Policies compare `auth.jwt() ->> 'sub'` with the owning `profile_id` (cast to
text where needed).

| table | select | insert | update | delete |
|---|---|---|---|---|
| profiles | own row | own row (id = sub) on signup bootstrap | own row, limited columns (full_name, first_name, last_name, phone, prefs) via `profiles_self_update` trigger guard | none |
| accounts | own | none (service only) | none | none |
| transactions | own | none | none | none |
| deposits | own | own (pending, own profile/account) | none (state machine via service only) | none |
| payment_attempts | none client | none | none | none |
| statements | own | none | none | none |
| notifications | own | none | own (read_at only) | none |
| support_tickets | own | own | none | none |
| support_messages | via ticket join (own tickets) | own tickets | none | none |
| security_events | own | none | none | none |
| currencies / country_defaults | public read (anon) | none | none | none |
| admin_roles / admin_users | none client | none | none | none |
| audit_logs | none | none | none | none |
| app_settings | none client | none | none | none |

The backend uses:
- the **service-role client** for administrative and money-mutating
  operations (authorization enforced in code, one verified place);
- a **user-scoped client** (forwards the user's Clerk JWT) for
  customer-facing reads — RLS is exercised on the hot path as defense in
  depth, and a bypass path exists only in the service client.

## 5. Migrations

`backend/migrations/` — forward-only, ordered:
`0001_extensions.sql`, `0002_schema.sql`, `0003_rls.sql`,
`0004_functions_triggers.sql`, `0005_seed.sql`.

Apply order matters (schema → RLS → functions → seed). A `0000` marker table
`schema_migrations` records applied files. Rollback = restore from backup;
destructive changes follow expand-then-contract in future migrations.

## 6. Backup and retention

- Supabase PITR (point-in-time recovery) enabled in production.
- Daily logical backup via `pg_dump` to object storage (runbook in
  `DEPLOYMENT_GUIDE.md`).
- Financial records (transactions, deposits, audit_logs, statements) are
  retained on user deletion (pseudonymized); profile PII is anonymized —
  GDPR erasure is fulfilled for personal data while preserving legally
  required financial audit records. The exact retention periods are an open
  jurisdictional requirement tracked in `PROJECT_STATUS.md`.
