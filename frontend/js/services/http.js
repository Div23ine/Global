/* HTTP layer — the ONLY module allowed to call fetch.
   - attaches the Supabase Auth access JWT as a bearer token
   - normalizes the API envelope {success, message, data, meta}
   - refreshes an expired Supabase token at most once per request
   - retries a transient network failure at most once per token attempt */
(function () {
  var TIMEOUT_MS = 20000;

  function ApiError(code, message, status, details) {
    var e = new Error(message || code);
    e.name = 'ApiError';
    e.code = code || 'INTERNAL';
    e.status = status == null ? 500 : status;
    e.details = details;
    return e;
  }

  function request(method, path, body, opts) {
    opts = opts || {};
    return MG.auth.token().then(function (initialToken) {
      var url = MG.config.API_BASE_URL + path;
      var headers = { Accept: 'application/json' };
      if (initialToken) headers.Authorization = 'Bearer ' + initialToken;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

      function fetchOnce() {
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = controller
          ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS)
          : null;

        return fetch(url, {
          method: method,
          headers: headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller ? controller.signal : undefined,
        }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (payload) {
            return { response: res, payload: payload };
          });
        }).finally(function () {
          if (timer) clearTimeout(timer);
        });
      }

      function send(networkRetriesRemaining, authRetried) {
        return fetchOnce().then(function (result) {
          var res = result.response;
          var payload = result.payload;

          if (res.ok && payload && payload.success) {
            return { data: payload.data, meta: payload.meta || {}, message: payload.message || '' };
          }

          if (res.status === 401 && !authRetried && !opts.noRetryOn401) {
            // Refresh once only. A failed refresh becomes an auth error; a
            // failure of the retried API request keeps its original error.
            return MG.auth.refresh().then(function (token) {
              if (!token) {
                throw ApiError(
                  (payload && payload.code) || 'UNAUTHENTICATED',
                  (payload && payload.message) || 'Please sign in again.',
                  401, payload && payload.details,
                );
              }
              headers.Authorization = 'Bearer ' + token;
              return send(1, true);
            }, function () {
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
        }).catch(function (err) {
          if (err && err.name === 'ApiError') throw err;
          if (err && err.name === 'AbortError') {
            throw ApiError('TIMEOUT', 'The request timed out. Please try again.', 0);
          }
          if (networkRetriesRemaining > 0) {
            return send(networkRetriesRemaining - 1, authRetried);
          }
          throw ApiError('NETWORK', 'Cannot reach the Meridian service.', 0);
        });
      }

      return send(1, false);
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
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = controller
          ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS)
          : null;
        return fetch(MG.config.API_BASE_URL + path, {
          headers: token ? { Authorization: 'Bearer ' + token } : {},
          signal: controller ? controller.signal : undefined,
        }).then(function (res) {
          if (!res.ok) throw ApiError('HTTP_' + res.status, 'Download failed.', res.status);
          return res.text();
        }).catch(function (err) {
          if (err && err.name === 'ApiError') throw err;
          if (err && err.name === 'AbortError') {
            throw ApiError('TIMEOUT', 'The download timed out. Please try again.', 0);
          }
          throw ApiError('NETWORK', 'Cannot reach the Meridian service.', 0);
        }).finally(function () {
          if (timer) clearTimeout(timer);
        });
      });
    },
  };
})();
