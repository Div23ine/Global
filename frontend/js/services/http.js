/* HTTP layer — only fetch module.
 * Supabase access/refresh tokens are never read or sent by browser JS.
 */
(function () {
  var TIMEOUT_MS = 20000;
  var SAFE_METHODS = { GET: true, HEAD: true, OPTIONS: true };

  function ApiError(code, message, status, details) {
    var error = new Error(message || code);
    error.name = 'ApiError';
    error.code = code || 'INTERNAL';
    error.status = status == null ? 500 : status;
    error.details = details;
    return error;
  }

  function request(method, path, body, opts) {
    opts = opts || {};
    var url = MG.config.API_BASE_URL + path;
    var headers = { Accept: 'application/json' };
    // This marker is sent only by the customer application, never by the
    // administrator dashboard. It keeps the admin tab fully functional while
    // a separate customer tab is operating in takeover scope.
    if (document.body && document.body.getAttribute('data-page') === 'app') {
      headers['X-Meridian-Customer-Context'] = '1';
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (!SAFE_METHODS[method] && MG.auth && MG.auth.state.csrfToken) {
      headers['X-Meridian-CSRF'] = MG.auth.state.csrfToken;
    }
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

    function fetchOnce() {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;
      return fetch(url, {
        method: method,
        headers: headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: 'include',
        cache: 'no-store',
        signal: controller ? controller.signal : undefined,
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (payload) {
          return { response: response, payload: payload };
        });
      }).finally(function () { if (timer) clearTimeout(timer); });
    }

    function send(retriesRemaining, authRetried) {
      return fetchOnce().then(function (result) {
        var response = result.response;
        var payload = result.payload;
        if (response.ok && payload && payload.success) {
          return { data: payload.data, meta: payload.meta || {}, message: payload.message || '' };
        }
        if (response.status === 401 && !authRetried && !opts.noRetryOn401) {
          return MG.auth.refresh().then(function (refreshed) {
            if (!refreshed) {
              throw ApiError(
                (payload && payload.code) || 'UNAUTHENTICATED',
                (payload && payload.message) || 'Please sign in again.',
                401, payload && payload.details,
              );
            }
            if (!SAFE_METHODS[method] && MG.auth.state.csrfToken) {
              headers['X-Meridian-CSRF'] = MG.auth.state.csrfToken;
            }
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
          (payload && payload.message) || 'Request failed (' + response.status + ').',
          response.status, payload && payload.details,
        );
      }).catch(function (error) {
        if (error && error.name === 'ApiError') throw error;
        if (error && error.name === 'AbortError') {
          throw ApiError('TIMEOUT', 'The request timed out. Please try again.', 0);
        }
        if (retriesRemaining > 0) return send(retriesRemaining - 1, authRetried);
        throw ApiError('NETWORK', 'Cannot reach the Meridian service.', 0);
      });
    }
    return send(1, false);
  }

  MG.http = {
    ApiError: ApiError,
    get: function (path, opts) { return request('GET', path, undefined, opts); },
    post: function (path, body, opts) { return request('POST', path, body, opts); },
    patch: function (path, body, opts) { return request('PATCH', path, body, opts); },
    del: function (path, opts) { return request('DELETE', path, undefined, opts); },
    download: function (path) {
      return fetch(MG.config.API_BASE_URL + path, {
        headers: { Accept: 'text/plain' },
        credentials: 'include',
        cache: 'no-store',
      }).then(function (response) {
        if (!response.ok) throw ApiError('HTTP_' + response.status, 'Download failed.', response.status);
        return response.text();
      }).catch(function (error) {
        if (error && error.name === 'ApiError') throw error;
        throw ApiError('NETWORK', 'Cannot reach the Meridian service.', 0);
      });
    },
  };
})();
