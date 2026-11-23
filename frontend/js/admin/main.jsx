/* ==========================================================================
   MERIDIAN ADMIN — Hong Kong International Fintech (Design 2)
   admin main.jsx — Application shell

   Hash router, admin session gate (Supabase Auth + server-side admin role check),
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
      var active = true;
      var off = function () {};
      var onHash = function () { setRoute(parseHash()); };
      window.addEventListener('hashchange', onHash);
      MG.ready.then(function () {
        if (!active) return;
        if (!MG.isConfigured()) throw (MG.configError || new Error('API public configuration is incomplete.'));
        MG.api.init();
        off = MG.auth.onChange(function () { force(function (x) { return x + 1; }); });
        return MG.auth.load();
      }).then(function () {
        if (active) setAuth({ ready: true, error: null });
      }).catch(function (err) {
        if (active) setAuth({ ready: true, error: err });
      });
      return function () {
        active = false;
        off();
        window.removeEventListener('hashchange', onHash);
      };
    }, []);

    useEffect(function () {
      if (!MG.auth.state.signedIn) {
        if (profile) setProfile(null);
        return;
      }
      if (!profile) {
        MGA.api.overview().then(function () {
          setProfile({ admin: true });
        }).catch(function (err) {
          setProfile({ admin: false, error: err });
        });
      }
    }, [MG.auth.state.signedIn, profile, route.view]);

    /* close drawer + reset scroll on every route change */
    useEffect(function () {
      setNavOpen(false);
      window.scrollTo(0, 0);
      if (titleRef.current && MG.auth.state.signedIn) {
        titleRef.current.focus({ preventScroll: true });
      }
    }, [route.view, route.param]);

    /* lock body scroll while drawer open */
    useEffect(function () {
      document.body.style.overflow = navOpen ? 'hidden' : '';
      return function () { document.body.style.overflow = ''; };
    }, [navOpen]);

    if (!MG.configLoaded) {
      return h('div', { className: 'auth-viewport' },
        h('div', { className: 'auth-wrap' },
          h('div', { className: 'auth-card' }, h(MG.ui.PageSkeleton, { variant: 'page' }))));
    }
    if (!MG.isConfigured()) {
      return h('div', { className: 'auth-viewport' },
        h('div', { className: 'auth-wrap' },
          h('div', { className: 'auth-card' },
            h('h1', null, 'Service temporarily unavailable'),
            h('p', { className: 'muted' }, 'We could not establish a secure connection to Meridian services. Please try again in a moment.'),
            h('button', { className: 'btn btn-primary btn-block', type: 'button',
              onClick: function () { window.location.reload(); } }, 'Retry connection'))));
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
    if (!MG.auth.state.signedIn) {
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
            h('button', { className: 'btn btn-ghost btn-block', onClick: function () { MG.auth.signOut({ scope: 'local' }); } },
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

    var adminName = (MG.auth.state.user && MG.auth.state.user.fullName) || 'Administrator';

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
              onClick: function () { MG.auth.signOut({ scope: 'local' }); } },
              h('span', { 'aria-hidden': 'true',
                dangerouslySetInnerHTML: { __html: MG.ui.icon('logout', 15) } }),
              ' Sign out'),
            h('p', { className: 'sidenav-note' }, 'Connected service'))),
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
                ' Connected service'),
              h('span', { className: 'user-chip' },
                h('span', { className: 'avatar' }, MG.util.initials(adminName)),
                h('span', { className: 'user-chip-name' }, adminName),
                h('span', { className: 'user-chip-role' }, 'ADMIN')),
              h('button', { type: 'button', className: 'icon-btn',
                onClick: function () { MG.auth.signOut({ scope: 'local' }); },
                title: 'Sign out', 'aria-label': 'Sign out' },
                h(MG.ui.Icon, { name: 'logout', size: 17 })))),
          h('main', { className: 'content', id: 'gl-main' },
            h(View, { route: route }))),
        h('div', { className: 'scrim', onClick: function () { setNavOpen(false); }, 'aria-hidden': 'true' }),
        h(MG.ui.ToastHost)));
  }

  function SignInInline() {
    var _e = React.useState(''); var email = _e[0]; var setEmail = _e[1];
    var _o = React.useState(''); var otp = _o[0]; var setOtp = _o[1];
    var _step = React.useState('email'); var step = _step[0]; var setStep = _step[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _x = React.useState(''); var error = _x[0]; var setError = _x[1];
    var _m = React.useState(''); var message = _m[0]; var setMessage = _m[1];

    function sendOtp(event) {
      if (event) event.preventDefault();
      setBusy(true); setError(''); setMessage('');
      MG.auth.signInAdmin(email).then(function (result) {
        if (result.error) throw result.error;
        setStep('otp');
        setMessage('A six-digit sign-in code has been sent to ' + email.trim() + '.');
      }).catch(function (err) {
        setError(err.message || 'Could not send the administrator sign-in code.');
      }).finally(function () { setBusy(false); });
    }

    function verifyOtp(event) {
      if (event) event.preventDefault();
      setBusy(true); setError(''); setMessage('');
      MG.auth.verifyAdminOtp(email, otp).then(function (result) {
        if (result.error) throw result.error;
        // Supabase publishes the authenticated session. AdminApp then checks
        // the server-side profile and role before rendering the console.
      }).catch(function (err) {
        setError(err.message || 'The code is invalid or expired.');
      }).finally(function () { setBusy(false); });
    }

    function resendOtp() {
      setBusy(true); setError(''); setMessage('');
      MG.auth.signInAdmin(email).then(function (result) {
        if (result.error) throw result.error;
        setMessage('A new six-digit code has been sent to ' + email.trim() + '.');
      }).catch(function (err) {
        setError(err.message || 'Could not resend the administrator sign-in code.');
      }).finally(function () { setBusy(false); });
    }

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
              h('p', null, step === 'email'
                ? 'Enter your authorized administrator email to receive a six-digit verification code.'
                : 'Enter the six-digit code sent to ' + email.trim() + '.')),
            step === 'email' ? h('form', { onSubmit: sendOtp },
              h('div', { className: 'field' },
                h('label', { htmlFor: 'admin-email' }, 'Administrator email address'),
                h('input', { id: 'admin-email', className: 'input', type: 'email', required: true,
                  autoComplete: 'email', value: email,
                  onChange: function (event) { setEmail(event.target.value.trim()); }, autoCapitalize: 'none' })),
              error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
              h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
                busy ? 'Sending…' : 'Send verification code')) : null,
            step === 'otp' ? h(React.Fragment, null,
              h('form', { onSubmit: verifyOtp },
                h('div', { className: 'field' },
                  h('label', { htmlFor: 'admin-otp' }, 'Six-digit email code'),
                  h('input', { id: 'admin-otp', className: 'input', type: 'text', required: true,
                    inputMode: 'numeric', autoComplete: 'one-time-code', pattern: '[0-9]{6}',
                    maxLength: 6, value: otp,
                    onChange: function (event) { setOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); } })),
                error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
                message ? h('p', { className: 'form-success', role: 'status' }, message) : null,
                h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy || otp.length !== 6 },
                  busy ? 'Verifying…' : 'Verify code and sign in')),
              h('button', { type: 'button', className: 'btn btn-ghost btn-block', disabled: busy, onClick: resendOtp },
                'Resend code'),
              h('button', { type: 'button', className: 'btn btn-ghost btn-block', disabled: busy,
                onClick: function () { setStep('email'); setOtp(''); setError(''); setMessage(''); } },
                'Use a different email')) : null))));
  }
  var mount = document.getElementById('gl-app');
  if (!mount) {
    if (window.__meridianBootError) window.__meridianBootError(new Error('Missing #gl-app mount node.'));
  } else {
    try {
      ReactDOM.createRoot(mount).render(h(AdminApp));
    } catch (err) {
      if (window.__meridianBootError) window.__meridianBootError(err);
      else throw err;
    }
  }
})();
