/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — Design Concept 1 · “Swiss Private Banking”
   customer/swiss/assets/views.js

   GL.Views — part 1: frame (app shell + auth layout), skeleton, notFound,
   the auth/verification views, overview, accounts and activate. Part 2
   (views-more.js) adds account, deposits, transactions, txn, statements,
   profile, security, sessions, notifications, support and settings.

   The engine (shared/app-core.js) owns all behaviour: forms declare
   data-form="<name>", buttons data-action="<name>". This file only
   supplies markup plus GL.Views.bind() for purely visual wiring
   (drawer, charts, dependent wizard fields, focus restoration).
   ========================================================================== */
window.GL = window.GL || {};
(function () {
  var esc = GL.esc, icon = GL.icon, fmt = GL.fmt;

  /* route groups mirrored from the engine contract */
  var PROTECTED = ['overview', 'accounts', 'account', 'activate', 'deposits', 'transactions', 'txn',
    'statements', 'profile', 'security', 'sessions', 'notifications', 'support', 'settings'];

  var NAVGROUPS = [
    { label: 'Banking', items: [
      ['overview', 'Overview', 'dashboard'],
      ['accounts', 'Accounts', 'wallet'],
      ['activate', 'Activate currency', 'plus'],
      ['deposits', 'Deposits', 'card'],
      ['transactions', 'Transactions', 'search'],
      ['statements', 'Statements', 'doc']
    ] },
    { label: 'Account', items: [
      ['notifications', 'Notifications', 'bell'],
      ['profile', 'Profile', 'user'],
      ['security', 'Security', 'shield'],
      ['sessions', 'Sessions', 'smartphone'],
      ['support', 'Support', 'message'],
      ['settings', 'Settings', 'settings']
    ] }
  ];
  var ACTIVE_ALIAS = { account: 'accounts', txn: 'transactions' };

  /* single-hue navy/blue chart palette */
  var CHART_COLORS = ['#0A1A2F', '#14263F', '#2E5A88', '#54749E', '#87A6C6', '#B9CFE4'];

  /* module state consumed by bind() after each render */
  var OV = null;          /* overview donut segments */
  var txnFocus = null;    /* txnFilters focus/caret restore */

  /* ---------------- small helpers ---------------- */
  function badge(st) { return '<span class="badge b-' + esc(st) + '">' + esc(st) + '</span>'; }
  function methodLabel(id) {
    var m = (GL.DEPOSIT_METHODS || []).filter(function (x) { return x.id === id; })[0];
    return m ? m.label : (id || '—');
  }
  function activeAccounts(S) {
    return ((S.me && S.me.accounts) || []).filter(function (a) { return a.status === 'active'; });
  }
  function emptyState(ic, title, text, cta) {
    return '<div class="empty">' + icon(ic, 22) +
      '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (cta || '') + '</div>';
  }
  function moneyHtml(amount, code) {
    var neg = Number(amount) < 0;
    return '<span class="num' + (neg ? ' neg' : '') + '">' + fmt.money(amount, code) + '</span>';
  }
  function curStatus(code) {
    try { return GL.db().settings.currencyStatus[code] || 'unavailable'; } catch (e) { return 'active'; }
  }

  /* payment-method radio cards (visual radiogroup, value kept in a hidden
     input — the engine's formData reads the hidden field) */
  function depMethodsHtml(cur, selected) {
    var list = (GL.DEPOSIT_METHODS || []).filter(function (m) {
      return !m.currencies || m.currencies.indexOf(cur) > -1;
    });
    return list.map(function (m) {
      var on = m.id === selected;
      return '<button type="button" class="dep-m' + (on ? ' selected' : '') + '" role="radio"' +
        ' aria-checked="' + (on ? 'true' : 'false') + '" data-method="' + esc(m.id) + '">' +
        '<span class="m-mark" aria-hidden="true"></span>' + icon(m.icon, 19) +
        '<span class="m-body"><b>' + esc(m.label) + '</b><p>' + esc(m.desc) + '</p>' +
        '<span class="dep-fee">' + esc(m.feeNote) + '</span></span></button>';
    }).join('');
  }

  /* ============================================================================
     GL.Views — part 1
     ========================================================================== */
  GL.Views = {

    /* ---------------------------------------------------------------- frame */
    frame: function (S, content) {
      var view = S.view || '';
      var title = view === 'notFound' ? 'Page not found'
        : (S.title || (GL.TITLES && GL.TITLES[view]) || 'Meridian');

      var bars = '';
      try {
        if (GL.db().settings.maintenanceMode) {
          bars += '<div class="maintenance-bar" role="status">' + icon('alert', 15) +
            '<span>Scheduled platform maintenance (demo) — some features may pause briefly.</span></div>';
        }
      } catch (e) { /* store unavailable — skip bar */ }
      if (S.takeover) {
        bars += '<div class="takeover-banner" role="status">' +
          '<span class="tk-label">Administrative takeover</span>' +
          '<span class="tk-text">You are viewing ' + esc(S.user ? S.user.name : 'this account') +
            '’s account · read + permitted edits · the customer is not notified</span>' +
          '<button type="button" class="btn btn-ghost btn-sm tk-end" data-action="end:takeover">End takeover</button>' +
        '</div>';
      }

      if (PROTECTED.indexOf(view) === -1) return authFrame(bars, title, content, view);
      return shellFrame(S, bars, title, content, view);
    },

    /* -------------------------------------------------------------- skeleton */
    skeleton: function () {
      return '<div class="skel-page" aria-hidden="true">' +
        '<div class="skel skel-title"></div>' +
        '<div class="skel-grid"><div class="skel skel-stat"></div><div class="skel skel-stat"></div>' +
          '<div class="skel skel-stat"></div><div class="skel skel-stat"></div></div>' +
        '<div class="skel-cols"><div class="skel skel-panel"></div><div class="skel skel-panel"></div></div>' +
      '</div>';
    },

    /* ------------------------------------------------------------- notFound */
    notFound: function () {
      return '<div class="gate-card" style="text-align:center">' +
        '<div class="auth-icon">' + icon('search', 24) + '</div>' +
        '<p class="eyebrow" style="justify-content:center">Error 404</p>' +
        '<h2 style="font-size:22px;margin:0 0 8px">Page not found</h2>' +
        '<p class="muted" style="max-width:40ch;margin:0 auto 18px">The page you are looking for does not exist or has moved.</p>' +
        '<a class="btn btn-primary" href="#/overview">Go to overview</a> ' +
        '<a class="btn btn-ghost" href="index.html">Website home</a>' +
      '</div>';
    },

    /* ------------------------------------------------------------------ gate */
    gate: function () {
      return '<div class="gate-card">' +
        '<div class="auth-icon">' + icon('lock', 24) + '</div>' +
        '<p class="auth-sub" style="margin-bottom:16px">Please log in or create an account to access this feature.</p>' +
        '<a class="btn btn-primary" href="#/login">Sign in</a>' +
        '<a class="btn btn-ghost" href="#/register">Create account</a>' +
      '</div>';
    },

    /* ----------------------------------------------------------------- login */
    login: function () {
      var demos = (GL.DEMO_CREDENTIALS && GL.DEMO_CREDENTIALS.customers) || [];
      var pw = (GL.DEMO_CREDENTIALS && GL.DEMO_CREDENTIALS.customerPassword) || '';
      return '<p class="auth-sub">Sign in to your Meridian platform account. This is a demonstration ' +
        'environment — no real money is involved.</p>' +
        '<form data-form="loginForm" novalidate>' +
          '<div class="field"><label for="li-email">Email address</label>' +
            '<input id="li-email" name="email" type="email" autocomplete="email" required>' +
            '<p class="field-err" hidden></p></div>' +
          '<div class="field"><label for="li-password">Password</label>' +
            '<input id="li-password" name="password" type="password" autocomplete="current-password" required>' +
            '<p class="field-err" hidden></p></div>' +
          '<div class="field-row"><a class="link-sm" href="#/forgot">Forgot your password?</a></div>' +
          '<button class="btn btn-primary btn-block" type="submit">Sign in</button>' +
        '</form>' +
        '<p class="auth-alt">New to Meridian? <a href="#/register">Create your account</a></p>' +
        '<div class="demo-chips">' +
          '<p class="eyebrow">Demo quick-fill — password ' + esc(pw) + '</p>' +
          demos.map(function (d) {
            return '<button type="button" class="chip" data-action="loginDemo" data-email="' + esc(d.email) + '">' +
              '<span>' + esc(d.email) + '</span><small>' + esc(d.note) + '</small></button>';
          }).join('') +
        '</div>';
    },

    /* -------------------------------------------------------------- register */
    register: function () {
      var countries = GL.COUNTRIES || [];
      return '<p class="auth-sub">Open a multi-currency platform account — it takes about two minutes. ' +
        'Verification codes are simulated and shown on screen.</p>' +
        '<form data-form="registerForm" novalidate>' +
          '<div class="field"><label for="rg-name">Full name</label>' +
            '<input id="rg-name" name="fullName" type="text" autocomplete="name" required>' +
            '<p class="field-err" hidden></p></div>' +
          '<div class="field"><label for="rg-email">Email address</label>' +
            '<input id="rg-email" name="email" type="email" autocomplete="email" required>' +
            '<p class="field-err" hidden></p></div>' +
          '<div class="field"><label for="rg-country">Country of residence</label>' +
            '<select id="rg-country" name="country" required>' +
              '<option value="">Select your country</option>' +
              countries.map(function (c) {
                return '<option value="' + esc(c.name) + '">' + esc(c.name) + ' — ' + esc(c.currency) + ' default</option>';
              }).join('') +
            '</select>' +
            '<p class="hint">Your country determines the default currency activated after verification.</p>' +
            '<p class="field-err" hidden></p></div>' +
          '<div class="field"><label for="rg-phone">International phone number</label>' +
            '<input id="rg-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required>' +
            '<p class="hint">International format, e.g. 801 234 5678 — your country’s dial code is added automatically.</p>' +
            '<p class="field-err" hidden></p></div>' +
          '<div class="gw-row">' +
            '<div class="field"><label for="rg-pass">Password</label>' +
              '<input id="rg-pass" name="password" type="password" autocomplete="new-password" required>' +
              '<p class="hint">At least 8 characters with uppercase, lowercase and a number.</p>' +
              '<p class="field-err" hidden></p></div>' +
            '<div class="field"><label for="rg-confirm">Confirm password</label>' +
              '<input id="rg-confirm" name="confirm" type="password" autocomplete="new-password" required>' +
              '<p class="field-err" hidden></p></div>' +
          '</div>' +
          '<div class="field field-check">' +
            '<input type="checkbox" id="rg-agree" name="agree">' +
            '<label for="rg-agree">I understand this is a design prototype: no real accounts are issued, ' +
              'no real money moves, and verification codes are simulated and shown on screen.</label>' +
          '</div>' +
          '<button class="btn btn-primary btn-block" type="submit">Create account</button>' +
        '</form>' +
        '<p class="auth-alt">Already registered? <a href="#/login">Sign in</a></p>';
    },

    /* ----------------------------------------------------------- verifyEmail */
    verifyEmail: function (S) {
      var p = null;
      try { p = GL.api.demo.pendingOtp(); } catch (e) { p = null; }
      var code = (p && p.emailOtp) || (S.demoOtp && S.demoOtp.email) || null;
      var email = (p && p.email) || (S.wizard && S.wizard.email) || (S.verify && S.verify.email) || '';
      return '<p class="eyebrow">Step 2 of 3 · Registration</p>' +
        '<p class="auth-sub">Enter the 6-digit code we sent to <b>' + esc(email || 'your email') +
        '</b>. In this prototype the code is simulated — nothing real is sent.</p>' +
        (code
          ? '<div class="preview-note">Demo mode — your code is <b>' + esc(code) + '</b></div>'
          : '<div class="preview-note">Demo mode — open the DEMO CONTROLS panel (bottom right) to view your simulated code.</div>') +
        '<form data-form="verifyEmailForm" novalidate>' +
          '<div class="otp-input" aria-label="6-digit code">' +
            '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 1">' +
            '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 2">' +
            '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 3">' +
            '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 4">' +
            '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 5">' +
            '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 6">' +
          '</div>' +
          '<input type="hidden" name="otp" value="">' +
          '<p class="otp-err" hidden></p>' +
          '<button class="btn btn-primary btn-block" type="submit">Verify email</button>' +
        '</form>' +
        '<p class="auth-alt">Didn’t receive it? ' +
          '<button type="button" class="linklike" data-action="otp:resend" data-channel="email">Resend code</button>' +
          ' <span class="muted" data-countdown="otp-email"></span></p>';
    },

    /* ----------------------------------------------------------- verifyPhone */
    verifyPhone: function (S) {
      var p = null;
      try { p = GL.api.demo.pendingOtp(); } catch (e) { p = null; }
      var code = (p && p.phoneOtp) || (S.demoOtp && S.demoOtp.phone) || null;
      return '<p class="eyebrow">Step 3 of 3 · Registration</p>' +
        '<p class="auth-sub">Enter the 6-digit code sent to your phone. In this prototype the code is ' +
        'simulated — nothing real is sent.</p>' +
        (code
          ? '<div class="preview-note">Demo mode — your code is <b>' + esc(code) + '</b></div>'
          : '<div class="preview-note">Demo mode — open the DEMO CONTROLS panel (bottom right) to view your simulated code.</div>') +
        '<form data-form="verifyPhoneForm" novalidate>' +
          '<div class="otp-input" aria-label="6-digit code">' +
            '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 1">' +
            '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 2">' +
            '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 3">' +
            '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 4">' +
            '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 5">' +
            '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 6">' +
          '</div>' +
          '<input type="hidden" name="otp" value="">' +
          '<p class="otp-err" hidden></p>' +
          '<button class="btn btn-primary btn-block" type="submit">Verify phone</button>' +
        '</form>' +
        '<p class="auth-alt">Didn’t receive it? ' +
          '<button type="button" class="linklike" data-action="otp:resend" data-channel="phone">Resend code</button>' +
          ' <span class="muted" data-countdown="otp-phone"></span></p>';
    },

    /* -------------------------------------------------------------- verified */
    verified: function (S) {
      var v = S.verified || {};
      return '<div class="gate-card">' +
        '<div class="auth-icon" style="color:var(--success);border-color:rgba(30,107,79,.4)">' + icon('check-circle', 24) + '</div>' +
        '<p class="eyebrow" style="justify-content:center">Verification complete</p>' +
        '<h2 style="font-size:22px;margin:0 0 8px">Your ' + esc(v.currency || 'default') + ' account is active</h2>' +
        '<p class="muted" style="margin:0 auto 6px;max-width:44ch">Your ' + esc(v.currency || '') +
          ' account is active with a zero balance' +
          (v.accountId ? ' — account ID <b class="num">' + esc(v.accountId) + '</b>' : '') + '.</p>' +
        '<p class="muted small" style="margin:0 auto 18px;max-width:44ch">New accounts always start at zero. ' +
          'Activate additional currencies any time — nothing converts automatically.</p>' +
        '<button type="button" class="btn btn-primary" data-action="verified:go">Go to overview</button>' +
      '</div>';
    },

    /* ---------------------------------------------------------- verifyFailed */
    verifyFailed: function () {
      var channel = 'email';
      try {
        var p = GL.api.demo.pendingOtp();
        if (p && !p.emailOtp && p.phoneOtp) channel = 'phone';
      } catch (e) { /* default email */ }
      return '<div class="gate-card">' +
        '<div class="auth-icon" style="color:var(--warn);border-color:rgba(138,97,22,.4)">' + icon('alert', 24) + '</div>' +
        '<p class="eyebrow" style="justify-content:center">Too many attempts</p>' +
        '<h2 style="font-size:22px;margin:0 0 8px">Code entry is locked</h2>' +
        '<p class="muted" style="margin:0 auto 20px;max-width:46ch">Five incorrect codes were entered, so ' +
          'verification is locked for security. Resend a new code to start again — the previous code becomes invalid.</p>' +
        '<button type="button" class="btn btn-primary" data-action="otp:resend" data-channel="' + channel + '">Resend a new code</button> ' +
        '<a class="btn btn-ghost" href="#/login">Back to sign in</a>' +
      '</div>';
    },

    /* ---------------------------------------------------------------- forgot */
    forgot: function () {
      return '<p class="auth-sub">Enter the email address on your account. In this prototype the reset ' +
        'link is simulated — no real email is sent.</p>' +
        '<form data-form="forgotForm" novalidate>' +
          '<div class="field"><label for="fg-email">Email address</label>' +
            '<input id="fg-email" name="email" type="email" autocomplete="email" required>' +
            '<p class="field-err" hidden></p></div>' +
          '<button class="btn btn-primary btn-block" type="submit">Send reset link</button>' +
        '</form>' +
        '<p class="auth-alt"><a href="#/login">Back to sign in</a></p>';
    },

    /* ----------------------------------------------------------------- reset */
    reset: function (S) {
      if (!S.reset) {
        return '<div class="gate-card">' +
          '<div class="auth-icon">' + icon('key', 24) + '</div>' +
          '<h2 style="font-size:20px;margin:0 0 8px">No reset request in progress</h2>' +
          '<p class="muted" style="margin:0 auto 18px;max-width:44ch">Start from the forgot-password screen to receive a demo reset token first.</p>' +
          '<a class="btn btn-primary" href="#/forgot">Request a reset link</a>' +
        '</div>';
      }
      return '<p class="auth-sub">Choose a new password for <b>' + esc(S.reset.email) + '</b>.</p>' +
        '<div class="preview-note">Demo reset token: <b>' + esc(S.reset.token) + '</b><br>' +
          '<span class="small">In production this token would arrive by email. It is shown here because the flow is simulated.</span></div>' +
        '<form data-form="resetForm" novalidate>' +
          '<div class="field"><label for="rs-pass">New password</label>' +
            '<input id="rs-pass" name="password" type="password" autocomplete="new-password" required>' +
            '<p class="hint">At least 8 characters with uppercase, lowercase and a number.</p>' +
            '<p class="field-err" hidden></p></div>' +
          '<div class="field"><label for="rs-confirm">Confirm new password</label>' +
            '<input id="rs-confirm" name="confirm" type="password" autocomplete="new-password" required>' +
            '<p class="field-err" hidden></p></div>' +
          '<button class="btn btn-primary btn-block" type="submit">Update password</button>' +
        '</form>' +
        '<p class="auth-alt"><a href="#/login">Back to sign in</a></p>';
    },

    /* ---------------------------------------------------------------- frozen */
    frozen: function (S) {
      var reason = S.frozenReason || (S.user && S.user.freezeReason) || 'Contact support for details.';
      var selfFrozen = S.user && S.user.frozenBy === 'Customer (self)';
      return '<div class="gate-card">' +
        '<div class="auth-icon" style="color:var(--blue);border-color:rgba(46,90,136,.4)">' + icon('snowflake', 24) + '</div>' +
        '<p class="eyebrow" style="justify-content:center">Account temporarily frozen</p>' +
        '<h2 style="font-size:22px;margin:0 8px">Sign-in and activity are paused</h2>' +
        '<p class="muted" style="margin:12px auto 20px;max-width:48ch;border:1px solid var(--hairline);' +
          'border-left:3px solid var(--blue);padding:12px 16px;border-radius:2px;text-align:left">' +
          esc(reason) + '</p>' +
        (selfFrozen
          ? '<p class="muted small" style="margin:0 auto 16px">You applied this freeze yourself — you can lift it at any time.</p>' +
            '<button type="button" class="btn btn-primary" data-action="unfreeze:self">Unfreeze my account</button> '
          : '<p class="muted small" style="margin:0 auto 16px">An administrator froze this account following a security ' +
            'review — please contact support for assistance.</p>') +
        '<a class="btn ' + (selfFrozen ? 'btn-ghost' : 'btn-primary') + '" href="#/support">Contact support</a>' +
      '</div>';
    },

    /* ----------------------------------------------------------- adminNotice */
    adminNotice: function () {
      return '<div class="gate-card">' +
        '<div class="auth-icon">' + icon('users', 24) + '</div>' +
        '<p class="eyebrow" style="justify-content:center">Administrator session</p>' +
        '<h2 style="font-size:21px;margin:0 0 8px">You are signed in as an administrator</h2>' +
        '<p class="muted" style="margin:0 auto 20px;max-width:48ch">The customer application is used in ' +
          'takeover mode — use Account Takeover from the admin console to view a customer account with a ' +
          'permanent on-screen indicator and permitted edits only.</p>' +
        '<button type="button" class="btn btn-primary" data-action="admin:console">Open admin console</button> ' +
        '<a class="btn btn-ghost" href="index.html">Website home</a>' +
      '</div>';
    },

    /* -------------------------------------------------------------- overview */
    overview: function (S) {
      var me = S.me || { accounts: [], totalUsd: 0 };
      var txns = S.data.recentTxns || [];
      var notifs = (S.data.notifs || []).slice(0, 3);
      var sec = S.data.security || { mfaEnabled: false, suspicious: [] };

      /* donut segments (single-hue navy/blue) */
      OV = null;
      var segs = me.accounts.map(function (a, i) {
        return { label: a.code, value: Math.max(0, a.equivalentUsd), color: CHART_COLORS[i % CHART_COLORS.length] };
      });
      var total = segs.reduce(function (s, x) { return s + x.value; }, 0);
      if (total > 0) OV = { segs: segs, total: total };

      var html = '';

      html += '<section class="ov-top">' +
        '<div class="card ov-hero">' +
          '<p class="eyebrow">Total balance — indicative USD equivalent</p>' +
          '<div class="ov-total">' + fmt.usd(me.totalUsd) + '</div>' +
          '<p class="ov-note">Demo data · ' + me.accounts.length + ' currency account' + (me.accounts.length === 1 ? '' : 's') +
            ' · balances are held per currency and never converted automatically.</p>' +
          '<div class="ov-actions">' +
            '<a class="btn btn-primary" href="#/deposits">' + icon('plus', 16) + 'Make a deposit</a>' +
            '<a class="btn btn-ghost" href="#/activate">' + icon('coins', 16) + 'Activate a currency</a>' +
          '</div>' +
        '</div>' +
        '<div class="card ov-donut">' +
          '<p class="eyebrow" style="margin:0 0 12px">Currency distribution</p>' +
          (OV
            ? '<canvas class="ov-canvas" role="img" aria-label="Currency distribution donut chart, USD equivalents"></canvas>' +
              '<div class="ov-legend">' + segs.map(function (sg, i) {
                return '<div class="ov-leg-item"><i style="background:' + CHART_COLORS[i % CHART_COLORS.length] + '"></i>' +
                  '<span class="lg-code">' + esc(sg.label) + '</span>' +
                  '<span class="lg-val">' + Math.round((sg.value / total) * 100) + '%</span></div>';
              }).join('') + '</div>'
            : '<p class="muted small">No balances yet — activate currencies and make a simulated deposit to see your distribution.</p>') +
        '</div>' +
      '</section>';

      html += '<div class="sec-row"><h2>Currency accounts</h2><a class="sec-more" href="#/accounts">All accounts →</a></div>' +
        '<div class="cc-grid">' +
        (me.accounts.length ? me.accounts.map(function (a) {
          return '<a class="cc-card" href="#/account/' + esc(a.code) + '">' +
            '<div class="cc-head"><span class="cc-code">' + esc(a.code) + '</span>' + badge(a.status) + '</div>' +
            '<p class="cc-name">' + esc(a.name) + '</p>' +
            '<p class="cc-bal">' + fmt.money(a.balance, a.code) + '</p>' +
            '<p class="cc-meta">≈ ' + fmt.usd(a.equivalentUsd) + ' · ' + a.txCount + ' transaction' + (a.txCount === 1 ? '' : 's') + '</p>' +
            '<span class="cc-go">View account →</span></a>';
        }).join('')
          : emptyState('wallet', 'No currency accounts', 'Activate your first currency to get started.',
            '<a class="btn btn-primary btn-sm" href="#/activate">Activate a currency</a>')) +
        '</div>';

      html += '<div class="ov-cols">' +
        '<section class="card"><div class="card-h"><h2>Recent transactions</h2>' +
          '<a class="link-sm" href="#/transactions">View all →</a></div>' +
          (txns.length
            ? '<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Description</th><th>Currency</th>' +
              '<th class="ta-r">Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
              txns.map(function (t) {
                return '<tr data-href="#/txn/' + esc(t.ref) + '"><td><a href="#/txn/' + esc(t.ref) + '">' + esc(t.ref) + '</a></td>' +
                  '<td class="td-desc">' + esc(t.description) + '</td><td>' + esc(t.currency) + '</td>' +
                  '<td class="ta-r">' + moneyHtml(t.amount, t.currency) + '</td><td>' + badge(t.status) + '</td>' +
                  '<td class="td-date">' + fmt.date(t.ts) + '</td></tr>';
              }).join('') + '</tbody></table></div>'
            : '<div class="card-b">' + emptyState('receipt', 'No transactions yet',
              'Simulated deposits create ledger entries — your history will appear here.', '') + '</div>') +
        '</section>' +
        '<div class="stack">' +
          '<section class="card"><div class="card-h"><h2>Security summary</h2><a class="link-sm" href="#/security">Manage →</a></div>' +
            '<div class="card-b" style="padding:0"><div class="mini-stats">' +
              '<div class="mini-stat"><b>' + (sec.mfaEnabled ? 'On' : 'Off') + '</b><span>Multi-factor auth</span></div>' +
              '<div class="mini-stat"><b data-ov-sessions>—</b><span>Active sessions</span></div>' +
              '<div class="mini-stat"><b>' + (sec.suspicious ? sec.suspicious.length : 0) + '</b><span>Suspicious events</span></div>' +
            '</div></div>' +
          '</section>' +
          '<section class="card"><div class="card-h"><h2>Notifications</h2><a class="link-sm" href="#/notifications">View all →</a></div>' +
            '<div class="card-b" style="padding-top:4px;padding-bottom:4px">' +
            (notifs.length ? notifs.map(function (n) {
              var ic = n.kind === 'success' ? 'check-circle' : n.kind === 'warning' ? 'alert' : 'info';
              return '<div class="notif-mini ' + (n.read ? '' : 'unread') + '" style="' + (n.read ? '' : 'position:relative') + '">' +
                icon(ic, 17) + '<div><b>' + esc(n.title) + '</b><p>' + esc(n.body) + '</p>' +
                '<time>' + fmt.timeAgo(n.ts) + '</time></div></div>';
            }).join('')
              : emptyState('bell', 'No notifications', 'Account events will appear here.', '')) +
          '</div></section>' +
        '</div>' +
      '</div>';

      return html;
    },

    /* -------------------------------------------------------------- accounts */
    accounts: function (S) {
      var me = S.me || { accounts: [] };
      var mine = me.accounts.map(function (a) { return a.code; });
      var others = (GL.CURRENCIES || []).filter(function (c) {
        return mine.indexOf(c.code) === -1 && curStatus(c.code) === 'active';
      });
      return '<div class="page-head"><p class="page-intro">Every currency keeps its own balance, history, ' +
        'deposit records and status — nothing is converted automatically. Demo data throughout.</p></div>' +
        '<div class="acct-grid">' +
        (me.accounts.length ? me.accounts.map(function (a) {
          return '<div class="acct-card">' +
            '<div class="acct-head"><span class="acct-code">' + esc(a.code) + '</span>' + badge(a.status) + '</div>' +
            '<p class="acct-name">' + esc(a.name) + '</p>' +
            '<p class="acct-bal">' + fmt.money(a.balance, a.code) + '</p>' +
            '<dl class="acct-meta">' +
              '<div><dt>USD equivalent</dt><dd>' + fmt.usd(a.equivalentUsd) + '</dd></div>' +
              '<div><dt>Transactions</dt><dd>' + a.txCount + '</dd></div>' +
              '<div><dt>Opened</dt><dd>' + fmt.date(a.openedAt) + '</dd></div>' +
            '</dl>' +
            '<a class="btn btn-ghost btn-sm" href="#/account/' + esc(a.code) + '">View account</a>' +
          '</div>';
        }).join('')
          : '<div class="card card-b" style="grid-column:1/-1">' +
            emptyState('wallet', 'No currency accounts yet', 'Activate your first currency to open an account.',
              '<a class="btn btn-primary btn-sm" href="#/activate">Activate a currency</a>') + '</div>') +
        '</div>' +
        '<section class="card" style="margin-top:18px"><div class="card-h"><h2>Available to activate</h2>' +
          '<a class="link-sm" href="#/activate">Activate currency →</a></div>' +
          '<div class="card-b">' +
          (others.length
            ? '<div class="cur-act">' + others.map(function (c) {
                return '<span class="badge b-default">' + esc(c.code) + ' · ' + esc(c.name) + '</span>';
              }).join('') + '</div>'
            : '<p class="muted small" style="margin:0">All supported currencies are active on your account.</p>') +
          '</div></section>';
    },

    /* -------------------------------------------------------------- activate */
    activate: function (S) {
      var list = S.data.currencies;
      if (!list) {
        list = (GL.CURRENCIES || []).map(function (c) {
          var mine = ((S.me && S.me.accounts) || []).filter(function (a) { return a.code === c.code; })[0];
          return {
            code: c.code, name: c.name, symbol: c.symbol, note: c.note,
            status: curStatus(c.code), activeForMe: !!mine, myStatus: mine ? mine.status : null,
            rateToUsd: GL.RATES[c.code] || null,
            isDefault: !!(S.user && S.user.defaultCurrency === c.code)
          };
        });
      }
      return '<div class="page-head"><p class="page-intro">Activate any supported currency in seconds. ' +
        'New accounts always start at a zero balance — existing balances are never converted or moved.</p></div>' +
        '<div class="cur-grid">' +
        list.map(function (c) {
          var state, foot;
          if (c.activeForMe) {
            state = '<div class="cur-act">' + badge('active') +
              '<a class="btn btn-ghost btn-sm" href="#/account/' + esc(c.code) + '">View account</a></div>' +
              '<p class="cur-note">Active for you — opens at zero when first activated.</p>';
          } else if (c.status !== 'active') {
            state = '<div class="cur-act">' + badge('unavailable') +
              '<button type="button" class="btn btn-sm" disabled>Activate</button></div>' +
              '<p class="cur-note">' + esc(c.note || 'Temporarily unavailable for activation.') + '</p>';
          } else {
            state = '<div class="cur-act">' +
              '<button type="button" class="btn btn-primary btn-sm" data-action="activate:currency" data-code="' + esc(c.code) + '">' +
              'Activate ' + esc(c.code) + '</button></div>' +
              '<p class="cur-note">Starts at a zero balance immediately.</p>';
          }
          foot = '<p class="cur-rate">Indicative rate · 1 ' + esc(c.code) + ' ≈ ' +
            fmt.usd(c.rateToUsd || 0) + ' (demo)</p>';
          return '<div class="cur-card' + (c.status !== 'active' && !c.activeForMe ? ' is-off' : '') + '">' +
            '<div class="cc-head"><span class="acct-code">' + esc(c.code) + '</span>' +
              (c.isDefault ? '<span class="badge b-default">Default</span>' : '') + '</div>' +
            '<p class="cc-name" style="margin:0">' + esc(c.name) + '</p>' +
            state + foot + '</div>';
        }).join('') +
        '</div>' +
        '<section class="card" style="margin-top:18px"><div class="card-h"><h2>Request a currency</h2></div>' +
          '<div class="card-b">' +
          '<p class="muted small" style="margin:0 0 14px">Currencies outside the supported set cannot be ' +
            'activated — the request is rejected with an UNSUPPORTED CURRENCY response, exactly as the ' +
            'service layer would in production.</p>' +
          '<form data-form="currencyRequest" novalidate class="cur-req" style="max-width:420px">' +
            '<div class="field"><label for="cr-code">Currency code</label>' +
              '<input id="cr-code" name="code" type="text" maxlength="3" autocomplete="off" placeholder="e.g. INR" required>' +
              '<p class="field-err" hidden></p></div>' +
            '<button class="btn btn-ghost" type="submit">Request activation</button>' +
          '</form>' +
          '<p class="field-err cur-req-note" data-currency-request-note hidden></p>' +
          '</div></section>';
    }
  };

  /* expose helpers used by views-more.js and bind() */
  GL.Views._badge = badge;
  GL.Views._methodLabel = methodLabel;
  GL.Views._activeAccounts = activeAccounts;
  GL.Views._emptyState = emptyState;
  GL.Views._moneyHtml = moneyHtml;
  GL.Views._depMethodsHtml = depMethodsHtml;
  GL.Views._CHART_COLORS = CHART_COLORS;

  /* ============================================================================
     frame layouts
     ========================================================================== */
  function brandMark() {
    return '<span class="brand-mark" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
      '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 3.5v17M3.5 12h17"></path></svg></span>';
  }

  function authFrame(bars, title, content, view) {
    var wrapCls = 'auth-wrap' + (view === 'gate' ? ' gate-wrap' : '');
    var cardCls = 'auth-card' + (view === 'gate' ? ' gate-card' : '');
    return bars +
      '<div class="' + wrapCls + '">' +
        '<div class="auth-head">' +
          '<a class="auth-brand" href="index.html" aria-label="Meridian Global Accounts — website home">' +
            brandMark() + '<span class="brand-text">Meridian<small>Global Accounts</small></span></a>' +
          '<span class="preview-chip">Demo environment — design preview</span>' +
        '</div>' +
        '<main id="gl-main" class="auth-main content">' +
          '<div class="' + cardCls + '">' +
            '<h1 id="gl-viewtitle" class="auth-title" tabindex="-1">' + esc(title) + '</h1>' +
            content +
          '</div>' +
        '</main>' +
        '<p class="auth-foot">Design prototype — not a live financial service.' +
          '<a href="index.html">Return to website</a></p>' +
      '</div>';
  }

  function shellFrame(S, bars, title, content, view) {
    var user = S.user || {};
    var unread = 0;
    try { unread = GL.unreadCount(); } catch (e) { unread = 0; }
    var initials = fmt.initials(user.name || '');
    var active = ACTIVE_ALIAS[view] || view;

    function navHtml() {
      return NAVGROUPS.map(function (g) {
        return '<div class="nav-group"><p class="nav-group-label">' + esc(g.label) + '</p>' +
          g.items.map(function (it) {
            var on = it[0] === active;
            var bel = it[0] === 'notifications' && unread > 0
              ? '<span class="nav-badge" aria-hidden="true">' + unread + '</span>' : '';
            return '<a class="nav-item' + (on ? ' active' : '') + '" href="#/' + it[0] + '"' +
              (on ? ' aria-current="page"' : '') + '>' + icon(it[2], 17) + '<span>' + esc(it[1]) + '</span>' + bel + '</a>';
          }).join('') + '</div>';
      }).join('');
    }

    return bars +
      '<div class="shell' + (S.takeover ? ' has-takeover' : '') + '">' +
        '<aside class="sidenav" id="gl-sidenav" aria-label="Account sections">' +
          '<div class="side-brand"><a class="brand" href="index.html" aria-label="Meridian — website home">' +
            brandMark() + '<span class="brand-text">Meridian<small>Global Accounts</small></span></a></div>' +
          '<nav class="side-nav">' + navHtml() + '</nav>' +
          '<div class="sidenav-foot">' +
            '<div class="side-user"><span class="uc-ava" aria-hidden="true">' + esc(initials) + '</span>' +
              '<span class="side-user-name">' + esc(user.name || 'Account holder') + '</span></div>' +
            '<button type="button" class="nav-item nav-signout" data-action="logout">' + icon('logout', 17) + '<span>Sign out</span></button>' +
            '<p class="side-note">Demo environment — design preview. All figures are demonstration data.</p>' +
          '</div>' +
        '</aside>' +
        '<div class="scrim" aria-hidden="true"></div>' +
        '<div class="shell-main">' +
          '<header class="topbar">' +
            '<button type="button" class="icon-btn nav-toggle" data-shell-nav-toggle aria-expanded="false" ' +
              'aria-controls="gl-sidenav" aria-label="Open navigation">' + icon('menu', 20) + '</button>' +
            '<h1 class="topbar-title" id="gl-viewtitle" tabindex="-1">' + esc(title) + '</h1>' +
            '<span class="preview-chip top-chip">Demo environment — design preview</span>' +
            '<div class="topbar-actions">' +
              '<a class="icon-btn top-bell" href="#/notifications" aria-label="Notifications' +
                (unread ? ' — ' + unread + ' unread' : '') + '">' + icon('bell', 19) +
                (unread ? '<span class="bell-badge" aria-hidden="true">' + unread + '</span>' : '') + '</a>' +
              '<a class="user-chip" href="#/profile"><span class="uc-ava" aria-hidden="true">' + esc(initials) + '</span>' +
                '<span class="uc-name">' + esc(user.name || 'Account') + '</span></a>' +
            '</div>' +
          '</header>' +
          '<main class="content" id="gl-main">' + content + '</main>' +
        '</div>' +
      '</div>';
  }

  /* ============================================================================
     bind(root) — visual wiring only (engine owns forms/actions)
     ========================================================================== */
  function wireDrawer(root) {
    var toggle = root.querySelector('[data-shell-nav-toggle]');
    var nav = root.querySelector('.sidenav');
    var scrim = root.querySelector('.scrim');
    if (!toggle || !nav) return;
    function setOpen(open) {
      nav.classList.toggle('open', open);
      if (scrim) scrim.classList.toggle('show', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    }
    toggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('open'));
    });
    if (scrim) scrim.addEventListener('click', function () { setOpen(false); });
    Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.contains(nav) && nav.classList.contains('open')) setOpen(false);
    });
  }

  function wireOverview(root) {
    var canvas = root.querySelector('.ov-canvas');
    if (canvas && OV && GL.charts) {
      GL.charts.donut(canvas, { segments: OV.segs, centre: 'USD' });
    }
    var sess = root.querySelector('[data-ov-sessions]');
    if (sess) {
      GL.api.security.sessions().then(function (res) {
        sess.textContent = res.data.active.length;
      }).catch(function () { sess.textContent = '—'; });
    }
  }

  function wireMethodCards(wrap, hidden) {
    Array.prototype.forEach.call(wrap.querySelectorAll('.dep-m'), function (b) {
      b.addEventListener('click', function () {
        hidden.value = b.getAttribute('data-method');
        Array.prototype.forEach.call(wrap.querySelectorAll('.dep-m'), function (x) {
          var on = x === b;
          x.classList.toggle('selected', on);
          x.setAttribute('aria-checked', on ? 'true' : 'false');
        });
      });
    });
  }

  function wireDepForm(form) {
    var sel = form.querySelector('select[name="currency"]');
    var methodsWrap = form.querySelector('.dep-methods');
    var hidden = form.querySelector('input[name="method"]');
    var limitNote = form.querySelector('[data-dep-limits]');
    if (!sel || !hidden) return;
    sel.addEventListener('change', function () {
      var cur = sel.value;
      if (limitNote) {
        var lim = (GL.DEPOSIT_LIMITS || {})[cur] || [10, 50000];
        limitNote.textContent = 'Minimum ' + fmt.money(lim[0], cur) + ' — maximum ' + fmt.money(lim[1], cur) + ' per deposit.';
      }
      if (methodsWrap) {
        var allowed = (GL.DEPOSIT_METHODS || []).filter(function (m) {
          return !m.currencies || m.currencies.indexOf(cur) > -1;
        }).map(function (m) { return m.id; });
        if (allowed.indexOf(hidden.value) === -1) hidden.value = '';
        methodsWrap.innerHTML = depMethodsHtml(cur, hidden.value);
        wireMethodCards(methodsWrap, hidden);
      }
    });
    if (methodsWrap) wireMethodCards(methodsWrap, hidden);
  }

  function wireStmtPreview(btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-stmt-preview');
      btn.disabled = true;
      GL.api.statements.get(id).then(function (res) {
        var st = res.data;
        var rows = st.lines.map(function (t) {
          return '<tr><td class="td-date">' + fmt.date(t.ts) + '</td><td class="td-desc">' + esc(t.description) +
            '</td><td class="ta-r">' + moneyHtml(t.amount, st.currency) + '</td><td>' + badge(t.status) + '</td></tr>';
        }).join('');
        GL.modal({
          title: 'Statement preview — ' + st.currency + ' · ' + st.period,
          html: '<div class="stmt-preview">' +
            '<p class="stmt-bal">Opening ' + fmt.money(st.opening, st.currency) + ' · Closing ' +
            fmt.money(st.closing, st.currency) + ' · ' + st.lines.length + ' entr' + (st.lines.length === 1 ? 'y' : 'ies') + '</p>' +
            '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Description</th>' +
            '<th class="ta-r">Amount</th><th>Status</th></tr></thead><tbody>' +
            (rows || '<tr><td colspan="4" class="muted">No entries in this period.</td></tr>') +
            '</tbody></table></div>' +
            '<p class="modal-note">Demo text file — statement downloads are demonstration data only.</p></div>',
          cancel: 'Close'
        });
      }).catch(GL.fail).then(function () { btn.disabled = false; });
    });
  }

  function wireTxnForm(form) {
    form.addEventListener('focusin', function (e) {
      var t = e.target;
      if (t.name) txnFocus = { name: t.name, pos: t.selectionStart };
    });
    form.addEventListener('focusout', function () { txnFocus = null; });
    form.addEventListener('input', function (e) {
      if (e.target.name === 'search') txnFocus = { name: 'search', pos: e.target.selectionStart };
    });
    form.addEventListener('change', function (e) {
      var t = e.target;
      if (t.tagName === 'SELECT' || t.type === 'date') {
        txnFocus = null;
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
  }

  function restoreTxnFocus(root) {
    if (!txnFocus || !txnFocus.name) return;
    var keep = txnFocus;
    txnFocus = null;
    setTimeout(function () {
      var el = root.querySelector('form[data-form="txnFilters"] [name="' + keep.name + '"]');
      if (el && document.contains(el)) {
        el.focus();
        if (keep.pos != null && el.setSelectionRange) {
          try { el.setSelectionRange(keep.pos, keep.pos); } catch (e) { /* type guard */ }
        }
      }
    }, 0);
  }

  GL.Views.bind = function (root) {
    restoreTxnFocus(root);
    wireDrawer(root);
    wireOverview(root);

    /* deposit wizard: picker preset + live method filtering */
    Array.prototype.forEach.call(root.querySelectorAll('.dep-pick'), function (btn) {
      btn.addEventListener('click', function () {
        GL.Views._presetCur = btn.getAttribute('data-cur');
      });
    });
    var depForm = root.querySelector('form[data-form="depForm"]');
    if (depForm) wireDepForm(depForm);

    /* statement preview buttons */
    Array.prototype.forEach.call(root.querySelectorAll('[data-stmt-preview]'), wireStmtPreview);

    /* transaction filters: live UX + focus persistence */
    var tf = root.querySelector('form[data-form="txnFilters"]');
    if (tf) wireTxnForm(tf);

    /* clickable table rows (link in first cell remains the a11y affordance) */
    Array.prototype.forEach.call(root.querySelectorAll('tr[data-href]'), function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('a, button')) return;
        location.hash = tr.getAttribute('data-href');
      });
    });
  };
})();
