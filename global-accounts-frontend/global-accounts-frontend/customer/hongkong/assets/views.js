/* ==========================================================================
   MERIDIAN GLOBAL ACCOUNTS — Hong Kong International Fintech (Design 2)
   customer/hongkong/assets/views.js

   GL.Views part 1 — the app shell (frame), skeleton, every auth-flow view
   and the core dashboard views (overview, accounts, account, activate).

   The shared engine (shared/app-core.js) owns ALL behaviour: forms are
   declared with data-form="<name>", buttons with data-action="<name>" and
   the engine binds them centrally. These functions only return markup.
   Escape user data with GL.esc(), money with GL.fmt.money(amount, code).
   ========================================================================== */
window.GL = window.GL || {};
(function () {
  var esc = GL.esc, icon = GL.icon, fmt = GL.fmt;

  /* ---------------------------------------------------------------- helpers */
  var PAL = ['#1F6FEB', '#6172F3', '#12B76A', '#F79009', '#7A5AF8'];
  var AUTH = ['login', 'register', 'verifyEmail', 'verifyPhone', 'forgot', 'reset',
    'verified', 'verifyFailed', 'gate', 'frozen', 'adminNotice'];
  var GATEY = ['gate', 'frozen', 'adminNotice', 'notFound'];

  function slice(list) { return Array.prototype.slice.call(list || []); }

  function badge(st) {
    return '<span class="badge b-' + esc(st) + '">' + esc(st) + '</span>';
  }
  function methodLabel(id) {
    var m = (GL.DEPOSIT_METHODS || []).filter(function (x) { return x.id === id; })[0];
    return m ? m.label : (id || '—');
  }
  function curStatus(code) {
    try {
      var st = GL.db().settings.currencyStatus;
      if (st && st[code]) return st[code];
    } catch (e) {}
    var c = (GL.CURRENCIES || []).filter(function (x) { return x.code === code; })[0];
    return c ? c.status : 'unavailable';
  }
  function emptyState(ic, title, text, ctaHtml) {
    return '<div class="empty"><span class="empty-ic">' + icon(ic, 26) + '</span>' +
      '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (ctaHtml || '') + '</div>';
  }
  function sessionExpired() {
    return emptyState('lock', 'Session expired', 'Please sign in again to continue.',
      '<a class="btn btn-primary" href="#/login">Sign in</a>');
  }
  function displayTitle(S) {
    if (S.title && S.title !== 'Meridian') return S.title;
    var map = { gate: 'Sign in required', frozen: 'Account frozen', adminNotice: 'Administrator session', notFound: 'Page not found' };
    return map[S.view] || 'Meridian Global Accounts';
  }
  /* deterministic decorative sparkline series (demo decoration only) */
  function sparkSeries(seed, end) {
    var s = 0, k = String(seed);
    for (var i = 0; i < k.length; i++) s = (s * 31 + k.charCodeAt(i)) % 9973;
    var target = Math.abs(Number(end) || 0);
    var out = [], v = Math.max(target * 0.55, 1);
    for (var j = 0; j < 11; j++) {
      s = (s * 137 + 61) % 9973;
      v = v * (0.9 + (s % 45) / 180);
      out.push(target ? Math.round(v * 100) / 100 : 0);
    }
    out.push(target);
    return out;
  }
  function txnRow(t) {
    var neg = Number(t.amount) < 0;
    return '<tr>' +
      '<td><a class="rowlink" href="#/txn/' + encodeURIComponent(t.ref) + '">' + esc(t.ref) + '</a></td>' +
      '<td class="td-desc">' + esc(t.description) + '</td>' +
      '<td><b>' + esc(t.currency) + '</b></td>' +
      '<td class="td-amount ' + (neg ? 'neg' : 'pos') + '">' + esc(fmt.money(t.amount, t.currency)) + '</td>' +
      '<td>' + badge(t.status) + '</td>' +
      '<td class="td-date">' + esc(fmt.dateTime(t.ts)) + '</td>' +
    '</tr>';
  }
  function notifRow(n) {
    return '<li class="notif-row' + (n.read ? '' : ' unread') + '">' +
      '<span class="notif-dot" aria-hidden="true"></span>' +
      '<div><b>' + esc(n.title) + '</b><small>' + esc(fmt.timeAgo(n.ts)) + '</small></div>' +
    '</li>';
  }
  function depRow(d) {
    return '<tr>' +
      '<td><b>' + esc(d.reference) + '</b></td>' +
      '<td>' + esc(d.currency) + '</td>' +
      '<td class="td-amount pos">' + esc(fmt.money(d.amount, d.currency)) + '</td>' +
      '<td>' + esc(methodLabel(d.method)) + '</td>' +
      '<td>' + badge(d.status) + '</td>' +
      '<td class="td-date">' + esc(fmt.date(d.createdAt)) + '</td>' +
    '</tr>';
  }

  /* ------------------------------------------------------------------ frame */
  function brandHtml(light) {
    return '<a class="' + (light ? 'brand brand-light' : 'brand') + '" href="index.html" aria-label="Meridian Global Accounts — public site">' +
      '<span class="brand-mark" aria-hidden="true">' + icon('globe', 20) + '</span>' +
      '<span class="brand-text">Meridian <small>GLOBAL ACCOUNTS</small></span></a>';
  }
  function takeoverBanner(S) {
    return '<div class="takeover-banner" role="alert">' +
      '<div class="takeover-inner">' +
        '<span class="takeover-ic" aria-hidden="true">' + icon('shield', 16) + '</span>' +
        '<p><b>ADMINISTRATIVE TAKEOVER</b> — You are viewing ' + esc(S.user ? S.user.name : 'a customer’s') +
        '’s account · read + permitted edits · the customer is not notified</p>' +
      '</div>' +
      '<button class="btn btn-light btn-sm" type="button" data-action="end:takeover">End takeover</button>' +
    '</div>';
  }
  function navItem(view, href, ic, label, extra, current) {
    var active = current === view;
    return '<a class="nav-item' + (active ? ' active' : '') + '" href="' + href + '"' +
      (active ? ' aria-current="page"' : '') + '>' + icon(ic, 18) + '<span>' + label + '</span>' + (extra || '') + '</a>';
  }
  function sidenav(S) {
    var unread = GL.unreadCount ? GL.unreadCount() : 0;
    var cur = S.view === 'account' ? 'accounts' : (S.view === 'txn' ? 'transactions' : S.view);
    var user = S.user;
    return '<aside class="sidenav" id="gl-sidenav" aria-label="Account navigation">' +
      '<div class="sidenav-brand">' + brandHtml(true) + '</div>' +
      '<nav class="sidenav-nav">' +
        '<p class="nav-group">Banking</p>' +
        navItem('overview', '#/overview', 'dashboard', 'Overview', '', cur) +
        navItem('accounts', '#/accounts', 'wallet', 'Accounts', '', cur) +
        navItem('activate', '#/activate', 'plus', 'Activate currency', '', cur) +
        navItem('deposits', '#/deposits', 'arrow-up', 'Deposits', '', cur) +
        navItem('transactions', '#/transactions', 'receipt', 'Transactions', '', cur) +
        navItem('statements', '#/statements', 'doc', 'Statements', '', cur) +
        '<p class="nav-group">Account</p>' +
        navItem('notifications', '#/notifications', 'bell', 'Notifications', unread ? '<span class="nav-badge">' + unread + '</span>' : '', cur) +
        navItem('profile', '#/profile', 'user', 'Profile', '', cur) +
        navItem('security', '#/security', 'shield', 'Security', '', cur) +
        navItem('sessions', '#/sessions', 'clock', 'Sessions', '', cur) +
        navItem('support', '#/support', 'life', 'Support', '', cur) +
        navItem('settings', '#/settings', 'settings', 'Settings', '', cur) +
      '</nav>' +
      '<div class="sidenav-foot">' +
        '<div class="sidenav-user">' +
          '<span class="avatar" aria-hidden="true">' + esc(fmt.initials(user ? user.name : '')) + '</span>' +
          '<div class="sidenav-user-txt"><b>' + esc(user ? user.name : 'Loading…') + '</b>' +
          '<small>' + esc(user ? user.email : '') + '</small></div>' +
        '</div>' +
        '<button class="btn btn-outline btn-sm sidenav-out" type="button" data-action="logout">' + icon('logout', 15) + ' Sign out</button>' +
      '</div>' +
    '</aside>';
  }
  function topbar(S, title) {
    var unread = GL.unreadCount ? GL.unreadCount() : 0;
    return '<header class="topbar">' +
      '<button class="icon-btn menu-btn" type="button" data-shell-nav-toggle aria-expanded="false" aria-controls="gl-sidenav" aria-label="Open navigation">' +
        icon('menu', 20) + '</button>' +
      '<h1 class="topbar-title" id="gl-viewtitle" tabindex="-1">' + esc(title) + '</h1>' +
      '<span class="preview-chip topbar-chip"><span class="dot" aria-hidden="true"></span> Demo environment — design preview</span>' +
      '<div class="topbar-actions">' +
        '<a class="icon-btn topbar-bell" href="#/notifications" aria-label="Notifications' + (unread ? ', ' + unread + ' unread' : '') + '">' +
          icon('bell', 19) + (unread ? '<span class="nav-badge">' + unread + '</span>' : '') + '</a>' +
        '<a class="user-chip" href="#/profile" aria-label="View profile">' +
          '<span class="avatar" aria-hidden="true">' + esc(fmt.initials(S.user ? S.user.name : '')) + '</span>' +
          '<span class="user-chip-name">' + esc(S.user ? (S.user.firstName || S.user.name) : 'Account') + '</span>' +
        '</a>' +
      '</div>' +
    '</header>';
  }
  function maintBar() {
    try {
      if (GL.db().settings.maintenanceMode) {
        return '<div class="maint-bar" role="status">' + icon('alert', 15) +
          ' Scheduled platform maintenance (demo) — some features may be briefly unavailable.</div>';
      }
    } catch (e) {}
    return '';
  }

  GL.Views = {

    /* ================= ================================================ frame */
    frame: function (S, content) {
      var sess = null;
      try { sess = GL.api.session.get(); } catch (e) {}
      var signedIn = !!(sess && (sess.kind === 'user' || sess.kind === 'takeover'));
      var authLayout = AUTH.indexOf(S.view) > -1 || !signedIn;
      var title = displayTitle(S);
      var maint = maintBar();

      if (authLayout) {
        if (GATEY.indexOf(S.view) > -1) {
          return maint +
            '<main class="content gate-viewport" id="gl-main">' +
              '<h1 class="vh" id="gl-viewtitle" tabindex="-1">' + esc(title) + '</h1>' +
              '<div class="gate-wrap">' + content + '</div>' +
            '</main>';
        }
        return maint +
          '<main class="content auth-viewport" id="gl-main">' +
            '<h1 class="vh" id="gl-viewtitle" tabindex="-1">' + esc(title) + '</h1>' +
            '<div class="auth-wrap">' +
              '<div class="auth-card">' +
                '<div class="auth-brand">' + brandHtml(false) + '</div>' +
                '<p class="preview-chip auth-chip"><span class="dot" aria-hidden="true"></span> Demo environment — design preview</p>' +
                content +
              '</div>' +
              '<p class="auth-foot">Design prototype — no real money. <a href="index.html">Back to the public site</a></p>' +
            '</div>' +
          '</main>';
      }

      return maint +
        (S.takeover ? takeoverBanner(S) : '') +
        '<div class="shell">' +
          sidenav(S) +
          '<div class="shell-main">' +
            topbar(S, title) +
            '<main class="content" id="gl-main">' + content + '</main>' +
          '</div>' +
        '</div>' +
        '<div class="scrim" data-scrim aria-hidden="true"></div>';
    },

    /* =============================================================== skeleton */
    skeleton: function () {
      return '<div class="skel-page" aria-hidden="true">' +
          '<div class="skel sk-title"></div>' +
          '<div class="skel-row">' +
            '<div class="skel sk-block"></div><div class="skel sk-block"></div>' +
            '<div class="skel sk-block"></div><div class="skel sk-block"></div>' +
          '</div>' +
          '<div class="skel-cols">' +
            '<div class="skel sk-panel"></div><div class="skel sk-panel"></div>' +
          '</div>' +
        '</div>';
    },

    /* =============================================================== notFound */
    notFound: function () {
      return '<div class="gate-card">' +
          '<span class="gate-ic">' + icon('search', 28) + '</span>' +
          '<h2>Page not found</h2>' +
          '<p class="muted">The page you’re looking for doesn’t exist or has moved.</p>' +
          '<div class="gate-actions">' +
            '<a class="btn btn-primary" href="#/overview">Go to overview</a>' +
            '<a class="btn btn-ghost" href="index.html">Public site</a>' +
          '</div>' +
        '</div>';
    },

    /* =================================================================== gate */
    gate: function () {
      return '<div class="gate-card">' +
          '<span class="gate-ic">' + icon('lock', 28) + '</span>' +
          '<h2>Sign in required</h2>' +
          '<p class="muted">Please log in or create an account to access this feature.</p>' +
          '<div class="gate-actions">' +
            '<a class="btn btn-primary" href="#/login">Sign in</a>' +
            '<a class="btn btn-ghost" href="#/register">Create account</a>' +
          '</div>' +
        '</div>';
    },

    /* =================================================================== login */
    login: function () {
      var creds = (GL.DEMO_CREDENTIALS && GL.DEMO_CREDENTIALS.customers) || [];
      var pw = (GL.DEMO_CREDENTIALS && GL.DEMO_CREDENTIALS.customerPassword) || 'Demo1234!';
      return '<div class="auth-head">' +
          '<h2>Welcome back</h2><p>Sign in to your Meridian platform account.</p>' +
        '</div>' +
        '<form data-form="loginForm" novalidate>' +
          '<div class="field">' +
            '<label for="li-email">Email address</label>' +
            '<input id="li-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>' +
            '<p class="field-err" hidden></p>' +
          '</div>' +
          '<div class="field">' +
            '<label for="li-pass">Password</label>' +
            '<input id="li-pass" name="password" type="password" autocomplete="current-password" placeholder="Your password" required>' +
            '<p class="field-err" hidden></p>' +
          '</div>' +
          '<div class="auth-row"><a class="auth-link" href="#/forgot">Forgot password?</a></div>' +
          '<button class="btn btn-primary btn-block" type="submit">Sign in</button>' +
        '</form>' +
        '<p class="auth-alt">New to Meridian? <a href="#/register">Create an account</a></p>' +
        '<div class="demo-fill">' +
          '<p class="demo-fill-note">' + icon('info', 14) + ' Demo quick-fill — password <code>' + esc(pw) + '</code> for all demo customers</p>' +
          '<div class="demo-chip-row">' +
            creds.map(function (c) {
              return '<button type="button" class="demo-chip" data-action="loginDemo" data-email="' + esc(c.email) + '">' +
                '<b aria-hidden="true">' + esc(fmt.initials(c.email.split('@')[0].replace(/[._]/g, ' '))) + '</b>' +
                '<span>' + esc(c.email.split('@')[0]) + '<small>' + esc(c.note) + '</small></span>' +
              '</button>';
            }).join('') +
          '</div>' +
        '</div>';
    },

    /* ================================================================ register */
    register: function () {
      var opts = (GL.COUNTRIES || []).map(function (c) {
        return '<option value="' + esc(c.name) + '">' + esc(c.name + ' — ' + c.currency + ' default') + '</option>';
      }).join('');
      return '<div class="auth-head">' +
          '<h2>Create your account</h2><p>One login, five currencies. It takes about a minute.</p>' +
        '</div>' +
        '<form data-form="registerForm" novalidate>' +
          '<div class="field">' +
            '<label for="rg-name">Full name</label>' +
            '<input id="rg-name" name="fullName" type="text" autocomplete="name" placeholder="First and last name" required>' +
            '<p class="field-err" hidden></p>' +
          '</div>' +
          '<div class="field">' +
            '<label for="rg-email">Email address</label>' +
            '<input id="rg-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>' +
            '<p class="field-err" hidden></p>' +
          '</div>' +
          '<div class="field">' +
            '<label for="rg-country">Country of residence</label>' +
            '<select id="rg-country" name="country" required>' +
              '<option value="" selected disabled>Choose your country</option>' + opts +
            '</select>' +
            '<p class="field-err" hidden></p>' +
            '<p class="hint">Your country determines the currency activated after verification.</p>' +
          '</div>' +
          '<div class="field">' +
            '<label for="rg-phone">Phone (international)</label>' +
            '<input id="rg-phone" name="phone" type="tel" autocomplete="tel" placeholder="801 234 5678" required>' +
            '<p class="field-err" hidden></p>' +
            '<p class="hint">Enter the number without the dial code — it is added from your country.</p>' +
          '</div>' +
          '<div class="field">' +
            '<label for="rg-pass">Password</label>' +
            '<input id="rg-pass" name="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" required>' +
            '<p class="field-err" hidden></p>' +
            '<p class="hint">Uppercase, lowercase and a number.</p>' +
          '</div>' +
          '<div class="field">' +
            '<label for="rg-confirm">Confirm password</label>' +
            '<input id="rg-confirm" name="confirm" type="password" autocomplete="new-password" placeholder="Repeat your password" required>' +
            '<p class="field-err" hidden></p>' +
          '</div>' +
          '<label class="check-row">' +
            '<input type="checkbox" name="agree">' +
            '<span>I understand this is a demonstration environment — no real account is opened and no real money is involved.</span>' +
          '</label>' +
          '<button class="btn btn-primary btn-block" type="submit">Create account</button>' +
        '</form>' +
        '<p class="auth-alt">Already registered? <a href="#/login">Sign in</a></p>' +
        '<p class="preview-note">' + icon('info', 14) + ' Verification codes are simulated and shown on screen in this prototype.</p>';
    },

    /* ================================ verifyEmail / verifyPhone (OTP blocks) */
    verifyEmail: function (S) { return otpView(S, 'email'); },
    verifyPhone: function (S) { return otpView(S, 'phone'); },

    /* ================================================================ verified */
    verified: function (S) {
      var v = S.verified || {};
      return '<div class="auth-head">' +
          '<span class="auth-ic ok">' + icon('check-circle', 30) + '</span>' +
          '<h2>You’re verified</h2>' +
          '<p>Your <b>' + esc(v.currency || 'account') + '</b> account is active with a zero balance.</p>' +
        '</div>' +
        '<dl class="verify-facts">' +
          '<div><dt>Default currency</dt><dd><b>' + esc(v.currency || '—') + '</b></dd></div>' +
          '<div><dt>Account ID</dt><dd><code>' + esc(v.accountId || '—') + '</code></dd></div>' +
          '<div><dt>Starting balance</dt><dd><b>' + esc(fmt.money(0, v.currency || 'USD')) + '</b></dd></div>' +
        '</dl>' +
        '<button class="btn btn-primary btn-block" type="button" data-action="verified:go">Go to my dashboard</button>' +
        '<p class="preview-note">' + icon('info', 14) + ' Activate more currencies any time — each starts at zero and nothing converts automatically.</p>';
    },

    /* ============================================================ verifyFailed */
    verifyFailed: function (S) {
      var stage = (S.wizard && S.wizard.step === 3) ? 'phone' : ((S.verify && S.verify.stage) || 'email');
      return '<div class="auth-head">' +
          '<span class="auth-ic err">' + icon('lock', 30) + '</span>' +
          '<h2>Too many attempts</h2>' +
          '<p class="muted">Code entry is locked after 5 incorrect attempts. Request a fresh code — it replaces the old one immediately.</p>' +
        '</div>' +
        '<div class="gate-actions">' +
          '<button class="btn btn-primary" type="button" data-action="otp:resend" data-channel="' + esc(stage) + '">Send a new ' + esc(stage) + ' code</button>' +
        '</div>' +
        '<p class="resend-row"><span class="countdown" data-countdown="otp-' + esc(stage) + '"></span></p>' +
        '<p class="auth-alt"><a href="#/login">Back to sign in</a></p>';
    },

    /* ================================================================== forgot */
    forgot: function () {
      return '<div class="auth-head">' +
          '<h2>Reset your password</h2>' +
          '<p class="muted">Enter the email you registered with. In this prototype the “email” is simulated — you continue straight to the reset screen with a demo token.</p>' +
        '</div>' +
        '<form data-form="forgotForm" novalidate>' +
          '<div class="field">' +
            '<label for="fg-email">Email address</label>' +
            '<input id="fg-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>' +
            '<p class="field-err" hidden></p>' +
          '</div>' +
          '<button class="btn btn-primary btn-block" type="submit">Send reset link</button>' +
        '</form>' +
        '<p class="auth-alt">Remembered it? <a href="#/login">Back to sign in</a></p>';
    },

    /* =================================================================== reset */
    reset: function (S) {
      if (!S.reset) {
        return '<div class="auth-head"><h2>Choose a new password</h2></div>' +
          '<div class="empty">' +
            '<span class="empty-ic">' + icon('key', 26) + '</span>' +
            '<h3>No reset token in this session</h3>' +
            '<p>Start a reset request first — the demo token is generated when you submit your email.</p>' +
            '<a class="btn btn-primary" href="#/forgot">Start a reset request</a>' +
          '</div>';
      }
      return '<div class="auth-head">' +
          '<h2>Choose a new password</h2>' +
          '<p class="muted">Setting a new password for <b>' + esc(S.reset.email) + '</b>.</p>' +
        '</div>' +
        '<div class="token-box">' +
          '<span>Demo reset token</span>' +
          '<input type="text" name="token" readonly value="' + esc(S.reset.token) + '" aria-label="Demo reset token (read-only)" onclick="this.select()">' +
        '</div>' +
        '<form data-form="resetForm" novalidate>' +
          '<div class="field">' +
            '<label for="rs-pass">New password</label>' +
            '<input id="rs-pass" name="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" required>' +
            '<p class="field-err" hidden></p>' +
            '<p class="hint">Uppercase, lowercase and a number.</p>' +
          '</div>' +
          '<div class="field">' +
            '<label for="rs-confirm">Confirm new password</label>' +
            '<input id="rs-confirm" name="confirm" type="password" autocomplete="new-password" placeholder="Repeat your password" required>' +
            '<p class="field-err" hidden></p>' +
          '</div>' +
          '<button class="btn btn-primary btn-block" type="submit">Update password</button>' +
        '</form>';
    },

    /* ================================================================== frozen */
    frozen: function (S) {
      var reason = S.frozenReason || (S.user && S.user.freezeReason) || 'No reason was provided.';
      var selfFroze = S.user && S.user.frozenBy === 'Customer (self)';
      var supportEmail = 'support@meridian.example';
      try { supportEmail = GL.db().settings.supportEmail || supportEmail; } catch (e) {}
      return '<div class="gate-card frozen-card">' +
          '<span class="gate-ic warn">' + icon('snowflake', 30) + '</span>' +
          '<h2>Your account is temporarily frozen</h2>' +
          '<p class="frozen-reason">“' + esc(reason) + '”</p>' +
          '<p class="muted">While the freeze is active, financial activity is blocked and the dashboard is limited to this screen.</p>' +
          (selfFroze
            ? '<button class="btn btn-primary" type="button" data-action="unfreeze:self">Unfreeze my account</button>' +
              '<p class="muted small">You froze this account yourself, so you can undo it here (demo recovery).</p>'
            : '<p class="frozen-admin">' + icon('shield', 15) + ' An administrator froze this account — contact support to resolve it.</p>' +
              '<div class="gate-actions">' +
                '<a class="btn btn-primary" href="contact.html">Contact support</a>' +
                '<a class="btn btn-ghost" href="mailto:' + esc(supportEmail) + '">' + esc(supportEmail) + '</a>' +
              '</div>') +
          '<div class="gate-actions"><button class="btn btn-ghost" type="button" data-action="logout">Sign out</button></div>' +
        '</div>';
    },

    /* ============================================================ adminNotice */
    adminNotice: function () {
      return '<div class="gate-card">' +
          '<span class="gate-ic">' + icon('shield', 30) + '</span>' +
          '<h2>Administrator session</h2>' +
          '<p class="muted">You are signed in as an administrator — use Account Takeover from the admin console to view a customer account in this app.</p>' +
          '<div class="gate-actions">' +
            '<button class="btn btn-primary" type="button" data-action="admin:console">Open admin console</button>' +
          '</div>' +
        '</div>';
    },

    /* ================================================================ overview */
    overview: function (S) {
      var me = S.me;
      if (!me) return sessionExpired();
      var accs = me.accounts || [];
      var txns = S.data.recentTxns || [];
      var notifs = (S.data.notifs || []).slice(0, 3);
      var sec = S.data.security || { mfaEnabled: !!(S.user && S.user.mfaEnabled), suspicious: [], loginHistory: [] };
      var total = me.totalUsd || 0;

      var chips = accs.map(function (a) {
        return '<a class="ov-chip" href="#/account/' + esc(a.code) + '"><b aria-hidden="true">' + esc(a.symbol) + '</b>' + esc(a.code) + '</a>';
      }).join('');

      function statCard(ic, label, valHtml, sub, seed, color) {
        var sp = sparkSeries(seed, 30);
        return '<div class="stat-card">' +
          '<div class="stat-info">' +
            '<span class="stat-ic" aria-hidden="true">' + icon(ic, 17) + '</span>' +
            '<div><p class="stat-label">' + label + '</p><p class="stat-val">' + valHtml + '</p><p class="stat-sub">' + sub + '</p></div>' +
          '</div>' +
          '<canvas class="stat-spark" data-spark="' + sp.join(',') + '" data-spark-color="' + color + '" aria-hidden="true"></canvas>' +
        '</div>';
      }

      function curCard(a, i) {
        return '<a class="curcard" href="#/account/' + esc(a.code) + '">' +
          '<div class="curcard-head">' +
            '<span class="curcard-sym" aria-hidden="true">' + esc(a.symbol) + '</span>' +
            '<div><b>' + esc(a.code) + '</b><small>' + esc(a.name) + '</small></div>' +
            badge(a.status) +
          '</div>' +
          '<p class="curcard-bal">' + esc(fmt.money(a.balance, a.code)) + '</p>' +
          '<p class="curcard-eq">≈ ' + esc(fmt.usd(a.equivalentUsd)) + '</p>' +
          '<canvas class="curcard-spark" data-spark="' + sparkSeries(a.code + a.balance, a.equivalentUsd).join(',') + '" data-spark-color="' + PAL[i % PAL.length] + '" aria-hidden="true"></canvas>' +
          '<span class="curcard-link">' + icon('arrow-r', 14) + ' View account</span>' +
        '</a>';
      }

      return '<section class="ov-hero" aria-label="Total balance">' +
          '<div class="ov-hero-glow" aria-hidden="true"></div>' +
          '<div class="ov-hero-main">' +
            '<p class="ov-label">' + icon('wallet', 15) + ' Total balance · USD equivalent</p>' +
            '<p class="ov-total"><span data-countup="' + total + '" data-countup-money="1">' + esc(fmt.usd(total)) + '</span></p>' +
            '<p class="ov-sub">Across ' + accs.length + ' currency account' + (accs.length === 1 ? '' : 's') +
              ' · <span class="ov-demo">' + icon('info', 12) + ' demo data</span></p>' +
          '</div>' +
          '<div class="ov-hero-side">' +
            '<div class="ov-chips">' + chips + '</div>' +
            '<div class="ov-actions">' +
              '<a class="btn btn-light" href="#/deposits">' + icon('arrow-up', 15) + ' Deposit</a>' +
              '<a class="btn btn-outline" href="#/activate">' + icon('plus', 15) + ' Activate currency</a>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="stat-row" aria-label="Account stats">' +
          statCard('coins', 'Active currencies', String(accs.length), 'of 5 supported', 'currencies-' + accs.length, PAL[0]) +
          statCard('bell', 'Unread notifications', String(GL.unreadCount ? GL.unreadCount() : 0), 'awaiting your attention', 'notifs', PAL[2]) +
          statCard('shield-check', 'Multi-factor auth',
            sec.mfaEnabled ? '<span class="badge b-active">on</span>' : '<span class="badge b-unavailable">off</span>',
            'manage in Security', 'mfa-' + (sec.mfaEnabled ? 1 : 0), PAL[1]) +
          statCard('alert', 'Suspicious events', String((sec.suspicious || []).length), 'in security history', 'suspicious', PAL[3]) +
        '</section>' +

        '<section class="ov-grid">' +
          '<div class="panel">' +
            '<div class="panel-head"><h2>My currencies</h2><a class="panel-link" href="#/accounts">Manage accounts ' + icon('arrow-r', 13) + '</a></div>' +
            (accs.length
              ? '<div class="curcards">' + accs.map(curCard).join('') + '</div>'
              : emptyState('wallet', 'No currencies yet', 'Activate your first currency to get started.',
                  '<a class="btn btn-primary" href="#/activate">Activate a currency</a>')) +
          '</div>' +
          '<div class="panel">' +
            '<div class="panel-head"><h2>Distribution</h2><span class="panel-chip">demo data</span></div>' +
            (total > 0
              ? '<div class="donut-wrap"><canvas data-donut aria-label="Currency distribution chart"></canvas></div>' +
                '<ul class="donut-legend">' + accs.map(function (a, i) {
                    return '<li><span class="legend-dot" style="background:' + PAL[i % PAL.length] + '" aria-hidden="true"></span>' +
                      esc(a.code) + '<b>' + esc(fmt.usd(a.equivalentUsd)) + '</b></li>';
                  }).join('') + '</ul>'
              : '<div class="empty-mini">' + icon('chart', 22) + '<p>No balance to chart yet — make a deposit to see the distribution.</p></div>') +
          '</div>' +
        '</section>' +

        '<section class="ov-grid2">' +
          '<div class="panel">' +
            '<div class="panel-head"><h2>Recent transactions</h2><a class="panel-link" href="#/transactions">View all ' + icon('arrow-r', 13) + '</a></div>' +
            (txns.length
              ? '<div class="table-wrap"><table>' +
                  '<thead><tr><th>Reference</th><th>Description</th><th>Cur.</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>' +
                  '<tbody>' + txns.map(txnRow).join('') + '</tbody></table></div>'
              : emptyState('receipt', 'No transactions yet', 'Successful deposits and fees will appear here.',
                  '<a class="btn btn-primary" href="#/deposits">Make a deposit</a>')) +
          '</div>' +
          '<div class="ov-side">' +
            '<div class="panel">' +
              '<div class="panel-head"><h2>Notifications</h2><a class="panel-link" href="#/notifications">All ' + icon('arrow-r', 13) + '</a></div>' +
              (notifs.length
                ? '<ul class="notif-preview">' + notifs.map(notifRow).join('') + '</ul>'
                : '<div class="empty-mini">' + icon('bell', 22) + '<p>Nothing yet — account events appear here.</p></div>') +
            '</div>' +
            '<div class="panel">' +
              '<div class="panel-head"><h2>Security</h2><a class="panel-link" href="#/security">Manage ' + icon('arrow-r', 13) + '</a></div>' +
              '<ul class="secsum">' +
                '<li><span aria-hidden="true">' + icon('shield-check', 16) + '</span>Multi-factor auth<b>' +
                  (sec.mfaEnabled ? '<span class="badge b-active">on</span>' : '<span class="badge b-unavailable">off</span>') + '</b></li>' +
                '<li><span aria-hidden="true">' + icon('history', 16) + '</span>Sign-in events<b>' + (sec.loginHistory || []).length + '</b></li>' +
                '<li><span aria-hidden="true">' + icon('alert', 16) + '</span>Suspicious events<b class="' + ((sec.suspicious || []).length ? 'txt-danger' : '') + '">' +
                  (sec.suspicious || []).length + '</b></li>' +
              '</ul>' +
            '</div>' +
          '</div>' +
        '</section>';
    },

    /* ================================================================ accounts */
    accounts: function (S) {
      var me = S.me;
      if (!me) return sessionExpired();
      var accs = me.accounts || [];
      var have = {};
      accs.forEach(function (a) { have[a.code] = 1; });
      var canAdd = (GL.CURRENCIES || []).filter(function (c) { return !have[c.code] && curStatus(c.code) === 'active'; });

      function accountCard(a) {
        return '<article class="account-card">' +
          '<div class="account-card-head">' +
            '<span class="curcard-sym lg" aria-hidden="true">' + esc(a.symbol) + '</span>' +
            '<div><h3>' + esc(a.code) + '</h3><p>' + esc(a.name) + '</p></div>' +
            badge(a.status) +
          '</div>' +
          '<p class="account-bal">' + esc(fmt.money(a.balance, a.code)) + '</p>' +
          '<p class="account-eq">≈ ' + esc(fmt.usd(a.equivalentUsd)) + ' · opened ' + esc(fmt.date(a.openedAt)) + '</p>' +
          '<p class="account-meta">' + icon('receipt', 14) + ' ' + a.txCount + ' transaction' + (a.txCount === 1 ? '' : 's') + '</p>' +
          '<a class="btn btn-primary btn-sm" href="#/account/' + esc(a.code) + '">View account</a>' +
        '</article>';
      }

      return '<div class="acc-totalbar">' +
          '<div><p class="stat-label">Total · USD equivalent</p><p class="acc-total">' + esc(fmt.usd(me.totalUsd || 0)) + '</p></div>' +
          '<div><p class="stat-label">Currency accounts</p><p class="acc-total">' + accs.length + '</p></div>' +
          '<span class="panel-chip">' + icon('info', 13) + ' demo data</span>' +
          '<a class="btn btn-primary btn-sm" href="#/deposits">' + icon('arrow-up', 14) + ' New deposit</a>' +
        '</div>' +
        (accs.length
          ? '<div class="grid-cards">' + accs.map(accountCard).join('') + '</div>'
          : emptyState('wallet', 'No currency accounts', 'Activate your first currency — it opens at a zero balance.',
              '<a class="btn btn-primary" href="#/activate">Activate a currency</a>')) +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Available to activate</h2><a class="panel-link" href="#/activate">Activate page ' + icon('arrow-r', 13) + '</a></div>' +
          (canAdd.length
            ? '<div class="addc-row">' + canAdd.map(function (c) {
                return '<a class="add-chip" href="#/activate"><b aria-hidden="true">' + esc(c.symbol) + '</b>' +
                  '<span><strong>' + esc(c.code) + '</strong> — ' + esc(c.name) + '</span><em>Activate ' + icon('arrow-r', 12) + '</em></a>';
              }).join('') + '</div>'
            : '<div class="empty-mini">' + icon('check-circle', 22) + '<p>All supported currencies are active on your account.</p></div>') +
        '</section>';
    },

    /* ================================================================= account */
    account: function (S) {
      if (S.data.accountError) {
        return emptyState('x-circle', 'Account not found', S.data.accountError,
          '<a class="btn btn-primary" href="#/accounts">Back to accounts</a>');
      }
      var d = S.data.account;
      if (!d) return sessionExpired();
      var a = d.account;
      var txns = d.transactions || [];
      var deps = d.deposits || [];

      return '<a class="backlink" href="#/accounts">' + icon('chevron-l', 14) + ' All accounts</a>' +
        '<section class="account-hero">' +
          '<div class="account-hero-main">' +
            '<div class="account-card-head">' +
              '<span class="curcard-sym xl" aria-hidden="true">' + esc(a.symbol) + '</span>' +
              '<div><h2>' + esc(a.code) + ' — ' + esc(a.name) + '</h2>' +
              '<p>Opened ' + esc(fmt.date(a.openedAt)) + ' · ' + a.txCount + ' transaction' + (a.txCount === 1 ? '' : 's') + '</p></div>' +
              badge(a.status) +
            '</div>' +
            '<p class="account-bal xl">' + esc(fmt.money(a.balance, a.code)) + '</p>' +
            '<p class="account-eq">≈ ' + esc(fmt.usd(a.equivalentUsd)) + ' at indicative demo rates</p>' +
          '</div>' +
          '<div class="account-hero-side">' +
            '<span class="panel-chip">' + icon('info', 13) + ' demo data</span>' +
            '<a class="btn btn-primary" href="#/deposits">' + icon('arrow-up', 15) + ' Deposit ' + esc(a.code) + '</a>' +
            '<a class="btn btn-ghost" href="#/statements">' + icon('doc', 15) + ' Statements</a>' +
          '</div>' +
        '</section>' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Transactions</h2><span class="panel-chip">' + esc(a.code) + ' ledger</span></div>' +
          (txns.length
            ? '<div class="table-wrap"><table>' +
                '<thead><tr><th>Reference</th><th>Description</th><th>Cur.</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>' +
                '<tbody>' + txns.map(txnRow).join('') + '</tbody></table></div>'
            : emptyState('receipt', 'No transactions', 'This currency has no ledger entries yet — successful deposits will appear here.',
                '<a class="btn btn-primary" href="#/deposits">Make a deposit</a>')) +
        '</section>' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Deposit records</h2><a class="panel-link" href="#/deposits">New deposit ' + icon('arrow-r', 13) + '</a></div>' +
          (deps.length
            ? '<div class="table-wrap"><table>' +
                '<thead><tr><th>Reference</th><th>Cur.</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>' +
                '<tbody>' + deps.map(depRow).join('') + '</tbody></table></div>'
            : emptyState('arrow-up', 'No deposits', 'Deposit attempts for this currency — successful, pending, failed or cancelled — will be listed here.')) +
        '</section>';
    },

    /* ================================================================ activate */
    activate: function (S) {
      var list = S.data.currencies;
      if (!list) return sessionExpired();

      function actCard(c) {
        var mine = c.activeForMe;
        var off = c.status !== 'active';
        return '<article class="act-card' + (off ? ' is-off' : '') + (mine ? ' is-mine' : '') + '">' +
          '<div class="act-head">' +
            '<span class="curcard-sym" aria-hidden="true">' + esc(c.symbol) + '</span>' +
            '<div><h3>' + esc(c.code) + '</h3><p>' + esc(c.name) + '</p></div>' +
            (c.isDefault ? '<span class="chip chip-default">' + icon('star', 12) + ' Default</span>' : '') +
          '</div>' +
          '<p class="act-rate">' + (c.rateToUsd ? '1 ' + esc(c.code) + ' ≈ $' + esc(fmt.num(c.rateToUsd)) : 'No demo rate') + '</p>' +
          (mine
            ? '<div class="act-state"><span class="badge b-active">active</span>' +
              '<a class="btn btn-ghost btn-sm" href="#/account/' + esc(c.code) + '">View account ' + icon('arrow-r', 12) + '</a></div>'
            : off
              ? '<div class="act-state"><button class="btn btn-sm" type="button" disabled>' + icon('clock', 14) + ' Temporarily unavailable</button></div>' +
                (c.note ? '<p class="act-note">' + icon('info', 13) + ' ' + esc(c.note) + '</p>' : '')
              : '<div class="act-state"><button class="btn btn-primary btn-sm" type="button" data-action="activate:currency" data-code="' + esc(c.code) + '">' +
                  icon('plus', 14) + ' Activate ' + esc(c.code) + '</button></div>') +
          (mine ? '' : '<p class="act-zero">Opens at ' + esc(fmt.money(0, c.code)) + ' — balances are never converted.</p>') +
        '</article>';
      }

      return '<div class="page-callout">' + icon('info', 16) +
          '<p><b>New accounts always start at a zero balance.</b> Activating a currency never converts or moves funds — each currency keeps its own balance, history and deposits.</p>' +
        '</div>' +
        '<div class="act-grid">' + list.map(actCard).join('') + '</div>' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Request a currency</h2><span class="panel-chip">service-layer check</span></div>' +
          '<p class="muted">Don’t see the currency you need? Enter its code — unsupported codes are rejected by the service layer with a clear error, which this page demonstrates.</p>' +
          '<form data-form="currencyRequest" novalidate class="cur-req">' +
            '<div class="field">' +
              '<label for="req-code">Currency code</label>' +
              '<input id="req-code" name="code" type="text" placeholder="e.g. INR" autocomplete="off">' +
              '<p class="field-err" hidden></p>' +
            '</div>' +
            '<p class="req-note" data-currency-request-note hidden></p>' +
            '<button class="btn btn-primary" type="submit">' + icon('send', 14) + ' Request activation</button>' +
          '</form>' +
        '</section>';
    },

    /* =================================================================== bind */
    bind: function (root) {
      try {
        /* sparklines (visual only — decorative demo series) */
        slice(root.querySelectorAll('canvas[data-spark]')).forEach(function (cv) {
          var vals = String(cv.getAttribute('data-spark') || '').split(',').map(function (n) { return Number(n); })
            .filter(function (n) { return !isNaN(n); });
          if (vals.length > 1) GL.charts.spark(cv, { values: vals, color: cv.getAttribute('data-spark-color') || '#1F6FEB' });
        });
        /* currency distribution donut (canvas exists only after render) */
        slice(root.querySelectorAll('canvas[data-donut]')).forEach(function (cv) {
          var st = GL.S;
          if (!st || !st.me || !st.me.accounts || !st.me.accounts.length) return;
          var segs = st.me.accounts.map(function (a, i) {
            return { value: Math.max(Number(a.equivalentUsd) || 0, 0), color: PAL[i % PAL.length], label: a.code };
          });
          GL.charts.donut(cv, { segments: segs, centre: 'USD' });
        });
        /* deposit form: initial method availability for the selected currency */
        slice(root.querySelectorAll('form[data-form="depForm"]')).forEach(updateDepMethods);
        /* restore txn live-search focus after the engine re-renders */
        var si = root.querySelector('form[data-form="txnFilters"] input[name="search"]');
        if (si && document.body.getAttribute('data-txnfocus') === '1') {
          si.focus();
          try { si.setSelectionRange(si.value.length, si.value.length); } catch (e) {}
        }
        if (!_wired) { _wired = true; wireDocument(); }
      } catch (e) { /* visuals only — never break the view */ }
    }
  };

  /* ---------------------------------------------------- OTP view builder ---- */
  function otpView(S, channel) {
    var isPhone = channel === 'phone';
    var p = null;
    try { p = GL.api.demo.pendingOtp(); } catch (e) {}
    var code = isPhone ? ((p && p.phoneOtp) || (S.demoOtp && S.demoOtp.phone) || null)
                       : ((p && p.emailOtp) || (S.demoOtp && S.demoOtp.email) || null);
    var email = '';
    try { email = (GL.currentPendingEmail && GL.currentPendingEmail()) || (p && p.email) || ''; } catch (e) {}
    var phoneHint = (S.wizard && S.wizard.form && S.wizard.form.phone) ? fmt.maskPhone(String(S.wizard.form.phone)) : 'your phone';
    var boxes = '';
    for (var i = 1; i <= 6; i++) {
      boxes += '<input class="otp-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit ' + i + '">';
    }
    return '<div class="auth-head">' +
        '<span class="auth-ic">' + icon(isPhone ? 'smartphone' : 'mail', 26) + '</span>' +
        '<h2>Verify your ' + (isPhone ? 'phone' : 'email') + '</h2>' +
        '<p class="muted">Enter the 6-digit code sent to <b>' + esc(isPhone ? phoneHint : (email ? fmt.maskEmail(email) : 'your email')) + '</b>.</p>' +
      '</div>' +
      (code ? '<p class="preview-note">' + icon('info', 14) + ' Demo mode — your code is <b>' + esc(code) + '</b></p>' : '') +
      '<form data-form="' + (isPhone ? 'verifyPhoneForm' : 'verifyEmailForm') + '" novalidate>' +
        '<div class="otp-input" aria-label="6-digit code">' + boxes + '</div>' +
        '<input type="hidden" name="otp" value="">' +
        '<p class="otp-err" hidden></p>' +
        '<button class="btn btn-primary btn-block" type="submit">Verify ' + (isPhone ? 'phone' : 'email') + '</button>' +
      '</form>' +
      '<div class="otp-resend">' +
        '<button class="btn btn-ghost btn-sm" type="button" data-action="otp:resend" data-channel="' + channel + '">Resend code</button>' +
        '<span class="countdown" data-countdown="otp-' + channel + '"></span>' +
      '</div>' +
      '<p class="auth-alt"><a href="#/login">Back to sign in</a></p>';
  }

  /* -------------------------------------------------- document-level wiring - */
  var _wired = false;
  function closeNav() {
    document.body.classList.remove('nav-open');
    var t = document.querySelector('[data-shell-nav-toggle]');
    if (t) t.setAttribute('aria-expanded', 'false');
  }
  function updateDepMethods(form) {
    if (!form) return;
    var sel = form.querySelector('select[name="currency"]');
    var cur = sel ? sel.value : '';
    var hidden = form.querySelector('input[name="method"]');
    var current = hidden ? hidden.value : '';
    var firstOk = null;
    slice(form.querySelectorAll('.method-card')).forEach(function (card) {
      var cs = card.getAttribute('data-currencies');
      var ok = !cs || !cur || cs.split(',').indexOf(cur) > -1;
      card.classList.toggle('is-off', !ok);
      if (ok && !firstOk) firstOk = card;
      if (!ok && card.getAttribute('data-method') === current) current = '';
    });
    if (hidden) {
      if (!current && firstOk) current = firstOk.getAttribute('data-method');
      hidden.value = current || '';
      slice(form.querySelectorAll('.method-card')).forEach(function (card) {
        var on = !!current && card.getAttribute('data-method') === current;
        card.classList.toggle('is-on', on);
        card.setAttribute('aria-pressed', String(on));
      });
    }
    var lim = form.querySelector('[data-dep-limits]');
    if (lim) {
      var L = cur && GL.DEPOSIT_LIMITS && GL.DEPOSIT_LIMITS[cur];
      lim.textContent = L ? 'Min ' + fmt.money(L[0], cur) + ' · Max ' + fmt.money(L[1], cur)
                          : 'Choose a currency to see limits.';
    }
  }
  function previewStatement(id, btn) {
    btn.disabled = true;
    GL.api.statements.get(id).then(function (res) {
      var st = res.data;
      var rows = (st.lines || []).map(function (t) {
        var neg = Number(t.amount) < 0;
        return '<tr><td>' + esc(fmt.date(t.ts)) + '</td><td>' + esc(t.description) + '</td>' +
          '<td class="td-amount ' + (neg ? 'neg' : 'pos') + '">' + esc(fmt.money(t.amount, st.currency)) + '</td>' +
          '<td>' + badge(t.status) + '</td></tr>';
      }).join('') || '<tr><td colspan="4" class="muted">No movements recorded in this period.</td></tr>';
      GL.modal({
        title: 'Statement preview — ' + st.period,
        html: '<p class="modal-sub">' + esc(st.currency) + ' account · opening ' + esc(fmt.money(st.opening, st.currency)) +
          ' → closing ' + esc(fmt.money(st.closing, st.currency)) + ' · demo text file</p>' +
          '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>',
        cancel: 'Close'
      });
    }).catch(GL.fail).then(function () { btn.disabled = false; });
  }
  function wireDocument() {
    /* shell sidebar: off-canvas drawer + scrim (mobile) */
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var t = e.target.closest('[data-shell-nav-toggle]');
      if (t) {
        var open = document.body.classList.toggle('nav-open');
        t.setAttribute('aria-expanded', String(open));
        return;
      }
      if (e.target.closest('[data-scrim]')) { closeNav(); return; }
      if (e.target.closest('.sidenav a')) closeNav();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });

    /* deposit form: method availability follows the selected currency */
    document.addEventListener('change', function (e) {
      var sel = e.target;
      if (sel && sel.matches && sel.matches('form[data-form="depForm"] select[name="currency"]')) {
        updateDepMethods(sel.closest('form'));
      }
    });

    /* deposit form: method card selection (visual radio cards + hidden input
       the engine reads — formData collects the hidden input's value) */
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var card = e.target.closest('.method-card[data-method]');
      if (!card) return;
      var form = card.closest('form');
      if (!form || form.getAttribute('data-form') !== 'depForm') return;
      if (card.classList.contains('is-off')) return;
      var hidden = form.querySelector('input[name="method"]');
      if (hidden) hidden.value = card.getAttribute('data-method');
      slice(form.querySelectorAll('.method-card')).forEach(function (c) {
        var on = c === card;
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-pressed', String(on));
      });
    });

    /* statement preview (calls the API, shows the lines in a modal) */
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var b = e.target.closest('[data-stmt-preview]');
      if (b) previewStatement(b.getAttribute('data-stmt-preview'), b);
    });

    /* remember txn live-search focus across the engine's re-render */
    document.addEventListener('focusin', function (e) {
      var t = e.target;
      if (t && t.matches && t.matches('form[data-form="txnFilters"] input[name="search"]')) {
        document.body.setAttribute('data-txnfocus', '1');
      } else if (t && t.removeAttribute) {
        document.body.removeAttribute('data-txnfocus');
      }
    });
  }

  /* helpers shared with views-more.js */
  GL.HK = {
    badge: badge, methodLabel: methodLabel, curStatus: curStatus, emptyState: emptyState,
    sessionExpired: sessionExpired, txnRow: txnRow, notifRow: notifRow, depRow: depRow,
    sparkSeries: sparkSeries, PAL: PAL, slice: slice
  };
})();
