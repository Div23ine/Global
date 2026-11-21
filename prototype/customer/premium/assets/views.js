/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — CONCEPT 03 · PREMIUM GLOBAL FINANCIAL PLATFORM
   customer/premium/assets/views.js

   GL.Views part 1 — frame (app shell / auth layout + theme toggle), skeleton,
   notFound, every auth view, and the core dashboard views (overview, accounts,
   account). Part 2 lives in views-more.js. The engine (shared/app-core.js)
   owns all form/action behaviour; these templates only produce markup, and
   GL.Views.bind wires purely visual/UX listeners (theme toggle, drawer, chart).
   ========================================================================== */
window.GL = window.GL || {};
(function () {
  var esc = GL.esc, icon = GL.icon, fmt = GL.fmt;

  /* ---------------- persisted theme (shared with site components.js) ------- */
  var THEME_KEY = 'gl_premium_theme';
  function themeSaved() {
    try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; }
    catch (e) { return 'dark'; }
  }
  function themeApply(t) {
    try { document.documentElement.setAttribute('data-theme', t); } catch (e) {}
    try { if (document.body) document.body.setAttribute('data-theme', t); } catch (e) {}
  }
  function themeFlip() {
    var t = themeSaved() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    themeApply(t);
    return t;
  }
  function themeBtn() {
    var dark = themeSaved() === 'dark';
    return '<button type="button" class="theme-toggle" data-action="premium:theme"'
      + ' aria-pressed="' + (dark ? 'true' : 'false') + '"'
      + ' aria-label="' + (dark ? 'Switch to the light theme' : 'Switch to the dark theme') + '"'
      + ' title="Toggle dark / light theme">'
      + '<span class="tt-sun">' + icon('sun', 17) + '</span>'
      + '<span class="tt-moon">' + icon('moon', 17) + '</span>'
      + '</button>';
  }

  /* ---------------- shared constants + tiny helpers ---------------- */
  var AUTH_VIEWS = ['login', 'register', 'verifyEmail', 'verifyPhone', 'forgot', 'reset',
    'verified', 'verifyFailed', 'gate', 'frozen', 'adminNotice'];
  var EXTRA_TITLES = {
    gate: 'Sign in required', frozen: 'Account temporarily frozen',
    adminNotice: 'Administrator session', notFound: 'Page not found'
  };
  var NAV_BANKING = [
    ['overview', 'Overview', 'dashboard'],
    ['accounts', 'Accounts', 'wallet'],
    ['activate', 'Activate currency', 'coins'],
    ['deposits', 'Deposits', 'plus'],
    ['transactions', 'Transactions', 'receipt'],
    ['statements', 'Statements', 'doc']
  ];
  var NAV_ACCOUNT = [
    ['notifications', 'Notifications', 'bell'],
    ['profile', 'Profile', 'user'],
    ['security', 'Security', 'shield'],
    ['sessions', 'Sessions', 'history'],
    ['support', 'Support', 'message'],
    ['settings', 'Settings', 'settings']
  ];
  var PALETTE = ['#4C7DFF', '#55B98A', '#D9A441', '#9BA3AF', '#7A5AF8'];

  function badge(st) { return '<span class="badge b-' + esc(st) + '">' + esc(st) + '</span>'; }
  function money(a, c) { return '<span class="num">' + esc(fmt.money(a, c)) + '</span>'; }
  function navActiveFor(view) {
    if (view === 'account') return 'accounts';
    if (view === 'txn') return 'transactions';
    return view;
  }
  function emptyState(ic, title, text, actions) {
    return '<div class="empty">'
      + '<span class="empty-ic">' + icon(ic, 21) + '</span>'
      + '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>'
      + (actions || '')
      + '</div>';
  }
  function brandLink() {
    return '<a class="brand" href="index.html" aria-label="Meridian Global Accounts — home">'
      + '<span class="brand-badge" aria-hidden="true">M</span>'
      + '<span class="brand-name"><b>Meridian</b><small>Global Accounts</small></span>'
      + '</a>';
  }

  GL.Views = {

    /* ======================================================================
       FRAME — auth views get the centered card layout; signed-in views get
       the full shell (sidenav + topbar + content) with takeover banner,
       maintenance bar, preview chip, notification badge and theme toggle.
       ====================================================================== */
    frame: function (S, content) {
      themeApply(themeSaved());
      var title = EXTRA_TITLES[S.view] || S.title || 'Meridian';

      var maint = '';
      try {
        if (GL.db().settings.maintenanceMode) {
          maint = '<div class="maint-bar" role="status">' + icon('clock', 14)
            + 'Scheduled platform maintenance (demo) — some screens may behave differently.</div>';
        }
      } catch (e) {}

      var takeover = '';
      if (S.takeover) {
        takeover = '<div class="takeover-banner" role="status">' + icon('eye', 15)
          + '<span><b class="hide-sm">Administrative takeover</b><span class="hide-sm"> — </span>you are viewing '
          + esc(S.user ? S.user.name : 'this customer')
          + '&rsquo;s account<span class="hide-sm"> · read + permitted edits · the customer is not notified</span></span>'
          + '<button type="button" class="btn btn-danger btn-sm" data-action="end:takeover">End takeover</button>'
          + '</div>';
      }

      if (AUTH_VIEWS.indexOf(S.view) > -1) {
        var isGate = S.view === 'gate';
        return maint
          + '<div class="' + (isGate ? 'gate-wrap' : 'auth-wrap') + '">'
          + '<header class="auth-top">'
          + brandLink()
          + '<div class="auth-top-right">'
          + '<span class="preview-chip hide-sm">Demo environment — design preview</span>'
          + themeBtn()
          + '</div>'
          + '</header>'
          + '<main class="content" id="gl-main" data-view="' + esc(S.view) + '">'
          + '<div class="' + (isGate ? 'gate-card' : 'auth-card') + '">'
          + '<h1 id="gl-viewtitle" tabindex="-1" class="auth-title">' + esc(title) + '</h1>'
          + content
          + '</div>'
          + '</main>'
          + '<footer class="auth-foot"><p>Demonstration environment · Meridian provides platform accounts — not bank accounts, and not actual offshore banking services. <a href="index.html">Return to the website</a></p></footer>'
          + '</div>';
      }

      var unread = 0;
      try { unread = GL.unreadCount(); } catch (e) {}
      var u = S.user;
      var initials = u ? esc(fmt.initials(u.name)) : '··';
      var active = navActiveFor(S.view);

      function navGroup(label, items) {
        return '<div class="nav-group"><div class="nav-label">' + esc(label) + '</div>'
          + items.map(function (it) {
            var isOn = it[0] === active;
            var b = it[0] === 'notifications' && unread ? '<span class="nav-badge">' + unread + '</span>' : '';
            return '<a class="nav-item' + (isOn ? ' active' : '') + '" href="#/' + it[0] + '"' + (isOn ? ' aria-current="page"' : '') + '>'
              + icon(it[2], 17) + '<span>' + esc(it[1]) + '</span>' + b + '</a>';
          }).join('')
          + '</div>';
      }

      return takeover + maint
        + '<div class="shell' + (S.takeover ? ' has-takeover' : '') + '">'
        + '<aside class="sidenav" id="gl-sidenav" aria-label="Account navigation">'
        + '<div class="sidenav-brand"><a href="index.html" aria-label="Meridian Global Accounts — home">'
        + '<span class="brand-badge" aria-hidden="true">M</span>'
        + '<span class="brand-name"><b>Meridian</b><small>Global Accounts</small></span>'
        + '</a></div>'
        + '<nav class="sidenav-nav">'
        + navGroup('Banking', NAV_BANKING)
        + navGroup('Account', NAV_ACCOUNT)
        + '</nav>'
        + '<div class="sidenav-foot">'
        + '<div class="sidenav-user">'
        + '<span class="avatar" aria-hidden="true">' + initials + '</span>'
        + '<span class="sidenav-user-meta"><b>' + esc(u ? u.name : 'Not signed in') + '</b><small>' + esc(u && u.accountId ? u.accountId : '') + '</small></span>'
        + '</div>'
        + '<button type="button" class="btn btn-ghost btn-sm btn-block" data-action="logout">' + icon('logout', 15) + ' Sign out</button>'
        + '<p class="sidenav-note">Demo environment — design preview</p>'
        + '</div>'
        + '</aside>'
        + '<div class="scrim" aria-hidden="true"></div>'
        + '<div class="shell-main">'
        + '<header class="topbar">'
        + '<button type="button" class="icon-btn nav-toggle" data-shell-nav-toggle aria-expanded="false" aria-controls="gl-sidenav" aria-label="Open navigation">' + icon('menu', 19) + '</button>'
        + '<h1 id="gl-viewtitle" tabindex="-1" class="topbar-title">' + esc(title) + '</h1>'
        + '<div class="topbar-actions">'
        + '<span class="preview-chip">Demo environment — design preview</span>'
        + themeBtn()
        + '<a class="icon-btn bell-btn" href="#/notifications" aria-label="Notifications' + (unread ? ' — ' + unread + ' unread' : '') + '">'
        + icon('bell', 18) + (unread ? '<span class="nav-badge">' + unread + '</span>' : '') + '</a>'
        + '<a class="user-chip" href="#/profile" aria-label="Open profile">'
        + '<span class="avatar" aria-hidden="true">' + initials + '</span>'
        + '<span class="user-chip-name">' + esc(u ? (u.firstName || u.name) : 'Account') + '</span>'
        + icon('chevron-d', 14)
        + '</a>'
        + '</div>'
        + '</header>'
        + '<main class="content" id="gl-main" data-view="' + esc(S.view) + '">' + content + '</main>'
        + '</div>'
        + '</div>';
    },

    /* ======================================================================
       SKELETON — shown by the engine while protected views load their data
       ====================================================================== */
    skeleton: function (view) {
      function rep(s, n) { var o = ''; for (var i = 0; i < n; i++) o += s; return o; }
      var rowish = ['transactions', 'txn', 'statements', 'sessions', 'account', 'notifications', 'support', 'security'];
      if (rowish.indexOf(view) > -1) {
        return '<div class="skel-page">'
          + '<div class="skel sk-title"></div>'
          + '<div class="skel-rows">' + rep('<div class="skel sk-row"></div>', 7) + '</div>'
          + '</div>';
      }
      return '<div class="skel-page">'
        + '<div class="skel sk-title"></div>'
        + '<div class="sk-stats">'
        + rep('<div class="skel sk-stat"></div>', 4)
        + '</div>'
        + '<div class="skel-cols">'
        + '<div class="skel sk-panel"></div>'
        + '<div class="skel sk-panel"></div>'
        + '</div>'
        + '</div>';
    },

    /* ======================================================================
       NOT FOUND
       ====================================================================== */
    notFound: function (S) {
      var hasSession = false;
      try { hasSession = !!GL.api.session.get(); } catch (e) {}
      return '<div class="result-panel">'
        + '<div class="result-ic mut">' + icon('search', 26) + '</div>'
        + '<div class="display" style="font-size:64px;line-height:1;margin-bottom:8px;">404</div>'
        + '<h2 class="result-title">This screen doesn&rsquo;t exist</h2>'
        + '<p class="result-text">The address ' + esc(location.hash || '#/') + ' doesn&rsquo;t match any screen in this application.</p>'
        + '<div class="result-actions">'
        + (hasSession
          ? '<a class="btn btn-primary" href="#/overview">Back to overview</a>'
          : '<a class="btn btn-primary" href="#/login">Go to sign in</a>')
        + '<a class="btn btn-ghost" href="index.html">Return to the website</a>'
        + '</div>'
        + '</div>';
    },

    /* ======================================================================
       AUTH VIEWS
       ====================================================================== */
    login: function (S) {
      var chips = (GL.DEMO_CREDENTIALS.customers || []).map(function (c) {
        return '<button type="button" class="demo-chip" data-action="loginDemo" data-email="' + esc(c.email) + '">'
          + '<span class="demo-chip-mail">' + esc(c.email) + '</span>'
          + '<span class="demo-chip-note">' + esc(c.country) + ' · ' + esc(c.note) + '</span>'
          + '</button>';
      }).join('');
      return '<p class="auth-lead">Sign in to your Meridian platform account. All data in this environment is simulated.</p>'
        + '<form data-form="loginForm" novalidate>'
        + '<div class="field"><label for="li-email">Email</label>'
        + '<input id="li-email" name="email" type="email" autocomplete="email" placeholder="you@example.com">'
        + '<p class="field-err" hidden></p></div>'
        + '<div class="field"><label for="li-pass">Password</label>'
        + '<input id="li-pass" name="password" type="password" autocomplete="current-password" placeholder="Your password">'
        + '<p class="field-err" hidden></p></div>'
        + '<p style="text-align:right;margin:0 0 16px;"><a class="link-sm" href="#/forgot">Forgot password?</a></p>'
        + '<button class="btn btn-primary btn-block" type="submit">Sign in</button>'
        + '</form>'
        + '<div class="auth-alt">'
        + '<p>New to Meridian? <a href="#/register">Create an account</a> — it takes about a minute.</p>'
        + '<p><a href="index.html">Return to the website</a></p>'
        + '</div>'
        + '<div class="demo-box">'
        + '<div class="demo-box-head">' + icon('key', 14) + 'Demo accounts — click to sign in</div>'
        + chips
        + '<p class="demo-note">Password for all demo customers: <code>' + esc(GL.DEMO_CREDENTIALS.customerPassword) + '</code></p>'
        + '</div>';
    },

    register: function (S) {
      var countries = GL.COUNTRIES.map(function (c) {
        return '<option value="' + esc(c.name) + '">' + esc(c.name) + ' — ' + esc(c.currency) + ' default</option>';
      }).join('');
      return '<p class="auth-lead">Open a multi-currency platform account. Verification codes are simulated and shown on screen — nothing real is sent.</p>'
        + '<form data-form="registerForm" novalidate>'
        + '<div class="field"><label for="rg-name">Full name</label>'
        + '<input id="rg-name" name="fullName" type="text" autocomplete="name" placeholder="First and last name">'
        + '<p class="field-err" hidden></p></div>'
        + '<div class="field"><label for="rg-email">Email</label>'
        + '<input id="rg-email" name="email" type="email" autocomplete="email" placeholder="you@example.com">'
        + '<p class="field-err" hidden></p></div>'
        + '<div class="field"><label for="rg-country">Country</label>'
        + '<select id="rg-country" name="country">'
        + '<option value="">Select your country</option>'
        + countries
        + '</select>'
        + '<p class="field-hint">Your country determines the default currency activated after verification.</p>'
        + '<p class="field-err" hidden></p></div>'
        + '<div class="field"><label for="rg-phone">Phone (international)</label>'
        + '<input id="rg-phone" name="phone" type="tel" autocomplete="tel" placeholder="+234 801 234 5678">'
        + '<p class="field-hint">Include the country code, e.g. +44 7700 900123.</p>'
        + '<p class="field-err" hidden></p></div>'
        + '<div class="field"><label for="rg-pass">Password</label>'
        + '<input id="rg-pass" name="password" type="password" autocomplete="new-password" placeholder="Create a password">'
        + '<p class="field-hint">At least 8 characters with uppercase, lowercase and a number.</p>'
        + '<p class="field-err" hidden></p></div>'
        + '<div class="field"><label for="rg-confirm">Confirm password</label>'
        + '<input id="rg-confirm" name="confirm" type="password" autocomplete="new-password" placeholder="Repeat the password">'
        + '<p class="field-err" hidden></p></div>'
        + '<div class="field field-check">'
        + '<input id="rg-agree" name="agree" type="checkbox">'
        + '<label for="rg-agree"><b>I understand this is a demonstration environment.</b> No real accounts are opened, no real money moves, and the data I enter stays in my browser.</label>'
        + '</div>'
        + '<button class="btn btn-primary btn-block" type="submit">Create account</button>'
        + '</form>'
        + '<div class="auth-alt">'
        + '<p>Already registered? <a href="#/login">Sign in instead</a>.</p>'
        + '</div>';
    },

    verifyEmail: function (S) { return otpView(S, 'email'); },

    verifyPhone: function (S) { return otpView(S, 'phone'); },

    forgot: function (S) {
      return '<p class="auth-lead">Enter the email on your account and we&rsquo;ll simulate a password reset. No real message is sent in this prototype.</p>'
        + '<form data-form="forgotForm" novalidate>'
        + '<div class="field"><label for="fg-email">Email</label>'
        + '<input id="fg-email" name="email" type="email" autocomplete="email" placeholder="you@example.com">'
        + '<p class="field-err" hidden></p></div>'
        + '<button class="btn btn-primary btn-block" type="submit">Send reset link (simulated)</button>'
        + '</form>'
        + '<div class="auth-alt"><p>Remembered it? <a href="#/login">Back to sign in</a>.</p></div>';
    },

    reset: function (S) {
      if (!S.reset) {
        return '<p class="auth-lead">This screen continues from the forgot-password flow, which generates a one-time demo token.</p>'
          + '<div class="preview-note">' + icon('info', 15) + '<span>No reset token in this session. Start from the forgot-password screen to generate one.</span></div>'
          + '<a class="btn btn-primary btn-block" href="#/forgot">Go to forgot password</a>';
      }
      return '<p class="auth-lead">Choose a new password for <b>' + esc(S.reset.email) + '</b>.</p>'
        + '<div class="token-display">'
        + '<span class="muted small">Demo reset token (no real email is sent)</span>'
        + '<code>' + esc(S.reset.token) + '</code>'
        + '</div>'
        + '<form data-form="resetForm" novalidate>'
        + '<div class="field"><label for="rs-pass">New password</label>'
        + '<input id="rs-pass" name="password" type="password" autocomplete="new-password" placeholder="New password">'
        + '<p class="field-hint">At least 8 characters with uppercase, lowercase and a number.</p>'
        + '<p class="field-err" hidden></p></div>'
        + '<div class="field"><label for="rs-confirm">Confirm new password</label>'
        + '<input id="rs-confirm" name="confirm" type="password" autocomplete="new-password" placeholder="Repeat the new password">'
        + '<p class="field-err" hidden></p></div>'
        + '<button class="btn btn-primary btn-block" type="submit">Update password</button>'
        + '</form>';
    },

    verified: function (S) {
      var v = S.verified || {};
      return '<div class="result-panel">'
        + '<div class="result-ic ok">' + icon('check-circle', 27) + '</div>'
        + '<h2 class="result-title">Verification complete</h2>'
        + '<p class="result-text">Your <b>' + esc(v.currency || 'default') + '</b> account is active with a zero balance. New accounts always start at zero — balances are never converted or transferred between currencies.</p>'
        + '<dl class="kv-grid" style="text-align:left;">'
        + '<div class="kv"><dt>Account ID</dt><dd class="mono">' + esc(v.accountId || '—') + '</dd></div>'
        + '<div class="kv"><dt>Default currency</dt><dd>' + esc(v.currency || '—') + '</dd></div>'
        + '</dl>'
        + '<div class="result-actions">'
        + '<button type="button" class="btn btn-primary" data-action="verified:go">Go to overview</button>'
        + '<a class="btn btn-ghost" href="#/activate">Activate another currency</a>'
        + '</div>'
        + '</div>';
    },

    verifyFailed: function (S) {
      return '<div class="result-panel">'
        + '<div class="result-ic err">' + icon('alert', 27) + '</div>'
        + '<h2 class="result-title">Too many attempts</h2>'
        + '<p class="result-text">The verification code was entered incorrectly five times, so it is now locked. Resend a fresh code to continue — the previous code no longer works.</p>'
        + '<div class="result-actions">'
        + '<button type="button" class="btn btn-primary" data-action="otp:resend" data-channel="email">Resend email code</button>'
        + '<button type="button" class="btn btn-ghost" data-action="otp:resend" data-channel="phone">Resend phone code</button>'
        + '<a class="btn btn-ghost" href="#/login">Back to sign in</a>'
        + '</div>'
        + '<p class="result-demo-row muted small">Codes are simulated — nothing real is delivered.</p>'
        + '</div>';
    },

    gate: function (S) {
      return '<span class="gate-ic">' + icon('lock', 22) + '</span>'
        + '<p class="result-text" style="max-width:none;">Please log in or create an account to access this feature.</p>'
        + '<div class="gate-actions">'
        + '<a class="btn btn-primary btn-block" href="#/login">Sign in</a>'
        + '<a class="btn btn-ghost btn-block" href="#/register">Create an account</a>'
        + '</div>'
        + '<p class="muted small" style="margin-top:18px;">New accounts are ready in about a minute — verification codes are simulated and shown on screen.</p>';
    },

    frozen: function (S) {
      var reason = S.frozenReason || (S.user && S.user.freezeReason) || 'This account is temporarily frozen.';
      var bySelf = S.user && S.user.frozenBy === 'Customer (self)';
      return '<div class="result-panel">'
        + '<div class="result-ic err">' + icon('snowflake', 27) + '</div>'
        + '<h2 class="result-title">Account temporarily frozen</h2>'
        + '<p class="result-text">' + esc(reason) + '</p>'
        + '<div class="panel" style="text-align:left;max-width:460px;margin:14px auto 0;">'
        + '<dl class="kv-grid">'
        + '<div class="kv"><dt>Status</dt><dd>' + badge('frozen') + '</dd></div>'
        + (S.user ? '<div class="kv"><dt>Account</dt><dd class="mono">' + esc(S.user.accountId || '—') + '</dd></div>' : '')
        + '<div class="kv"><dt>Applied by</dt><dd>' + esc((S.user && S.user.frozenBy) || 'Administrator') + '</dd></div>'
        + '</dl>'
        + '</div>'
        + (bySelf
          ? '<div class="result-actions"><button type="button" class="btn btn-primary" data-action="unfreeze:self">Unfreeze my account</button></div>'
          : '<p class="result-text" style="margin-top:18px;">An administrator froze this account — contact support to resolve it.</p>')
        + '<div class="result-actions">'
        + '<a class="btn btn-ghost" href="contact.html">Contact support</a>'
        + '<button type="button" class="btn btn-ghost" data-action="logout">' + icon('logout', 15) + ' Sign out</button>'
        + '</div>'
        + '</div>';
    },

    adminNotice: function (S) {
      return '<div class="result-panel">'
        + '<div class="result-ic warn">' + icon('shield', 27) + '</div>'
        + '<h2 class="result-title">Administrator session</h2>'
        + '<p class="result-text">You are signed in as an administrator. Use Account Takeover from the admin console to view a specific customer account — administrative sessions can&rsquo;t use the customer app directly.</p>'
        + '<div class="result-actions">'
        + '<button type="button" class="btn btn-primary" data-action="admin:console">' + icon('external', 15) + ' Open admin console</button>'
        + '</div>'
        + '</div>';
    },

    /* ======================================================================
       OVERVIEW
       ====================================================================== */
    overview: function (S) {
      var me = S.me || { accounts: [], totalUsd: 0 };
      var txns = S.data.recentTxns || [];
      var notifs = (S.data.notifs || []).slice(0, 3);
      var sec = S.data.security || {};
      var mfaOn = S.user ? !!S.user.mfaEnabled : !!(sec && sec.mfaEnabled);
      var suspicious = (sec.suspicious || []).length;
      var activeSessions = 0;
      try {
        var ses = GL.api.session.get();
        activeSessions = GL.db().sessions.filter(function (x) {
          return x.userId === (ses && ses.userId) && x.status === 'active';
        }).length;
      } catch (e) {}

      /* currency cards */
      var curCards = me.accounts.map(function (a) {
        return '<a class="ccard" href="#/account/' + esc(a.code) + '">'
          + '<div class="ccard-top"><span class="ccard-code">' + esc(a.code) + '</span>' + badge(a.status) + '</div>'
          + '<div class="ccard-name">' + esc(a.name) + '</div>'
          + '<div class="ccard-balance">' + esc(fmt.money(a.balance, a.code)) + '</div>'
          + '<div class="ccard-meta"><span>≈ ' + esc(fmt.usd(a.equivalentUsd)) + '</span><span>' + a.txCount + ' txn' + (a.txCount === 1 ? '' : 's') + '</span></div>'
          + '</a>';
      }).join('');

      /* recent transactions */
      var txnBody = txns.length
        ? txns.map(function (t) {
          return '<tr data-href="#/txn/' + esc(t.ref) + '">'
            + '<td><a href="#/txn/' + esc(t.ref) + '"><span class="cell-main mono">' + esc(t.ref) + '</span></a><span class="cell-sub">' + esc(t.description) + '</span></td>'
            + '<td><span class="cell-main">' + esc(t.currency) + '</span></td>'
            + '<td class="num"><span class="' + (t.amount < 0 ? 'amt-neg' : 'amt-pos') + '">' + esc(fmt.money(t.amount, t.currency)) + '</span></td>'
            + '<td>' + badge(t.status) + '</td>'
            + '<td class="num muted">' + esc(fmt.date(t.ts)) + '</td>'
            + '</tr>';
        }).join('')
        : '';
      var txnTable = txns.length
        ? '<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Currency</th><th class="num">Amount</th><th>Status</th><th class="num">Date</th></tr></thead><tbody>' + txnBody + '</tbody></table></div>'
        : emptyState('receipt', 'No transactions yet', 'Deposits and other activity on your currency accounts will appear here.', '<a class="btn btn-ghost btn-sm" href="#/deposits">Make a deposit</a>');

      /* notifications preview */
      var notifHtml = notifs.length
        ? notifs.map(function (n) {
          var tone = n.kind === 'success' ? 'ok' : n.kind === 'warning' ? 'warn' : 'acc';
          return '<div class="notif-mini">'
            + '<span class="notif-ic ' + tone + '">' + icon(n.kind === 'success' ? 'check-circle' : n.kind === 'warning' ? 'alert' : 'info', 16) + '</span>'
            + '<div class="notif-body">'
            + '<div class="notif-head"><span class="notif-title">' + esc(n.title) + '</span><span class="notif-time">' + esc(fmt.timeAgo(n.ts)) + '</span></div>'
            + '<p class="notif-text">' + esc(n.body) + '</p>'
            + '</div></div>';
        }).join('') + '<p style="margin:14px 0 0;"><a class="link-sm" href="#/notifications">View all notifications</a></p>'
        : emptyState('bell', 'No notifications', 'Account events and security alerts will appear here.');

      /* donut + legend */
      var withBal = (me.accounts || []).filter(function (a) { return a.equivalentUsd > 0; });
      var distHtml = withBal.length
        ? '<canvas class="ov-donut" data-chart="overview-donut" role="img" aria-label="Currency distribution of your total balance, in USD equivalents"></canvas>'
          + '<div class="legend">'
          + withBal.map(function (a, i) {
            return '<div class="legend-row"><span class="legend-swatch" style="background:' + PALETTE[i % PALETTE.length] + '"></span>'
              + '<b>' + esc(a.code) + '</b>'
              + '<span class="legend-val">' + esc(fmt.usd(a.equivalentUsd)) + ' · ' + Math.round(a.equivalentUsd / Math.max(1, me.totalUsd) * 100) + '%</span></div>';
          }).join('')
          + '</div>'
        : emptyState('chart', 'Nothing to chart yet', 'Once your accounts hold balances, this chart shows how your total is distributed across currencies.');

      var secHtml =
        '<div class="sec-sum-row"><span class="lab">' + icon('shield-check', 16) + 'Multi-factor authentication</span><span class="val">' + (mfaOn ? '<span class="dot ok"></span>On' : '<span class="dot warn"></span>Off') + '</span></div>'
        + '<div class="sec-sum-row"><span class="lab">' + icon('history', 16) + 'Active sessions</span><span class="val">' + activeSessions + '</span></div>'
        + '<div class="sec-sum-row"><span class="lab">' + icon('alert', 16) + 'Suspicious events</span><span class="val">' + (suspicious ? '<span class="dot err"></span>' + suspicious : '<span class="dot ok"></span>0') + '</span></div>'
        + '<p style="margin:14px 0 0;"><a class="link-sm" href="#/security">Manage security</a></p>';

      return '<section class="ov-hero sheen-card" aria-label="Total balance">'
        + '<div class="ov-hero-main">'
        + '<p class="eyebrow no-rule">Total balance · all accounts</p>'
        + '<p class="ov-balance" data-countup="' + esc(me.totalUsd || 0) + '" data-countup-money="1" data-countup-cur="USD">' + esc(fmt.usd(me.totalUsd)) + '</p>'
        + '<p class="ov-hero-note">' + me.accounts.length + ' active ' + (me.accounts.length === 1 ? 'currency' : 'currencies') + ' · USD equivalents at indicative demo rates</p>'
        + '</div>'
        + '<div class="ov-hero-actions">'
        + '<a class="btn btn-primary" href="#/deposits">' + icon('plus', 16) + ' Deposit</a>'
        + '<a class="btn btn-ghost" href="#/activate">' + icon('coins', 16) + ' Activate currency</a>'
        + '</div>'
        + '</section>'
        + '<div class="ov-grid">'
        + '<div class="ov-col-main">'
        + '<section class="panel"><div class="panel-head"><h2 class="panel-title">Your currencies</h2><a class="link-sm" href="#/accounts">All accounts</a></div>'
        + (curCards ? '<div class="ccard-grid">' + curCards + '</div>' : emptyState('wallet', 'No currency accounts yet', 'Your default currency activates automatically once verification completes.'))
        + '</section>'
        + '<section class="panel"><div class="panel-head"><h2 class="panel-title">Recent activity</h2><a class="link-sm" href="#/transactions">View all</a></div>'
        + txnTable
        + '</section>'
        + '</div>'
        + '<div class="ov-col-side">'
        + '<section class="panel"><div class="panel-head"><h2 class="panel-title">Distribution</h2></div>' + distHtml + '</section>'
        + '<section class="panel"><div class="panel-head"><h2 class="panel-title">Notifications</h2><a class="link-sm" href="#/notifications">View all</a></div>' + notifHtml + '</section>'
        + '<section class="panel"><div class="panel-head"><h2 class="panel-title">Security</h2></div>' + secHtml + '</section>'
        + '</div>'
        + '</div>';
    },

    /* ======================================================================
       ACCOUNTS — every account card + un-activated supported currencies
       ====================================================================== */
    accounts: function (S) {
      var me = S.me || { accounts: [] };
      var have = {};
      me.accounts.forEach(function (a) { have[a.code] = true; });
      var live = {};
      try { live = GL.db().settings.currencyStatus || {}; } catch (e) {}
      var avail = GL.CURRENCIES.filter(function (c) { return !have[c.code] && live[c.code] === 'active'; });

      var cards = me.accounts.map(function (a) {
        return '<article class="acct-card card-hover">'
          + '<div class="acct-card-top"><span class="ccard-code">' + esc(a.code) + '</span>' + badge(a.status) + '</div>'
          + '<h3 class="acct-name">' + esc(a.name) + '</h3>'
          + '<p class="acct-balance">' + esc(fmt.money(a.balance, a.code)) + '</p>'
          + '<p class="acct-equiv">≈ ' + esc(fmt.usd(a.equivalentUsd)) + ' equivalent</p>'
          + '<div class="acct-meta">'
          + '<span>' + icon('receipt', 14) + a.txCount + ' transactions</span>'
          + '<span>' + icon('calendar', 14) + 'Opened ' + esc(fmt.date(a.openedAt)) + '</span>'
          + '</div>'
          + '<a class="btn btn-ghost btn-sm" href="#/account/' + esc(a.code) + '">View account</a>'
          + '</article>';
      }).join('');

      var availHtml = avail.length
        ? '<div class="avail-strip">'
        + avail.map(function (c) {
          return '<a class="avail-card" href="#/activate"><b>' + esc(c.code) + '</b>' + esc(c.name) + '<span class="link-sm">Activate</span></a>';
        }).join('')
        + '</div>'
        : '<p class="muted small">All supported currencies are active on your account. New currencies appear here as the platform adds them.</p>';

      return '<section class="panel">'
        + '<div class="panel-head"><h2 class="panel-title">Your currency accounts</h2><a class="link-sm" href="#/activate">Activate a currency</a></div>'
        + '<p class="panel-sub">Each currency keeps its own balance, history and deposit records — nothing is converted automatically. Demo data.</p>'
        + (cards ? '<div class="acct-cards">' + cards + '</div>' : emptyState('wallet', 'No accounts yet', 'Your default currency activates automatically once verification completes.'))
        + '</section>'
        + '<section class="panel">'
        + '<div class="panel-head"><h2 class="panel-title">Available to activate</h2></div>'
        + availHtml
        + '</section>';
    },

    /* ======================================================================
       ACCOUNT DETAIL — header, transactions, deposit records
       ====================================================================== */
    account: function (S) {
      if (S.data.accountError) {
        return emptyState('wallet', 'Account not found', S.data.accountError,
          '<a class="btn btn-ghost btn-sm" href="#/accounts">Back to accounts</a>'
          + ' <a class="btn btn-primary btn-sm" href="#/activate">Activate a currency</a>');
      }
      var d = S.data.account;
      if (!d) return emptyState('wallet', 'Account unavailable', 'This account could not be loaded. Try again.');
      var a = d.account;
      var txns = d.transactions || [];
      var deps = d.deposits || [];

      var txnBody = txns.map(function (t) {
        return '<tr data-href="#/txn/' + esc(t.ref) + '">'
          + '<td><a href="#/txn/' + esc(t.ref) + '"><span class="cell-main mono">' + esc(t.ref) + '</span></a></td>'
          + '<td><span class="cell-main">' + esc(t.description) + '</span></td>'
          + '<td class="num"><span class="' + (t.amount < 0 ? 'amt-neg' : 'amt-pos') + '">' + esc(fmt.money(t.amount, t.currency)) + '</span></td>'
          + '<td>' + badge(t.status) + '</td>'
          + '<td class="num muted">' + esc(fmt.dateTime(t.ts)) + '</td>'
          + '</tr>';
      }).join('');

      var depBody = deps.map(function (x) {
        return '<tr>'
          + '<td><span class="cell-main mono">' + esc(x.reference) + '</span></td>'
          + '<td class="num">' + esc(fmt.money(x.amount, x.currency)) + '</td>'
          + '<td><span class="cell-sub" style="margin:0;">' + esc(methodLabel(x.method)) + '</span><span class="cell-sub">Fee ' + esc(fmt.money(x.fee, x.currency)) + '</span></td>'
          + '<td>' + badge(x.status) + '</td>'
          + '<td class="num muted">' + esc(fmt.date(x.createdAt)) + '</td>'
          + '</tr>';
      }).join('');

      return '<a class="backlink" href="#/accounts">' + icon('chevron-l', 15) + 'All accounts</a>'
        + '<section class="acct-hero sheen-card">'
        + '<div>'
        + '<div class="acct-card-top"><span class="ccard-code">' + esc(a.code) + '</span>' + badge(a.status) + '</div>'
        + '<h2 class="acct-name" style="font-size:28px;">' + esc(a.name) + '</h2>'
        + '<p class="ov-balance" style="font-size:clamp(34px,4vw,44px);">' + esc(fmt.money(a.balance, a.code)) + '</p>'
        + '<p class="ov-hero-note">≈ ' + esc(fmt.usd(a.equivalentUsd)) + ' equivalent · opened ' + esc(fmt.date(a.openedAt)) + '</p>'
        + '</div>'
        + '<div class="ov-hero-actions">'
        + '<a class="btn btn-primary" href="#/deposits">' + icon('plus', 16) + ' Deposit ' + esc(a.code) + '</a>'
        + '<a class="btn btn-ghost" href="#/transactions">Transactions</a>'
        + '</div>'
        + '</section>'
        + '<section class="panel">'
        + '<div class="panel-head"><h2 class="panel-title">Transactions</h2><span class="muted small">' + a.txCount + ' total · demo ledger</span></div>'
        + (txns.length
          ? '<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Description</th><th class="num">Amount</th><th>Status</th><th class="num">Date</th></tr></thead><tbody>' + txnBody + '</tbody></table></div>'
          : emptyState('receipt', 'No transactions yet', 'Activity on this currency account will appear here.'))
        + '</section>'
        + '<section class="panel">'
        + '<div class="panel-head"><h2 class="panel-title">Deposit records</h2><span class="muted small">Simulated payments</span></div>'
        + (deps.length
          ? '<div class="table-wrap"><table><thead><tr><th>Reference</th><th class="num">Amount</th><th>Method</th><th>Status</th><th class="num">Date</th></tr></thead><tbody>' + depBody + '</tbody></table></div>'
          : emptyState('download', 'No deposits yet', 'Simulated deposits into this currency will be recorded here.'))
        + '</section>';
    },

    /* ======================================================================
       BIND — visual/UX listeners only (behaviour belongs to the engine)
       ====================================================================== */
    bind: function (root) {
      root.querySelectorAll('[data-action="premium:theme"]').forEach(function (b) {
        b.addEventListener('click', function () {
          var t = themeFlip();
          b.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
          b.setAttribute('aria-label', t === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme');
        });
      });

      /* mobile off-canvas sidenav */
      var tog = root.querySelector('[data-shell-nav-toggle]');
      var side = root.querySelector('.sidenav');
      function closeNav() {
        document.body.classList.remove('nav-open');
        root.querySelectorAll('[data-shell-nav-toggle]').forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
      }
      if (tog) {
        tog.addEventListener('click', function () {
          var open = document.body.classList.toggle('nav-open');
          tog.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      }
      var scrim = root.querySelector('.scrim');
      if (scrim) scrim.addEventListener('click', closeNav);
      if (side) {
        side.querySelectorAll('a[href^="#/"]').forEach(function (a) { a.addEventListener('click', closeNav); });
      }

      /* overview donut chart */
      var cv = root.querySelector('[data-chart="overview-donut"]');
      if (cv && GL.charts && GL.S && GL.S.me) {
        var segs = (GL.S.me.accounts || []).filter(function (a) { return a.equivalentUsd > 0; })
          .map(function (a, i) { return { value: a.equivalentUsd, color: PALETTE[i % PALETTE.length], label: a.code }; });
        if (segs.length) GL.charts.donut(cv, { segments: segs, centre: 'USD' });
      }

      /* clickable table rows that mirror their reference link */
      root.querySelectorAll('tr[data-href]').forEach(function (tr) {
        tr.addEventListener('click', function (e) {
          if (e.target.closest('a')) return;
          location.hash = tr.getAttribute('data-href').replace(/^#/, '');
        });
      });

      /* extras registered by views-more.js */
      (GL.Views._binds || []).forEach(function (fn) { try { fn(root); } catch (e) {} });
    }
  };

  /* per-concept visual hooks appended by views-more.js */
  GL.Views._binds = [];

  /* ---------------- shared internal helpers ---------------- */
  function otpView(S, channel) {
    var isEmail = channel === 'email';
    var formName = isEmail ? 'verifyEmailForm' : 'verifyPhoneForm';
    var code = null, p = null;
    try { p = GL.api.demo.pendingOtp(); } catch (e) {}
    code = isEmail ? ((p && p.emailOtp) || (S.demoOtp && S.demoOtp.email) || null)
      : ((p && p.phoneOtp) || (S.demoOtp && S.demoOtp.phone) || null);
    var digits = '';
    for (var i = 1; i <= 6; i++) {
      digits += '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit ' + i + '">';
    }
    return '<p class="auth-lead">Enter the 6-digit code sent to your ' + (isEmail ? 'email address' : 'phone') + '.</p>'
      + (code
        ? '<p class="preview-note">' + icon('info', 15) + '<span>Demo mode — your code is <b>' + esc(code) + '</b></span></p>'
        : '<p class="preview-note">' + icon('info', 15) + '<span>No pending ' + esc(channel) + ' verification found. Codes appear here during registration or sign-in.</span></p>')
      + '<form data-form="' + formName + '" novalidate>'
      + '<div class="otp-input" aria-label="6-digit code">' + digits + '</div>'
      + '<input type="hidden" name="otp" value="">'
      + '<p class="otp-err" hidden></p>'
      + '<button class="btn btn-primary btn-block" type="submit">Verify ' + (isEmail ? 'email' : 'phone') + '</button>'
      + '</form>'
      + '<div class="auth-alt">'
      + '<p>Didn&rsquo;t receive it? <button type="button" class="link-btn" data-action="otp:resend" data-channel="' + channel + '">Resend code</button> <span class="muted small" data-countdown="otp-' + channel + '"></span></p>'
      + '<p class="muted small">Resends are simulated — no real message is delivered.</p>'
      + '</div>';
  }

  function methodLabel(id) {
    var m = (GL.DEPOSIT_METHODS || []).filter(function (x) { return x.id === id; })[0];
    return m ? m.label : (id || '—');
  }
  GL.Views._methodLabel = methodLabel;
})();
