/* Meridian Global Accounts — public frontend configuration.
   Supabase URL + anon/publishable key are intentionally public browser values.
   The service-role key must remain in the backend Worker secrets only.
   Set window.MG_SUPABASE_URL and window.MG_SUPABASE_ANON_KEY at deploy time,
   or use the local override mechanism below.
*/
window.MG = window.MG || {};
MG.config = {
  API_BASE_URL: (typeof window !== 'undefined' && window.MG_API_BASE_URL)
    ? window.MG_API_BASE_URL
    : 'https://global.primeage.workers.dev/api/v1',

  SUPABASE_URL: (typeof window !== 'undefined' && window.MG_SUPABASE_URL)
    ? window.MG_SUPABASE_URL
    : '',
  SUPABASE_ANON_KEY: (typeof window !== 'undefined' && window.MG_SUPABASE_ANON_KEY)
    ? window.MG_SUPABASE_ANON_KEY
    : '',

  DEFAULT_CURRENCY: 'EUR',
  LOCALE: 'en-IE',
  APP_NAME: 'Meridian Global Accounts',
};

(function () {
  try {
    if (window.MG_LOCAL_CONFIG) Object.assign(MG.config, window.MG_LOCAL_CONFIG);
  } catch (e) { /* ignore local override errors */ }
})();

MG.isConfigured = function () {
  return Boolean(
    MG.config.API_BASE_URL &&
    MG.config.SUPABASE_URL &&
    MG.config.SUPABASE_ANON_KEY
  );
};
