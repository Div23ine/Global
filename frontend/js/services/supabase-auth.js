/* Meridian browser auth facade.
 * Auth tokens exist only in Secure/HttpOnly cookies on the API host.
 * Browser JS receives safe user data and a CSRF nonce, never a JWT.
 */
(function () {
  var listeners = [];
  var refreshPromise = null;
  var pendingSignup = null;
  var customerOtpPending = false;
  var state = {
    ready: false,
    signedIn: false,
    user: null,
    session: null,
    csrfToken: null,
    mfaRequired: false,
    mfaFactorId: null,
  };

  function publish(data) {
    data = data || {};
    if (data.csrfToken) state.csrfToken = data.csrfToken;
    if (Object.prototype.hasOwnProperty.call(data, 'user')) state.user = data.user || null;
    state.mfaRequired = Boolean(data.mfaRequired);
    state.mfaFactorId = data.mfaFactorId || null;
    state.session = null;
    state.signedIn = Boolean(state.user && !customerOtpPending && !state.mfaRequired);
    state.ready = true;
    listeners.slice().forEach(function (listener) {
      try { listener(state); } catch (error) { /* isolate view listeners */ }
    });
  }

  function asResult(promise) {
    return promise.then(function (result) {
      return {
        data: result && Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : result,
        error: null,
      };
    }).catch(function (error) { return { data: null, error: error }; });
  }

  function clearLegacyBrowserSessions() {
    try {
      [window.sessionStorage, window.localStorage].forEach(function (store) {
        var remove = [];
        for (var i = 0; i < store.length; i++) {
          var key = store.key(i);
          if (key && (
            key.indexOf('sb-') === 0 ||
            key.indexOf('supabase.auth') === 0 ||
            key === 'mg-auth' ||
            key === 'mg-auth-tab' ||
            key === 'mg_pending_signup'
          )) remove.push(key);
        }
        remove.forEach(function (key) { store.removeItem(key); });
      });
    } catch (error) { /* storage can be disabled in private browsing */ }
  }

  function ensureCsrf() {
    if (state.csrfToken) return Promise.resolve(state.csrfToken);
    return MG.http.get('/auth/csrf', { noRetryOn401: true }).then(function (result) {
      var token = result.data && result.data.csrfToken;
      if (!token) throw new Error('The secure session could not be initialized.');
      state.csrfToken = token;
      return token;
    });
  }

  function requestOtp(email, shouldCreateUser, metadata) {
    return ensureCsrf().then(function () {
      return asResult(MG.http.post('/auth/otp', {
        email: String(email || '').trim().toLowerCase(),
        shouldCreateUser: shouldCreateUser === true,
        ...(metadata ? { data: metadata } : {}),
      }));
    });
  }

  window.MG = window.MG || {};
  MG.auth = {
    state: state,

    onChange: function (callback) {
      listeners.push(callback);
      return function () { listeners = listeners.filter(function (item) { return item !== callback; }); };
    },

    load: function () {
      if (state.ready) return Promise.resolve();
      clearLegacyBrowserSessions();
      return ensureCsrf().then(function () {
        return MG.http.get('/auth/session', { noRetryOn401: true }).catch(function (error) {
          if (!error || error.status !== 401) throw error;
          return MG.auth.refresh().then(function (refreshed) {
            if (!refreshed) return null;
            return MG.http.get('/auth/session', { noRetryOn401: true });
          }).catch(function (refreshError) {
            if (refreshError && refreshError.status === 401) return null;
            throw refreshError;
          });
        });
      }).then(function (result) {
        publish(result && result.data ? result.data : { user: null });
      }).catch(function (error) {
        publish({ user: null });
        if (error && error.status === 401) return;
        throw error;
      });
    },

    refresh: function () {
      if (refreshPromise) return refreshPromise;
      refreshPromise = ensureCsrf().then(function () {
        return MG.http.post('/auth/refresh', {}, { noRetryOn401: true });
      }).then(function (result) {
        publish(result.data || {});
        return true;
      }).catch(function (error) {
        if (error && error.status === 401) {
          customerOtpPending = false;
          pendingSignup = null;
          publish({ user: null, mfaRequired: false, mfaFactorId: null });
          state.csrfToken = null;
          return false;
        }
        throw error;
      }).finally(function () { refreshPromise = null; });
      return refreshPromise;
    },

    signIn: function (email) {
      customerOtpPending = true;
      state.signedIn = false;
      return requestOtp(email, false).then(function (result) {
        if (result.error) customerOtpPending = false;
        return result;
      }).catch(function (error) {
        customerOtpPending = false;
        throw error;
      });
    },

    signInAdmin: function (email) {
      return requestOtp(email, false);
    },

    verifyAdminOtp: function (email, token) {
      return asResult(ensureCsrf().then(function () {
        return MG.http.post('/auth/verify-otp', {
          email: String(email || '').trim().toLowerCase(),
          token: String(token || '').replace(/\s+/g, ''),
        });
      }).then(function (result) {
        customerOtpPending = false;
        publish(result.data);
        return result.data;
      }));
    },

    verifyEmailOtp: function (email, token) {
      var normalizedEmail = String(email || '').trim().toLowerCase();
      var password = pendingSignup && pendingSignup.email === normalizedEmail
        ? pendingSignup.password : undefined;
      return asResult(ensureCsrf().then(function () {
        return MG.http.post('/auth/verify-otp', {
          email: normalizedEmail,
          token: String(token || '').replace(/\s+/g, ''),
          ...(password ? { password: password } : {}),
        });
      }).then(function (result) {
        if (pendingSignup && pendingSignup.email === normalizedEmail) pendingSignup = null;
        publish(result.data);
        return result.data;
      }));
    },

    beginSignUp: function (payload) {
      var email = String(payload.email || '').trim().toLowerCase();
      var metadata = {
        full_name: String(payload.fullName || '').trim(),
        first_name: payload.firstName || '',
        last_name: payload.lastName || '',
        phone: payload.phone,
        country: String(payload.country || '').trim(),
        country_name: String(payload.country || '').trim(),
        country_code: String(payload.countryCode || '').trim().toUpperCase(),
        country_calling_code: String(payload.callingCode || '').trim(),
      };
      // Keep the chosen password in module memory only; never sessionStorage.
      pendingSignup = { email: email, password: payload.password, meta: metadata };
      customerOtpPending = true;
      return requestOtp(email, true, metadata);
    },
    signUp: function (payload) { return MG.auth.beginSignUp(payload); },

    resendSignupOtp: function (email) {
      var normalized = String(email || '').trim().toLowerCase();
      return requestOtp(
        normalized,
        true,
        pendingSignup && pendingSignup.email === normalized ? pendingSignup.meta : undefined,
      );
    },

    completeSignUpPassword: function () {
      // The API saves a registration password before it issues session cookies.
      return Promise.resolve({ data: { user: state.user }, error: null });
    },

    getMfaAssurance: function () { return asResult(MG.http.get('/auth/mfa/assurance')); },
    listMfaFactors: function () { return asResult(MG.http.get('/auth/mfa/factors')); },
    enrollTotp: function () { return asResult(MG.http.post('/auth/mfa/enroll', {})); },
    challengeTotp: function (factorId) {
      return asResult(MG.http.post('/auth/mfa/challenge', { factorId: factorId }));
    },
    verifyTotp: function (factorId, challengeId, code) {
      return asResult(MG.http.post('/auth/mfa/verify', {
        factorId: factorId,
        challengeId: challengeId,
        code: String(code || '').replace(/\s+/g, ''),
      }).then(function (result) {
        if (result.data && result.data.csrfToken) state.csrfToken = result.data.csrfToken;
        return result.data;
      }));
    },
    unenrollTotp: function (factorId) {
      return asResult(MG.http.post('/auth/mfa/unenroll', { factorId: factorId }).then(function (result) {
        if (result.data && result.data.csrfToken) state.csrfToken = result.data.csrfToken;
        return result.data;
      }));
    },

    completeCustomerLogin: function () {
      customerOtpPending = false;
      state.mfaRequired = false;
      state.mfaFactorId = null;
      state.signedIn = Boolean(state.user);
      listeners.slice().forEach(function (listener) {
        try { listener(state); } catch (error) { /* isolate listeners */ }
      });
    },

    updatePassword: function (password) {
      return asResult(MG.http.post('/auth/password', { password: password }));
    },

    signOut: function (options) {
      var scope = options && options.scope ? options.scope : 'local';
      return asResult(MG.http.post('/auth/logout', { scope: scope }).then(function (result) {
        if (scope !== 'others') {
          customerOtpPending = false;
          pendingSignup = null;
          publish({ user: null, mfaRequired: false, mfaFactorId: null });
          state.csrfToken = null;
        }
        return result.data;
      }));
    },

    destroy: function () {
      customerOtpPending = false;
      pendingSignup = null;
      publish({ user: null, mfaRequired: false, mfaFactorId: null });
      state.csrfToken = null;
    },
  };
})();
