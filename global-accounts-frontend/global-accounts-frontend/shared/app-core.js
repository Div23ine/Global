/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — shared/app-core.js
   CUSTOMER APPLICATION ENGINE (design-concept agnostic).

   Drives the hash router, the auth gate, registration + OTP verification,
   login edge cases (unverified / frozen), currency activation, the deposit
   simulation state machine, statements, security actions and the admin
   takeover session. Each design concept supplies markup through the
   GL.Views contract and inherits IDENTICAL functional behaviour:

     GL.Views.frame(S, contentHtml)   -> full app shell html (S.takeover set => banner)
     GL.Views[viewId](S)              -> view content html
     GL.Views.bind(root)              -> optional per-concept listeners
     GL.Views.skeleton(view)          -> optional loading skeleton

   Forms declare data-form="<name>" and buttons data-action="<name>" — the
   engine binds everything centrally, so behaviour never diverges between
   the three designs. Supported names are listed in docs/SPEC.md.
   ========================================================================== */
window.GL = window.GL || {};
(function () {
  var LS = GL.LS;

  /* ---------------- state ---------------- */
  var S = {
    view: 'login', param: null,
    user: null, me: null,            /* me = {accounts, totalUsd, rates, mode} */
    intended: null,
    wizard: null,                    /* registration wizard */
    verify: null,                    /* login-resumed verification {stage, email} */
    dep: null,                       /* deposit wizard state */
    demoOtp: null,                   /* {email, phone} last simulated codes */
    reset: null,                     /* forgot/reset flow */
    data: {},                        /* per-view api caches */
    txnFilters: { search: '', currency: '', status: '', from: '', to: '', page: 1 }
  };
  GL.S = S;

  var PROTECTED = ['overview', 'accounts', 'account', 'activate', 'deposits', 'transactions', 'txn',
    'statements', 'profile', 'security', 'sessions', 'notifications', 'support', 'settings'];
  var AUTH_VIEWS = ['login', 'register', 'verifyEmail', 'verifyPhone', 'forgot', 'reset',
    'verified', 'verifyFailed', 'gate', 'frozen', 'adminNotice'];
  var TITLES = {
    overview: 'Account Overview', accounts: 'My Accounts', account: 'Currency Account',
    activate: 'Activate Currency', deposits: 'Deposits', transactions: 'Transactions', txn: 'Transaction Detail',
    statements: 'Statements', profile: 'Profile', security: 'Security', sessions: 'Login Sessions',
    notifications: 'Notifications', support: 'Support', settings: 'Settings',
    login: 'Sign in', register: 'Create account', verifyEmail: 'Verify email', verifyPhone: 'Verify phone',
    forgot: 'Reset password', reset: 'Choose a new password', verified: 'Verification complete',
    verifyFailed: 'Verification problem'
  };
  GL.TITLES = TITLES;

  var root;
  function $(sel, sc) { return (sc || document).querySelector(sel); }
  function $$(sel, sc) { return Array.prototype.slice.call((sc || document).querySelectorAll(sel)); }
  function esc(s) { return GL.esc(s); }

  /* ---------------- boot: adopt takeover token from the admin app ---------------- */
  (function adoptToken() {
    try {
      var m = location.search.match(/[?&]tkn=([^&]+)/);
      if (m) {
        var tkn = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
        if (tkn && tkn.kind === 'takeover' && tkn.userId) {
          GL.api.session.set(tkn);
          history.replaceState(null, '', location.pathname + location.hash);
        }
      }
    } catch (e) { /* invalid token — ignored */ }
  })();

  /* ---------------- router ---------------- */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    return { view: parts[0] || null, param: parts[1] ? decodeURIComponent(parts[1]) : null };
  }
  function go(view, param, replace) {
    var h = '#/' + view + (param ? '/' + encodeURIComponent(param) : '');
    if (replace) location.replace(h); else location.hash = h;
  }
  GL.go = go;

  function session() { return GL.api.session.get(); }

  function route() {
    var r = parseHash();
    var view = r.view || (session() && session().kind !== 'admin' ? 'overview' : 'login');
    var s = session();

    /* an administrator opening the customer app directly (no takeover) */
    if (s && s.kind === 'admin' && PROTECTED.indexOf(view) > -1) { S.view = 'adminNotice'; S.param = null; render(); return; }

    if (PROTECTED.indexOf(view) > -1 && !s) {
      S.intended = { view: view, param: r.param };
      view = 'gate';
    }
    S.view = view; S.param = r.param;
    if (AUTH_VIEWS.indexOf(view) === -1 && PROTECTED.indexOf(view) === -1) { S.view = view in (GL.Views || {}) ? view : 'notFound'; }

    if (PROTECTED.indexOf(S.view) > -1) {
      /* protected views: skeleton first, then fresh data */
      loadMe().then(function () { render(); afterRender(); }, function () { render(); afterRender(); });
    } else {
      render(); afterRender();
    }
  }

  function loadMe() {
    return GL.api.account.me().then(function (res) {
      S.user = res.data.user; S.me = res.data;
      S.takeover = res.data.mode === 'admin-takeover' ? session() : null;
      if (S.user && S.user.status === 'frozen' && ['frozen'].indexOf(S.view) === -1) {
        S.view = 'frozen';
      }
    }, function (err) {
      if (err.code === 'UNAUTHENTICATED') { S.user = null; S.me = null; S.takeover = null; }
      throw err;
    });
  }
  GL.loadMe = loadMe;

  /* ---------------- rendering ---------------- */
  function render() {
    if (!GL.Views) return;
    S.title = TITLES[S.view] || 'Meridian';
    var content = GL.Views[S.view] ? GL.Views[S.view](S) : GL.Views.notFound(S);
    root.innerHTML = GL.Views.frame(S, content);
    if (GL.Views.bind) GL.Views.bind(root);
    var m = $('#gl-main'); if (m) m.setAttribute('data-view', S.view);
  }
  function rerender() { render(); afterRender(); }

  function afterRender() {
    var h = $('#gl-viewtitle'); if (h) h.focus();
    window.scrollTo(0, 0);
    wireOtp(root);
    startCountdowns(root);
    if (GL.fx && GL.fx.mount) GL.fx.mount(root);
  }
  GL.rerender = rerender;

  /* ---------------- toasts / modal / confirm ---------------- */
  function toast(msg, tone) {
    var wrap = $('#gl-toasts'); if (!wrap) return;
    var t = document.createElement('div');
    t.className = 'gl-toast tone-' + (tone || 'ok');
    t.setAttribute('role', 'status');
    t.innerHTML = (tone === 'err' ? GL.icon('alert', 18) : tone === 'info' ? GL.icon('info', 18) : GL.icon('check-circle', 18)) +
      '<span>' + esc(msg) + '</span>';
    wrap.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, 3800);
  }
  GL.toast = toast;
  GL.fail = function (err) { toast((err && err.message) || 'Something went wrong.', 'err'); };

  var modalConfirmCb = null, modalAltCb = null;
  function modal(opts) {
    var wrap = $('#gl-modal'); if (!wrap) return;
    modalConfirmCb = opts.onConfirm || null; modalAltCb = opts.onAlt || null;
    wrap.innerHTML =
      '<div class="gl-modal-backdrop" data-action="modal-close"></div>' +
      '<div class="gl-modal" role="dialog" aria-modal="true" aria-labelledby="gl-modal-title">' +
        '<h3 id="gl-modal-title">' + esc(opts.title) + '</h3>' +
        '<div class="gl-modal-body">' + (opts.html || '<p>' + esc(opts.body || '') + '</p>') + '</div>' +
        '<div class="gl-modal-actions">' +
          (opts.onAlt ? '<button type="button" class="btn btn-ghost" data-action="modal-alt">' + esc(opts.alt || 'Alternative') + '</button>' : '') +
          '<button type="button" class="btn btn-ghost" data-action="modal-close">' + esc(opts.cancel || 'Cancel') + '</button>' +
          (opts.onConfirm ? '<button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-action="modal-confirm">' + esc(opts.confirm || 'Confirm') + '</button>' : '') +
        '</div>' +
      '</div>';
    wrap.hidden = false;
    var first = wrap.querySelector('.gl-modal-actions button'); if (first) first.focus();
  }
  function closeModal() { var w = $('#gl-modal'); if (w) { w.hidden = true; w.innerHTML = ''; } modalConfirmCb = modalAltCb = null; }
  GL.modal = modal; GL.closeModal = closeModal;
  function confirmBox(opts) {
    return new Promise(function (resolve) {
      modal({ title: opts.title, body: opts.body, html: opts.html, danger: opts.danger,
        cancel: opts.cancel || 'Cancel', confirm: opts.confirm || 'Confirm',
        onConfirm: function () { resolve(true); } });
      GL._confirmResolve = resolve;
    });
  }
  GL.confirm = confirmBox;

  /* ---------------- OTP input behaviour ---------------- */
  function wireOtp(scope) {
    $$('.otp-input', scope).forEach(function (box) {
      if (box.dataset.wired) return; box.dataset.wired = '1';
      var inputs = $$('input', box);
      inputs.forEach(function (inp, i) {
        inp.addEventListener('input', function () {
          inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
          if (inp.value && inputs[i + 1]) inputs[i + 1].focus();
          sync();
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Backspace' && !inp.value && inputs[i - 1]) { inputs[i - 1].focus(); inputs[i - 1].value = ''; sync(); }
        });
        inp.addEventListener('paste', function (e) {
          e.preventDefault();
          var digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
          digits.split('').forEach(function (d, j) { if (inputs[j]) inputs[j].value = d; });
          if (inputs[digits.length]) inputs[digits.length].focus();
          sync();
        });
      });
      function sync() {
        var val = inputs.map(function (i) { return i.value; }).join('');
        var hidden = $('input[name="otp"]', box.closest('form') || document) || $('input.otp-value', box.closest('form') || document);
        if (hidden) hidden.value = val;
        var hint = $('[data-otp-filled]', box.closest('form') || document);
        if (hint) hint.textContent = val.length + '/6';
      }
    });
  }
  GL.wireOtp = wireOtp;

  /* ---------------- resend cooldown ---------------- */
  var cooldowns = {};
  function armCooldown(key, seconds) {
    cooldowns[key] = Date.now() + seconds * 1000;
    clearInterval(cooldowns[key + '_t']);
    cooldowns[key + '_t'] = setInterval(function () {
      var left = Math.max(0, Math.ceil((cooldowns[key] - Date.now()) / 1000));
      $$('[data-countdown="' + key + '"]').forEach(function (el) { el.textContent = left > 0 ? '(' + left + 's)' : ''; });
      if (left <= 0) clearInterval(cooldowns[key + '_t']);
    }, 500);
  }
  function startCountdowns(scope) {
    Object.keys(cooldowns).forEach(function (k) {
      if (k.endsWith('_t')) return;
      var left = Math.max(0, Math.ceil((cooldowns[k] - Date.now()) / 1000));
      $$('[data-countdown="' + k + '"]', scope).forEach(function (el) { el.textContent = left > 0 ? '(' + left + 's)' : ''; });
    });
  }

  /* ---------------- small fx helpers for the designs ---------------- */
  GL.fx = {
    countUp: function (el, target, money, code) {
      if (!el) return;
      var start = performance.now(), dur = 500, from = 0;
      function frame(t) {
        var p = Math.min(1, (t - start) / dur), eased = 1 - Math.pow(1 - p, 3);
        var v = from + (target - from) * eased;
        el.textContent = money ? GL.fmt.money(v, code || 'USD') : GL.fmt.num(Math.round(v));
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    },
    mount: function (scope) {
      $$('[data-countup]', scope).forEach(function (el) {
        var v = Number(el.getAttribute('data-countup')) || 0;
        var money = el.getAttribute('data-countup-money');
        GL.fx.countUp(el, v, !!money, el.getAttribute('data-countup-cur') || 'USD');
      });
    }
  };

  /* ============================================================================
     FORMS — central registry. Each design renders the inputs; the engine owns
     the behaviour, validation and API calls.
     ========================================================================== */
  function formData(form) {
    var out = {};
    $$('input, select, textarea', form).forEach(function (i) {
      if (!i.name) return;
      if (i.type === 'radio') { if (i.checked) out[i.name] = i.value; }
      else if (i.type === 'checkbox') out[i.name] = i.checked;
      else out[i.name] = i.value.trim ? i.value.trim() : i.value;
    });
    return out;
  }
  function fieldError(form, name, msg) {
    var f = form.querySelector('[name="' + name + '"]');
    if (!f) return;
    var wrap = f.closest('.field') || f.parentElement;
    var err = wrap && wrap.querySelector('.field-err');
    if (err) { err.textContent = msg || ''; err.hidden = !msg; }
    f.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function clearErrors(form) { $$('.field-err', form).forEach(function (e) { e.hidden = true; }); $$('.otp-err', form).forEach(function (e) { e.hidden = true; }); }
  function busy(form, on) {
    var b = form.querySelector('[type="submit"]');
    if (b) { b.disabled = !!on; b.classList.toggle('is-busy', !!on); }
  }
  function requireFields(form, names, v) {
    var okAll = true;
    names.forEach(function (n) {
      if (!v[n]) { fieldError(form, n, 'This field is required.'); okAll = false; }
    });
    return okAll;
  }

  var FORMS = {

    /* ---------- authentication ---------- */
    loginForm: function (form, v) {
      var ok = requireFields(form, ['email', 'password'], v);
      if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) { fieldError(form, 'email', 'Enter a valid email address.'); ok = false; }
      if (!ok) return Promise.resolve();
      busy(form, true);
      return GL.api.auth.login(v.email, v.password).then(function (res) {
        S.user = res.data.user; S.intended = null;
        return loadMe();
      }).then(function () {
        toast('Welcome back, ' + (S.user.firstName || '') + '.');
        var dest = S.intended || { view: 'overview' };
        S.intended = null;
        go(dest.view, dest.param, true);
      }).catch(function (err) {
        if (err.code === 'VERIFICATION_REQUIRED') {
          S.verify = { stage: err.data.stage, email: err.data.email };
          GL.api.demo.setPendingEmail(err.data.email);
          toast('Please verify your ' + err.data.stage + ' to continue.', 'info');
          go(err.data.stage === 'email' ? 'verifyEmail' : 'verifyPhone', null, true);
        } else if (err.code === 'ACCOUNT_FROZEN') {
          S.frozenReason = err.data.reason;
          go('frozen', null, true);
        } else { GL.fail(err); busy(form, false); }
      });
    },

    registerForm: function (form, v) {
      var ok = requireFields(form, ['fullName', 'email', 'country', 'phone', 'password', 'confirm'], v);
      if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) { fieldError(form, 'email', 'Enter a valid email address.'); ok = false; }
      if (v.password && v.password !== v.confirm) { fieldError(form, 'confirm', 'Passwords do not match.'); ok = false; }
      if (!v.agree) { toast('Please confirm the demonstration notice.', 'err'); ok = false; }
      if (!ok) return Promise.resolve();
      busy(form, true);
      return GL.api.auth.register(v).then(function (res) {
        S.wizard = { step: 2, email: v.email, form: v, userId: res.data.userId };
        S.demoOtp = { email: res.meta && res.meta.demoEmailOtp };
        GL.api.demo.setPendingEmail(v.email);
        go('verifyEmail', null, true);
      }).catch(function (err) { GL.fail(err); busy(form, false); });
    },

    verifyEmailForm: function (form, v) {
      var email = currentPendingEmail();
      if (!v.otp || v.otp.length !== 6) { var e = $('.otp-err', form); if (e) { e.textContent = 'Enter the 6-digit code.'; e.hidden = false; } return Promise.resolve(); }
      busy(form, true);
      return GL.api.auth.verifyEmail(email, v.otp).then(function (res) {
        if (S.wizard) S.wizard.step = 3;
        S.demoOtp = { phone: res.meta && res.meta.demoPhoneOtp };
        toast('Email verified.');
        go('verifyPhone', null, true);
      }).catch(function (err) {
        if (err.code === 'OTP_LOCKED') { go('verifyFailed', null, true); return; }
        var e = $('.otp-err', form); if (e) { e.textContent = err.message; e.hidden = false; }
        busy(form, false);
      });
    },

    verifyPhoneForm: function (form, v) {
      var email = currentPendingEmail();
      if (!v.otp || v.otp.length !== 6) { var e = $('.otp-err', form); if (e) { e.textContent = 'Enter the 6-digit code.'; e.hidden = false; } return Promise.resolve(); }
      busy(form, true);
      return GL.api.auth.verifyPhone(email, v.otp).then(function (res) {
        S.verified = { currency: res.data.defaultCurrency, accountId: res.data.accountId };
        /* sign the newly verified user in automatically */
        var nu = null;
        try {
          var em = String(email || '').toLowerCase();
          nu = GL.db().users.filter(function (x) { return x.email.toLowerCase() === em; })[0] || null;
        } catch (e) { nu = null; }
        if (nu) GL.api.session.set({ kind: 'user', userId: nu.id, ts: Date.now() });
        GL.api.demo.clearPendingEmail();
        toast('Phone verified — your ' + res.data.defaultCurrency + ' account is active.');
        go('verified', null, true);
      }).catch(function (err) {
        if (err.code === 'OTP_LOCKED') { go('verifyFailed', null, true); return; }
        var e = $('.otp-err', form); if (e) { e.textContent = err.message; e.hidden = false; }
        busy(form, false);
      });
    },

    forgotForm: function (form, v) {
      var ok = requireFields(form, ['email'], v);
      if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) { fieldError(form, 'email', 'Enter a valid email address.'); ok = false; }
      if (!ok) return Promise.resolve();
      busy(form, true);
      return GL.api.auth.forgotPassword(v.email).then(function (res) {
        S.reset = { token: res.data.token, email: v.email };
        toast('Reset link simulated — continuing to the reset screen.', 'info');
        go('reset', null, true);
      }).catch(function (err) { GL.fail(err); busy(form, false); });
    },

    resetForm: function (form, v) {
      var ok = requireFields(form, ['password', 'confirm'], v);
      if (v.password && v.password !== v.confirm) { fieldError(form, 'confirm', 'Passwords do not match.'); ok = false; }
      if (!ok) return Promise.resolve();
      var token = (S.reset && S.reset.token) || v.token || '';
      busy(form, true);
      return GL.api.auth.resetPassword(token, v.password, v.confirm).then(function () {
        toast('Password updated. Please sign in.');
        S.reset = null; go('login', null, true);
      }).catch(function (err) { GL.fail(err); busy(form, false); });
    },

    /* ---------- profile / security / support ---------- */
    profileForm: function (form, v) {
      var ok = requireFields(form, ['firstName', 'lastName'], v);
      if (!ok) return Promise.resolve();
      busy(form, true);
      return GL.api.account.updateProfile({ firstName: v.firstName, lastName: v.lastName, phone: v.phone, address: v.address })
        .then(function (res) { S.user = res.data.user; toast(S.takeover ? 'Profile updated — action recorded in the audit log.' : 'Profile updated.'); rerender(); })
        .catch(function (err) { GL.fail(err); busy(form, false); });
    },

    passwordForm: function (form, v) {
      var ok = requireFields(form, ['current', 'next', 'confirm'], v);
      if (ok && v.next !== v.confirm) { fieldError(form, 'confirm', 'Passwords do not match.'); ok = false; }
      if (!ok) return Promise.resolve();
      busy(form, true);
      return GL.api.account.changePassword(v.current, v.next, v.confirm).then(function () {
        toast('Password updated.'); form.reset(); busy(form, false);
      }).catch(function (err) { GL.fail(err); busy(form, false); });
    },

    prefsForm: function (form, v) {
      return GL.api.account.updatePrefs({ emailNotifs: !!v.emailNotifs, pushNotifs: !!v.pushNotifs, weeklySummary: !!v.weeklySummary })
        .then(function () { toast('Preferences saved.'); })
        .catch(GL.fail);
    },

    supportForm: function (form, v) {
      var ok = requireFields(form, ['subject', 'message'], v);
      if (!ok) return Promise.resolve();
      busy(form, true);
      return GL.api.support.create(v).then(function () {
        toast('Support request sent.');
        return refreshViewData('support');
      }).then(rerender).catch(function (err) { GL.fail(err); busy(form, false); });
    },

    /* ---------- transactions filters ---------- */
    txnFilters: function (form, v) {
      S.txnFilters = { search: v.search || '', currency: v.currency || '', status: v.status || '', from: v.from || '', to: v.to || '', page: 1 };
      return refreshTxns().then(rerender);
    },

    currencyRequest: function (form, v) {
      if (!v.code) { fieldError(form, 'code', 'Enter a currency code, e.g. INR.'); return Promise.resolve(); }
      busy(form, true);
      return GL.api.currencies.activate(v.code.toUpperCase()).then(function () {
        toast('Currency activated.');
        return refreshViewData('activate');
      }).then(rerender).catch(function (err) {
        fieldError(form, 'code', err.message); busy(form, false);
        $$('[data-currency-request-note]', document).forEach(function (n) {
          n.textContent = err.code === 'UNSUPPORTED_CURRENCY' ? 'State shown: UNSUPPORTED CURRENCY — ' + esc(err.message) :
            err.code === 'CURRENCY_UNAVAILABLE' ? 'State shown: TEMPORARILY UNAVAILABLE — ' + esc(err.message) : err.message;
          n.hidden = false;
        });
      });
    },

    /* ---------- deposit wizard ---------- */
    depForm: function (form, v) {
      var ok = requireFields(form, ['amount'], v);
      var amt = Number(v.amount);
      if (ok && (!amt || amt <= 0)) { fieldError(form, 'amount', 'Enter a valid amount.'); ok = false; }
      if (ok && !v.method) { toast('Choose a payment method.', 'err'); ok = false; }
      if (ok && !v.currency) { toast('Choose a currency.', 'err'); ok = false; }
      if (!ok) return Promise.resolve();
      busy(form, true);
      return GL.api.deposits.initiate({ currency: v.currency, amount: amt, method: v.method }).then(function (res) {
        S.dep = { step: 'gateway', currency: res.data.currency, amount: res.data.amount,
          method: res.data.method, methodName: res.data.methodName, fee: res.data.fee, ref: res.data.reference };
        rerender();
      }).catch(function (err) { GL.fail(err); busy(form, false); });
    },

    gatewayForm: function (form, v) {
      /* simulated card detail collection — values are never sent anywhere */
      var ok = ['cardName', 'cardNumber', 'cardExpiry', 'cardCvc'].every(function (n) { return v[n]; });
      if (S.dep && S.dep.method === 'bank_transfer') ok = true;
      if (!ok) { toast('Complete the demo payment details.', 'err'); return Promise.resolve(); }
      return FORMS._depConfirm('authorize');
    },

    _depConfirm: function (action, refOverride) {
      var ref = refOverride || (S.dep && S.dep.ref);
      if (!ref) return Promise.resolve();
      if (S.dep) S.dep.step = 'processing';
      rerender();
      return GL.api.deposits.confirm(ref, action).then(function (res) {
        S.dep.step = 'result'; S.dep.result = res.data.depot || res.data.deposit;
        S.dep.message = res.message; S.dep.balanceAfter = res.data.balanceAfter;
        return loadMe();
      }).then(rerender).catch(function (err) {
        if (err.code === 'DUPLICATE_REFERENCE') {
          S.dep = S.dep || { step: 'result' };
          S.dep.step = 'result'; S.dep.duplicate = true; S.dep.message = err.message; S.dep.ref = ref;
          rerender();
        } else { GL.fail(err); if (S.dep) { S.dep.step = 'gateway'; } rerender(); }
      });
    }
  };

  function currentPendingEmail() {
    if (S.wizard && S.wizard.email) return S.wizard.email;
    if (S.verify && S.verify.email) return S.verify.email;
    try { return sessionStorage.getItem('gl_pending_email'); } catch (e) { return null; }
  }
  GL.currentPendingEmail = currentPendingEmail;

  /* ============================================================================
     ACTIONS — data-action="<name>" buttons, wired centrally.
     ========================================================================== */
  var ACTIONS = {
    'modal-close': function () { closeModal(); if (GL._confirmResolve) { GL._confirmResolve(false); GL._confirmResolve = null; } },
    'modal-confirm': function () { var cb = modalConfirmCb; closeModal(); if (cb) cb(); },
    'modal-alt': function () { var cb = modalAltCb; closeModal(); if (cb) cb(); },

    'logout': function () {
      GL.api.auth.logout().then(function () {
        S.user = null; S.me = null; S.takeover = null; S.dep = null;
        toast('Signed out.'); go('login', null, true);
      });
    },

    'loginDemo': function (el) {
      var email = el.getAttribute('data-email');
      var form = $('#gl-modal') && !$('#gl-modal').hidden ? null : document.querySelector('[data-form="loginForm"]');
      if (form) {
        form.querySelector('[name="email"]').value = email;
        form.querySelector('[name="password"]').value = GL.DEMO_CREDENTIALS.customerPassword;
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    },

    'otp:resend': function (el) {
      var channel = el.getAttribute('data-channel') || 'email';
      var key = 'otp-' + channel;
      if (cooldowns[key] && cooldowns[key] > Date.now()) return;
      armCooldown(key, 30);
      GL.api.auth.resendOtp(currentPendingEmail(), channel).then(function (res) {
        if (S.demoOtp) S.demoOtp[channel] = res.meta && res.meta.demoOtp;
        toast('New code sent (simulated).', 'info');
        if (GL.Views[S.view]) rerender();
      }).catch(GL.fail);
    },

    'verified:go': function () { go('overview', null, true); },

    'activate:currency': function (el) {
      var code = el.getAttribute('data-code');
      el.disabled = true;
      GL.api.currencies.activate(code).then(function (res) {
        toast(res.message);
        return Promise.all([refreshViewData('activate'), loadMe()]);
      }).then(rerender).catch(function (err) { GL.fail(err); rerender(); });
    },

    'dep:new': function () { S.dep = { step: 'form', currency: '', amount: '', method: '' }; go('deposits'); rerender(); },
    'dep:cancel-wizard': function () { S.dep = null; rerender(); },
    'dep:pay': function () { /* gatewayForm submit handles this */ },
    'dep:gateway-cancel': function () { FORMS._depConfirm('cancel'); },
    'dep:retry': function () { S.dep = { step: 'form', currency: S.dep.currency, amount: '', method: S.dep.method }; rerender(); },
    'dep:duplicate': function () { FORMS._depConfirm('authorize', S.dep.ref); },
    'dep:done': function () { S.dep = null; refreshViewData('deposits').then(rerender); },
    'dep:view-txn': function () { go('transactions'); },

    'txn:page': function (el) { S.txnFilters.page = Number(el.getAttribute('data-page') || 1); refreshTxns().then(rerender); },
    'txn:clear': function () { S.txnFilters = { search: '', currency: '', status: '', from: '', to: '', page: 1 }; refreshTxns().then(rerender); },

    'statement:download': function (el) {
      var id = el.getAttribute('data-id');
      el.disabled = true;
      GL.api.statements.download(id).then(function (res) {
        GL.util.downloadText(res.data.filename, res.data.content);
        toast('Statement downloaded — ' + res.data.filename + ' (demo file).');
      }).catch(GL.fail).then(function () { el.disabled = false; });
    },

    'notif:read': function (el) {
      var id = el.getAttribute('data-id') || 'all';
      GL.api.notifications.markRead(id).then(function () { return refreshViewData('notifications'); }).then(rerender);
    },

    'session:revoke': function (el) {
      var id = el.getAttribute('data-id');
      confirmBox({ title: 'Revoke session', body: 'Sign out this device? The demo session will be marked as revoked.', danger: true, confirm: 'Revoke' })
        .then(function (yes) {
          if (!yes) return;
          GL.api.security.revokeSession(id).then(function (res) {
            toast(res.message); return refreshViewData('sessions');
          }).then(rerender).catch(GL.fail);
        });
    },

    'mfa:toggle': function () {
      var target = !S.user.mfaEnabled;
      confirmBox({ title: target ? 'Enable MFA' : 'Disable MFA', body: target ? 'Simulated multi-factor authentication will be turned on for sign-ins.' : 'Disable multi-factor authentication? This lowers your account security (demo).', danger: !target, confirm: target ? 'Enable' : 'Disable' })
        .then(function (yes) {
          if (!yes) return;
          GL.api.security.setMfa(target).then(function (res) {
            toast(res.message); return refreshViewData('security');
          }).then(rerender).catch(GL.fail);
        });
    },

    'freeze:self': function () {
      modal({
        title: 'Temporarily freeze account',
        html: '<p class="muted" style="margin:0 0 12px">Freezing blocks sign-ins and financial activity until unfrozen (demo).</p>' +
          '<div class="field"><label for="freeze-reason">Reason</label><input id="freeze-reason" name="reason" type="text" placeholder="e.g. Lost phone while travelling"></div>',
        confirm: 'Freeze account', danger: true,
        onConfirm: function () {
          var reason = ($('#freeze-reason') || {}).value || 'Self-initiated temporary freeze (demo).';
          GL.api.security.freezeSelf(reason).then(function () {
            toast('Account frozen.'); return loadMe();
          }).then(rerender).catch(GL.fail);
        }
      });
    },

    'unfreeze:self': function () {
      GL.api.security.unfreezeSelf().then(function (res) {
        toast(res.message); return loadMe();
      }).then(function () { go('overview', null, true); }).catch(GL.fail);
    },

    'end:takeover': function () {
      confirmBox({ title: 'End takeover session', body: 'Return to the administrator console? All actions taken during this session are recorded in the audit log.', confirm: 'End takeover' })
        .then(function (yes) {
          if (!yes) return;
          GL.api.admin.endTakeover().then(function (res) {
            S.user = null; S.me = null; S.takeover = null;
            location.href = (res.data && res.data.back) || '../../index.html';
          }).catch(GL.fail);
        });
    },

    'admin:console': function () { location.href = (session() && session().back) || '../../index.html'; }
  };
  GL.actions = ACTIONS;

  /* ============================================================================
     VIEW DATA REFRESH — fills S.data[view] for the designs.
     ========================================================================== */
  function refreshTxns() {
    var f = S.txnFilters;
    return GL.api.transactions.list(f).then(function (res) { S.data.transactions = res.data; }, function (err) { S.data.txnError = err.message; });
  }

  var VIEW_LOADERS = {
    overview: function () {
      return Promise.all([
        GL.api.transactions.list({ page: 1, perPage: 6 }),
        GL.api.notifications.list(),
        GL.api.security.overview()
      ]).then(function (r) {
        S.data.recentTxns = r[0].data.items;
        S.data.notifs = r[1].data;
        S.data.security = r[2].data;
      }, function () {});
    },
    accounts: function () { return loadMe(); },
    account: function () {
      return GL.api.account.get(S.param).then(function (res) { S.data.account = res.data; }, function (err) { S.data.accountError = err.message; });
    },
    activate: function () {
      return GL.api.currencies.list().then(function (res) { S.data.currencies = res.data; }, function () {});
    },
    deposits: function () {
      return GL.api.deposits.list().then(function (res) { S.data.deposits = res.data; }, function () {});
    },
    transactions: function () { S.data.txnError = null; return refreshTxns(); },
    txn: function () {
      return GL.api.transactions.get(S.param).then(function (res) { S.data.txn = res.data; }, function (err) { S.data.txnError = err.message; });
    },
    statements: function () {
      return GL.api.statements.list().then(function (res) { S.data.statements = res.data; }, function () {});
    },
    notifications: function () {
      return GL.api.notifications.list().then(function (res) { S.data.notifs = res.data; }, function () {});
    },
    sessions: function () {
      return GL.api.security.sessions().then(function (res) { S.data.sessionsData = res.data; }, function () {});
    },
    security: function () {
      return GL.api.security.overview().then(function (res) { S.data.security = res.data; }, function () {});
    },
    support: function () {
      return GL.api.support.tickets().then(function (res) { S.data.tickets = res.data; }, function () {});
    },
    profile: function () { return loadMe(); },
    settings: function () { return loadMe(); }
  };

  function refreshViewData(view) {
    var l = VIEW_LOADERS[view];
    return l ? l() : Promise.resolve();
  }
  GL.refreshViewData = refreshViewData;

  /* route hook: protected views load their data first (skeleton in between) */
  var _route = route;
  route = function () {
    var r = parseHash();
    var view = r.view;
    if (PROTECTED.indexOf(view) > -1 && session() && session().kind !== 'admin') {
      S.view = view; S.param = r.param;
      S.title = TITLES[view] || '';
      if (GL.Views) { /* skeleton */
        S.title = TITLES[view] || '';
        root.innerHTML = GL.Views.frame(S, GL.Views.skeleton ? GL.Views.skeleton(view) : '<div class="gl-loading" aria-busy="true">Loading…</div>');
      }
      loadMe().then(function () {
        if (S.user && S.user.status === 'frozen' && view !== 'frozen') { S.view = 'frozen'; render(); afterRender(); return; }
        return refreshViewData(view);
      }).then(function () { render(); afterRender(); }, function () { render(); afterRender(); });
      return;
    }
    _route();
  };

  /* ============================================================================
     GLOBAL EVENT WIRING (delegated once)
     ========================================================================== */
  function wireGlobal() {
    document.addEventListener('submit', function (e) {
      var form = e.target.closest('form[data-form]');
      if (!form) return;
      e.preventDefault();
      clearErrors(form);
      var fn = FORMS[form.getAttribute('data-form')];
      if (fn) fn(form, formData(form));
    });
    document.addEventListener('submit', function (e) { /* second handler for filter live-search */ }, true);
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      var fn = ACTIONS[el.getAttribute('data-action')];
      if (fn) { e.preventDefault(); fn(el, e); }
    });
    /* live transaction search (debounced input inside txnFilters form) */
    document.addEventListener('input', GL.util.debounce(function (e) {
      var inp = e.target;
      if (inp && inp.closest && inp.closest('form[data-form="txnFilters"]') && inp.name === 'search') {
        var form = inp.closest('form');
        var v = formData(form);
        S.txnFilters.search = v.search; S.txnFilters.page = 1;
        refreshTxns().then(rerender);
      }
    }, 350));
    window.addEventListener('hashchange', route);
  }

  /* ---------------- init ---------------- */
  function init() {
    root = $('#gl-app');
    if (!root) return;
    wireGlobal();
    route();
    /* keep demo data fresh across tabs (same origin) */
    GL.api.subscribe(function () { if (PROTECTED.indexOf(S.view) > -1) { refreshViewData(S.view).then(rerender); } });
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
