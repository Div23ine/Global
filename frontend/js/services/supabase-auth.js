/* Supabase Auth client — the sole browser identity/session provider. */
(function () {
  var client = null;
  var loading = null;
  var subscription = null;
  var listeners = [];
  // Keep the customer shell gated between email OTP success and completion of
  // any enrolled TOTP challenge. Admin sign-in uses its own OTP flow.
  var customerOtpPending = (function () {
    try { return window.sessionStorage.getItem('mg_customer_otp_pending') === '1'; }
    catch (e) { return false; }
  })();
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
    state.signedIn = Boolean(session && user && !customerOtpPending);
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
      customerOtpPending = true;
      try { window.sessionStorage.setItem('mg_customer_otp_pending', '1'); } catch (e) {}
      return requireClient().auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false },
      }).then(function (result) {
        if (result.error) {
          customerOtpPending = false;
          try { window.sessionStorage.removeItem('mg_customer_otp_pending'); } catch (e) {}
        }
        return result;
      }).catch(function (error) {
        customerOtpPending = false;
        try { window.sessionStorage.removeItem('mg_customer_otp_pending'); } catch (e) {}
        throw error;
      });
    },

    signInAdmin: function (email) {
      var normalizedEmail = email.trim().toLowerCase();
      return requireClient().auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false },
      });
    },

    verifyAdminOtp: function (email, token) {
      var normalizedEmail = email.trim().toLowerCase();
      var code = String(token).replace(/\s+/g, '');
      if (!/^\d{6}$/.test(code)) {
        return Promise.resolve({ data: null, error: new Error('Enter the six-digit email code.') });
      }
      return requireClient().auth.verifyOtp({
        email: normalizedEmail,
        token: code,
        type: 'email',
      });
    },

    verifyEmailOtp: function (email, token) {
      var normalized = email.trim().toLowerCase();
      var code = String(token).replace(/\s+/g, '');
      if (!/^\d{6}$/.test(code)) {
        return Promise.resolve({ data: null, error: new Error('Enter the six-digit email code.') });
      }
      return requireClient().auth.verifyOtp({
        email: normalized,
        token: code,
        type: 'email',
      }).then(function (result) {
        if (result.error) return result;
        // After OTP succeeds on registration, set the password chosen on the form.
        return MG.auth.completeSignUpPassword().then(function (pwResult) {
          if (pwResult && pwResult.error) return pwResult;
          return result;
        });
      });
    },

    /**
     * Registration is OTP-first (no magic link):
     * 1) beginSignUp → signInWithOtp(shouldCreateUser: true) + stash password locally
     * 2) verifyEmailOtp → verifyOtp type email
     * 3) completeSignUpPassword → updateUser({ password })
     * Supabase "Magic Link or OTP" and "Confirm sign up" templates must show {{ .Token }}.
     */
    beginSignUp: function (payload) {
      var email = payload.email.trim().toLowerCase();
      var password = payload.password;
      var meta = {
        full_name: payload.fullName.trim(),
        first_name: payload.firstName || '',
        last_name: payload.lastName || '',
        phone: payload.phone,
        country: payload.country.trim(),
        country_name: payload.country.trim(),
        country_code: payload.countryCode.trim().toUpperCase(),
        country_calling_code: payload.callingCode.trim(),
      };
      try {
        window.sessionStorage.setItem('mg_pending_signup', JSON.stringify({
          email: email,
          password: password,
          meta: meta,
        }));
      } catch (e) { /* private mode */ }
      return requireClient().auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true,
          data: meta,
        },
      });
    },

    /* Kept for compatibility — routes to beginSignUp */
    signUp: function (payload) {
      return MG.auth.beginSignUp(payload);
    },

    resendSignupOtp: function (email) {
      var normalized = String(email || '').trim().toLowerCase();
      var pending = null;
      try { pending = JSON.parse(window.sessionStorage.getItem('mg_pending_signup') || 'null'); } catch (e) {}
      var meta = (pending && pending.email === normalized && pending.meta) ? pending.meta : undefined;
      return requireClient().auth.signInWithOtp({
        email: normalized,
        options: {
          shouldCreateUser: true,
          data: meta,
        },
      });
    },

    completeSignUpPassword: function () {
      var pending = null;
      try { pending = JSON.parse(window.sessionStorage.getItem('mg_pending_signup') || 'null'); } catch (e) {}
      if (!pending || !pending.password) {
        return Promise.resolve({ data: { user: state.user }, error: null });
      }
      var currentEmail = (state.user && state.user.email || '').trim().toLowerCase();
      if (pending.email && currentEmail && pending.email !== currentEmail) {
        return Promise.resolve({ data: { user: state.user }, error: null });
      }
      return requireClient().auth.updateUser({ password: pending.password }).then(function (result) {
        try { window.sessionStorage.removeItem('mg_pending_signup'); } catch (e) {}
        return result;
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
      customerOtpPending = false;
      try { window.sessionStorage.removeItem('mg_customer_otp_pending'); } catch (e) {}
      var session = state.session;
      if (session && session.user) publish(session, session.user);
    },

    updatePassword: function (password) {
      return requireClient().auth.updateUser({ password: password });
    },

    signOut: function (options) {
      var scope = options && options.scope ? options.scope : 'local';
      return requireClient().auth.signOut({ scope: scope }).then(function (result) {
        if (!result.error && scope !== 'others') {
          customerOtpPending = false;
          try { window.sessionStorage.removeItem('mg_customer_otp_pending'); } catch (e) {}
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

  // Hard aliases — survive partial deploys / cache skew between HTML and JS.
  if (typeof MG.auth.verifyAdminOtp !== 'function') {
    MG.auth.verifyAdminOtp = function (email, token) {
      return MG.auth.verifyEmailOtp(email, token);
    };
  }
  if (typeof MG.auth.signInAdmin !== 'function') {
    MG.auth.signInAdmin = function (email) {
      return MG.auth.signIn(email);
    };
  }
})();
