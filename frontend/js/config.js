/* Meridian Global Accounts — frontend configuration (non-secret values only).
   Copy js/config.js to js/config.local.js to override values locally —
   config.local.js is gitignored. NEVER put secret keys here: Clerk
   publishable keys are public by design; Clerk secret keys and Supabase
   service-role keys belong to the backend only.

   Deployment:
   - Cloudflare Pages: set these via Pages environment variables or a
     build-time inject step that writes config.local.js / replaces placeholders.
   - Local: create frontend/js/config.local.js with real values (gitignored).
*/
window.MG = window.MG || {};
MG.config = {
  // REST API base (no trailing slash). This is the confirmed Cloudflare Worker
  // host for Meridian; override with MG_API_BASE_URL for preview/staging.
  API_BASE_URL: (typeof window !== 'undefined' && window.MG_API_BASE_URL)
    ? window.MG_API_BASE_URL
    : 'https://global.primeage.workers.dev/api/v1',

  // Clerk publishable key (pk_test_… or pk_live_…). Public by design.
  // Injected at deploy time; never a secret.
  CLERK_PUBLISHABLE_KEY: (typeof window !== 'undefined' && window.MG_CLERK_PUBLISHABLE_KEY)
    ? window.MG_CLERK_PUBLISHABLE_KEY
    : '',

  // Clerk is loaded from the official ClerkJS CDN build.
  CLERK_JS_URL: 'https://unpkg.com/@clerk/clerk-js@4/dist/clerk.browser.js',

  // Presentation defaults (European market).
  DEFAULT_CURRENCY: 'EUR',
  LOCALE: 'en-IE',
  APP_NAME: 'Meridian Global Accounts',
};

// Local overrides (gitignored). Prefer config.local.js for local keys.
(function () {
  try {
    if (window.MG_LOCAL_CONFIG) Object.assign(MG.config, window.MG_LOCAL_CONFIG);
  } catch (e) { /* ignore */ }
})();

MG.isConfigured = function () {
  return Boolean(MG.config.API_BASE_URL && MG.config.CLERK_PUBLISHABLE_KEY);
};
