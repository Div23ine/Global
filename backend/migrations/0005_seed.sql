-- 0005_seed.sql — baseline configuration (European positioning, EUR default).
-- NOTE: Nigeria / NGN deliberately absent per product decision.

INSERT INTO currencies (code, name, symbol, minor_units, status, display_order) VALUES
  ('EUR', 'Euro',            '€',    2, 'active', 10),
  ('GBP', 'British Pound',   '£',    2, 'active', 20),
  ('USD', 'US Dollar',       '$',    2, 'active', 30),
  ('CHF', 'Swiss Franc',     'CHF',  2, 'active', 40),
  ('PLN', 'Polish Zloty',    'zł',   2, 'active', 50)
ON CONFLICT (code) DO NOTHING;

-- Country -> default currency (registration bootstrap; configurable).
INSERT INTO country_defaults (country_code, country_name, currency_code, dial_code) VALUES
  ('AT', 'Austria',        'EUR', '+43'),
  ('BE', 'Belgium',        'EUR', '+32'),
  ('CH', 'Switzerland',    'CHF', '+41'),
  ('CY', 'Cyprus',         'EUR', '+357'),
  ('CZ', 'Czech Republic', 'EUR', '+420'),
  ('DE', 'Germany',        'EUR', '+49'),
  ('DK', 'Denmark',        'EUR', '+45'),
  ('EE', 'Estonia',        'EUR', '+372'),
  ('ES', 'Spain',          'EUR', '+34'),
  ('FI', 'Finland',        'EUR', '+358'),
  ('FR', 'France',         'EUR', '+33'),
  ('GB', 'United Kingdom', 'GBP', '+44'),
  ('GR', 'Greece',         'EUR', '+30'),
  ('HR', 'Croatia',        'EUR', '+385'),
  ('HU', 'Hungary',        'EUR', '+36'),
  ('IE', 'Ireland',        'EUR', '+353'),
  ('IT', 'Italy',          'EUR', '+39'),
  ('LT', 'Lithuania',      'EUR', '+370'),
  ('LU', 'Luxembourg',     'EUR', '+352'),
  ('LV', 'Latvia',         'EUR', '+371'),
  ('MT', 'Malta',          'EUR', '+356'),
  ('NL', 'Netherlands',    'EUR', '+31'),
  ('NO', 'Norway',         'EUR', '+47'),
  ('PL', 'Poland',         'PLN', '+48'),
  ('PT', 'Portugal',       'EUR', '+351'),
  ('SE', 'Sweden',         'EUR', '+46'),
  ('SI', 'Slovenia',       'EUR', '+386'),
  ('SK', 'Slovakia',       'EUR', '+421'),
  ('US', 'United States',  'USD', '+1')
ON CONFLICT (country_code) DO NOTHING;

-- Admin roles + permission matrix (checked server-side on every request).
INSERT INTO admin_roles (id, description, permissions) VALUES
  ('super_admin', 'Full administrative access',
   ARRAY['users.read','users.edit','users.ban','users.delete','currencies.manage',
         'deposits.read','deposits.manage','refunds.manage','transactions.read','payments.read','security.read',
         'security.freeze','reports.read','support.manage','roles.manage',
         'audit.read','settings.manage']),
  ('support', 'Customer support operations',
   ARRAY['users.read','users.edit','deposits.read','deposits.manage','refunds.manage','transactions.read',
         'support.manage','security.read']),
  ('compliance', 'Compliance and security oversight',
   ARRAY['users.read','transactions.read','deposits.read','payments.read',
         'security.read','security.freeze','audit.read','reports.read']),
  ('finance_readonly', 'Finance reporting (read-only)',
   ARRAY['deposits.read','transactions.read','payments.read','reports.read'])
ON CONFLICT (id) DO NOTHING;

-- Application settings.
INSERT INTO app_settings (key, value) VALUES
  ('platform.name', '"Meridian Global Accounts"'),
  ('platform.maintenance_mode', 'false'),
  ('platform.tagline', '"One account. Five currencies. Global access."'),
  ('support.email', '"support@meridian.example"'),
  ('presentation.default_currency', '"EUR"')
ON CONFLICT (key) DO NOTHING;

-- Register migration versions.
INSERT INTO schema_migrations (version) VALUES
  ('0001_extensions'),
  ('0002_schema'),
  ('0003_rls'),
  ('0004_functions_triggers'),
  ('0005_seed')
ON CONFLICT (version) DO NOTHING;
