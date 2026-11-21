/* Meridian Global Accounts — runtime configuration.
 * Supabase browser settings are retrieved from the API Worker.
 * Only SUPABASE_URL and SUPABASE_ANON_KEY are returned. Never expose
 * SUPABASE_SERVICE_ROLE_KEY or any other private Worker secret.
 */
window.MG = window.MG || {};
MG.config = {
  API_BASE_URL: (typeof window !== 'undefined' && window.MG_API_BASE_URL)
    ? window.MG_API_BASE_URL
    : 'https://api.meridian.uk.com/api/v1',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  DEFAULT_CURRENCY: 'EUR',
  LOCALE: 'en-IE',
  APP_NAME: 'Meridian Global Accounts',
};
MG.configLoaded = false;
MG.configError = null;

MG.ready = (function () {
  var base = MG.config.API_BASE_URL;
  if (base.charAt(base.length - 1) === '/') base = base.slice(0, -1);
  return fetch(base + '/public-config', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    cache: 'no-store',
  }).then(function (response) {
    return response.json().then(function (body) {
      if (!response.ok || !body || body.success !== true || !body.data) {
        throw new Error((body && body.message) || 'The API did not provide public configuration.');
      }
      MG.config.SUPABASE_URL = body.data.supabaseUrl || '';
      MG.config.SUPABASE_ANON_KEY = body.data.supabaseAnonKey || '';
    });
  }).catch(function (error) {
    MG.configError = error;
  }).then(function () {
    MG.configLoaded = true;
    return MG.config;
  });
})();

MG.isConfigured = function () {
  return Boolean(MG.config.API_BASE_URL && MG.config.SUPABASE_URL && MG.config.SUPABASE_ANON_KEY);
};
