-- 0022_exchange_rates_and_deposit_snapshots.sql
-- Administrator-managed / live FX rates (USD base) and deposit eligibility snapshots.
-- Does not alter existing deposit balances or ledger entries.

BEGIN;

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  currency_code   text PRIMARY KEY REFERENCES public.currencies(code),
  units_per_usd   numeric(18, 8) NOT NULL CHECK (units_per_usd > 0),
  source          text NOT NULL CHECK (source IN ('manual', 'live')),
  provider        text,
  rate_timestamp  timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.fx_settings (
  id                 smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode               text NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual', 'live')),
  live_provider      text NOT NULL DEFAULT 'frankfurter',
  last_refresh_at    timestamptz,
  last_refresh_error text,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES public.profiles(id)
);

INSERT INTO public.fx_settings (id, mode, live_provider)
VALUES (1, 'manual', 'frankfurter')
ON CONFLICT (id) DO NOTHING;

-- Seed manual rates matching the historical first-deposit indicative policy table.
INSERT INTO public.exchange_rates (currency_code, units_per_usd, source, provider, rate_timestamp)
VALUES
  ('USD', 1.00000000, 'manual', 'policy', now()),
  ('EUR', 0.95000000, 'manual', 'policy', now()),
  ('GBP', 0.82000000, 'manual', 'policy', now()),
  ('CHF', 0.90000000, 'manual', 'policy', now()),
  ('PLN', 4.10000000, 'manual', 'policy', now())
ON CONFLICT (currency_code) DO NOTHING;

-- Historical eligibility snapshot on deposit requests (append-only fields).
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS fx_base_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS fx_units_per_usd numeric(18, 8),
  ADD COLUMN IF NOT EXISTS fx_usd_equivalent numeric(19, 4),
  ADD COLUMN IF NOT EXISTS fx_rate_source text,
  ADD COLUMN IF NOT EXISTS fx_provider text,
  ADD COLUMN IF NOT EXISTS fx_rate_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS fx_retrieved_at timestamptz,
  ADD COLUMN IF NOT EXISTS min_policy text
    CHECK (min_policy IS NULL OR min_policy IN ('initial', 'subsequent'));

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_settings ENABLE ROW LEVEL SECURITY;
-- No client policies: service role only (deny-by-default).

UPDATE public.admin_roles
   SET permissions = (
     SELECT ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['fx.manage']) AS p ORDER BY 1)
   )
 WHERE id IN ('super_admin');

INSERT INTO public.schema_migrations (version)
VALUES ('0022_exchange_rates_and_deposit_snapshots')
ON CONFLICT (version) DO NOTHING;

COMMIT;
