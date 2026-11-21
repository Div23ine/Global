/* Meridian Global Accounts — frontend configuration (non-secret values only).
   Copy js/config.js to js/config.local.js to override values locally —
   config.local.js is gitignored. NEVER put secret keys here: Clerk
   publishable keys are public by design; Clerk secret keys and Supabase
   service-role keys belong to the backend only. */
window.MG = window.MG || {};
MG.config = {
  // REST API base (no trailing slash), e.g. https://api.meridian.example.com/api/v1
  API_BASE_URL: '',
  // Clerk publishable key (pk_...). Same key configured in the Clerk instance.
  CLERK_PUBLISHABLE_KEY: '',
  // Clerk is loaded from the official ClerkJS CDN build.
  CLERK_JS_URL: 'https://unpkg.com/@clerk/clerk-js@4/dist/clerk.browser.js',
  // Presentation defaults (European market).
  DEFAULT_CURRENCY: 'EUR',
  LOCALE: 'en-IE',
  APP_NAME: 'Meridian Global Accounts',
};
// Local overrides (gitignored).
(function () {
  try {
    // eslint-disable-next-line no-undef
    if (window.MG_LOCAL_CONFIG) Object.assign(MG.config, window.MG_LOCAL_CONFIG);
  } catch (e) { /* ignore */ }
})();
MG.isConfigured = function () {
  return Boolean(MG.config.API_BASE_URL && MG.config.CLERK_PUBLISHABLE_KEY);
};
