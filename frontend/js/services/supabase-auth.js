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
        publish(session, session && session.user);
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

    signIn: function (email, password) {
      return requireClient().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });
    },

    signUp: function (payload) {
      return requireClient().auth.signUp({
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        options: {
          data: {
            first_name: payload.firstName,
            last_name: payload.lastName,
            full_name: [payload.firstName, payload.lastName].filter(Boolean).join(' '),
            phone: payload.phone || '',
            country_code: (payload.countryCode || '').trim().toUpperCase(),
          },
          emailRedirectTo: window.location.origin + window.location.pathname,
        },
      });
    },

    resetPassword: function (email) {
      var redirectTo = window.location.origin + window.location.pathname + '#/reset-password';
      return requireClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: redirectTo,
      });
    },

    updatePassword: function (password) {
      return requireClient().auth.updateUser({ password: password });
    },

    signOut: function (options) {
      var scope = options && options.scope ? options.scope : 'local';
      return requireClient().auth.signOut({ scope: scope }).then(function (result) {
        if (!result.error) publish(null, null);
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
