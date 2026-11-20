/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — shared/api.js
   FRONTEND INTEGRATION LAYER (the backend seam).

   Every screen — customer app (all three designs) and the React admin apps —
   talks to this facade ONLY. Each method resolves against the demo dataset
   in localStorage with simulated latency, so every loading / empty / error
   state in the UI is a real state.

   WHEN THE BACKEND EXISTS: replace each method body with a fetch() to the
   corresponding endpoint (documented in docs/SPEC.md) and keep the
   signature. No screen code changes.

   Response envelope (consistent everywhere):
     { success: true,  message?: string, data: any, meta?: any }
   Rejections: ApiError { code, status, message, data? }
   ========================================================================== */
window.GL = window.GL || {};
(function () {
  var LS = {
    get: function (k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  GL.LS = LS;

  /* ---------------- errors + latency ---------------- */
  function ApiError(code, status, message, data) {
    var e = new Error(message); e.name = 'ApiError'; e.code = code; e.status = status; e.data = data || null; return e;
  }
  function ok(data, message, meta) { return { success: true, message: message || '', data: data, meta: meta || null }; }
  function delay(min, max) { return new Promise(function (r) { setTimeout(r, (min || 220) + Math.random() * ((max || 600) - (min || 220))); }); }

  /* ---------------- demo store (single source of truth) ----------------
     The parsed db is CACHED so every reference shares one object; the cache
     is invalidated on cross-tab storage events and explicit reset. */
  var DB_KEY = 'gl_db_v1';
  var _dbCache = null;
  var store = {
    get db() {
      if (_dbCache) return _dbCache;
      var v = LS.get(DB_KEY, null);
      if (!v || v.version !== 1) { v = GL.seedDb(); LS.set(DB_KEY, v); }
      _dbCache = v; return v;
    },
    set db(v) { _dbCache = v; LS.set(DB_KEY, v); }
  };
  GL.db = function () { return store.db; };
  GL.saveDb = function (v) { store.db = v; };
  GL.resetDb = function () { _dbCache = null; LS.del(DB_KEY); return store.db; };

  /* ============================================================================
     FORMATTERS + UTILITIES (shared by all apps, including React)
     ========================================================================== */
  GL.fmt = {
    money: function (amount, code) {
      var n = Number(amount) || 0;
      try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).format(n); }
      catch (e) { var c = GL.CURRENCIES.filter(function (x) { return x.code === code; })[0]; return (c ? c.symbol : '') + n.toFixed(2); }
    },
    usd: function (n) { return GL.fmt.money(Number(n) || 0, 'USD'); },
    num: function (n) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(n) || 0); },
    date: function (ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); },
    dateTime: function (ts) { return GL.fmt.date(ts) + ', ' + GL.fmt.time(ts); },
    time: function (ts) { return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); },
    month: function (ts) { return new Date(ts).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); },
    monthShort: function (ts) { return new Date(ts).toLocaleDateString('en-GB', { month: 'short' }); },
    timeAgo: function (ts) {
      var s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
      if (s < 60) return 'just now';
      var m = Math.floor(s / 60); if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
      var h = Math.floor(m / 60); if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
      var d = Math.floor(h / 24); if (d < 31) return d + (d === 1 ? ' day ago' : ' days ago');
      return GL.fmt.date(ts);
    },
    maskEmail: function (e) { return String(e).replace(/^(.).*(@.*)$/, '$1•••$2'); },
    maskPhone: function (p) { return String(p).replace(/^(\+\d{2,3}).*(\d{3})$/, '$1 ••• $2'); },
    initials: function (name) { return String(name || '?').split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(''); },
    toUsd: function (amount, code) { return (Number(amount) || 0) * (GL.RATES[code] || 1); }
  };
  GL.util = {
    debounce: function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 250); }; },
    downloadText: function (filename, text) {
      try {
        var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
      } catch (e) { /* demo environment guard */ }
    },
    toCsv: function (rows) {
      return rows.map(function (r) {
        return r.map(function (cell) {
          var s = String(cell == null ? '' : cell);
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',');
      }).join('\n');
    },
    dateInput: function (ts) { var d = new Date(ts); return d.toISOString().slice(0, 10); },
    uid: function (p) { return (p || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  };

  /* ============================================================================
     INTERNAL HELPERS
     ========================================================================== */
  function findUser(id) { return store.db.users.filter(function (u) { return u.id === id; })[0] || null; }
  function findUserByEmail(email) {
    email = String(email || '').trim().toLowerCase();
    return store.db.users.filter(function (u) { return u.email.toLowerCase() === email; })[0] || null;
  }
  function sanitize(u) {
    if (!u) return null;
    var c = JSON.parse(JSON.stringify(u));
    delete c.password; delete c.emailOtp; delete c.phoneOtp; delete c.otpAttempts;
    return c;
  }
  function currencyInfo(code) { return GL.CURRENCIES.filter(function (c) { return c.code === code; })[0] || null; }
  function currencyAvailable(code) { return store.db.settings.currencyStatus[code] === 'active'; }
  function audit(action, target, detail, result) {
    var s = GL.api.session.get();
    var db = store.db;
    db.audit.unshift({ id: 'a-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ts: Date.now(),
      actor: s && s.adminEmail ? s.adminEmail : 'nadia.farouk@meridian.example',
      actorName: s && s.adminName ? s.adminName : 'Nadia Farouk',
      action: action, target: target || '—', detail: detail || '', result: result || 'allowed', ip: '102.89.44.7' });
    store.db = db;
  }
  function notify(userId, title, body, kind) {
    var db = store.db;
    db.notifications.unshift({ id: 'n-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), userId: userId,
      title: title, body: body, ts: Date.now(), read: false, kind: kind || 'info' });
    store.db = db;
  }
  function ledgerBalance(userId, code) {
    return store.db.transactions.reduce(function (s, t) {
      return (t.userId === userId && t.currency === code && t.status === 'successful') ? s + t.amount : s;
    }, 0);
  }
  function accountView(u, a) {
    var info = currencyInfo(a.code) || { code: a.code, name: a.code, symbol: '' };
    return { code: a.code, name: info.name, symbol: info.symbol, status: a.status, balance: a.balance,
      txCount: store.db.transactions.filter(function (t) { return t.userId === u.id && t.currency === a.code; }).length,
      equivalentUsd: Math.round(GL.fmt.toUsd(a.balance, a.code) * 100) / 100, openedAt: a.openedAt };
  }
  function myAccounts(u) { return (u.accounts || []).map(function (a) { return accountView(u, a); }); }
  function refreshBalances(u) { (u.accounts || []).forEach(function (a) { a.balance = ledgerBalance(u.id, a.code); }); }
  function newOtp() { return String(Math.floor(100000 + Math.random() * 900000)); }
  function methodInfo(id) { return GL.DEPOSIT_METHODS.filter(function (m) { return m.id === id; })[0] || null; }
  function methodLabel(id) { var m = methodInfo(id); return m ? m.label : id; }

  /* ============================================================================
     API
     ========================================================================== */
  GL.api = {

    /* ---------------- session ---------------- */
    session: {
      get: function () { return LS.get('gl_session', null); },
      set: function (s) { LS.set('gl_session', s); },
      clear: function () { LS.del('gl_session'); }
    },

    /* ---------------- authentication ---------------- */
    auth: {
      register: function (form) {
        return delay(450, 900).then(function () {
          var db = store.db;
          var name = String(form.fullName || '').trim();
          var email = String(form.email || '').trim().toLowerCase();
          var country = GL.COUNTRIES.filter(function (c) { return c.name === form.country; })[0] || null;
          if (!name || name.split(/\s+/).length < 2) throw ApiError('VALIDATION', 422, 'Please enter your full name (first and last name).');
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw ApiError('VALIDATION', 422, 'Please enter a valid email address.');
          if (!country) throw ApiError('VALIDATION', 422, 'Please select your country.');
          if (!/^\+?[\d\s\-()]{7,18}$/.test(String(form.phone || ''))) throw ApiError('VALIDATION', 422, 'Please enter a valid international phone number.');
          if (findUserByEmail(email)) throw ApiError('EMAIL_TAKEN', 409, 'An account with this email already exists. Try signing in instead.');
          if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/.test(form.password || '')) throw ApiError('WEAK_PASSWORD', 422, 'Password must be at least 8 characters and contain uppercase, lowercase and a number.');
          if (form.password !== form.confirm) throw ApiError('VALIDATION', 422, 'Passwords do not match.');
          if (!form.agree) throw ApiError('VALIDATION', 422, 'Please confirm you understand this is a demonstration environment.');
          var u = {
            id: 'u-' + Date.now().toString(36), name: name,
            firstName: name.split(/\s+/)[0], lastName: name.split(/\s+/).slice(1).join(' '),
            email: email, phone: (country.dial + ' ' + String(form.phone).replace(/^[+0-9]+/, '')).trim(),
            countryCode: country.code, country: country.name, password: form.password,
            role: 'customer', status: 'active', verification: { email: false, phone: false },
            emailOtp: newOtp(), phoneOtp: newOtp(), otpAttempts: { email: 0, phone: 0 },
            defaultCurrency: country.currency,
            accounts: [{ code: country.currency, status: 'pending', balance: 0, openedAt: Date.now() }],
            mfaEnabled: false, prefs: { emailNotifs: true, pushNotifs: true, weeklySummary: false },
            createdAt: Date.now(), address: '', accountId: 'MGA-' + (2000 + Math.floor(Math.random() * 7999)) + '-' + (1000 + Math.floor(Math.random() * 8999))
          };
          db.users.push(u); store.db = db;
          return ok({ userId: u.id, defaultCurrency: u.defaultCurrency, email: u.email },
            'Account created. Verify your email to continue.', { demoEmailOtp: u.emailOtp });
        });
      },

      verifyEmail: function (email, code) {
        return delay(350, 700).then(function () {
          var u = findUserByEmail(email);
          if (!u) throw ApiError('NOT_FOUND', 404, 'No pending registration found for this email.');
          if (u.verification.email) return ok({ stage: 'phone' }, 'Email already verified.');
          if ((u.otpAttempts.email || 0) >= 5) throw ApiError('OTP_LOCKED', 429, 'Too many attempts. Please resend a new code.');
          if (String(code) !== String(u.emailOtp)) {
            var db = store.db; u.otpAttempts.email = (u.otpAttempts.email || 0) + 1; store.db = db;
            throw ApiError('INVALID_OTP', 422, 'Incorrect code. Attempts left: ' + (5 - u.otpAttempts.email));
          }
          var db2 = store.db; u.verification.email = true; store.db = db2;
          return ok({ stage: 'phone' }, 'Email verified. Now verify your phone.', { demoPhoneOtp: u.phoneOtp });
        });
      },

      verifyPhone: function (email, code) {
        return delay(350, 700).then(function () {
          var u = findUserByEmail(email);
          if (!u) throw ApiError('NOT_FOUND', 404, 'No pending registration found for this email.');
          if ((u.otpAttempts.phone || 0) >= 5) throw ApiError('OTP_LOCKED', 429, 'Too many attempts. Please resend a new code.');
          if (String(code) !== String(u.phoneOtp)) {
            var db = store.db; u.otpAttempts.phone = (u.otpAttempts.phone || 0) + 1; store.db = db;
            throw ApiError('INVALID_OTP', 422, 'Incorrect code. Attempts left: ' + (5 - u.otpAttempts.phone));
          }
          var db2 = store.db; u.verification.phone = true;
          /* the country-based default currency activates automatically once verification completes */
          (u.accounts || []).forEach(function (a) { if (a.code === u.defaultCurrency && a.status === 'pending') a.status = 'active'; });
          store.db = db2;
          notify(u.id, 'Welcome to Meridian', 'Your ' + u.defaultCurrency + ' account is active with a zero balance. This is a demonstration environment — no real money is involved.', 'success');
          return ok({ verified: true, defaultCurrency: u.defaultCurrency, accountId: u.accountId }, 'Phone verified. Your ' + u.defaultCurrency + ' account is now active.');
        });
      },

      resendOtp: function (email, channel) {
        return delay(400, 800).then(function () {
          var u = findUserByEmail(email);
          if (!u) throw ApiError('NOT_FOUND', 404, 'No pending registration found for this email.');
          var db = store.db;
          var code = newOtp();
          if (channel === 'phone') { u.phoneOtp = code; u.otpAttempts.phone = 0; } else { u.emailOtp = code; u.otpAttempts.email = 0; }
          store.db = db;
          return ok({ sent: true }, 'A new code has been sent (simulated — no real message is delivered).', { demoOtp: code });
        });
      },

      login: function (email, password) {
        return delay(450, 900).then(function () {
          var u = findUserByEmail(email);
          if (!u || u.password !== password) throw ApiError('INVALID_CREDENTIALS', 401, 'Incorrect email or password.');
          if (u.role !== 'customer') throw ApiError('NOT_ADMIN', 403, 'This is an administrator account. Use the admin console.');
          if (!u.verification.email) throw ApiError('VERIFICATION_REQUIRED', 403, 'Please verify your email to continue.', { stage: 'email', email: u.email });
          if (!u.verification.phone) throw ApiError('VERIFICATION_REQUIRED', 403, 'Please verify your phone to continue.', { stage: 'phone', email: u.email });
          if (u.status === 'frozen') throw ApiError('ACCOUNT_FROZEN', 423, 'Your account is temporarily frozen.', { reason: u.freezeReason || 'Contact support for details.' });
          GL.api.session.set({ kind: 'user', userId: u.id, ts: Date.now() });
          return ok({ user: sanitize(u) }, 'Signed in.');
        });
      },

      logout: function () {
        return delay(150, 300).then(function () {
          var s = GL.api.session.get();
          if (s && s.kind === 'takeover') audit('takeover_end', s.userId, 'Takeover ended by sign-out.');
          GL.api.session.clear();
          return ok({ done: true }, 'Signed out.');
        });
      },

      forgotPassword: function (email) {
        return delay(400, 800).then(function () {
          var u = findUserByEmail(email);
          if (!u) throw ApiError('NOT_FOUND', 404, 'No account found with this email.');
          var token = 'demo-reset-' + Math.random().toString(36).slice(2, 10);
          var db = store.db; db.resetTokens = db.resetTokens || {}; db.resetTokens[token] = { userId: u.id, ts: Date.now() }; store.db = db;
          /* no real email is sent — the demo token is returned so the flow can be completed */
          return ok({ token: token }, 'Reset link sent (simulated).', { demoToken: token });
        });
      },

      resetPassword: function (token, password, confirm) {
        return delay(400, 800).then(function () {
          var db = store.db; var t = (db.resetTokens || {})[token];
          if (!t || Date.now() - t.ts > 30 * 60000) throw ApiError('INVALID_TOKEN', 400, 'This reset link is invalid or has expired.');
          if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/.test(password || '')) throw ApiError('WEAK_PASSWORD', 422, 'Password must be at least 8 characters and contain uppercase, lowercase and a number.');
          if (password !== confirm) throw ApiError('VALIDATION', 422, 'Passwords do not match.');
          var u = findUser(t.userId); u.password = password; delete db.resetTokens[token]; store.db = db;
          return ok({ done: true }, 'Password updated. You can now sign in.');
        });
      }
    },

    /* ---------------- customer account ---------------- */
    account: {
      me: function () {
        return delay(200, 450).then(function () {
          var s = GL.api.session.get();
          if (!s || (s.kind !== 'user' && s.kind !== 'takeover')) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var u = findUser(s.userId); if (!u) { GL.api.session.clear(); throw ApiError('UNAUTHENTICATED', 401, 'Session expired.'); }
          refreshBalances(u);
          var accounts = myAccounts(u);
          var totalUsd = Math.round(accounts.reduce(function (s2, a) { return s2 + a.equivalentUsd; }, 0) * 100) / 100;
          return ok({ user: sanitize(u), accounts: accounts, totalUsd: totalUsd, rates: GL.RATES,
            mode: s.kind === 'takeover' ? 'admin-takeover' : 'customer' });
        });
      },

      get: function (code) {
        return delay(250, 500).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var u = findUser(s.userId); refreshBalances(u);
          var a = (u.accounts || []).filter(function (x) { return x.code === code; })[0];
          if (!a) throw ApiError('NOT_FOUND', 404, 'No ' + code + ' account. Activate it first.');
          var txns = store.db.transactions.filter(function (t) { return t.userId === u.id && t.currency === code; })
            .sort(function (x, y) { return y.ts - x.ts; });
          var deps = store.db.deposits.filter(function (t) { return t.userId === u.id && t.currency === code; })
            .sort(function (x, y) { return y.createdAt - x.createdAt; });
          return ok({ account: accountView(u, a), transactions: txns, deposits: deps });
        });
      },

      updateProfile: function (patch) {
        return delay(350, 700).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var u = findUser(s.userId);
          var whitelist = ['firstName', 'lastName', 'phone', 'address'];
          Object.keys(patch || {}).forEach(function (k) {
            if (whitelist.indexOf(k) === -1) throw ApiError('FORBIDDEN_FIELD', 403, 'Field "' + k + '" cannot be edited here.');
          });
          var db = store.db;
          Object.assign(u, patch);
          u.name = ((u.firstName || '') + ' ' + (u.lastName || '')).trim();
          store.db = db;
          if (s.kind === 'takeover') audit('profile_edit', u.id + ' · ' + u.name, 'Permitted profile edit during takeover: ' + JSON.stringify(patch) + '. User not auto-notified.');
          return ok({ user: sanitize(u) }, 'Profile updated.');
        });
      },

      changePassword: function (current, next, confirm) {
        return delay(350, 700).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var u = findUser(s.userId);
          if (u.password !== current) throw ApiError('INVALID_CREDENTIALS', 401, 'Current password is incorrect.');
          if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}/.test(next || '')) throw ApiError('WEAK_PASSWORD', 422, 'New password must be at least 8 characters with uppercase, lowercase and a number.');
          if (next !== confirm) throw ApiError('VALIDATION', 422, 'Passwords do not match.');
          var db = store.db; u.password = next; store.db = db;
          notify(u.id, 'Password changed', 'Your password was updated from Security settings.', 'info');
          return ok({ done: true }, 'Password updated.');
        });
      },

      updatePrefs: function (prefs) {
        return delay(250, 450).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var u = findUser(s.userId); var db = store.db;
          u.prefs = Object.assign({}, u.prefs, prefs); store.db = db;
          return ok({ prefs: u.prefs }, 'Preferences saved.');
        });
      }
    },

    /* ---------------- currencies ---------------- */
    currencies: {
      list: function () {
        return delay(200, 400).then(function () {
          var s = GL.api.session.get();
          var me = s ? findUser(s.userId) : null;
          return ok(GL.CURRENCIES.map(function (c) {
            var st = store.db.settings.currencyStatus[c.code] || 'unavailable';
            var mine = me ? (me.accounts || []).filter(function (a) { return a.code === c.code; })[0] : null;
            return { code: c.code, name: c.name, symbol: c.symbol, status: st, note: c.note,
              activeForMe: !!mine, myStatus: mine ? mine.status : null,
              rateToUsd: GL.RATES[c.code] || null, isDefault: me ? me.defaultCurrency === c.code : false };
          }));
        });
      },

      activate: function (code) {
        return delay(450, 850).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var u = findUser(s.userId);
          if (!currencyInfo(code)) throw ApiError('UNSUPPORTED_CURRENCY', 422, code + ' is not a supported currency on this platform.');
          if (!currencyAvailable(code)) {
            var info = currencyInfo(code);
            throw ApiError('CURRENCY_UNAVAILABLE', 422, (info ? info.name : code) + ' is temporarily unavailable for activation.');
          }
          if ((u.accounts || []).filter(function (a) { return a.code === code; }).length) {
            throw ApiError('ALREADY_ACTIVE', 409, 'You already have an active ' + code + ' account.');
          }
          var db = store.db;
          u.accounts.push({ code: code, status: 'active', balance: 0, openedAt: Date.now() });
          store.db = db;
          notify(u.id, code + ' account activated', 'Your ' + code + ' account is active with a zero balance. Existing balances were not converted.', 'success');
          if (s.kind === 'takeover') audit('currency_manage', u.id + ' · ' + u.name, 'Activated ' + code + ' for customer during takeover.');
          return ok({ account: { code: code, balance: 0, status: 'active' } }, code + ' account activated with a zero balance.');
        });
      }
    },

    /* ---------------- deposits (simulated) ---------------- */
    deposits: {
      methods: function (currency) {
        return delay(150, 350).then(function () {
          var list = GL.DEPOSIT_METHODS.filter(function (m) {
            return !m.currencies || m.currencies.indexOf(currency) > -1;
          }).map(function (m) {
            return { id: m.id, label: m.label, icon: m.icon, desc: m.desc, feePct: m.feePct, feeNote: m.feeNote };
          });
          return ok({ methods: list, limits: GL.DEPOSIT_LIMITS[currency] || [10, 50000] });
        });
      },

      initiate: function (form) {
        return delay(500, 1000).then(function () {
          var s = GL.api.session.get();
          if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          if (s.kind === 'takeover') throw ApiError('TAKEOVER_FINANCIAL_BLOCKED', 403, 'Financial operations are blocked during an administrative takeover session.');
          var u = findUser(s.userId);
          var acc = (u.accounts || []).filter(function (a) { return a.code === form.currency && a.status === 'active'; })[0];
          if (!acc) throw ApiError('ACCOUNT_NOT_ACTIVE', 422, 'Activate your ' + form.currency + ' account before depositing.');
          var amount = Number(form.amount);
          if (!amount || isNaN(amount) || amount <= 0) throw ApiError('VALIDATION', 422, 'Enter a deposit amount.');
          var lim = GL.DEPOSIT_LIMITS[form.currency] || [10, 50000];
          if (amount < lim[0]) throw ApiError('VALIDATION', 422, 'Minimum deposit is ' + GL.fmt.money(lim[0], form.currency) + '.');
          if (amount > lim[1]) throw ApiError('VALIDATION', 422, 'Maximum deposit is ' + GL.fmt.money(lim[1], form.currency) + '.');
          var m = methodInfo(form.method);
          if (!m || (m.currencies && m.currencies.indexOf(form.currency) === -1)) throw ApiError('VALIDATION', 422, 'This payment method is not available for ' + form.currency + '.');
          /* feePct is expressed in percent (1.4 = 1.4%); minimum 0.50 currency units */
          var fee = m.feePct ? Math.max(Math.round(amount * (m.feePct / 100) * 100) / 100, 0.5) : 0;
          var db = store.db;
          var ref = 'DEMO-DEP-' + (3300 + db.deposits.length + Math.floor(Math.random() * 40));
          db.deposits.unshift({ reference: ref, userId: u.id, currency: form.currency, amount: amount, method: form.method,
            fee: fee, status: 'pending', createdAt: Date.now(), processedAt: null, outcomeSource: 'gateway' });
          db.payments.unshift({ id: 'DEMO-PAY-' + (1000 + db.payments.length), reference: ref, userId: u.id, method: form.method,
            outcome: 'initiated', durationMs: 0, ts: Date.now(), forced: false });
          store.db = db;
          return ok({ reference: ref, currency: form.currency, amount: amount, method: form.method, methodName: m.label, fee: fee },
            'Deposit initiated. Complete the simulated payment.');
        });
      },

      /* the mock payment service: resolves SUCCESS / PENDING / FAILED / CANCELLED / DUPLICATE */
      confirm: function (reference, action) {
        return delay(700, 1400).then(function () {
          var s = GL.api.session.get();
          if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          if (s.kind === 'takeover') throw ApiError('TAKEOVER_FINANCIAL_BLOCKED', 403, 'Financial operations are blocked during an administrative takeover session.');
          var db = store.db;
          var dep = db.deposits.filter(function (x) { return x.reference === reference; })[0];
          if (!dep) throw ApiError('NOT_FOUND', 404, 'Deposit reference not found.');
          var u = findUser(s.userId);
          var forced = db.forcedOutcome || 'auto';
          function payRecord(outcome) {
            db.payments.unshift({ id: 'DEMO-PAY-' + (1000 + db.payments.length), reference: reference, userId: u.id,
              method: dep.method, outcome: outcome, durationMs: 600 + Math.floor(Math.random() * 1800),
              ts: Date.now(), forced: forced !== 'auto' });
          }
          /* duplicate: reference already processed */
          if (dep.status !== 'pending' || forced === 'duplicate') {
            payRecord('duplicate');
            store.db = db;
            throw ApiError('DUPLICATE_REFERENCE', 409, 'This payment reference has already been processed.');
          }
          if (action === 'cancel') {
            dep.status = 'cancelled'; dep.processedAt = Date.now(); payRecord('cancelled'); store.db = db;
            return ok({ deposit: dep }, 'Payment cancelled. Nothing was credited.');
          }
          var outcome = forced !== 'auto' ? forced : (dep.method === 'bank_transfer' ? 'pending' : 'success');
          dep.outcomeSource = forced !== 'auto' ? 'forced' : 'default';
          if (outcome === 'success') {
            dep.status = 'successful'; dep.processedAt = Date.now();
            db.transactions.unshift({ ref: 'DEMO-TXN-' + (7000 + db.transactions.length + Math.floor(Math.random() * 90)),
              userId: u.id, currency: dep.currency, type: 'deposit', amount: dep.amount, status: 'successful',
              method: dep.method, ts: Date.now(), description: methodLabel(dep.method) + ' — ' + dep.reference });
            payRecord('success'); store.db = db;
            notify(u.id, 'Deposit confirmed', 'Your ' + dep.currency + ' deposit of ' + GL.fmt.money(dep.amount, dep.currency) + ' has been credited.', 'success');
            return ok({ deposit: dep, balanceAfter: ledgerBalance(u.id, dep.currency) }, 'Payment successful. Balance credited.');
          }
          if (outcome === 'pending') {
            payRecord('pending'); store.db = db;
            notify(u.id, 'Deposit pending', 'Your ' + dep.currency + ' deposit of ' + GL.fmt.money(dep.amount, dep.currency) + ' is awaiting confirmation. It is not credited yet.', 'warning');
            return ok({ deposit: dep }, 'Payment is awaiting confirmation. The balance is not credited yet.');
          }
          /* failed */
          dep.status = 'failed'; dep.processedAt = Date.now();
          db.transactions.unshift({ ref: 'DEMO-TXN-' + (7000 + db.transactions.length + Math.floor(Math.random() * 90)),
            userId: u.id, currency: dep.currency, type: 'deposit', amount: dep.amount, status: 'failed',
            method: dep.method, ts: Date.now(), description: methodLabel(dep.method) + ' — ' + dep.reference });
          payRecord('failed'); store.db = db;
          return ok({ deposit: dep }, 'Payment failed. Nothing was credited.');
        });
      },

      list: function (currency) {
        return delay(200, 450).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var list = store.db.deposits.filter(function (d) {
            return d.userId === s.userId && (!currency || d.currency === currency);
          }).sort(function (a, b) { return b.createdAt - a.createdAt; });
          return ok(list);
        });
      }
    },

    /* ---------------- transactions ---------------- */
    transactions: {
      list: function (q) {
        return delay(280, 550).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          q = q || {};
          var items = store.db.transactions.filter(function (t) { return t.userId === s.userId; });
          if (q.search) {
            var srch = String(q.search).toLowerCase();
            items = items.filter(function (t) {
              return (t.ref + ' ' + t.description + ' ' + t.currency + ' ' + t.status + ' ' + methodLabel(t.method)).toLowerCase().indexOf(srch) > -1;
            });
          }
          if (q.currency) items = items.filter(function (t) { return t.currency === q.currency; });
          if (q.status) items = items.filter(function (t) { return t.status === q.status; });
          if (q.from) items = items.filter(function (t) { return t.ts >= new Date(q.from).getTime(); });
          if (q.to) items = items.filter(function (t) { return t.ts < new Date(q.to).getTime() + 864e5; });
          items.sort(function (a, b) { return b.ts - a.ts; });
          var page = q.page || 1, perPage = q.perPage || 10;
          var pages = Math.max(1, Math.ceil(items.length / perPage));
          var slice = items.slice((page - 1) * perPage, page * perPage);
          return ok({ items: slice, total: items.length, page: page, pages: pages });
        });
      },

      get: function (ref) {
        return delay(200, 400).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var t = store.db.transactions.filter(function (x) { return x.ref === ref && x.userId === s.userId; })[0];
          if (!t) throw ApiError('NOT_FOUND', 404, 'Transaction not found.');
          return ok(Object.assign({}, t, { methodName: methodLabel(t.method) }));
        });
      }
    },

    /* ---------------- statements (computed from the ledger) ---------------- */
    statements: {
      list: function () {
        return delay(300, 600).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var u = findUser(s.userId); refreshBalances(u);
          var out = [];
          for (var i = 0; i < 3; i++) {
            var m = new Date(); m.setDate(1); m.setMonth(m.getMonth() - i);
            var start = new Date(m.getFullYear(), m.getMonth(), 1).getTime();
            var end = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime();
            (u.accounts || []).forEach(function (a) {
              var inMonth = store.db.transactions.filter(function (t) {
                return t.userId === u.id && t.currency === a.code && t.ts >= start && t.ts < end;
              });
              if (!inMonth.length && i > 0) return;
              var opening = store.db.transactions.reduce(function (sum, t) {
                return (t.userId === u.id && t.currency === a.code && t.status === 'successful' && t.ts < start) ? sum + t.amount : sum;
              }, 0);
              var closing = inMonth.reduce(function (sum, t) { return t.status === 'successful' ? sum + t.amount : sum; }, opening);
              out.push({
                id: 'DEMO-STMT-' + a.code + '-' + m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0'),
                currency: a.code, period: GL.fmt.month(start), opening: opening, closing: closing,
                count: inMonth.length, ts: end - 1
              });
            });
          }
          return ok(out);
        });
      },

      get: function (id) {
        return delay(250, 500).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var parts = id.split('-'); var code = parts[2]; var y = Number(parts[3]); var m = Number(parts[4]);
          var start = new Date(y, m - 1, 1).getTime(); var end = new Date(y, m, 1).getTime();
          var u = findUser(s.userId);
          var lines = store.db.transactions.filter(function (t) {
            return t.userId === u.id && t.currency === code && t.ts >= start && t.ts < end;
          }).sort(function (a, b) { return a.ts - b.ts; });
          if (!lines.length) throw ApiError('NOT_FOUND', 404, 'Statement not found.');
          var opening = store.db.transactions.reduce(function (sum, t) {
            return (t.userId === u.id && t.currency === code && t.status === 'successful' && t.ts < start) ? sum + t.amount : sum;
          }, 0);
          return ok({ id: id, currency: code, period: GL.fmt.month(start), opening: opening,
            closing: lines.reduce(function (sum, t) { return t.status === 'successful' ? sum + t.amount : sum; }, opening),
            lines: lines });
        });
      },

      download: function (id) {
        return delay(500, 900).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          return GL.api.statements.get(id).then(function (res) {
            var st = res.data; var u = findUser(s.userId);
            var L = [];
            L.push('MERIDIAN GLOBAL ACCOUNTS — ACCOUNT STATEMENT (DEMO)');
            L.push('='.repeat(58));
            L.push('Account holder : ' + u.name + ' (' + u.accountId + ')');
            L.push('Currency       : ' + st.currency);
            L.push('Period         : ' + st.period);
            L.push('Generated      : ' + GL.fmt.dateTime(Date.now()));
            L.push('');
            L.push('THIS IS DEMONSTRATION DATA — NOT A REAL FINANCIAL STATEMENT.');
            L.push('');
            L.push('Opening balance: ' + GL.fmt.money(st.opening, st.currency));
            L.push('');
            L.push('DATE             DESCRIPTION                        AMOUNT        STATUS');
            L.push('-'.repeat(78));
            st.lines.forEach(function (t) {
              L.push(GL.fmt.date(t.ts).padEnd(17) + String(t.description).slice(0, 33).padEnd(34) +
                GL.fmt.money(t.amount, st.currency).padStart(13) + '  ' + t.status.toUpperCase());
            });
            L.push('-'.repeat(78));
            L.push('Closing balance: ' + GL.fmt.money(st.closing, st.currency));
            return ok({ filename: id + '-DEMO.txt', content: L.join('\n') }, 'Statement ready.');
          });
        });
      }
    },

    /* ---------------- notifications ---------------- */
    notifications: {
      list: function (unreadOnly) {
        return delay(180, 400).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var items = store.db.notifications.filter(function (n) { return n.userId === s.userId; })
            .sort(function (a, b) { return b.ts - a.ts; });
          if (unreadOnly) items = items.filter(function (n) { return !n.read; });
          return ok(items);
        });
      },
      markRead: function (id) {
        return delay(120, 300).then(function () {
          var db = store.db; var s = GL.api.session.get();
          db.notifications.forEach(function (n) {
            if (n.userId === s.userId && (id === 'all' || n.id === id)) n.read = true;
          });
          store.db = db;
          return ok({ done: true }, 'Marked as read.');
        });
      }
    },

    /* ---------------- support ---------------- */
    support: {
      tickets: function () {
        return delay(250, 500).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var list = store.db.tickets.filter(function (t) { return t.userId === s.userId; })
            .sort(function (a, b) { return b.createdAt - a.createdAt; });
          return ok(list);
        });
      },
      create: function (form) {
        return delay(450, 850).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          if (!form.subject || !form.message) throw ApiError('VALIDATION', 422, 'Subject and message are required.');
          var db = store.db;
          var t = { id: 't-' + Date.now().toString(36), userId: s.userId, subject: form.subject,
            category: form.category || 'General', status: 'open', createdAt: Date.now(),
            messages: [{ from: 'customer', text: form.message, ts: Date.now() }] };
          db.tickets.unshift(t); store.db = db;
          return ok(t, 'Support request sent. Our demo team will reply shortly.');
        });
      }
    },

    /* ---------------- security ---------------- */
    security: {
      overview: function () {
        return delay(250, 500).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var u = findUser(s.userId);
          var events = store.db.securityEvents.filter(function (e) { return e.userId === s.userId; })
            .sort(function (a, b) { return b.ts - a.ts; });
          return ok({ mfaEnabled: u.mfaEnabled, events: events,
            loginHistory: events.filter(function (e) { return e.type === 'login' || e.type === 'login_failed'; }),
            suspicious: events.filter(function (e) { return e.suspicious; }) });
        });
      },
      sessions: function () {
        return delay(250, 500).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var mine = store.db.sessions.filter(function (x) { return x.userId === s.userId; })
            .sort(function (a, b) { return b.lastActive - a.lastActive; });
          return ok({ active: mine.filter(function (x) { return x.status === 'active'; }),
            history: mine.filter(function (x) { return x.status !== 'active'; }) });
        });
      },
      revokeSession: function (id) {
        return delay(250, 500).then(function () {
          var db = store.db; var ses = db.sessions.filter(function (x) { return x.id === id; })[0];
          if (!ses) throw ApiError('NOT_FOUND', 404, 'Session not found.');
          if (ses.current) throw ApiError('VALIDATION', 400, 'The current session cannot be revoked from here — sign out instead.');
          ses.status = 'revoked'; store.db = db;
          return ok({ done: true }, 'Session revoked.');
        });
      },
      setMfa: function (enabled) {
        return delay(300, 600).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var db = store.db; var u = findUser(s.userId); u.mfaEnabled = !!enabled; store.db = db;
          db.securityEvents.unshift({ id: 'se-' + Date.now().toString(36), userId: u.id,
            type: enabled ? 'mfa_enabled' : 'mfa_disabled', device: 'Account settings', ip: '102.89.44.7',
            location: '—', ts: Date.now(), suspicious: false,
            detail: enabled ? 'Multi-factor authentication enabled' : 'Multi-factor authentication disabled' });
          store.db = db;
          return ok({ mfaEnabled: u.mfaEnabled }, 'MFA ' + (enabled ? 'enabled' : 'disabled') + ' (simulated).');
        });
      },
      freezeSelf: function (reason) {
        return delay(400, 700).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var db = store.db; var u = findUser(s.userId);
          u.status = 'frozen'; u.freezeReason = reason || 'Self-initiated temporary freeze (demo).'; u.frozenAt = Date.now(); u.frozenBy = 'Customer (self)';
          db.securityEvents.unshift({ id: 'se-' + Date.now().toString(36), userId: u.id, type: 'account_frozen',
            device: 'Account settings', ip: '102.89.44.7', location: '—', ts: Date.now(), suspicious: false,
            detail: 'Temporary freeze: ' + u.freezeReason });
          store.db = db;
          return ok({ status: 'frozen', reason: u.freezeReason }, 'Account frozen.');
        });
      },
      unfreezeSelf: function () {
        return delay(400, 700).then(function () {
          var s = GL.api.session.get(); if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Please sign in.');
          var db = store.db; var u = findUser(s.userId);
          if (u.frozenBy === 'Customer (self)') {
            u.status = 'active'; u.freezeReason = null; store.db = db;
            return ok({ status: 'active' }, 'Account unfrozen (demo recovery).');
          }
          throw ApiError('ADMIN_FROZEN', 403, 'This freeze was applied by an administrator for security review. Please contact support.');
        });
      }
    },

    /* ============================================================================
       ADMIN API — requires an administrator session. FINANCIAL RESTRICTIONS
       ARE ENFORCED HERE, in the service layer — not by hiding buttons.
       ========================================================================== */
    admin: {
      login: function (email, password) {
        return delay(450, 900).then(function () {
          var u = findUserByEmail(email);
          if (!u || u.password !== password) throw ApiError('INVALID_CREDENTIALS', 401, 'Incorrect email or password.');
          if (u.role !== 'super-admin') throw ApiError('NOT_ADMIN', 403, 'This account does not have administrator access.');
          GL.api.session.set({ kind: 'admin', adminId: u.id, adminName: u.name, adminEmail: u.email, ts: Date.now() });
          audit('admin_login', '—', 'Administrator signed in (demo).');
          return ok({ admin: sanitize(u) }, 'Signed in.');
        });
      },

      dashboard: function () {
        return delay(300, 600).then(function () {
          requireAdmin();
          var db = store.db;
          var customers = db.users.filter(function (u) { return u.role === 'customer'; });
          var depositsByDay = [];
          for (var i = 29; i >= 0; i--) {
            var day = Date.now() - i * 864e5; var d0 = new Date(day); d0.setHours(0, 0, 0, 0);
            var d1 = d0.getTime() + 864e5;
            var vol = db.deposits.filter(function (x) { return x.createdAt >= d0 && x.createdAt < d1 && x.status === 'successful'; })
              .reduce(function (s, x) { return s + GL.fmt.toUsd(x.amount, x.currency); }, 0);
            depositsByDay.push({ t: d0.getTime(), v: Math.round(vol * 100) / 100 });
          }
          var outcomeMix = ['successful', 'pending', 'failed', 'cancelled', 'duplicate'].map(function (st) {
            return { status: st, count: db.payments.filter(function (p) { return p.outcome === st; }).length };
          });
          var currencyDist = GL.CURRENCIES.filter(function (c) { return c.status === 'active'; }).map(function (c) {
            var v = 0;
            customers.forEach(function (u) {
              (u.accounts || []).forEach(function (a) { if (a.code === c.code) v += GL.fmt.toUsd(a.balance, c.code); });
            });
            return { code: c.code, v: Math.round(v * 100) / 100 };
          }).filter(function (x) { return x.v > 0; });
          return ok({
            kpis: {
              totalUsers: customers.length,
              activeUsers: customers.filter(function (u) { return u.status === 'active'; }).length,
              frozenUsers: customers.filter(function (u) { return u.status === 'frozen'; }).length,
              pendingDeposits: db.deposits.filter(function (x) { return x.status === 'pending'; }).length,
              volumeUsd: Math.round(customers.reduce(function (s, u) {
                return s + (u.accounts || []).reduce(function (s2, a) { return s2 + GL.fmt.toUsd(a.balance, a.code); }, 0);
              }, 0) * 100) / 100,
              openTickets: db.tickets.filter(function (t) { return t.status === 'open'; }).length,
              suspiciousEvents: db.securityEvents.filter(function (e) { return e.suspicious; }).length
            },
            series: { depositsByDay: depositsByDay, outcomeMix: outcomeMix, currencyDist: currencyDist },
            recentUsers: customers.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 5).map(userRow),
            pendingDeposits: db.deposits.filter(function (x) { return x.status === 'pending'; }).slice(0, 5).map(depositRow),
            recentPayments: db.payments.slice(0, 6).map(paymentRow)
          });
        });
      },

      users: function (q) {
        return delay(280, 550).then(function () {
          requireAdmin();
          q = q || {};
          var list = store.db.users.filter(function (u) { return u.role === 'customer'; });
          if (q.search) {
            var s2 = q.search.toLowerCase();
            list = list.filter(function (u) { return (u.name + ' ' + u.email + ' ' + u.country).toLowerCase().indexOf(s2) > -1; });
          }
          if (q.status) list = list.filter(function (u) { return u.status === q.status; });
          if (q.country) list = list.filter(function (u) { return u.country === q.country; });
          return ok(list.sort(function (a, b) { return b.createdAt - a.createdAt; }).map(userRow));
        });
      },

      user: function (id) {
        return delay(300, 600).then(function () {
          requireAdmin();
          var u = findUser(id);
          if (!u || u.role !== 'customer') throw ApiError('NOT_FOUND', 404, 'Customer not found.');
          refreshBalances(u);
          return ok({
            user: sanitize(u), accounts: myAccounts(u),
            totalUsd: Math.round(myAccounts(u).reduce(function (s, a) { return s + a.equivalentUsd; }, 0) * 100) / 100,
            transactions: store.db.transactions.filter(function (t) { return t.userId === id; }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 10),
            deposits: store.db.deposits.filter(function (t) { return t.userId === id; }).sort(function (a, b) { return b.createdAt - a.createdAt; }),
            sessions: store.db.sessions.filter(function (t) { return t.userId === id; }),
            securityEvents: store.db.securityEvents.filter(function (t) { return t.userId === id; }).sort(function (a, b) { return b.ts - a.ts; })
          });
        });
      },

      /* Account takeover — view + permitted edits only; never notified automatically */
      takeover: function (userId, design) {
        return delay(400, 800).then(function () {
          var s = requireAdmin();
          var u = findUser(userId);
          if (!u || u.role !== 'customer') throw ApiError('NOT_FOUND', 404, 'Customer not found.');
          var back = location.href;
          GL.api.session.set({ kind: 'takeover', adminId: s.adminId, adminName: s.adminName, adminEmail: s.adminEmail,
            userId: userId, ts: Date.now(), back: back });
          audit('takeover_start', userId + ' · ' + u.name, 'Administrative takeover session started — view + permitted edits. User not auto-notified.');
          var tkn = btoa(unescape(encodeURIComponent(JSON.stringify({ kind: 'takeover', adminId: s.adminId,
            adminName: s.adminName, adminEmail: s.adminEmail, userId: userId, ts: Date.now(), back: back }))));
          /* resolve the customer app relative to the project root, correct for both
             the dev server (admin/<design>/) and the built dist (admin/<design>/dist/) */
          var base = '';
          if (/\/admin\//.test(location.pathname)) base = location.pathname.split('/admin/')[0];
          var rel = base + '/customer/' + design + '/app.html?tkn=' + encodeURIComponent(tkn);
          return ok({ userId: userId, redirect: rel }, 'Takeover session started.');
        });
      },

      endTakeover: function () {
        return delay(250, 500).then(function () {
          var s = GL.api.session.get();
          if (!s || s.kind !== 'takeover') throw ApiError('NOT_TAKEOVER', 400, 'No takeover session active.');
          audit('takeover_end', s.userId, 'Administrative takeover session ended.');
          GL.api.session.set({ kind: 'admin', adminId: s.adminId, adminName: s.adminName, adminEmail: s.adminEmail, ts: Date.now() });
          return ok({ back: s.back || null }, 'Takeover ended.');
        });
      },

      /* permitted edits — whitelisted fields; anything financial is rejected here */
      updateProfile: function (id, patch) {
        return delay(400, 800).then(function () {
          requireAdmin();
          var u = findUser(id); if (!u) throw ApiError('NOT_FOUND', 404, 'Customer not found.');
          var whitelist = ['firstName', 'lastName', 'phone', 'address'];
          var forbidden = Object.keys(patch || {}).filter(function (k) { return whitelist.indexOf(k) === -1; });
          if (forbidden.length) {
            audit('denied_attempt', id + ' · ' + u.name, 'Blocked by policy: attempted to edit restricted field(s) ' + forbidden.join(', ') + '.', 'denied');
            throw ApiError('FORBIDDEN_FINANCIAL', 403, 'Administrators cannot edit restricted account fields (' + forbidden.join(', ') + '). This restriction is enforced in the service layer.');
          }
          var db = store.db; Object.assign(u, patch);
          u.name = ((u.firstName || '') + ' ' + (u.lastName || '')).trim(); store.db = db;
          audit('profile_edit', id + ' · ' + u.name, 'Permitted profile edit: ' + JSON.stringify(patch) + '. User not auto-notified.');
          return ok({ user: sanitize(u) }, 'Profile updated (audited).');
        });
      },

      setUserCurrency: function (id, code, action) {
        return delay(400, 800).then(function () {
          requireAdmin();
          var u = findUser(id); if (!u) throw ApiError('NOT_FOUND', 404, 'Customer not found.');
          if (!currencyInfo(code)) throw ApiError('UNSUPPORTED_CURRENCY', 422, code + ' is not supported.');
          var acc = (u.accounts || []).filter(function (a) { return a.code === code; })[0];
          var db = store.db;
          if (action === 'activate') {
            if (acc) throw ApiError('ALREADY_ACTIVE', 409, 'Customer already has a ' + code + ' account.');
            if (!currencyAvailable(code)) throw ApiError('CURRENCY_UNAVAILABLE', 422, code + ' is currently unavailable.');
            u.accounts.push({ code: code, status: 'active', balance: 0, openedAt: Date.now() });
            audit('currency_manage', id + ' · ' + u.name, 'Activated ' + code + ' for customer.');
            store.db = db;
            return ok({ code: code }, code + ' activated for customer (zero balance).');
          }
          if (action === 'deactivate') {
            if (!acc) throw ApiError('NOT_FOUND', 404, 'Customer has no ' + code + ' account.');
            if (ledgerBalance(id, code) !== 0) throw ApiError('NON_ZERO_BALANCE', 409, 'Cannot deactivate an account holding a balance.');
            u.accounts = u.accounts.filter(function (a) { return a.code !== code; });
            audit('currency_manage', id + ' · ' + u.name, 'Deactivated ' + code + ' for customer (balance was zero).');
            store.db = db;
            return ok({ code: code }, code + ' deactivated.');
          }
          throw ApiError('VALIDATION', 422, 'Unknown action.');
        });
      },

      freezeUser: function (id, reason) {
        return delay(400, 800).then(function () {
          requireAdmin();
          var u = findUser(id); if (!u) throw ApiError('NOT_FOUND', 404, 'Customer not found.');
          var db = store.db;
          u.status = 'frozen'; u.freezeReason = reason || 'Security review'; u.frozenAt = Date.now(); u.frozenBy = (GL.api.session.get().adminName || 'Administrator') + ' (admin)';
          db.securityEvents.unshift({ id: 'se-' + Date.now().toString(36), userId: id, type: 'account_frozen',
            device: 'Administrator action', ip: '102.89.44.7', location: '—', ts: Date.now(), suspicious: true,
            detail: 'Account frozen by administrator: ' + u.freezeReason });
          store.db = db;
          audit('account_frozen', id + ' · ' + u.name, 'Reason: ' + u.freezeReason + '. User not auto-notified.');
          return ok({ status: 'frozen' }, 'Account frozen. The user was not notified automatically.');
        });
      },

      unfreezeUser: function (id, reason) {
        return delay(400, 800).then(function () {
          requireAdmin();
          var u = findUser(id); if (!u) throw ApiError('NOT_FOUND', 404, 'Customer not found.');
          var db = store.db;
          u.status = 'active'; u.freezeReason = null; u.frozenBy = null; store.db = db;
          audit('account_unfrozen', id + ' · ' + u.name, 'Reason: ' + (reason || 'review completed') + '.');
          return ok({ status: 'active' }, 'Account unfrozen.');
        });
      },

      notifyUser: function (id, form) {
        return delay(400, 800).then(function () {
          requireAdmin();
          var u = findUser(id); if (!u) throw ApiError('NOT_FOUND', 404, 'Customer not found.');
          notify(id, form.title || 'Notification from Meridian', form.body || '', 'info');
          audit('manual_notification', id + ' · ' + u.name, 'Manual notification sent: ' + (form.title || ''));
          return ok({ done: true }, 'Notification sent to customer.');
        });
      },

      currencies: function () {
        return delay(200, 400).then(function () {
          requireAdmin();
          return ok(GL.CURRENCIES.map(function (c) {
            var users = store.db.users.filter(function (u) {
              return (u.accounts || []).filter(function (a) { return a.code === c.code; }).length;
            }).length;
            return { code: c.code, name: c.name, symbol: c.symbol, status: store.db.settings.currencyStatus[c.code] || 'unavailable',
              note: c.note, customers: users };
          }));
        });
      },

      setCurrencyAvailability: function (code, status) {
        return delay(400, 700).then(function () {
          requireAdmin();
          if (!currencyInfo(code)) throw ApiError('UNSUPPORTED_CURRENCY', 422, code + ' is not a known currency.');
          if (['active', 'unavailable'].indexOf(status) === -1) throw ApiError('VALIDATION', 422, 'Status must be active or unavailable.');
          var db = store.db;
          db.settings.currencyStatus[code] = status; store.db = db;
          audit('currency_config', code, 'Availability set to ' + status + '.');
          return ok({ code: code, status: status }, code + ' availability updated.');
        });
      },

      deposits: function (q) {
        return delay(280, 550).then(function () {
          requireAdmin();
          q = q || {};
          var list = store.db.deposits.map(depositRow);
          if (q.status) list = list.filter(function (d) { return d.status === q.status; });
          return ok(list.sort(function (a, b) { return b.createdAt - a.createdAt; }));
        });
      },

      transactions: function (q) {
        return delay(280, 550).then(function () {
          requireAdmin();
          q = q || {};
          var list = store.db.transactions.map(function (t) {
            var u = findUser(t.userId); return Object.assign({}, t, { userName: u ? u.name : '—' });
          });
          if (q.search) { var s2 = q.search.toLowerCase(); list = list.filter(function (t) { return (t.ref + ' ' + t.description + ' ' + t.userName).toLowerCase().indexOf(s2) > -1; }); }
          if (q.status) list = list.filter(function (t) { return t.status === q.status; });
          if (q.currency) list = list.filter(function (t) { return t.currency === q.currency; });
          return ok(list.sort(function (a, b) { return b.ts - a.ts; }));
        });
      },

      payments: function (q) {
        return delay(280, 550).then(function () {
          requireAdmin();
          q = q || {};
          var list = store.db.payments.map(paymentRow);
          if (q.outcome && q.outcome !== 'all') list = list.filter(function (p) { return p.outcome === q.outcome; });
          var stats = {};
          list.forEach(function (p) { stats[p.outcome] = (stats[p.outcome] || 0) + 1; });
          return ok({ items: list.sort(function (a, b) { return b.ts - a.ts; }), stats: stats });
        });
      },

      securityEvents: function (q) {
        return delay(280, 550).then(function () {
          requireAdmin();
          q = q || {};
          var list = store.db.securityEvents.map(function (e) {
            var u = findUser(e.userId); return Object.assign({}, e, { userName: u ? u.name : '—' });
          });
          if (q.suspiciousOnly) list = list.filter(function (e) { return e.suspicious; });
          if (q.type) list = list.filter(function (e) { return e.type === q.type; });
          return ok(list.sort(function (a, b) { return b.ts - a.ts; }));
        });
      },

      reports: function () {
        return delay(350, 700).then(function () {
          requireAdmin();
          var db = store.db;
          var byMethod = GL.DEPOSIT_METHODS.map(function (m) {
            var mine = db.deposits.filter(function (x) { return x.method === m.id; });
            return { method: m.label, count: mine.length,
              volumeUsd: Math.round(mine.filter(function (x) { return x.status === 'successful'; }
                ).reduce(function (s, x) { return s + GL.fmt.toUsd(x.amount, x.currency); }, 0) * 100) / 100 };
          });
          var byCountry = {};
          db.users.filter(function (u) { return u.role === 'customer'; }).forEach(function (u) {
            byCountry[u.country] = (byCountry[u.country] || 0) + 1;
          });
          return ok({ byMethod: byMethod, byCountry: byCountry,
            outcomeMix: ['successful', 'pending', 'failed', 'cancelled', 'duplicate'].map(function (st) {
              return { status: st, count: db.payments.filter(function (p) { return p.outcome === st; }).length };
            }),
            totals: { users: db.users.filter(function (u) { return u.role === 'customer'; }).length,
              deposits: db.deposits.length, transactions: db.transactions.length } });
        });
      },

      tickets: function () {
        return delay(250, 500).then(function () {
          requireAdmin();
          var list = store.db.tickets.map(function (t) {
            var u = findUser(t.userId);
            return Object.assign({}, t, { userName: u ? u.name : '—', userEmail: u ? u.email : '—' });
          });
          return ok(list.sort(function (a, b) { return b.createdAt - a.createdAt; }));
        });
      },

      replyTicket: function (id, message) {
        return delay(400, 800).then(function () {
          requireAdmin();
          var t = store.db.tickets.filter(function (x) { return x.id === id; })[0];
          if (!t) throw ApiError('NOT_FOUND', 404, 'Ticket not found.');
          if (!message) throw ApiError('VALIDATION', 422, 'Message is required.');
          var db = store.db;
          t.messages.push({ from: 'support', text: message, ts: Date.now() }); store.db = db;
          notify(t.userId, 'Support replied', 'Your request "' + t.subject + '" has a new reply.', 'info');
          return ok(t, 'Reply sent.');
        });
      },

      resolveTicket: function (id) {
        return delay(300, 600).then(function () {
          requireAdmin();
          var db = store.db;
          var t = db.tickets.filter(function (x) { return x.id === id; })[0];
          if (!t) throw ApiError('NOT_FOUND', 404, 'Ticket not found.');
          t.status = t.status === 'resolved' ? 'open' : 'resolved'; store.db = db;
          return ok(t, 'Ticket ' + t.status + '.');
        });
      },

      roles: function () {
        return delay(200, 400).then(function () {
          requireAdmin();
          return ok({ roles: GL.ADMIN_ROLES, matrix: GL.PERMISSION_MATRIX });
        });
      },

      auditLog: function (q) {
        return delay(250, 500).then(function () {
          requireAdmin();
          q = q || {};
          var list = store.db.audit.slice();
          if (q.search) { var s2 = q.search.toLowerCase(); list = list.filter(function (a) { return (a.action + ' ' + a.target + ' ' + a.detail + ' ' + a.actorName).toLowerCase().indexOf(s2) > -1; }); }
          if (q.result) list = list.filter(function (a) { return a.result === q.result; });
          return ok(list);
        });
      },

      settings: function () {
        return delay(200, 400).then(function () {
          requireAdmin();
          return ok(store.db.settings);
        });
      },

      updateSettings: function (patch) {
        return delay(400, 800).then(function () {
          requireAdmin();
          var whitelist = ['platformName', 'maintenanceMode', 'supportEmail'];
          var bad = Object.keys(patch || {}).filter(function (k) { return whitelist.indexOf(k) === -1; });
          if (bad.length) throw ApiError('VALIDATION', 422, 'Unknown setting: ' + bad.join(', '));
          var db = store.db; Object.assign(db.settings, patch); store.db = db;
          audit('settings_update', 'platform', JSON.stringify(patch));
          return ok(db.settings, 'Settings saved.');
        });
      },

      /* Demonstration of the financial restrictions — ALWAYS rejected here. */
      attemptRestricted: function (op, payload) {
        return delay(400, 800).then(function () {
          requireAdmin();
          var messages = {
            edit_balance: 'Administrators cannot edit customer balances.',
            withdraw: 'Administrators cannot withdraw funds from customer accounts.',
            transfer: 'Administrators cannot transfer funds between accounts.',
            alter_deposit: 'Administrators cannot change deposit confirmations.',
            edit_ledger: 'Administrators cannot modify historical financial ledger entries.'
          };
          if (!messages[op]) throw ApiError('VALIDATION', 422, 'Unknown operation.');
          audit('denied_attempt', (payload && payload.userId ? payload.userId : '—'), 'Blocked by policy: ' + op + (payload && payload.detail ? ' — ' + payload.detail : ''), 'denied');
          throw ApiError('FORBIDDEN_FINANCIAL', 403, messages[op] + ' This restriction is enforced in the service layer; the production backend enforces it server-side.');
        });
      }
    },

    /* ---------------- demo controls (used by the demo panel) ---------------- */
    demo: {
      forcedOutcome: function () { return store.db.forcedOutcome || 'auto'; },
      setForcedOutcome: function (v) { var db = store.db; db.forcedOutcome = v; store.db = db; },
      reset: function () { GL.resetDb(); GL.api.session.clear(); },
      pendingOtp: function () {
        var s = GL.api.session.get();
        var email = null;
        try { email = sessionStorage.getItem('gl_pending_email') || (s && s.pendingEmail) || null; } catch (e) {}
        if (!email) {
          /* fall back to the most recently registered unverified user */
          var cand = store.db.users.filter(function (u) { return u.role === 'customer' && (!u.verification.email || !u.verification.phone); }).sort(function (a, b) { return b.createdAt - a.createdAt; })[0];
          email = cand ? cand.email : null;
        }
        var u = email ? findUserByEmail(email) : null;
        if (!u) return null;
        return { email: u.email, emailOtp: u.verification.email ? null : u.emailOtp, phoneOtp: u.verification.phone ? null : u.phoneOtp };
      },
      setPendingEmail: function (email) { try { sessionStorage.setItem('gl_pending_email', email); } catch (e) {} },
      clearPendingEmail: function () { try { sessionStorage.removeItem('gl_pending_email'); } catch (e) {} },
      currencyStatus: function () { return store.db.settings.currencyStatus; },
      setCurrencyStatus: function (code, status) { var db = store.db; db.settings.currencyStatus[code] = status; store.db = db; },
      stats: function () {
        var db = store.db;
        return { users: db.users.length, transactions: db.transactions.length, deposits: db.deposits.length, payments: db.payments.length };
      }
    }
  };

  /* ---------------- internal row mappers ---------------- */
  function requireAdmin() {
    var s = GL.api.session.get();
    if (!s) throw ApiError('UNAUTHENTICATED', 401, 'Administrator session required.');
    if (s.kind !== 'admin' && s.kind !== 'takeover') throw ApiError('FORBIDDEN', 403, 'Administrator access required.');
    return s;
  }
  function userRow(u) {
    refreshBalances(u);
    return { id: u.id, name: u.name, email: u.email, country: u.country, countryCode: u.countryCode,
      status: u.status, verification: u.verification, defaultCurrency: u.defaultCurrency,
      currencies: (u.accounts || []).map(function (a) { return a.code; }),
      totalUsd: Math.round((u.accounts || []).reduce(function (s, a) { return s + GL.fmt.toUsd(a.balance, a.code); }, 0) * 100) / 100,
      createdAt: u.createdAt, accountId: u.accountId, mfaEnabled: u.mfaEnabled };
  }
  function depositRow(d) {
    var u = findUser(d.userId);
    return Object.assign({}, d, { userName: u ? u.name : '—', methodName: methodLabel(d.method) });
  }
  function paymentRow(p) {
    var u = findUser(p.userId);
    var d = store.db.deposits.filter(function (x) { return x.reference === p.reference; })[0];
    return Object.assign({}, p, { userName: u ? u.name : '—', methodName: methodLabel(p.method),
      amount: d ? d.amount : null, currency: d ? d.currency : null });
  }

  /* ---------------- cross-tab live sync (same origin) ---------------- */
  GL.api.subscribe = function (cb) {
    window.addEventListener('storage', function (e) { if (e.key === DB_KEY) { _dbCache = null; cb(); } });
  };

  /* ---------------- session helpers ---------------- */
  GL.unreadCount = function () {
    var s = GL.api.session.get(); if (!s) return 0;
    return store.db.notifications.filter(function (n) { return n.userId === s.userId && !n.read; }).length;
  };
})();
