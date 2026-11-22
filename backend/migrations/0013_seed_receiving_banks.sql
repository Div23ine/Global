-- 0013_seed_receiving_banks.sql
-- Fresh-database bootstrap for the manual bank-transfer deposit workflow.
--
-- Migration 0006 deliberately ships no receiving-bank rows: production
-- payment instructions must come only from bank details independently
-- verified by Meridian and entered through the admin console (audit-logged,
-- see deposits.service.ts upsertReceivingBank). A database built purely from
-- migrations (CI, rehearsal, preview) therefore has zero receiving accounts
-- and the deposit-assignment flow cannot run at all.
--
-- This migration inserts one OPERATIONAL PLACEHOLDER account per supported
-- currency, and only when the currency has no active receiving account at
-- all:
--   * rows are clearly labeled as placeholders,
--   * account_number / iban / swift_bic stay NULL (no invented bank details),
--   * databases that already hold active receiving accounts (production,
--     staging) are left completely untouched.
-- Placeholders keep the workflow operable on fresh environments; they are
-- NOT valid payment instructions and must be replaced with owner-verified
-- details through the admin console before any real customer handoff.

INSERT INTO receiving_bank_accounts
  (label, bank_name, beneficiary_name, country_code, currency_code,
   transfer_instructions, is_active, display_order)
SELECT 'PLACEHOLDER — replace with owner-verified details',
       'Unassigned receiving account (EUR)',
       'Meridian Global Accounts (placeholder)', 'DE', 'EUR',
       'PLACEHOLDER: no verified receiving details have been configured yet. Bank details are assigned by an administrator through the admin console after independent verification.',
       true, 10
WHERE NOT EXISTS (
  SELECT 1 FROM receiving_bank_accounts
  WHERE currency_code = 'EUR' AND is_active = true
);

INSERT INTO receiving_bank_accounts
  (label, bank_name, beneficiary_name, country_code, currency_code,
   transfer_instructions, is_active, display_order)
SELECT 'PLACEHOLDER — replace with owner-verified details',
       'Unassigned receiving account (GBP)',
       'Meridian Global Accounts (placeholder)', 'GB', 'GBP',
       'PLACEHOLDER: no verified receiving details have been configured yet. Bank details are assigned by an administrator through the admin console after independent verification.',
       true, 20
WHERE NOT EXISTS (
  SELECT 1 FROM receiving_bank_accounts
  WHERE currency_code = 'GBP' AND is_active = true
);

INSERT INTO receiving_bank_accounts
  (label, bank_name, beneficiary_name, country_code, currency_code,
   transfer_instructions, is_active, display_order)
SELECT 'PLACEHOLDER — replace with owner-verified details',
       'Unassigned receiving account (USD)',
       'Meridian Global Accounts (placeholder)', 'US', 'USD',
       'PLACEHOLDER: no verified receiving details have been configured yet. Bank details are assigned by an administrator through the admin console after independent verification.',
       true, 30
WHERE NOT EXISTS (
  SELECT 1 FROM receiving_bank_accounts
  WHERE currency_code = 'USD' AND is_active = true
);

INSERT INTO receiving_bank_accounts
  (label, bank_name, beneficiary_name, country_code, currency_code,
   transfer_instructions, is_active, display_order)
SELECT 'PLACEHOLDER — replace with owner-verified details',
       'Unassigned receiving account (CHF)',
       'Meridian Global Accounts (placeholder)', 'CH', 'CHF',
       'PLACEHOLDER: no verified receiving details have been configured yet. Bank details are assigned by an administrator through the admin console after independent verification.',
       true, 40
WHERE NOT EXISTS (
  SELECT 1 FROM receiving_bank_accounts
  WHERE currency_code = 'CHF' AND is_active = true
);

INSERT INTO receiving_bank_accounts
  (label, bank_name, beneficiary_name, country_code, currency_code,
   transfer_instructions, is_active, display_order)
SELECT 'PLACEHOLDER — replace with owner-verified details',
       'Unassigned receiving account (PLN)',
       'Meridian Global Accounts (placeholder)', 'PL', 'PLN',
       'PLACEHOLDER: no verified receiving details have been configured yet. Bank details are assigned by an administrator through the admin console after independent verification.',
       true, 50
WHERE NOT EXISTS (
  SELECT 1 FROM receiving_bank_accounts
  WHERE currency_code = 'PLN' AND is_active = true
);

INSERT INTO schema_migrations (version) VALUES ('0013_seed_receiving_banks')
ON CONFLICT (version) DO NOTHING;
