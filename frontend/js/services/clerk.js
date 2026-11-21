/* ClerkJS integration — the ONLY authentication mechanism.
   Loads the official ClerkJS browser build, exposes the Clerk instance,
   a React-friendly auth state hook, and a bearer-token provider for http.js.
   Registration, sign-in, sessions, password recovery, email/phone
   verification are handled by Clerk's own mounted components. */
(function () {
  var listeners = [];
  var state = { loaded: false, signedIn: false, userId: null, user: null, ready: false };

  function emit() {
    listeners.forEach(function (cb) {
      try { cb(state); } catch (e) { /* listener errors must not break auth */ }
    });
  }

  function readClerkState() {
    if (!window.Clerk || !window.Clerk.loaded) return;
    state.loaded = true;
    state.ready = true;
    state.signedIn = Boolean(window.Clerk.user);
    state.userId = window.Clerk.user ? window.Clerk.user.id : null;
    state.user = window.Clerk.user
      ? {
          id: window.Clerk.user.id,
          firstName: window.Clerk.user.firstName || '',
          lastName: window.Clerk.user.lastName || '',
          fullName: [window.Clerk.user.firstName, window.Clerk.user.lastName]
            .filter(Boolean).join(' ') || 'Customer',
          email: window.Clerk.user.primaryEmailAddress
            ? window.Clerk.user.primaryEmailAddress.emailAddress : '',
          phone: window.Clerk.user.primaryPhoneNumber
            ? window.Clerk.user.primaryPhoneNumber.phoneNumber : null,
          hasImage: Boolean(window.Clerk.user.imageUrl),
          imageUrl: window.Clerk.user.imageUrl || '',
        }
      : null;
    emit();
  }

  MG.clerk = {
    state: state,
    onChange: function (cb) { listeners.push(cb); return function () { listeners = listeners.filter(function (x) { return x !== cb; }); }; },

    /** Load ClerkJS; resolves when Clerk is ready. Safe to call repeatedly. */
    load: function () {
      if (MG.clerk._loading) return MG.clerk._loading;
      if (state.ready) return Promise.resolve();
      MG.clerk._loading = new Promise(function (resolve, reject) {
        if (!MG.config.CLERK_PUBLISHABLE_KEY) {
          reject(new Error('CLERK_PUBLISHABLE_KEY is not configured'));
          return;
        }
        var s = document.createElement('script');
        s.src = MG.config.CLERK_JS_URL;
        s.async = true;
        s.onload = function () {
          try {
            var clerk = new window.Clerk(MG.config.CLERK_PUBLISHABLE_KEY);
            clerk.load().then(function () {
              window.Clerk = clerk;
              readClerkState();
              clerk.addListener(function () { readClerkState(); });
              resolve();
            }).catch(reject);
          } catch (e) { reject(e); }
        };
        s.onerror = function () { reject(new Error('Failed to load ClerkJS')); };
        document.head.appendChild(s);
      });
      return MG.clerk._loading;
    },

    /** Current session JWT for API calls (null when signed out). */
    token: function () {
      if (!window.Clerk || !window.Clerk.session) return Promise.resolve(null);
      return window.Clerk.session.getToken().catch(function () { return null; });
    },

    /** Imperative Clerk mounts used by the React views via refs. */
    mountSignIn: function (el, props) {
      return window.Clerk.mountSignIn(el, props || {});
    },
    mountSignUp: function (el, props) {
      return window.Clerk.mountSignUp(el, props || {});
    },
    mountUserButton: function (el, props) {
      return window.Clerk.mountUserButton(el, props || {});
    },
    mountUserProfile: function (el, props) {
      return window.Clerk.mountUserProfile(el, props || {});
    },
    openUserProfile: function () { return window.Clerk.openUserProfile(); },
    signOut: function () { return window.Clerk.signOut(); },
  };
})();
