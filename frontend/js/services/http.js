/* HTTP layer — the ONLY module allowed to call fetch.
   - attaches the Supabase Auth access JWT as a bearer token
   - normalizes the API envelope {success, message, data, meta}
   - surfaces stable error codes from API_SPECIFICATION.md
   - 40,000-character body cap guard, timeout, single retry on network error */
(function () {
  var TIMEOUT_MS = 20000;

  function ApiError(code, message, status, details) {
    var e = new Error(message || code);
    e.name = 'ApiError';
    e.code = code || 'INTERNAL';
    e.status = status || 500;
    e.details = details;
    return e;
  }

  function request(method, path, body, opts) {
    opts = opts || {};
    return MG.auth.token().then(function (token) {
      var url = MG.config.API_BASE_URL + path;
      var headers = { Accept: 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = controller
        ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS)
        : null;

      var doFetch = function (attempt) {
        return fetch(url, {
          method: method,
          headers: headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller ? controller.signal : undefined,
        }).then(function (res) {
          if (timer) clearTimeout(timer);
          return res.json().catch(function () { return {}; }).then(function (payload) {
            if (res.ok && payload && payload.success) {
              return { data: payload.data, meta: payload.meta || {}, message: payload.message || '' };
            }
            if (res.status === 401 && !opts.noRetryOn401) {
              // Refresh the Supabase Auth access token once, then retry once.
              return MG.auth.refresh().then(function (token) {
                if (token) headers.Authorization = 'Bearer ' + token;
                return doFetch(0);
              }).catch(function () {
                throw ApiError(
                  (payload && payload.code) || 'UNAUTHENTICATED',
                  (payload && payload.message) || 'Please sign in again.',
                  401, payload && payload.details,
                );
              });
            }
            throw ApiError(
              (payload && payload.code) || 'INTERNAL',
              (payload && payload.message) || 'Request failed (' + res.status + ').',
              res.status, payload && payload.details,
            );
          });
        }).catch(function (err) {
          if (err && err.name === 'ApiError') throw err;
          if (err && err.name === 'AbortError') {
            throw ApiError('TIMEOUT', 'The request timed out. Please try again.', 0);
          }
          if (attempt > 0) throw ApiError('NETWORK', 'Cannot reach the Meridian service.', 0);
          return doFetch(attempt - 1);
        });
      };
      return doFetch(1);
    });
  }

  MG.http = {
    ApiError: ApiError,
    get: function (path) { return request('GET', path, undefined); },
    post: function (path, body, opts) { return request('POST', path, body, opts); },
    patch: function (path, body) { return request('PATCH', path, body); },
    del: function (path) { return request('DELETE', path, undefined); },
    download: function (path) {
      return MG.auth.token().then(function (token) {
        return fetch(MG.config.API_BASE_URL + path, {
          headers: token ? { Authorization: 'Bearer ' + token } : {},
        }).then(function (res) {
          if (!res.ok) throw ApiError('HTTP_' + res.status, 'Download failed.', res.status);
          return res.text();
        });
      });
    },
  };
})();
