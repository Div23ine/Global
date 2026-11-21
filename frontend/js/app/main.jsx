/* Customer application bootstrap + shell (Design 02 preserved).
   Flow: configuration check -> ClerkJS load -> auth gate -> hash router. */
(function () {
  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var h = React.createElement;

  /* -------------------------------------------------------- configuration */
  function ConfigScreen() {
    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('div', { className: 'brand brand-center' },
          h('span', { className: 'brand-mark', 'aria-hidden': 'true' }, '◎'),
          h('span', { className: 'brand-text' }, 'Meridian ', h('small', null, 'GLOBAL ACCOUNTS'))),
        h('h1', null, 'Configuration required'),
        h('p', { className: 'muted' },
          'This deployment has not been connected to a Clerk instance and an API endpoint yet. ',
          'Set ', h('code', null, 'CLERK_PUBLISHABLE_KEY'), ' and ', h('code', null, 'API_BASE_URL'),
          ' in ', h('code', null, 'js/config.js'), ' (or js/config.local.js).'),
        h('p', { className: 'muted' },
          'For security reasons the application never runs on simulated data: without real services ',
          'it stops here instead of showing fake accounts.')));
  }

  /* ------------------------------------------------------------ ClerkGate */
  var CLERK_MOUNT_STYLES = { width: '100%', maxWidth: '420px', margin: '0 auto' };

  function SignInView() {
    var ref = useRef(null);
    useEffect(function () {
      if (ref.current) MG.clerk.mountSignIn(ref.current, { fallbackRedirectUrl: 'app.html' });
    }, []);
    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('p', { className: 'auth-brand' }, 'Meridian Global Accounts'),
        h('div', { ref: ref, style: CLERK_MOUNT_STYLES })));
  }

  function SignUpView() {
    var ref = useRef(null);
    useEffect(function () {
      if (ref.current) MG.clerk.mountSignUp(ref.current, { fallbackRedirectUrl: 'app.html' });
    }, []);
    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('p', { className: 'auth-brand' }, 'Create your account'),
        h('p', { className: 'muted' },
          'Email and phone verification codes are sent automatically. Your country determines the default currency account.'),
        h('div', { ref: ref, style: CLERK_MOUNT_STYLES })));
  }

  /* ------------------------------------------------------------------ shell */
  var NAV = [
    { group: 'Banking', items: [
      { id: 'overview', label: 'Overview', icon: '◧' },
      { id: 'accounts', label: 'My Accounts', icon: '◎' },
      { id: 'activate', label: 'Activate Currency', icon: '⚡' },
      { id: 'deposits', label: 'Deposits', icon: '⇄' },
      { id: 'transactions', label: 'Transactions', icon: '≡' },
      { id: 'statements', label: 'Statements', icon: '🗂' },
    ] },
    { group: 'Account', items: [
      { id: 'notifications', label: 'Notifications', icon: '🔔' },
      { id: 'profile', label: 'Profile', icon: '👤' },
      { id: 'security', label: 'Security', icon: '🛡' },
      { id: 'sessions', label: 'Login Sessions', icon: '📱' },
      { id: 'support', label: 'Support', icon: '💬' },
      { id: 'settings', label: 'Settings', icon: '⚙' },
    ] },
  ];

  var TITLES = {
    overview: 'Account Overview', accounts: 'My Accounts', activate: 'Activate Currency',
    deposits: 'Deposits', transactions: 'Transactions', statements: 'Statements',
    notifications: 'Notifications', profile: 'Profile', security: 'Security',
    sessions: 'Login Sessions', support: 'Support', settings: 'Settings',
    register: 'Create Account', login: 'Sign In',
  };

  MG.app = { NAV: NAV, TITLES: TITLES };

  function parseHash() {
    var raw = (location.hash || '#/overview').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(Boolean);
    return { view: parts[0] || 'overview', param: parts[1] || null };
  }

  function Shell(props) {
    var route = props.route;
    var user = props.user;
    var _u = useState(0); var force = _u[1];
    var _d = useState(false); var drawer = _d[0]; var setDrawer = _d[1];

    useEffect(function () {
      var onHash = function () { force(function (x) { return x + 1; }); };
      window.addEventListener('hashchange', onHash);
      return function () { window.removeEventListener('hashchange', onHash); };
    }, []);

    var title = TITLES[route.view] || (route.view === 'account' ? 'Currency Account'
      : route.view === 'txn' ? 'Transaction Detail' : 'Meridian');
    var View = props.resolveView(route);

    return h(React.Fragment, null,
      h('div', { className: 'shell' + (drawer ? ' nav-open' : '') },
        h('aside', { className: 'sidenav', 'aria-label': 'Application' },
          h('a', { className: 'side-brand', href: 'index.html' },
            h('span', { className: 'brand-mark brand-mark-light', 'aria-hidden': 'true' }, '◎'),
            h('span', { className: 'brand-text brand-text-side' }, 'Meridian ', h('small', null, 'GLOBAL ACCOUNTS'))),
          NAV.map(function (group) {
            return h('div', { key: group.group, className: 'nav-group' },
              h('p', { className: 'nav-label' }, group.group),
              group.items.map(function (item) {
                return h('a', {
                  key: item.id,
                  className: 'nav-item' + (route.view === item.id ? ' active' : ''),
                  href: '#/' + item.id,
                  onClick: function () { setDrawer(false); },
                },
                h('span', { className: 'nav-ic', 'aria-hidden': 'true' }, item.icon),
                item.label,
                item.id === 'notifications' && MG.app.unreadCount > 0
                  ? h('span', { className: 'nav-badge' }, MG.app.unreadCount > 9 ? '9+' : MG.app.unreadCount)
                  : null);
              }));
          }),
          h('button', {
            className: 'nav-item nav-signout',
            onClick: function () { MG.clerk.signOut(); },
          }, h('span', { className: 'nav-ic', 'aria-hidden': 'true' }, '⎋'), 'Sign out')),
        h('div', { className: 'shell-main' },
          h('header', { className: 'topbar' },
            h('button', {
              className: 'icon-btn nav-burger', 'aria-label': 'Open navigation',
              onClick: function () { setDrawer(!drawer); },
            }, '☰'),
            h('h1', { id: 'gl-viewtitle', tabIndex: -1 }, title),
            h('div', { className: 'topbar-right' },
              h('a', { className: 'icon-btn', href: '#/notifications', 'aria-label': 'Notifications' }, '🔔'),
              h('div', { className: 'user-chip' },
                h('span', { className: 'avatar', 'aria-hidden': 'true' }, MG.util.initials(user.fullName)),
                h('span', { className: 'user-chip-name' }, user.fullName)))),
          h('main', { className: 'content', id: 'gl-main' },
            h(View, { route: route, user: user }))),
        h('div', {
          className: 'scrim' + (drawer ? '' : ' is-hidden'),
          onClick: function () { setDrawer(false); },
          hidden: !drawer,
        })));
  }

  /* ------------------------------------------------------------- root/app */
  function App() {
    var _a = useState({ ready: false, error: null });
    var auth = _a[0]; var setAuth = _a[1];
    var _r = useState(parseHash()); var route = _r[0]; var setRoute = _r[1];
    var _u = useState(0); var force = _u[1];

    useEffect(function () {
      MG.api.init();
      MG.clerk.load().then(function () {
        setAuth({ ready: true, error: null });
      }).catch(function (err) {
        setAuth({ ready: true, error: err });
      });
      var off = MG.clerk.onChange(function () { force(function (x) { return x + 1; }); });
      var onHash = function () { setRoute(parseHash()); };
      window.addEventListener('hashchange', onHash);
      return function () { off(); window.removeEventListener('hashchange', onHash); };
    }, []);

    if (!MG.isConfigured()) return h(ConfigScreen);
    if (!auth.ready) {
      return h('div', { className: 'auth-wrap' },
        h('div', { className: 'auth-card' }, h(MG.ui.Skeleton, { lines: 3 })));
    }
    if (auth.error) {
      return h('div', { className: 'auth-wrap' },
        h('div', { className: 'auth-card' },
          h('h1', null, 'Authentication unavailable'),
          h('p', { className: 'muted' }, 'The identity service could not be loaded. Check your connection and the Clerk configuration.'),
          h('button', {
            className: 'btn btn-primary', onClick: function () { location.reload(); },
          }, 'Retry')));
    }

    var st = MG.clerk.state;
    if (!st.signedIn || !st.user) {
      return route.view === 'register' ? h(SignUpView) : h(SignInView);
    }

    // Resolve view lazily so each view module registers itself.
    function resolveView(r) {
      var views = MG.views || {};
      var key = r.view === 'account' ? 'account' : r.view === 'txn' ? 'txn' : r.view;
      return views[key] || views.notFound || function () {
        return h('div', { className: 'panel' },
          h(MG.ui.Empty, { title: 'Page not found',
            hint: 'The view "' + r.view + '" does not exist.',
            action: h('a', { className: 'btn btn-primary', href: '#/overview' }, 'Back to overview') }));
      };
    }

    return h(Shell, { route: route, user: st.user, resolveView: resolveView });
  }

  ReactDOM.createRoot(document.getElementById('gl-app')).render(h(App));
})();
