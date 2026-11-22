/* Customer application bootstrap + shell (Design 02 preserved).
   Flow: configuration check -> Supabase Auth load -> auth gate -> hash router. */
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
        h('h1', null, 'Service temporarily unavailable'),
        h('p', { className: 'muted' },
          'We could not establish a secure connection to Meridian services. Please try again in a moment.'),
        h('button', {
          className: 'btn btn-primary btn-block',
          type: 'button',
          onClick: function () { window.location.reload(); }
        }, 'Retry connection')));
  }

  /* --------------------------------------------------------- Supabase Auth */
  function AuthInput(props) {
    return h('label', { className: 'field' },
      h('span', null, props.label),
      h('input', {
        className: 'input', type: props.type || 'text', value: props.value,
        placeholder: props.placeholder || '', autoComplete: props.autoComplete,
        required: Boolean(props.required), minLength: props.minLength,
        maxLength: props.maxLength, onChange: props.onChange,
      }));
  }

  function SignInView() {
    var _e = useState(''); var email = _e[0]; var setEmail = _e[1];
    var _o = useState(''); var otp = _o[0]; var setOtp = _o[1];
    var _s = useState(false); var sent = _s[0]; var setSent = _s[1];
    var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _x = useState(''); var error = _x[0]; var setError = _x[1];
    var _m = useState(''); var message = _m[0]; var setMessage = _m[1];

    function sendLink(event) {
      if (event) event.preventDefault();
      setBusy(true); setError(''); setMessage('');
      MG.auth.signIn(email).then(function (result) {
        if (result.error) throw result.error;
        setSent(true);
        setMessage('We sent a secure sign-in link and a one-time code to your email. Open the link or enter the code below.');
      }).catch(function (err) { setError(err.message || 'Could not send the sign-in email.'); })
        .finally(function () { setBusy(false); });
    }

    function verifyCode(event) {
      event.preventDefault(); setBusy(true); setError(''); setMessage('');
      MG.auth.verifyEmailOtp(email, otp).then(function (result) {
        if (result.error) throw result.error;
        location.hash = '#/overview';
      }).catch(function (err) { setError(err.message || 'The code is invalid or expired.'); })
        .finally(function () { setBusy(false); });
    }

    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('p', { className: 'auth-brand' }, 'Meridian Global Accounts'),
        h('h1', null, 'Welcome back'),
        h('p', { className: 'muted' }, 'Sign in without a password using your email magic link or one-time code.'),
        h('form', { onSubmit: sent ? verifyCode : sendLink },
          h(AuthInput, { label: 'Email address', type: 'email', autoComplete: 'email',
            value: email, required: true,
            onChange: function (event) { setEmail(event.target.value); } }),
          sent ? h(AuthInput, { label: 'Six-digit email code', type: 'text', autoComplete: 'one-time-code',
            placeholder: 'Enter the code from your email', value: otp, required: true, maxLength: 8,
            onChange: function (event) { setOtp(event.target.value.replace(/\\D/g, '').slice(0, 8)); } }) : null,
          error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
          message ? h('p', { className: 'form-success', role: 'status' }, message) : null,
          h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
            busy ? 'Please wait…' : (sent ? 'Verify code and sign in' : 'Email me a sign-in link'))),
        sent ? h('button', { type: 'button', className: 'btn btn-ghost btn-block', disabled: busy,
          onClick: sendLink }, 'Resend email') : null,
        h('p', { className: 'muted auth-links' }, h('a', { href: '#/register' }, 'Create an account'))));
  }

  function SignUpView() {
    var _f = useState({ firstName: '', lastName: '', email: '', phone: '', countryCode: '' });
    var form = _f[0]; var setForm = _f[1];
    var _o = useState(''); var otp = _o[0]; var setOtp = _o[1];
    var _s = useState(false); var sent = _s[0]; var setSent = _s[1];
    var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _e = useState(''); var error = _e[0]; var setError = _e[1];
    var _m = useState(''); var message = _m[0]; var setMessage = _m[1];

    function submit(event) {
      event.preventDefault(); setError(''); setMessage(''); setBusy(true);
      MG.auth.signUp(form).then(function (result) {
        if (result.error) throw result.error;
        if (result.data && result.data.session) location.hash = '#/overview';
        else {
          setSent(true);
          setMessage('We sent a confirmation magic link and one-time code. Open the link or enter the code below to activate your account.');
        }
      }).catch(function (err) { setError(err.message || 'Could not start registration.'); })
        .finally(function () { setBusy(false); });
    }

    function verifyCode(event) {
      event.preventDefault(); setBusy(true); setError(''); setMessage('');
      MG.auth.verifyEmailOtp(form.email, otp).then(function (result) {
        if (result.error) throw result.error;
        location.hash = '#/overview';
      }).catch(function (err) { setError(err.message || 'The code is invalid or expired.'); })
        .finally(function () { setBusy(false); });
    }

    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('p', { className: 'auth-brand' }, 'Meridian Global Accounts'),
        h('h1', null, 'Create your account'),
        h('p', { className: 'muted' }, 'Register with your email. No password is required.'),
        h('form', { onSubmit: sent ? verifyCode : submit },
          sent ? null : h('div', { className: 'grid-2' },
            h(AuthInput, { label: 'First name', value: form.firstName, required: true,
              onChange: function (event) { setForm(Object.assign({}, form, { firstName: event.target.value })); } }),
            h(AuthInput, { label: 'Last name', value: form.lastName, required: true,
              onChange: function (event) { setForm(Object.assign({}, form, { lastName: event.target.value })); } })),
          h(AuthInput, { label: 'Email address', type: 'email', autoComplete: 'email', value: form.email, required: true,
            onChange: function (event) { setForm(Object.assign({}, form, { email: event.target.value })); } }),
          sent ? h(AuthInput, { label: 'Six-digit email code', type: 'text', autoComplete: 'one-time-code',
            placeholder: 'Enter the code from your email', value: otp, required: true, maxLength: 8,
            onChange: function (event) { setOtp(event.target.value.replace(/\\D/g, '').slice(0, 8)); } }) :
            h('div', { className: 'grid-2' },
              h(AuthInput, { label: 'Country code (2 letters)', placeholder: 'e.g. DE', maxLength: 2,
                value: form.countryCode,
                onChange: function (event) { setForm(Object.assign({}, form, { countryCode: event.target.value.toUpperCase() })); } }),
              h(AuthInput, { label: 'Phone (optional)', type: 'tel', placeholder: '+49123456789',
                value: form.phone,
                onChange: function (event) { setForm(Object.assign({}, form, { phone: event.target.value })); } })),
          error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
          message ? h('p', { className: 'form-success', role: 'status' }, message) : null,
          h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
            busy ? 'Please wait…' : (sent ? 'Verify code and create account' : 'Continue with email'))),
        sent ? h('button', { type: 'button', className: 'btn btn-ghost btn-block', disabled: busy,
          onClick: submit }, 'Resend confirmation email') : null,
        h('p', { className: 'muted auth-links' }, 'Already registered? ', h('a', { href: '#/login' }, 'Sign in'))));
  }

  function ForgotPasswordView() {
    var _e = useState(''); var email = _e[0]; var setEmail = _e[1];
    var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _m = useState(''); var message = _m[0]; var setMessage = _m[1];
    var _x = useState(''); var error = _x[0]; var setError = _x[1];
    function submit(event) {
      event.preventDefault(); setBusy(true); setError(''); setMessage('');
      MG.auth.resetPassword(email).then(function (result) {
        if (result.error) throw result.error;
        setMessage('If the address is registered, a password-reset link will arrive by email.');
      }).catch(function (err) { setError(err.message || 'Could not send the reset email.'); })
        .finally(function () { setBusy(false); });
    }
    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('p', { className: 'auth-brand' }, 'Meridian Global Accounts'),
        h('h1', null, 'Reset your password'),
        h('form', { onSubmit: submit },
          h(AuthInput, { label: 'Email address', type: 'email', value: email, required: true,
            onChange: function (event) { setEmail(event.target.value); } }),
          error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
          message ? h('p', { className: 'form-success', role: 'status' }, message) : null,
          h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
            busy ? 'Sending…' : 'Send reset link')),
        h('p', { className: 'muted auth-links' }, h('a', { href: '#/login' }, 'Back to sign in'))));
  }

  function UpdatePasswordView() {
    var _p = useState(''); var password = _p[0]; var setPassword = _p[1];
    var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _e = useState(''); var error = _e[0]; var setError = _e[1];
    var _m = useState(''); var message = _m[0]; var setMessage = _m[1];
    function submit(event) {
      event.preventDefault(); setBusy(true); setError(''); setMessage('');
      MG.auth.updatePassword(password).then(function (result) {
        if (result.error) throw result.error;
        setMessage('Password updated successfully.');
        setPassword('');
        setTimeout(function () { location.hash = '#/overview'; }, 900);
      }).catch(function (err) { setError(err.message || 'Could not update the password.'); })
        .finally(function () { setBusy(false); });
    }
    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('p', { className: 'auth-brand' }, 'Meridian Global Accounts'),
        h('h1', null, 'Choose a new password'),
        h('form', { onSubmit: submit },
          h(AuthInput, { label: 'New password (minimum 8 characters)', type: 'password',
            autoComplete: 'new-password', minLength: 8, value: password, required: true,
            onChange: function (event) { setPassword(event.target.value); } }),
          error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
          message ? h('p', { className: 'form-success', role: 'status' }, message) : null,
          h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
            busy ? 'Updating…' : 'Update password'))));
  }

  /* ------------------------------------------------------------------ shell */
  var NAV = [
    { group: 'Banking', items: [
      { id: 'overview', label: 'Overview', icon: 'dashboard' },
      { id: 'accounts', label: 'Accounts', icon: 'wallet' },
      { id: 'activate', label: 'Activate currency', icon: 'plus' },
      { id: 'deposits', label: 'Deposits', icon: 'arrow-up' },
      { id: 'transactions', label: 'Transactions', icon: 'receipt' },
      { id: 'statements', label: 'Statements', icon: 'doc' },
    ] },
    { group: 'Account', items: [
      { id: 'notifications', label: 'Notifications', icon: 'bell' },
      { id: 'profile', label: 'Profile', icon: 'user' },
      { id: 'security', label: 'Security', icon: 'shield' },
      { id: 'sessions', label: 'Sessions', icon: 'clock' },
      { id: 'support', label: 'Support', icon: 'life' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
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
    var unread = MG.app.unreadCount || 0;
    var email = (user && (user.primaryEmailAddress && user.primaryEmailAddress.emailAddress)) || (user && user.email) || '';
    var displayName = (user && (user.fullName || user.firstName)) || 'Customer';

    return h(React.Fragment, null,
      h('div', { className: 'shell' + (drawer ? ' nav-open' : '') },
        h('aside', { className: 'sidenav', id: 'gl-sidenav', 'aria-label': 'Account navigation' },
          h('div', { className: 'sidenav-brand' },
            h('a', { href: 'index.html', className: 'brand brand-side' },
              h('span', { className: 'brand-mark brand-mark-light', 'aria-hidden': 'true' }, '◎'),
              h('span', { className: 'brand-text' }, 'Meridian', h('small', null, ' GLOBAL ACCOUNTS')))),
          h('nav', { className: 'sidenav-nav' },
            NAV.map(function (group) {
              return h(React.Fragment, { key: group.group },
                h('p', { className: 'nav-group' }, group.group),
                group.items.map(function (item) {
                  var isActive = route.view === item.id || (item.id === 'accounts' && route.view === 'account');
                  return h('a', {
                    key: item.id,
                    className: 'nav-item' + (isActive ? ' active' : ''),
                    href: '#/' + item.id,
                    onClick: function () { setDrawer(false); },
                  },
                    MG.icon ? MG.icon(item.icon, 17) : null,
                    h('span', null, item.label),
                    item.id === 'notifications' && unread > 0
                      ? h('span', { className: 'nav-badge' }, unread > 9 ? '9+' : String(unread))
                      : null);
                }));
            })),
          h('div', { className: 'sidenav-foot' },
            h('div', { className: 'sidenav-user' },
              h('span', { className: 'avatar', 'aria-hidden': 'true' }, MG.util.initials(displayName)),
              h('div', { className: 'sidenav-user-txt' },
                h('b', null, displayName),
                h('small', null, email || 'Signed in'))),
            h('button', {
              className: 'btn btn-outline btn-sm sidenav-out',
              type: 'button',
              onClick: function () { MG.auth.signOut({ scope: 'local' }); },
            }, MG.icon ? MG.icon('logout', 15) : null, ' Sign out'))),

        h('div', { className: 'shell-main' },
          h('header', { className: 'topbar' },
            h('button', {
              className: 'icon-btn menu-btn',
              type: 'button',
              'aria-expanded': drawer ? 'true' : 'false',
              'aria-controls': 'gl-sidenav',
              'aria-label': drawer ? 'Close navigation' : 'Open navigation',
              onClick: function () { setDrawer(!drawer); },
            }, MG.icon ? MG.icon('menu', 20) : '☰'),
            h('h1', { className: 'topbar-title', id: 'gl-viewtitle', tabIndex: -1 }, title),
            h('div', { className: 'topbar-actions' },
              h('a', {
                className: 'icon-btn topbar-bell',
                href: '#/notifications',
                'aria-label': unread ? ('Notifications, ' + unread + ' unread') : 'Notifications',
              },
                MG.icon ? MG.icon('bell', 19) : '🔔',
                unread > 0 ? h('span', { className: 'nav-badge' }, unread > 9 ? '9+' : String(unread)) : null),
              h('a', { className: 'topbar-chip', href: '#/profile', title: displayName },
                h('span', { className: 'avatar avatar-sm', 'aria-hidden': 'true' }, MG.util.initials(displayName)),
                h('span', { className: 'topbar-chip-name' }, displayName.split(' ')[0])))),

          h('main', { className: 'content', id: 'gl-main' },
            h(View, { route: route, user: user }))),

        h('div', {
          className: 'scrim' + (drawer ? '' : ' is-hidden'),
          onClick: function () { setDrawer(false); },
          hidden: !drawer,
          'aria-hidden': 'true',
        })));
  }

  /* ------------------------------------------------------------- root/app */
  function App() {
    var _a = useState({ ready: false, error: null });
    var auth = _a[0]; var setAuth = _a[1];
    var _r = useState(parseHash()); var route = _r[0]; var setRoute = _r[1];
    var _u = useState(0); var force = _u[1];

    useEffect(function () {
      var active = true;
      var off = function () {};
      var onHash = function () { setRoute(parseHash()); };
      window.addEventListener('hashchange', onHash);
      MG.ready.then(function () {
        if (!active) return;
        if (!MG.isConfigured()) {
          throw (MG.configError || new Error('API public configuration is incomplete.'));
        }
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

    if (!MG.configLoaded) return h('div', { className: 'auth-wrap' }, h('div', { className: 'auth-card' }, h(MG.ui.Skeleton, { lines: 3 })));
    if (!MG.isConfigured()) return h(ConfigScreen);
    if (!auth.ready) {
      return h('div', { className: 'auth-wrap' },
        h('div', { className: 'auth-card' }, h(MG.ui.Skeleton, { lines: 3 })));
    }
    if (auth.error) {
      return h('div', { className: 'auth-wrap' },
        h('div', { className: 'auth-card' },
          h('h1', null, 'Authentication unavailable'),
          h('p', { className: 'muted' }, 'The identity service could not be loaded. Check your connection and the Supabase configuration.'),
          h('button', {
            className: 'btn btn-primary', onClick: function () { location.reload(); },
          }, 'Retry')));
    }

    var st = MG.auth.state;
    if (!st.signedIn || !st.user) {
      if (route.view === 'register') return h(SignUpView);
      if (route.view === 'forgot-password') return h(ForgotPasswordView);
      if (route.view === 'reset-password') {
        return h('div', { className: 'auth-wrap' },
          h('div', { className: 'auth-card' },
            h('h1', null, 'Password reset link unavailable'),
            h('p', { className: 'muted' }, 'Open the reset link from your email on this device, or request a new one.'),
            h('a', { className: 'btn btn-primary', href: '#/forgot-password' }, 'Request another link')));
      }
      return h(SignInView);
    }
    if (route.view === 'reset-password') return h(UpdatePasswordView);

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
