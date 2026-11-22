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
        setMessage('A secure sign-in link has been sent to your email. Open it on this device to continue.');
      }).catch(function (err) { setError(err.message || 'Could not send the sign-in link.'); })
        .finally(function () { setBusy(false); });
    }

    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('p', { className: 'auth-brand' }, 'Meridian Global Accounts'),
        h('h1', null, 'Welcome back'),
        h('p', { className: 'muted' }, 'Enter your registered email. We will send you a secure sign-in link, followed by an email verification code.'),
        h('form', { onSubmit: sendLink },
          h(AuthInput, { label: 'Email address', type: 'email', autoComplete: 'email',
            value: email, required: true,
            onChange: function (event) { setEmail(event.target.value); } }),
          error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
          message ? h('p', { className: 'form-success', role: 'status' }, message) : null,
          h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
            busy ? 'Please wait…' : (sent ? 'Resend sign-in link' : 'Continue with email'))),
        h('p', { className: 'muted auth-links' }, h('a', { href: '#/register' }, 'Create an account'))));
  }

  function PostLinkOtpView() {
    var _o = useState(''); var otp = _o[0]; var setOtp = _o[1];
    var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _s = useState(false); var sent = _s[0]; var setSent = _s[1];
    var _step = useState('email'); var step = _step[0]; var setStep = _step[1];
    var _factor = useState(null); var factor = _factor[0]; var setFactor = _factor[1];
    var _challenge = useState(null); var challenge = _challenge[0]; var setChallenge = _challenge[1];
    var _mfaCode = useState(''); var mfaCode = _mfaCode[0]; var setMfaCode = _mfaCode[1];
    var _e = useState(''); var error = _e[0]; var setError = _e[1];
    var _m = useState(''); var message = _m[0]; var setMessage = _m[1];

    useEffect(function () {
      var active = true;
      MG.auth.sendPostLinkEmailOtp().then(function (result) {
        if (result.error) throw result.error;
        if (active) { setSent(true); setMessage('We sent a one-time code to your email. Enter it below to finish signing in.'); }
      }).catch(function (err) { if (active) setError(err.message || 'Could not send the verification code.'); });
      return function () { active = false; };
    }, []);

    function finishLogin() {
      MG.auth.completeCustomerLogin();
      location.hash = '#/overview';
    }

    function verifyEmail(event) {
      event.preventDefault(); setBusy(true); setError(''); setMessage('');
      MG.auth.verifyPostLinkEmailOtp(otp).then(function (result) {
        if (result.error) throw result.error;
        return MG.auth.getMfaAssurance();
      }).then(function (result) {
        if (result.error) throw result.error;
        var assurance = result.data || {};
        if (assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
          return MG.auth.listMfaFactors().then(function (factorsResult) {
            if (factorsResult.error) throw factorsResult.error;
            var factors = (factorsResult.data && factorsResult.data.totp) || [];
            var verified = factors.filter(function (item) { return item.status === 'verified'; })[0];
            if (!verified) throw new Error('Your authenticator factor is not available. Contact support.');
            return MG.auth.challengeTotp(verified.id).then(function (challengeResult) {
              if (challengeResult.error) throw challengeResult.error;
              setFactor(verified.id);
              setChallenge(challengeResult.data.id);
              setStep('mfa');
              setMessage('Enter the current code from your authenticator app.');
            });
          });
        }
        finishLogin();
      }).catch(function (err) { setError(err.message || 'The code is invalid or expired.'); })
        .finally(function () { setBusy(false); });
    }

    function verifyMfa(event) {
      event.preventDefault(); setBusy(true); setError(''); setMessage('');
      MG.auth.verifyTotp(factor, challenge, mfaCode).then(function (result) {
        if (result.error) throw result.error;
        finishLogin();
      }).catch(function (err) { setError(err.message || 'Authenticator code is invalid or expired.'); })
        .finally(function () { setBusy(false); });
    }

    function resend() {
      setBusy(true); setError(''); setMessage('');
      MG.auth.sendPostLinkEmailOtp().then(function (result) {
        if (result.error) throw result.error;
        setSent(true); setMessage('A new verification code has been sent.');
      }).catch(function (err) { setError(err.message || 'Could not resend the code.'); })
        .finally(function () { setBusy(false); });
    }

    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('p', { className: 'auth-brand' }, 'Meridian Global Accounts'),
        h('h1', null, step === 'mfa' ? 'Authenticator verification' : 'Verify your sign-in'),
        h('p', { className: 'muted' }, step === 'mfa'
          ? 'Multi-factor authentication is enabled on this account. Enter the current code from your authenticator app.'
          : 'Your email link was accepted. Enter the additional one-time code sent to the same registered email address.'),
        h('form', { onSubmit: step === 'mfa' ? verifyMfa : verifyEmail },
          h(AuthInput, { label: step === 'mfa' ? 'Authenticator code' : 'Six-digit email code',
            type: 'text', autoComplete: 'one-time-code',
            placeholder: step === 'mfa' ? 'Enter your authenticator code' : 'Enter the code from your email',
            value: step === 'mfa' ? mfaCode : otp, required: true, maxLength: 8,
            onChange: function (event) {
              var value = event.target.value.replace(/\D/g, '').slice(0, 8);
              if (step === 'mfa') setMfaCode(value); else setOtp(value.slice(0, 6));
            } }),
          error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
          message ? h('p', { className: 'form-success', role: 'status' }, message) : null,
          h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy || (step === 'email' && !sent) },
            busy ? 'Verifying…' : (step === 'mfa' ? 'Verify authenticator and sign in' : 'Verify and continue'))),
        step === 'email' ? h('button', { type: 'button', className: 'btn btn-ghost btn-block', disabled: busy, onClick: resend }, 'Resend email code') : null));
  }

  function SignUpView() {
    var _f = useState({ fullName: '', email: '', country: '', countryCode: '', callingCode: '', phone: '', password: '', confirmPassword: '' });
    var form = _f[0]; var setForm = _f[1];
    var _step = useState('details'); var step = _step[0]; var setStep = _step[1];
    var _emailOtp = useState(''); var emailOtp = _emailOtp[0]; var setEmailOtp = _emailOtp[1];
    var _phoneOtp = useState(''); var phoneOtp = _phoneOtp[0]; var setPhoneOtp = _phoneOtp[1];
    var _phone = useState(''); var fullPhone = _phone[0]; var setFullPhone = _phone[1];
    var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _e = useState(''); var error = _e[0]; var setError = _e[1];
    var _m = useState(''); var message = _m[0]; var setMessage = _m[1];

    function update(key, value) { setForm(Object.assign({}, form, { [key]: value })); }

    function normalizePhone() {
      var calling = form.callingCode.replace(/[^+0-9]/g, '');
      var national = form.phone.replace(/[^0-9]/g, '').replace(/^0+/, '');
      if (!/^\+[1-9][0-9]{0,3}$/.test(calling) || national.length < 6 || national.length > 14) {
        throw new Error('Enter a valid country calling code and phone number.');
      }
      return calling + national;
    }

    function submit(event) {
      event.preventDefault(); setError(''); setMessage('');
      if (!/^[A-Z]{2}$/.test(form.countryCode)) { setError('Enter the two-letter ISO country code for the selected country.'); return; }
      if (form.password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
      if (form.password !== form.confirmPassword) { setError('Your passwords do not match.'); return; }
      var phone;
      try { phone = normalizePhone(); } catch (err) { setError(err.message); return; }
      setFullPhone(phone); setBusy(true);
      MG.auth.signUp({
        fullName: form.fullName, email: form.email, countryCode: form.countryCode,
        callingCode: form.callingCode, phone: phone, password: form.password,
      }).then(function (result) {
        if (result.error) throw result.error;
        setStep('email');
        setMessage('Enter the email verification code sent to ' + form.email + '.');
      }).catch(function (err) { setError(err.message || 'Could not start registration.'); })
        .finally(function () { setBusy(false); });
    }

    function verifyEmail(event) {
      event.preventDefault(); setBusy(true); setError(''); setMessage('');
      MG.auth.verifyEmailOtp(form.email, emailOtp).then(function (result) {
        if (result.error) throw result.error;
        return MG.auth.beginPhoneVerification(fullPhone).then(function (phoneResult) {
          if (phoneResult.error) throw phoneResult.error;
          setStep('phone');
          setMessage('Email verified. A separate SMS code has been sent to ' + fullPhone + '.');
        });
      }).catch(function (err) { setError(err.message || 'Email verification failed.'); })
        .finally(function () { setBusy(false); });
    }

    function verifyPhone(event) {
      event.preventDefault(); setBusy(true); setError(''); setMessage('');
      MG.auth.verifyPhoneOtp(fullPhone, phoneOtp).then(function (result) {
        if (result.error) throw result.error;
        location.hash = '#/overview';
      }).catch(function (err) { setError(err.message || 'Phone verification failed.'); })
        .finally(function () { setBusy(false); });
    }

    var content;
    if (step === 'details') {
      content = h('form', { onSubmit: submit },
        h(AuthInput, { label: 'Full name', value: form.fullName, required: true, autoComplete: 'name',
          onChange: function (event) { update('fullName', event.target.value); } }),
        h(AuthInput, { label: 'Email address', type: 'email', value: form.email, required: true, autoComplete: 'email',
          onChange: function (event) { update('email', event.target.value); } }),
        h('div', { className: 'grid-2' },
          h(AuthInput, { label: 'Country', value: form.country, required: true, placeholder: 'e.g. Nigeria',
            onChange: function (event) { update('country', event.target.value); } }),
          h(AuthInput, { label: 'Country code (ISO-2)', value: form.countryCode, required: true, placeholder: 'e.g. NG', maxLength: 2,
            onChange: function (event) { update('countryCode', event.target.value.toUpperCase()); } })),
        h('div', { className: 'grid-2' },
          h(AuthInput, { label: 'Country calling code', value: form.callingCode, required: true, placeholder: '+234',
            onChange: function (event) { update('callingCode', event.target.value); } }),
          h(AuthInput, { label: 'Phone number', type: 'tel', value: form.phone, required: true, placeholder: '8012345678',
            onChange: function (event) { update('phone', event.target.value); } })),
        h(AuthInput, { label: 'Password (minimum 8 characters)', type: 'password', value: form.password, required: true, minLength: 8, autoComplete: 'new-password',
          onChange: function (event) { update('password', event.target.value); } }),
        h(AuthInput, { label: 'Confirm password', type: 'password', value: form.confirmPassword, required: true, autoComplete: 'new-password',
          onChange: function (event) { update('confirmPassword', event.target.value); } }),
        error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
        h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
          busy ? 'Creating account…' : 'Sign Up'));
    } else if (step === 'email') {
      content = h('form', { onSubmit: verifyEmail },
        h(AuthInput, { label: 'Email verification code', value: emailOtp, required: true, maxLength: 6, autoComplete: 'one-time-code',
          onChange: function (event) { setEmailOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); } }),
        h('p', { className: 'muted' }, 'Check your inbox and enter the six-digit code. Phone verification follows after email confirmation.'),
        error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
        h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
          busy ? 'Verifying email…' : 'Verify email'));
    } else {
      content = h('form', { onSubmit: verifyPhone },
        h(AuthInput, { label: 'SMS verification code', value: phoneOtp, required: true, maxLength: 6, autoComplete: 'one-time-code',
          onChange: function (event) { setPhoneOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); } }),
        h('p', { className: 'muted' }, 'Enter the code sent to ' + fullPhone + '. Your account becomes available after both email and phone are verified.'),
        error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
        h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
          busy ? 'Verifying phone…' : 'Verify phone and activate account'));
    }

    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('p', { className: 'auth-brand' }, 'Meridian Global Accounts'),
        h('h1', null, step === 'details' ? 'Create your account' : step === 'email' ? 'Verify your email' : 'Verify your phone'),
        h('p', { className: 'muted' }, step === 'details' ? 'Create your Meridian account with your contact details and a password.' : message),
        content,
        step !== 'details' && message ? h('p', { className: 'form-success', role: 'status' }, message) : null,
        h('p', { className: 'muted auth-links' }, 'Already registered? ', h('a', { href: '#/login' }, 'Sign in'))));
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
      var onHash = function () {
        force(function (x) { return x + 1; });
        setDrawer(false);
      };
      window.addEventListener('hashchange', onHash);
      return function () { window.removeEventListener('hashchange', onHash); };
    }, []);

    // Theme CSS keys off body.nav-open for the mobile drawer — keep body in sync.
    useEffect(function () {
      document.body.classList.toggle('nav-open', drawer);
      document.body.classList.add('app-shell');
      return function () {
        document.body.classList.remove('nav-open', 'app-shell');
      };
    }, [drawer]);

    var title = TITLES[route.view] || (route.view === 'account' ? 'Currency Account'
      : route.view === 'txn' ? 'Transaction Detail' : 'Meridian');
    var View = props.resolveView(route);
    var unread = MG.app.unreadCount || 0;
    var email = (user && user.email) ||
      (user && user.primaryEmailAddress && user.primaryEmailAddress.emailAddress) ||
      (user && user.user_metadata && user.user_metadata.email) || '';
    var displayName =
      (user && (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name))) ||
      (user && user.fullName) ||
      (user && user.firstName) ||
      (email ? email.split('@')[0] : 'Customer');

    return h(React.Fragment, null,
      h('div', { className: 'shell' },
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
            h('div', { className: 'page-frame' },
              h(View, { key: route.view + (route.param || ''), route: route, user: user })))),

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
      document.body.classList.remove('app-shell', 'nav-open');
      document.body.classList.add('auth-page');
      var authView;
      if (route.view === 'register') authView = h(SignUpView);
      else authView = h(SignInView);
      return h('div', { className: 'auth-page-root' }, authView);
    }
    document.body.classList.remove('auth-page');

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
