import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Prevent Vite's upward PostCSS config search from touching unrelated
  // files outside this repository.
  css: { postcss: { plugins: [] } },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 300_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: {
      NODE_ENV: 'test',
      PAYMENT_PROVIDER: 'test-provider',
      PAYMENT_WEBHOOK_SECRET: 'whsec_test_secret',
      // Placeholder values so supabaseConfigured() passes in unit tests; the
      // service client is replaced by setServiceClientForTests stubs.
      SUPABASE_URL: 'https://test-unit.supabase.co',
      SUPABASE_ANON_KEY: 'test-unit-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-unit-service-role-key',
    },
  },
});
