/* Meridian public runtime configuration.
 * Authentication and all protected API access run through the cookie BFF.
 * No Supabase Auth key or token is exposed to browser JavaScript.
 */
window.MG = window.MG || {};
MG.config = {
  API_BASE_URL: (typeof window !== 'undefined' && window.MG_API_BASE_URL)
    ? window.MG_API_BASE_URL
    : 'https://api.meridian.uk.com/api/v1',
  DEFAULT_CURRENCY: 'EUR',
  LOCALE: 'en-IE',
  APP_NAME: 'Meridian Global Accounts',
};
MG.configLoaded = true;
MG.configError = null;
MG.ready = Promise.resolve(MG.config);
MG.isConfigured = function () { return Boolean(MG.config.API_BASE_URL); };
