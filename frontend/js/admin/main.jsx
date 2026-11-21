/* Admin console bootstrap + shell. Role-gated: requires an admin role in
   the backend admin_users table; permissions are enforced per endpoint. */
(function () {
  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var useState = React.useState, useEffect = React.useEffect;
  var h = React.createElement;

  var NAV = [
    { group: 'Operations', items: [
      { id: 'dashboard', label: 'Overview' },
      { id: 'users', label: 'User Management' },
      { id: 'deposits', label: 'Deposit Management' },
      { id: 'refunds', label: 'Refund Management' },
      { id: 'transactions', label: 'Transactions' },
      { id: 'payments', label: 'Payment Monitoring' },
    ] },
    { group: 'Security & Compliance', items: [
      { id: 'security', label: 'Security Monitoring' },
      { id: 'audit', label: 'Audit Logs' },
      { id: 'roles', label: 'Admin Roles' },
    ] },
    { group: 'Service', items: [
      { id: 'support', label: 'Support' },
      { id: 'currencies', label: 'Currency Management' },
      { id: 'reports', label: 'Reports' },
      { id: 'settings', label: 'Settings' },
    ] },
  ];

  var TITLES = {
    dashboard: 'Overview', users: 'User Management', deposits: 'Deposit Management',
    refunds: 'Refund Management', transactions: 'Transactions', payments: 'Payment Monitoring', security: 'Security Monitoring',
    audit: 'Audit Logs', roles: 'Admin Roles', support: 'Support',
    currencies: 'Currency Management', reports: 'Reports', settings: 'Settings',
  };

  function parseHash() {
    var raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(Boolean);
    return { view: parts[0] || 'dashboard', param: parts[1] || null };
  }

  function AdminApp() {
    var _a = useState({ ready: false, error: null }); var auth = _a[0]; var setAuth = _a[1];
    var _r = useState(parseHash()); var route = _r[0]; var setRoute = _r[1];
    var _p = useState(null); var profile = _p[0]; var setProfile = _p[1];
    var _f = useState(0); var force = _f[1];

    useEffect(function () {
      MG.api.init();
      MG.clerk.load().then(function () { setAuth({ ready: true, error: null }); })
        .catch(function (err) { setAuth({ ready: true, error: err }); });
      var off = MG.clerk.onChange(function () { force(function (x) { return x + 1; }); });
      var onHash = function () { setRoute(parseHash()); };
      window.addEventListener('hashchange', onHash);
      return function () { off(); window.removeEventListener('hashchange', onHash); };
    }, []);

    // Once signed in, confirm the caller actually holds an admin role by
    // hitting an admin endpoint (any role suffices for the gate; per-view
    // endpoints enforce specific permissions).
    useEffect(function () {
      if (MG.clerk.state.signedIn && !profile) {
        MGA.api.overview().then(function () {
          setProfile({ admin: true });
        }).catch(function (err) {
          setProfile({ admin: false, error: err });
        });
      }
    }, [MG.clerk.state.signedIn, profile]);

    if (!MG.isConfigured()) {
      return h('div', { className: 'auth-wrap' },
        h('div', { className: 'auth-card' },
          h('h1', null, 'Configuration required'),
          h('p', { className: 'muted' }, 'Set CLERK_PUBLISHABLE_KEY and API_BASE_URL in js/config.js.')));
    }
    if (!auth.ready) {
      return h('div', { className: 'auth-wrap' },
        h('div', { className: 'auth-card' }, h(MG.ui.Skeleton, { lines: 3 })));
    }
    if (auth.error) {
      return h('div', { className: 'auth-wrap' },
        h('div', { className: 'auth-card' },
          h('h1', null, 'Authentication unavailable'),
          h('p', { className: 'muted' }, 'The identity service could not be loaded.'),
          h('button', { className: 'btn btn-primary', onClick: function () { location.reload(); } }, 'Retry')));
    }
    if (!MG.clerk.state.signedIn) {
      // Clerk sign-in mounted inline.
      return h(SignInInline);
    }
    if (!profile) {
      return h('div', { className: 'auth-wrap' },
        h('div', { className: 'auth-card' }, h(MG.ui.Skeleton, { lines: 2 })));
    }
    if (!profile.admin) {
      return h('div', { className: 'auth-wrap' },
        h('div', { className: 'auth-card' },
          h('h1', null, 'Not an administrator'),
          h('p', { className: 'muted' }, 'This account does not hold an administrative role. Access attempts are logged.'),
          h('button', { className: 'btn btn-ghost', onClick: function () { MG.clerk.signOut(); } }, 'Sign out')));
    }

    var title = TITLES[route.view] || 'Administration';
    var View = (MGA.views || {})[route.view === 'user' ? 'user' : route.view] || function () {
      return h('div', { className: 'panel' }, h(MG.ui.Empty, { title: 'View not found' }));
    };

    return h('div', { className: 'shell' },
      h('aside', { className: 'sidenav', 'aria-label': 'Administration' },
        h('a', { className: 'side-brand', href: 'index.html' },
          h('span', { className: 'brand-mark brand-mark-light', 'aria-hidden': 'true' }, '◎'),
          h('span', { className: 'brand-text brand-text-side' }, 'Meridian ', h('small', null, 'ADMINISTRATION'))),
        NAV.map(function (group) {
          return h('div', { key: group.group, className: 'nav-group' },
            h('p', { className: 'nav-label' }, group.group),
            group.items.map(function (item) {
              return h('a', {
                key: item.id,
                className: 'nav-item' + (route.view === item.id ? ' active' : ''),
                href: '#/' + item.id,
              }, item.label);
            }));
        }),
        h('button', { className: 'nav-item nav-signout', onClick: function () { MG.clerk.signOut(); } },
          '⎋ Sign out')),
      h('div', { className: 'shell-main' },
        h('header', { className: 'topbar' },
          h('h1', { id: 'gl-viewtitle', tabIndex: -1 }, title),
          h('div', { className: 'topbar-right' },
            h('span', { className: 'adm-chip' }, 'ADMIN'),
            h('span', { className: 'user-chip-name' }, MG.clerk.state.user.fullName))),
        h('main', { className: 'content', id: 'gl-main' },
          h(View, { route: route }))));
  }

  function SignInInline() {
    var ref = React.useRef(null);
    React.useEffect(function () {
      if (ref.current) MG.clerk.mountSignIn(ref.current, { fallbackRedirectUrl: 'admin.html' });
    }, []);
    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('p', { className: 'auth-brand' }, 'Meridian Administration'),
        h('div', { ref: ref, style: { width: '100%', maxWidth: '420px', margin: '0 auto' } })));
  }

  ReactDOM.createRoot(document.getElementById('gl-app')).render(h(AdminApp));
})();
