/* Supabase Auth client — the sole browser identity/session provider. */
(function () {
  var client = null;
  var loading = null;
  var subscription = null;
  var listeners = [];
  var state = {
    ready: false,
    signedIn: false,
    user: null,
    session: null,
  };

  function normalizedUser(user) {
    if (!user) return null;
    var meta = user.user_metadata || {};
    var firstName = meta.first_name || '';
    var lastName = meta.last_name || '';
    return {
      id: user.id,
      email: user.email || '',
      firstName: firstName,
      lastName: lastName,
      fullName: [firstName, lastName].filter(Boolean).join(' ') || meta.full_name || 'Customer',
      phone: user.phone || meta.phone || null,
      hasImage: Boolean(meta.avatar_url),
      imageUrl: meta.avatar_url || '',
    };
  }

  function publish(session, user) {
    state.session = session || null;
    state.signedIn = Boolean(session && user);
    state.user = normalizedUser(user || (session && session.user));
    state.ready = true;
    listeners.slice().forEach(function (listener) {
      try { listener(state); } catch (e) { /* a view must not break auth */ }
    });
  }

  function requireClient() {
    if (!client) throw new Error('Supabase Auth has not been initialized.');
    return client;
  }

  window.MG = window.MG || {};
  MG.auth = {
    state: state,

    onChange: function (callback) {
      listeners.push(callback);
      return function () {
        listeners = listeners.filter(function (item) { return item !== callback; });
      };
    },

    load: function () {
      if (loading) return loading;
      if (state.ready && client) return Promise.resolve();
      if (!MG.config.SUPABASE_URL || !MG.config.SUPABASE_ANON_KEY) {
        return Promise.reject(new Error('SUPABASE_URL and SUPABASE_ANON_KEY are not configured.'));
      }
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        return Promise.reject(new Error('The Supabase browser SDK could not be loaded.'));
      }

      client = window.supabase.createClient(
        MG.config.SUPABASE_URL,
        MG.config.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'pkce',
          },
        }
      );

      var authEvents = client.auth.onAuthStateChange(function (_event, session) {
        // Keep this callback synchronous; Supabase warns against awaiting other
        // Supabase calls from inside onAuthStateChange.
        publish(session, session && session.user);
      });
      subscription = authEvents.data && authEvents.data.subscription;

      loading = client.auth.getSession().then(function (result) {
        if (result.error) throw result.error;
        var session = result.data.session;
        if (!session) {
          publish(null, null);
          return;
        }
        return client.auth.getUser().then(function (userResult) {
          if (userResult.error) throw userResult.error;
          publish(session, userResult.data.user);
        });
      }).then(function () {
        state.ready = true;
      }).catch(function (error) {
        publish(null, null);
        throw error;
      });
      return loading;
    },

    token: function () {
      var current = requireClient();
      return current.auth.getSession().then(function (result) {
        if (result.error) throw result.error;
        var session = result.data.session;
        return session ? session.access_token : null;
      });
    },

    refresh: function () {
      var current = requireClient();
      return current.auth.refreshSession().then(function (result) {
        if (result.error) {
          publish(null, null);
          throw result.error;
        }
        var session = result.data.session;
        publish(session, session && session.user);
        return session ? session.access_token : null;
      });
    },

    signIn: function (email) {
      var normalizedEmail = email.trim().toLowerCase();
      try { window.localStorage.setItem('mg_customer_login_email', normalizedEmail); } catch (e) {}
      return requireClient().auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname + '?customer_login=1' },
      });
    },

    signInAdmin: function (email) {
      return requireClient().auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname },
      });
    },

    hasPendingSecondFactor: function () {
      try {
        var pending = window.localStorage.getItem('mg_customer_login_email');
        var current = state.user && state.user.email;
        var callbackFlow = new URLSearchParams(window.location.search).get('customer_login') === '1';
        return Boolean(current && ((pending && pending === current.trim().toLowerCase()) || callbackFlow));
      } catch (e) { return false; }
    },

    sendPostLinkEmailOtp: function () {
      var email = state.user && state.user.email;
      if (!email || !MG.auth.hasPendingSecondFactor()) {
        return Promise.reject(new Error('Open your sign-in link before requesting the email code.'));
      }
      return requireClient().auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      });
    },

    verifyPostLinkEmailOtp: function (token) {
      var email = state.user && state.user.email;
      if (!email || !MG.auth.hasPendingSecondFactor()) {
        return Promise.reject(new Error('There is no pending email verification.'));
      }
      return requireClient().auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: String(token).replace(/\s+/g, ''),
        type: 'email',
      });
    },

    verifyEmailOtp: function (email, token) {
      var normalized = email.trim().toLowerCase();
      var code = String(token).replace(/\s+/g, '');
      return requireClient().auth.verifyOtp({
        email: normalized,
        token: code,
        type: 'signup',
      }).then(function (result) {
        if (!result.error) return result;
        // Fallback when the project issues a generic email OTP type.
        return requireClient().auth.verifyOtp({
          email: normalized,
          token: code,
          type: 'email',
        });
      });
    },

    signUp: function (payload) {
      // Password registration + email one-time code (OTP). Do not pass
      // emailRedirectTo — that steers Supabase toward a "Confirm your email"
      // magic-link message. The Confirm signup template must include
      // {{ .Token }} so the customer receives a numeric OTP instead.
      var email = payload.email.trim().toLowerCase();
      return requireClient().auth.signUp({
        email: email,
        password: payload.password,
        options: {
          data: {
            full_name: payload.fullName.trim(),
            first_name: payload.firstName || '',
            last_name: payload.lastName || '',
            phone: payload.phone,
            country: payload.country.trim(),
            country_name: payload.country.trim(),
            country_code: payload.countryCode.trim().toUpperCase(),
            country_calling_code: payload.callingCode.trim(),
          },
        },
      }).then(function (result) {
        if (result.error) return result;
        // If the project still has a stale session path, ensure an OTP is issued.
        var user = result.data && result.data.user;
        var session = result.data && result.data.session;
        if (user && !session) {
          return requireClient().auth.resend({ type: 'signup', email: email }).then(function (resendResult) {
            if (resendResult.error) return resendResult;
            return result;
          });
        }
        return result;
      });
    },

    resendSignupOtp: function (email) {
      return requireClient().auth.resend({
        type: 'signup',
        email: String(email || '').trim().toLowerCase(),
      });
    },

    /* SMS/phone verification removed: customers verify by email OTP only. */

    getMfaAssurance: function () {
      return requireClient().auth.mfa.getAuthenticatorAssuranceLevel();
    },

    listMfaFactors: function () {
      return requireClient().auth.mfa.listFactors();
    },

    enrollTotp: function () {
      return requireClient().auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Meridian Global Accounts',
      });
    },

    challengeTotp: function (factorId) {
      return requireClient().auth.mfa.challenge({ factorId: factorId });
    },

    verifyTotp: function (factorId, challengeId, code) {
      return requireClient().auth.mfa.verify({
        factorId: factorId,
        challengeId: challengeId,
        code: String(code).replace(/\s+/g, ''),
      });
    },

    unenrollTotp: function (factorId) {
      return requireClient().auth.mfa.unenroll({ factorId: factorId });
    },

    completeCustomerLogin: function () {
      try { window.localStorage.removeItem('mg_customer_login_email'); } catch (e) {}
      if (new URLSearchParams(window.location.search).has('customer_login')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    },

    updatePassword: function (password) {
      return requireClient().auth.updateUser({ password: password });
    },

    signOut: function (options) {
      var scope = options && options.scope ? options.scope : 'local';
      return requireClient().auth.signOut({ scope: scope }).then(function (result) {
        if (!result.error && scope !== 'others') {
          try { window.localStorage.removeItem('mg_customer_login_email'); } catch (e) {}
          publish(null, null);
        }
        return result;
      });
    },

    getClient: function () { return requireClient(); },

    destroy: function () {
      if (subscription) subscription.unsubscribe();
      subscription = null;
      client = null;
      loading = null;
      publish(null, null);
    },
  };
})();
