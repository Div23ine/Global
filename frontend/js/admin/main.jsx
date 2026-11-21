/* ==========================================================================
   MERIDIAN ADMIN — Hong Kong International Fintech (Design 2)
   admin main.jsx — Application shell

   Hash router, admin session gate (Clerk auth + admin role check),
   dark-navy grouped sidebar with icons, topbar with preview chip and
   user chip, mobile off-canvas drawer, toast host + confirm provider.
   ========================================================================== */
(function () {
  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var h = React.createElement;

  var NAV = [
    { group: 'Overview', items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    ] },
    { group: 'Customers', items: [
      { id: 'users', label: 'User Management', icon: 'users' },
      { id: 'deposits', label: 'Deposit Management', icon: 'wallet' },
      { id: 'refunds', label: 'Refund Management', icon: 'receipt' },
    ] },
    { group: 'Money', items: [
      { id: 'transactions', label: 'Transactions', icon: 'receipt' },
      { id: 'payments', label: 'Payment Monitoring', icon: 'card' },
    ] },
    { group: 'Platform', items: [
      { id: 'currencies', label: 'Currency Management', icon: 'coins' },
      { id: 'security', label: 'Security Monitoring', icon: 'shield' },
      { id: 'reports', label: 'Reports', icon: 'chart' },
      { id: 'support', label: 'Support', icon: 'ticket' },
      { id: 'roles', label: 'Admin Roles', icon: 'key' },
      { id: 'audit', label: 'Audit Logs', icon: 'history' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ] },
  ];

  var TITLES = {
    dashboard: 'Dashboard', users: 'User Management', user: 'Individual Account Viewer',
    deposits: 'Deposit Management', refunds: 'Refund Management',
    transactions: 'Transactions', payments: 'Payment Monitoring',
    currencies: 'Currency Management', security: 'Security Monitoring',
    reports: 'Reports', support: 'Support', roles: 'Admin Roles',
    audit: 'Audit Logs', settings: 'Settings',
  };

  function parseHash() {
    var raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(Boolean);
    var head = parts[0] || 'dashboard';
    if (head === 'users' && parts[1]) return { view: 'user', param: parts[1] };
    return { view: head, param: parts[1] || null };
  }

  function AdminApp() {
    var _a = useState({ ready: false, error: null }); var auth = _a[0]; var setAuth = _a[1];
    var _r = useState(parseHash()); var route = _r[0]; var setRoute = _r[1];
    var _p = useState(null); var profile = _p[0]; var setProfile = _p[1];
    var _n = useState(false); var navOpen = _n[0]; var setNavOpen = _n[1];
    var _f = useState(0); var force = _f[1];
    var titleRef = useRef(null);

    useEffect(function () {
      MG.api.init();
      MG.clerk.load().then(function () { setAuth({ ready: true, error: null }); })
        .catch(function (err) { setAuth({ ready: true, error: err }); });
      var off = MG.clerk.onChange(function () { force(function (x) { return x + 1; }); });
      var onHash = function () { setRoute(parseHash()); };
      window.addEventListener('hashchange', onHash);
      return function () { off(); window.removeEventListener('hashchange', onHash); };
    }, []);

    useEffect(function () {
      if (MG.clerk.state.signedIn && !profile) {
        MGA.api.overview().then(function () {
          setProfile({ admin: true });
        }).catch(function (err) {
          setProfile({ admin: false, error: err });
        });
      }
    }, [MG.clerk.state.signedIn, profile]);

    /* close drawer + reset scroll on every route change */
    useEffect(function () {
      setNavOpen(false);
      window.scrollTo(0, 0);
      if (titleRef.current && MG.clerk.state.signedIn) {
        titleRef.current.focus({ preventScroll: true });
      }
    }, [route.view, route.param]);

    /* lock body scroll while drawer open */
    useEffect(function () {
      document.body.style.overflow = navOpen ? 'hidden' : '';
      return function () { document.body.style.overflow = ''; };
    }, [navOpen]);

    if (!MG.isConfigured()) {
      return h('div', { className: 'auth-viewport' },
        h('div', { className: 'auth-wrap' },
          h('div', { className: 'auth-card' },
            h('h1', null, 'Configuration required'),
            h('p', { className: 'muted' }, 'Set CLERK_PUBLISHABLE_KEY and API_BASE_URL in js/config.js.'))));
    }
    if (!auth.ready) {
      return h('div', { className: 'auth-viewport' },
        h('div', { className: 'auth-wrap' },
          h('div', { className: 'auth-card' }, h(MG.ui.PageSkeleton, { variant: 'page' }))));
    }
    if (auth.error) {
      return h('div', { className: 'auth-viewport' },
        h('div', { className: 'auth-wrap' },
          h('div', { className: 'auth-card' },
            h('h1', null, 'Authentication unavailable'),
            h('p', { className: 'muted' }, 'The identity service could not be loaded.'),
            h('button', { className: 'btn btn-primary', onClick: function () { location.reload(); } }, 'Retry'))));
    }
    if (!MG.clerk.state.signedIn) {
      return h(MG.ui.ConfirmProvider, null,
        h(SignInInline),
        h(MG.ui.ToastHost));
    }
    if (!profile) {
      return h('div', { className: 'auth-viewport' },
        h('div', { className: 'auth-wrap' },
          h('div', { className: 'auth-card' }, h(MG.ui.PageSkeleton, { variant: 'page' }))));
    }
    if (!profile.admin) {
      return h('div', { className: 'auth-viewport' },
        h('div', { className: 'auth-wrap' },
          h('div', { className: 'auth-card' },
            h('div', { className: 'auth-head' },
              h('span', { className: 'auth-ic', 'aria-hidden': 'true',
                dangerouslySetInnerHTML: { __html: MG.ui.icon('shield', 26) } }),
              h('h2', null, 'Not an administrator'),
              h('p', null, 'This account does not hold an administrative role. Access attempts are logged.')),
            h('button', { className: 'btn btn-ghost btn-block', onClick: function () { MG.clerk.signOut(); } },
              h(MG.ui.Icon, { name: 'logout', size: 15 }), ' Sign out'))));
    }

    var title = TITLES[route.view] || 'Administration';
    var View = (MGA.views || {})[route.view] || function () {
      return h('div', { className: 'gate-card' },
        h('span', { className: 'gate-ic', 'aria-hidden': 'true',
          dangerouslySetInnerHTML: { __html: MG.ui.icon('search', 26) } }),
        h('h2', null, 'Page not found'),
        h('p', { className: 'muted' }, 'There is no admin page at ', h('code', null, location.hash), '.'),
        h('div', { className: 'gate-actions' },
          h('a', { className: 'btn btn-primary', href: '#/dashboard' },
            h(MG.ui.Icon, { name: 'dashboard', size: 15 }), ' Back to dashboard')));
    };

    var adminName = (MG.clerk.state.user && MG.clerk.state.user.fullName) || 'Administrator';

    return h(MG.ui.ConfirmProvider, null,
      h('div', { className: 'shell' + (navOpen ? ' nav-open' : '') },
        h('a', { className: 'skip-link', href: '#gl-main' }, 'Skip to content'),
        /* sidebar */
        h('aside', { className: 'sidenav', id: 'sidenav', 'aria-label': 'Admin navigation' },
          h('div', { className: 'sidenav-brand' },
            h('span', { className: 'brand-mark', 'aria-hidden': 'true',
              dangerouslySetInnerHTML: { __html: MG.ui.icon('globe', 20) } }),
            h('span', { className: 'brand-text' }, 'Meridian \u00B7 ADMIN',
              h('small', null, 'GLOBAL ACCOUNTS'))),
          h('nav', { className: 'sidenav-nav' },
            NAV.map(function (group) {
              return h(React.Fragment, { key: group.group },
                h('p', { className: 'nav-group' }, group.group),
                group.items.map(function (item) {
                  var isActive = route.view === item.id || (item.id === 'users' && route.view === 'user');
                  return h('a', {
                    key: item.id,
                    className: 'nav-item' + (isActive ? ' active' : ''),
                    href: '#/' + item.id,
                    'aria-current': isActive ? 'page' : undefined,
                  },
                    h('span', { 'aria-hidden': 'true',
                      dangerouslySetInnerHTML: { __html: MG.ui.icon(item.icon, 17) } }),
                    item.label);
                }));
            })),
          h('div', { className: 'sidenav-foot' },
            h('div', { className: 'sidenav-user' },
              h('span', { className: 'avatar' }, MG.util.initials(adminName)),
              h('div', { className: 'sidenav-user-txt' },
                h('b', null, adminName),
                h('small', null, 'Administrator'))),
            h('button', { type: 'button', className: 'btn btn-outline btn-sm sidenav-out',
              onClick: function () { MG.clerk.signOut(); } },
              h('span', { 'aria-hidden': 'true',
                dangerouslySetInnerHTML: { __html: MG.ui.icon('logout', 15) } }),
              ' Sign out'),
            h('p', { className: 'sidenav-note' }, 'Demo environment \u2014 sample data only.'))),
        /* main */
        h('div', { className: 'shell-main' },
          h('header', { className: 'topbar' },
            h('button', { type: 'button', className: 'icon-btn menu-btn',
              onClick: function () { setNavOpen(!navOpen); },
              'aria-expanded': navOpen, 'aria-controls': 'sidenav',
              'aria-label': 'Open navigation menu' },
              h(MG.ui.Icon, { name: 'menu', size: 18 })),
            h('h1', { className: 'topbar-title', tabIndex: -1, ref: titleRef }, title),
            h('div', { className: 'topbar-actions' },
              h('span', { className: 'preview-chip' },
                h('span', { className: 'dot', 'aria-hidden': 'true' }),
                ' Demo environment \u2014 sample data'),
              h('span', { className: 'user-chip' },
                h('span', { className: 'avatar' }, MG.util.initials(adminName)),
                h('span', { className: 'user-chip-name' }, adminName),
                h('span', { className: 'user-chip-role' }, 'ADMIN')),
              h('button', { type: 'button', className: 'icon-btn',
                onClick: function () { MG.clerk.signOut(); },
                title: 'Sign out', 'aria-label': 'Sign out' },
                h(MG.ui.Icon, { name: 'logout', size: 17 })))),
          h('main', { className: 'content', id: 'gl-main' },
            h(View, { route: route }))),
        h('div', { className: 'scrim', onClick: function () { setNavOpen(false); }, 'aria-hidden': 'true' }),
        h(MG.ui.ToastHost)));
  }

  function SignInInline() {
    var ref = useRef(null);
    useEffect(function () {
      if (ref.current) MG.clerk.mountSignIn(ref.current, { fallbackRedirectUrl: 'admin.html' });
    }, []);
    return h('div', { className: 'auth-viewport' },
      h('div', { className: 'auth-wrap' },
        h('main', null,
          h('div', { className: 'auth-brand' },
            h('span', { className: 'brand-mark', 'aria-hidden': 'true',
              dangerouslySetInnerHTML: { __html: MG.ui.icon('globe', 20) } }),
            h('span', { className: 'brand-text' }, 'Meridian ',
              h('small', null, 'ADMIN CONSOLE'))),
          h('div', { className: 'auth-card' },
            h('div', { className: 'auth-head' },
              h('span', { className: 'auth-ic', 'aria-hidden': 'true',
                dangerouslySetInnerHTML: { __html: MG.ui.icon('shield-check', 26) } }),
              h('h2', null, 'Administrator sign in'),
              h('p', null, 'Meridian Global Accounts \u00B7 operations console')),
            h('div', { ref: ref, style: { width: '100%', maxWidth: '420px', margin: '0 auto' } })))));
  }

  ReactDOM.createRoot(document.getElementById('gl-app')).render(h(AdminApp));
})();
