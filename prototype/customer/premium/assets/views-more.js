/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — CONCEPT 03 · PREMIUM GLOBAL FINANCIAL PLATFORM
   customer/premium/assets/views-more.js

   GL.Views part 2 — activate, deposits (full wizard incl. the five result
   outcomes + duplicate), transactions, txn, statements, profile, security,
   sessions, notifications, support, settings. Extends the object created in
   views.js; also registers purely visual bind hooks (deposit method
   filtering, live filter submission, statement previews).
   ========================================================================== */
(function () {
  var V = window.GL.Views;
  var esc = GL.esc, icon = GL.icon, fmt = GL.fmt;

  function badge(st) { return '<span class="badge b-' + esc(st) + '">' + esc(st) + '</span>'; }
  function emptyState(ic, title, text, actions) {
    return '<div class="empty">'
      + '<span class="empty-ic">' + icon(ic, 21) + '</span>'
      + '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>'
      + (actions || '')
      + '</div>';
  }
  function methodLabel(id) {
    var m = (GL.DEPOSIT_METHODS || []).filter(function (x) { return x.id === id; })[0];
    return m ? m.label : (id || '—');
  }
  function methodAllowed(m, cur) {
    return !m.currencies || m.currencies.indexOf(cur) > -1;
  }
  function activeAccounts(S) {
    return ((S.me && S.me.accounts) || []).filter(function (a) { return a.status === 'active'; });
  }

  /* ======================================================================
       ACTIVATE CURRENCY — four states per currency + request form
       ====================================================================== */
  V.activate = function (S) {
    var list = S.data.currencies;
    if (!list || !list.length) {
      return emptyState('coins', 'Currencies unavailable', 'Currency information could not be loaded. Reload the page to try again.');
    }

    var cards = list.map(function (c) {
      var headBadges = c.isDefault ? '<span class="badge b-default">Default currency</span>' : '';
      var foot = '';
      var cls = 'act-card';

      if (c.activeForMe) {
        cls += ' is-active';
        foot = '<div class="act-badges">' + badge('active') + '</div>'
          + '<p class="act-note">Activated on your account' + (c.myStatus ? ' · status ' + esc(c.myStatus) : '') + '.</p>'
          + '<a class="btn btn-ghost btn-sm" href="#/account/' + esc(c.code) + '">Open account</a>';
      } else if (c.status !== 'active') {
        cls += ' is-off';
        foot = '<div class="act-badges">' + badge('unavailable') + '</div>'
          + '<p class="act-note">' + esc(c.note || 'Temporarily unavailable for activation.') + '</p>'
          + '<button type="button" class="btn btn-ghost btn-sm" disabled aria-disabled="true">Activate</button>';
      } else {
        foot = '<button type="button" class="btn btn-primary btn-sm" data-action="activate:currency" data-code="' + esc(c.code) + '">' + icon('plus', 15) + ' Activate ' + esc(c.code) + '</button>'
          + '<p class="act-note">Starts at a zero balance — nothing is converted.</p>';
      }

      var rate = c.rateToUsd ? '1 ' + esc(c.code) + ' ≈ ' + esc(fmt.money(c.rateToUsd, 'USD')) : 'Indicative rate unavailable';
      return '<article class="' + cls + '">'
        + '<div class="act-head"><span class="act-code">' + esc(c.code) + '</span>' + headBadges + '</div>'
        + '<h3 class="act-name">' + esc(c.name) + '</h3>'
        + '<p class="act-rate">' + rate + ' · demo rate</p>'
        + '<div class="act-foot">' + foot + '</div>'
        + '</article>';
    }).join('');

    return '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Activate a currency</h2><a class="link-sm" href="#/accounts">My accounts</a></div>'
      + '<p class="panel-sub">New currency accounts always start at a zero balance — balances are never converted or moved between currencies. Availability can change; this page reflects the live platform configuration.</p>'
      + '<div class="act-grid">' + cards + '</div>'
      + '</section>'
      + '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Need a currency we don&rsquo;t support?</h2></div>'
      + '<p class="panel-sub">Enter its ISO code to request activation. The platform currently supports NGN, USD, GBP, EUR and CHF — anything else is rejected here so you can see the UNSUPPORTED and UNAVAILABLE states.</p>'
      + '<form data-form="currencyRequest" novalidate class="dep-form-grid" style="grid-template-columns:1fr;">'
      + '<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;">'
      + '<div class="field" style="margin:0;flex:1;min-width:200px;">'
      + '<label for="cr-code">Currency code</label>'
      + '<input id="cr-code" name="code" type="text" placeholder="e.g. INR" style="text-transform:uppercase;" autocomplete="off">'
      + '<p class="field-err" hidden></p>'
      + '</div>'
      + '<button class="btn btn-ghost" type="submit" style="margin-top:22px;">Request activation</button>'
      + '</div>'
      + '<p class="field-hint" data-currency-request-note hidden style="margin-top:10px;"></p>'
      + '</form>'
      + '</section>';
  };

  /* ======================================================================
       DEPOSITS — landing, form, gateway, processing, five result outcomes
       ====================================================================== */
  V.deposits = function (S) {
    var hist = S.data.deposits || [];

    function historyTable() {
      if (!hist.length) {
        return emptyState('download', 'No deposits yet', 'Your simulated deposit history will appear here once you make your first deposit.');
      }
      var rows = hist.map(function (x) {
        return '<tr>'
          + '<td><span class="cell-main mono">' + esc(x.reference) + '</span></td>'
          + '<td><span class="cell-main">' + esc(x.currency) + '</span></td>'
          + '<td class="num">' + esc(fmt.money(x.amount, x.currency)) + '</td>'
          + '<td>' + esc(methodLabel(x.method)) + '<span class="cell-sub">Fee ' + esc(fmt.money(x.fee, x.currency)) + '</span></td>'
          + '<td>' + badge(x.status) + '</td>'
          + '<td class="num muted">' + esc(fmt.dateTime(x.createdAt)) + '</td>'
          + '</tr>';
      }).join('');
      return '<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Currency</th><th class="num">Amount</th><th>Method</th><th>Status</th><th class="num">Date</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    /* administrative takeover: financial operations are blocked */
    if (S.takeover) {
      return '<div class="restriction">' + icon('ban', 18)
        + '<span><b>Financial operations are blocked during an administrative takeover session.</b> '
        + 'Deposits cannot be initiated while an administrator is viewing this account — the restriction is enforced in the service layer. Deposit history remains visible below (read-only).</span></div>'
        + '<section class="panel"><div class="panel-head"><h2 class="panel-title">Deposit history</h2></div>' + historyTable() + '</section>';
    }

    /* landing: active-account picker + history */
    if (!S.dep) {
      var active = activeAccounts(S);
      var picker = active.length
        ? '<div class="dep-picker">'
          + active.map(function (a) {
            return '<button type="button" class="pick-card" data-action="dep:new">'
              + '<span class="pick-code">' + esc(a.code) + '</span>'
              + '<span class="pick-name">' + esc(a.name) + '</span>'
              + '<span class="pick-bal">' + esc(fmt.money(a.balance, a.code)) + '</span>'
              + '<span class="btn btn-primary btn-sm">' + icon('plus', 14) + ' Deposit</span>'
              + '</button>';
          }).join('')
          + '</div>'
        : emptyState('coins', 'No active currency accounts', 'Activate at least one currency before making a deposit.', '<a class="btn btn-primary btn-sm" href="#/activate">Activate a currency</a>');

      return '<section class="panel">'
        + '<div class="panel-head"><h2 class="panel-title">New deposit</h2><span class="badge b-open">simulated</span></div>'
        + '<p class="panel-sub">Choose an account to deposit into. Payments run through a mock gateway — no real money moves, and outcomes can be successful, pending, failed, cancelled or duplicate.</p>'
        + picker
        + '</section>'
        + '<section class="panel">'
        + '<div class="panel-head"><h2 class="panel-title">Deposit history</h2><span class="muted small">' + hist.length + ' record' + (hist.length === 1 ? '' : 's') + '</span></div>'
        + historyTable()
        + '</section>';
    }

    /* wizard header */
    function steps(cur) {
      return '<div class="wiz-steps" aria-hidden="true">'
        + '<span class="wiz-step' + (cur >= 1 ? ' cur' : '') + '"><b>1</b>Details</span><span class="wiz-sep"></span>'
        + '<span class="wiz-step' + (cur === 2 ? ' cur' : cur > 2 ? ' done' : '') + '"><b>2</b>Payment</span><span class="wiz-sep"></span>'
        + '<span class="wiz-step' + (cur === 3 ? ' cur' : '') + '"><b>3</b>Result</span>'
        + '</div>';
    }

    /* step: form */
    if (S.dep.step === 'form') {
      var active = activeAccounts(S);
      if (!active.length) {
        return emptyState('coins', 'No active currency accounts', 'Activate a currency before making a deposit.', '<a class="btn btn-primary btn-sm" href="#/activate">Activate a currency</a>');
      }
      var cur = active.some(function (a) { return a.code === S.dep.currency; }) ? S.dep.currency : active[0].code;
      var lim = GL.DEPOSIT_LIMITS[cur] || [10, 50000];

      var curOpts = active.map(function (a) {
        return '<option value="' + esc(a.code) + '"' + (a.code === cur ? ' selected' : '') + '>'
          + esc(a.name) + ' (' + esc(a.code) + ') — ' + esc(fmt.money(a.balance, a.code)) + '</option>';
      }).join('');

      var pref = S.dep.method && GL.DEPOSIT_METHODS.some(function (m) { return m.id === S.dep.method && methodAllowed(m, cur); })
        ? S.dep.method : null;
      var firstAllowed = null;
      var methods = GL.DEPOSIT_METHODS.map(function (m) {
        var ok = methodAllowed(m, cur);
        if (ok && !firstAllowed) firstAllowed = m.id;
        var checked = ok && ((pref && m.id === pref) || (!pref && m.id === firstAllowed));
        var dataAttr = m.currencies ? ' data-cur="' + esc(m.currencies.join(',')) + '"' : ' data-any="1"';
        return '<label class="method-card">'
          + '<input type="radio" name="method" value="' + esc(m.id) + '"' + (checked ? ' checked' : '') + (ok ? '' : ' disabled') + dataAttr + '>'
          + '<span class="m-body">'
          + '<span class="m-head">' + icon(m.icon, 18) + '<span class="m-name">' + esc(m.label) + '</span><span class="m-fee">' + esc(m.feeNote) + '</span></span>'
          + '<span class="m-desc">' + esc(m.desc) + '</span>'
          + (ok ? '' : '<span class="m-off-note">Not available for ' + esc(cur) + '</span>')
          + '</span>'
          + '</label>';
      }).join('');

      return steps(1)
        + '<div class="dep-form-grid">'
        + '<section class="panel" style="margin:0;">'
        + '<div class="panel-head"><h2 class="panel-title">Deposit details</h2><button type="button" class="btn btn-ghost btn-sm" data-action="dep:cancel-wizard">Cancel</button></div>'
        + '<form data-form="depForm" novalidate>'
        + '<div class="field"><label for="dep-cur">Deposit into</label>'
        + '<select id="dep-cur" name="currency" data-dep-currency>' + curOpts + '</select>'
        + '</div>'
        + '<div class="field"><label for="dep-amount">Amount</label>'
        + '<input id="dep-amount" name="amount" type="number" inputmode="decimal" min="' + lim[0] + '" max="' + lim[1] + '" step="0.01" placeholder="0.00">'
        + '<p class="field-hint" data-dep-limits>Minimum ' + esc(fmt.money(lim[0], cur)) + ' · maximum ' + esc(fmt.money(lim[1], cur)) + ' per deposit.</p>'
        + '<p class="field-err" hidden></p>'
        + '</div>'
        + '<fieldset style="border:0;padding:0;margin:0 0 16px;">'
        + '<legend style="font:600 11px/1.3 var(--font-ui);letter-spacing:.09em;text-transform:uppercase;color:var(--muted);padding:0;margin-bottom:8px;">Payment method</legend>'
        + '<div class="method-grid">' + methods + '</div>'
        + '</fieldset>'
        + '<button class="btn btn-primary" type="submit">Continue to payment</button>'
        + '</form>'
        + '</section>'
        + '<aside class="dep-aside">'
        + '<div class="sum-card"><h3>Selected account</h3>'
        + '<dl>'
        + '<div class="sum-row"><dt>Currency</dt><dd data-dep-cur-name>' + esc(cur) + '</dd></div>'
        + '<div class="sum-row"><dt>Current balance</dt><dd data-dep-balance>' + esc(fmt.money((S.me.accounts.filter(function (a) { return a.code === cur; })[0] || {}).balance || 0, cur)) + '</dd></div>'
        + '</dl></div>'
        + '<div class="callout" style="align-items:flex-start;">' + icon('info', 16)
        + '<p><b>Simulated payments.</b> The gateway is a mock — no card data is transmitted and no real money moves. Fees are informational.</p></div>'
        + '</aside>'
        + '</div>';
    }

    /* step: gateway */
    if (S.dep.step === 'gateway') {
      var dep = S.dep;
      var isBank = dep.method === 'bank_transfer';
      var u = S.user || {};

      var summary = '<div class="sum-card" style="margin-bottom:18px;"><h3>Payment summary</h3><dl>'
        + '<div class="sum-row"><dt>Reference</dt><dd class="mono">' + esc(dep.ref) + '</dd></div>'
        + '<div class="sum-row"><dt>Amount</dt><dd>' + esc(fmt.money(dep.amount, dep.currency)) + '</dd></div>'
        + '<div class="sum-row"><dt>Fee</dt><dd>' + (dep.fee > 0 ? esc(fmt.money(dep.fee, dep.currency)) : 'No fee') + '</dd></div>'
        + '<div class="sum-row"><dt>Method</dt><dd>' + esc(dep.methodName || methodLabel(dep.method)) + '</dd></div>'
        + '</dl></div>';

      var payNote = '<p class="preview-note">' + icon('info', 15) + '<span><b>Simulated payment</b> — no real money moves and no real provider is contacted.</span></p>';

      var inner = '';
      if (isBank) {
        inner = payNote
          + '<div class="bank-note"><dl>'
          + '<div class="sum-row"><dt>Beneficiary</dt><dd>Meridian Global Accounts (demo)</dd></div>'
          + '<div class="sum-row"><dt>Bank</dt><dd>Meridian Sandbox Bank</dd></div>'
          + '<div class="sum-row"><dt>IBAN</dt><dd class="mono">CH00 0011 2233 4455 6677 8</dd></div>'
          + '<div class="sum-row"><dt>Reference</dt><dd class="mono">' + esc(dep.ref) + '</dd></div>'
          + '<div class="sum-row"><dt>Amount</dt><dd>' + esc(fmt.money(dep.amount, dep.currency)) + '</dd></div>'
          + '</dl>'
          + '<p class="muted small" style="margin:10px 0 0;">These are demonstration instructions. Simulated bank transfers settle as PENDING until confirmed — nothing is credited yet.</p></div>'
          + '<form data-form="gatewayForm" novalidate>'
          + '<button class="btn btn-primary btn-block" type="submit">I&rsquo;ve initiated the transfer — continue</button>'
          + '</form>'
          + '<p style="margin-top:12px;"><button type="button" class="btn btn-ghost btn-block" data-action="dep:gateway-cancel">Cancel payment</button></p>';
      } else {
        inner = payNote
          + '<form data-form="gatewayForm" novalidate>'
          + '<div class="card-fields">'
          + '<div class="field"><label for="gw-name">Name on card</label><input id="gw-name" name="cardName" type="text" autocomplete="cc-name" value="' + esc(u.name || 'Demo Cardholder') + '"><p class="field-err" hidden></p></div>'
          + '<div class="field"><label for="gw-num">Card number</label><input id="gw-num" name="cardNumber" type="text" inputmode="numeric" autocomplete="cc-number" value="4242 4242 4242 4242"><p class="field-err" hidden></p></div>'
          + '<div class="field"><label for="gw-exp">Expiry</label><input id="gw-exp" name="cardExpiry" type="text" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" value="12/28"><p class="field-err" hidden></p></div>'
          + '<div class="field"><label for="gw-cvc">CVC</label><input id="gw-cvc" name="cardCvc" type="text" inputmode="numeric" autocomplete="cc-csc" placeholder="123" value="123"><p class="field-err" hidden></p></div>'
          + '</div>'
          + '<button class="btn btn-primary btn-block btn-lg" type="submit">' + icon('lock', 16) + ' Pay ' + esc(fmt.money(dep.amount, dep.currency)) + '</button>'
          + '</form>'
          + '<p style="margin-top:12px;"><button type="button" class="btn btn-ghost btn-block" data-action="dep:gateway-cancel">Cancel payment</button></p>'
          + '<p class="muted small" style="margin-top:12px;">Demo values are prefilled — nothing is validated against a real card network.</p>';
      }

      return steps(2)
        + '<div class="dep-form-grid">'
        + '<section class="panel gateway-card" style="margin:0;">'
        + '<div class="panel-head"><h2 class="panel-title">' + (isBank ? 'Bank transfer' : 'Card payment') + '</h2></div>'
        + summary + inner
        + '</section>'
        + '<aside class="dep-aside">'
        + '<div class="sum-card"><h3>Deposit</h3><dl>'
        + '<div class="sum-row"><dt>Into</dt><dd>' + esc(dep.currency) + ' account</dd></div>'
        + '<div class="sum-row"><dt>Reference</dt><dd class="mono">' + esc(dep.ref) + '</dd></div>'
        + '<div class="sum-row"><dt>Status</dt><dd>' + badge('pending') + '</dd></div>'
        + '</dl></div>'
        + '<div class="callout">' + icon('shield-check', 16)
        + '<p><b>Outcomes are simulated.</b> The mock gateway decides the result — use the DEMO CONTROLS panel to force a specific outcome.</p></div>'
        + '</aside>'
        + '</div>';
    }

    /* step: processing */
    if (S.dep.step === 'processing') {
      return steps(2)
        + '<section class="panel">'
        + '<div class="dep-spinner" role="status" aria-live="polite">'
        + '<p>Contacting the simulated payment service…</p>'
        + '<p class="small">Reference <span class="mono">' + esc(S.dep.ref) + '</span> · ' + esc(fmt.money(S.dep.amount, S.dep.currency)) + '</p>'
        + '</div>'
        + '</section>';
    }

    /* step: result — five outcomes */
    var dep = S.dep;
    if (dep.duplicate) {
      return steps(3)
        + '<section class="panel">'
        + '<div class="result-panel">'
        + '<div class="result-ic mut">' + icon('x-circle', 27) + '</div>'
        + '<h2 class="result-title">Duplicate payment</h2>'
        + '<p class="result-text">' + esc(dep.message || 'This payment reference has already been processed.') + '</p>'
        + '<dl class="kv-grid" style="text-align:left;max-width:420px;margin:10px auto 0;">'
        + '<div class="kv"><dt>Reference</dt><dd class="mono">' + esc(dep.ref || '—') + '</dd></div>'
        + '<div class="kv"><dt>HTTP</dt><dd class="mono">409 Conflict · DUPLICATE_REFERENCE</dd></div>'
        + '<div class="kv"><dt>Credited</dt><dd>Nothing — duplicates never credit</dd></div>'
        + '</dl>'
        + '<div class="result-actions">'
        + '<button type="button" class="btn btn-primary" data-action="dep:done">Done</button>'
        + '<button type="button" class="btn btn-ghost" data-action="dep:retry">Start a new deposit</button>'
        + '</div>'
        + '<div class="result-demo-row"><span>Demo:</span><button type="button" class="link-btn" data-action="dep:duplicate">Attempt duplicate (demo)</button></div>'
        + '</div>'
        + '</section>';
    }

    var st = dep.result ? dep.result.status : 'pending';
    var icons = { successful: ['check-circle', 'ok'], pending: ['clock', 'warn'], failed: ['x-circle', 'err'], cancelled: ['ban', 'mut'] };
    var ic = icons[st] || icons.pending;
    var title = { successful: 'Payment successful', pending: 'Awaiting confirmation', failed: 'Payment failed', cancelled: 'Payment cancelled' }[st] || 'Result';
    var text;
    if (st === 'successful') {
      text = '<b>' + esc(fmt.money(dep.amount, dep.currency)) + '</b> has been credited to your ' + esc(dep.currency) + ' account.';
    } else if (st === 'pending') {
      text = 'The payment is awaiting confirmation from the simulated provider. It has <b>not</b> been credited yet — your ' + esc(dep.currency) + ' balance is unchanged.';
    } else if (st === 'failed') {
      text = 'The simulated payment was declined. Nothing was credited to your ' + esc(dep.currency) + ' account.';
    } else {
      text = 'The payment was cancelled before completion. Nothing was credited to your ' + esc(dep.currency) + ' account.';
    }

    var balanceRow = '';
    if (st === 'successful' && typeof dep.balanceAfter !== 'undefined' && dep.balanceAfter !== null) {
      balanceRow = '<p class="result-balance">' + esc(fmt.money(dep.balanceAfter, dep.currency)) + '</p>'
        + '<p class="muted small" style="margin:0 0 6px;">New ' + esc(dep.currency) + ' balance</p>';
    }

    return steps(3)
      + '<section class="panel">'
      + '<div class="result-panel">'
      + '<div class="result-ic ' + ic[1] + '">' + icon(ic[0], 27) + '</div>'
      + '<h2 class="result-title">' + title + '</h2>'
      + '<p class="result-text">' + text + '</p>'
      + balanceRow
      + '<dl class="kv-grid" style="text-align:left;max-width:440px;margin:10px auto 0;">'
      + '<div class="kv"><dt>Reference</dt><dd class="mono">' + esc(dep.ref) + '</dd></div>'
      + '<div class="kv"><dt>Method</dt><dd>' + esc(dep.methodName || methodLabel(dep.method)) + '</dd></div>'
      + '<div class="kv"><dt>Fee</dt><dd>' + (dep.fee > 0 ? esc(fmt.money(dep.fee, dep.currency)) : 'No fee') + '</dd></div>'
      + '<div class="kv"><dt>Status</dt><dd>' + badge(st) + '</dd></div>'
      + '</dl>'
      + '<div class="result-actions">'
      + '<button type="button" class="btn btn-primary" data-action="dep:done">Done</button>'
      + (st === 'successful' ? '<button type="button" class="btn btn-ghost" data-action="dep:view-txn">View transactions</button>' : '')
      + (st === 'failed' || st === 'cancelled' ? '<button type="button" class="btn btn-ghost" data-action="dep:retry">Try again</button>' : '')
      + '</div>'
      + '<div class="result-demo-row"><span>Demo:</span><button type="button" class="link-btn" data-action="dep:duplicate">Attempt duplicate (demo)</button></div>'
      + '</div>'
      + '</section>';
  };

  /* ======================================================================
       TRANSACTIONS — filter bar, table, pagination
       ====================================================================== */
  V.transactions = function (S) {
    var d = S.data.transactions;
    var f = S.txnFilters || { search: '', currency: '', status: '', from: '', to: '', page: 1 };

    var curOpts = ((S.me && S.me.accounts) || []).map(function (a) {
      return '<option value="' + esc(a.code) + '"' + (f.currency === a.code ? ' selected' : '') + '>' + esc(a.code) + '</option>';
    }).join('');
    var stOpts = ['successful', 'pending', 'failed', 'cancelled'].map(function (s) {
      return '<option value="' + s + '"' + (f.status === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');

    var filters = '<form data-form="txnFilters" class="filters" novalidate>'
      + '<div class="field"><label for="tf-search">Search</label><input id="tf-search" name="search" type="search" value="' + esc(f.search) + '" placeholder="Reference, description…"></div>'
      + '<div class="field"><label for="tf-cur">Currency</label><select id="tf-cur" name="currency"><option value="">All</option>' + curOpts + '</select></div>'
      + '<div class="field"><label for="tf-status">Status</label><select id="tf-status" name="status"><option value="">All</option>' + stOpts + '</select></div>'
      + '<div class="field"><label for="tf-from">From</label><input id="tf-from" name="from" type="date" value="' + esc(f.from) + '"></div>'
      + '<div class="field"><label for="tf-to">To</label><input id="tf-to" name="to" type="date" value="' + esc(f.to) + '"></div>'
      + '<button class="btn btn-ghost" type="submit">' + icon('filter', 15) + ' Apply</button>'
      + '<button class="btn btn-ghost" type="button" data-action="txn:clear">Clear</button>'
      + '</form>';

    if (S.data.txnError) {
      return '<section class="panel">' + filters + '</section>'
        + emptyState('alert', 'Couldn&rsquo;t load transactions', S.data.txnError);
    }
    if (!d) {
      return '<section class="panel">' + filters + '</section><div class="gl-loading" aria-busy="true">Loading…</div>';
    }

    var hasFilters = f.search || f.currency || f.status || f.from || f.to;
    var rows = (d.items || []).map(function (t) {
      return '<tr data-href="#/txn/' + esc(t.ref) + '">'
        + '<td><a href="#/txn/' + esc(t.ref) + '"><span class="cell-main mono">' + esc(t.ref) + '</span></a></td>'
        + '<td><span class="cell-main">' + esc(t.description) + '</span></td>'
        + '<td><span class="cell-main">' + esc(t.currency) + '</span></td>'
        + '<td class="num"><span class="' + (t.amount < 0 ? 'amt-neg' : 'amt-pos') + '">' + esc(fmt.money(t.amount, t.currency)) + '</span></td>'
        + '<td>' + badge(t.status) + '</td>'
        + '<td class="num muted">' + esc(fmt.date(t.ts)) + '</td>'
        + '</tr>';
    }).join('');

    var table = rows
      ? '<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Description</th><th>Currency</th><th class="num">Amount</th><th>Status</th><th class="num">Date</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : emptyState('search', 'No transactions found',
        hasFilters ? 'No records match the current filters — try clearing them.' : 'Deposits and other activity on your accounts will appear here.',
        hasFilters ? '<button type="button" class="btn btn-ghost btn-sm" data-action="txn:clear">Clear filters</button>' : '');

    var pagerHtml = '';
    if (d.pages > 1) {
      var nums = [];
      for (var i = 1; i <= d.pages; i++) {
        if (i === 1 || i === d.pages || Math.abs(i - d.page) <= 1) nums.push(i);
      }
      var out = ['<button type="button" data-action="txn:page" data-page="' + (d.page - 1) + '" aria-label="Previous page"' + (d.page <= 1 ? ' disabled' : '') + '>' + icon('chevron-l', 15) + '</button>'];
      var prev = 0;
      nums.forEach(function (n) {
        if (n - prev > 1) out.push('<span class="pager-gap">…</span>');
        out.push(n === d.page
          ? '<span class="pager-cur" aria-current="page">' + n + '</span>'
          : '<button type="button" data-action="txn:page" data-page="' + n + '">' + n + '</button>');
        prev = n;
      });
      out.push('<button type="button" data-action="txn:page" data-page="' + (d.page + 1) + '" aria-label="Next page"' + (d.page >= d.pages ? ' disabled' : '') + '>' + icon('chevron', 15) + '</button>');
      pagerHtml = '<nav class="pager" aria-label="Transactions pagination">' + out.join('') + '</nav>';
    }

    return '<section class="panel">' + filters
      + '<p class="results-count">' + d.total + ' transaction' + (d.total === 1 ? '' : 's')
      + (d.pages > 1 ? ' · page ' + d.page + ' of ' + d.pages : '')
      + ' · demo ledger</p>'
      + table + pagerHtml
      + '</section>';
  };

  /* ======================================================================
       TRANSACTION DETAIL
       ====================================================================== */
  V.txn = function (S) {
    if (S.data.txnError) {
      return emptyState('search', 'Transaction not found', S.data.txnError,
        '<a class="btn btn-ghost btn-sm" href="#/transactions">Back to transactions</a>');
    }
    var t = S.data.txn;
    if (!t) return emptyState('search', 'Transaction unavailable', 'This record could not be loaded. Try again.');
    return '<a class="backlink" href="#/transactions">' + icon('chevron-l', 15) + 'All transactions</a>'
      + '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">' + esc(t.description) + '</h2>' + badge(t.status) + '</div>'
      + '<dl class="kv-grid">'
      + '<div class="kv"><dt>Reference</dt><dd class="mono">' + esc(t.ref) + '</dd></div>'
      + '<div class="kv"><dt>Amount</dt><dd class="' + (t.amount < 0 ? 'amt-neg' : 'amt-pos') + '">' + esc(fmt.money(t.amount, t.currency)) + '</dd></div>'
      + '<div class="kv"><dt>Currency</dt><dd>' + esc(t.currency) + '</dd></div>'
      + '<div class="kv"><dt>Type</dt><dd>' + esc(String(t.type || '—').replace(/_/g, ' ')) + '</dd></div>'
      + '<div class="kv"><dt>Method</dt><dd>' + esc(t.methodName || methodLabel(t.method)) + '</dd></div>'
      + '<div class="kv"><dt>Date</dt><dd>' + esc(fmt.dateTime(t.ts)) + '</dd></div>'
      + '</dl>'
      + '</section>';
  };

  /* ======================================================================
       STATEMENTS
       ====================================================================== */
  V.statements = function (S) {
    var list = S.data.statements || [];
    if (!list.length) {
      return emptyState('doc', 'No statements yet',
        'Monthly statements appear once your accounts have activity. Simulated deposits generate real ledger lines you can preview and download.');
    }
    var rows = list.map(function (st) {
      return '<div class="stmt-row">'
        + '<span class="stmt-period">' + esc(st.period) + '</span>'
        + '<span class="stmt-cur">' + esc(st.currency) + '</span>'
        + '<span class="stmt-range">' + esc(fmt.money(st.opening, st.currency)) + ' ' + icon('arrow-r', 13) + ' ' + esc(fmt.money(st.closing, st.currency)) + '</span>'
        + '<span class="stmt-count">' + st.count + ' line' + (st.count === 1 ? '' : 's') + '</span>'
        + '<span class="stmt-actions">'
        + '<button type="button" class="btn btn-ghost btn-sm" data-stmt-preview data-id="' + esc(st.id) + '">' + icon('eye', 14) + ' Preview</button>'
        + '<button type="button" class="btn btn-ghost btn-sm" data-action="statement:download" data-id="' + esc(st.id) + '">' + icon('download', 14) + ' Download</button>'
        + '</span>'
        + '</div>';
    }).join('');

    return '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Monthly statements</h2><span class="muted small">Demo text files</span></div>'
      + '<p class="panel-sub">Statements are generated from the transaction ledger for each currency. Downloads are plain-text demonstration files.</p>'
      + '<div>' + rows + '</div>'
      + '</section>';
  };

  /* ======================================================================
       PROFILE
       ====================================================================== */
  V.profile = function (S) {
    var u = S.user || {};
    return '<div class="profile-grid">'
      + '<section class="panel" style="margin:0;">'
      + '<div class="panel-head"><h2 class="panel-title">Profile details</h2></div>'
      + (S.takeover
        ? '<div class="restriction">' + icon('eye', 17) + '<span><b>Takeover session.</b> These permitted edits are recorded in the audit log. The customer is not notified automatically. Financial fields are blocked by policy.</span></div>'
        : '')
      + '<form data-form="profileForm" novalidate>'
      + '<div class="card-fields">'
      + '<div class="field"><label for="pf-first">First name</label><input id="pf-first" name="firstName" type="text" value="' + esc(u.firstName || '') + '"><p class="field-err" hidden></p></div>'
      + '<div class="field"><label for="pf-last">Last name</label><input id="pf-last" name="lastName" type="text" value="' + esc(u.lastName || '') + '"><p class="field-err" hidden></p></div>'
      + '<div class="field"><label for="pf-phone">Phone</label><input id="pf-phone" name="phone" type="tel" value="' + esc(u.phone || '') + '"><p class="field-hint">International format, e.g. +234 801 234 5678.</p><p class="field-err" hidden></p></div>'
      + '<div class="field"><label for="pf-addr">Address</label><input id="pf-addr" name="address" type="text" value="' + esc(u.address || '') + '" placeholder="City, country"><p class="field-err" hidden></p></div>'
      + '</div>'
      + '<button class="btn btn-primary" type="submit">Save changes</button>'
      + '</form>'
      + '</section>'
      + '<section class="panel" style="margin:0;">'
      + '<div class="panel-head"><h2 class="panel-title">Account</h2></div>'
      + '<div class="ro-list">'
      + '<div class="kv"><dt>Email</dt><dd>' + esc(u.email || '—') + '</dd></div>'
      + '<div class="kv"><dt>Country</dt><dd>' + esc(u.country || '—') + '</dd></div>'
      + '<div class="kv"><dt>Account ID</dt><dd class="mono">' + esc(u.accountId || '—') + '</dd></div>'
      + '<div class="kv"><dt>Default currency</dt><dd>' + esc(u.defaultCurrency || '—') + '</dd></div>'
      + '<div class="kv"><dt>Member since</dt><dd>' + esc(u.createdAt ? fmt.date(u.createdAt) : '—') + '</dd></div>'
      + '</div>'
      + '<p class="muted small" style="margin-top:14px;">Email, country and account identifiers are read-only. Contact support to change them.</p>'
      + '</section>'
      + '</div>';
  };

  /* ======================================================================
       SECURITY
       ====================================================================== */
  V.security = function (S) {
    var sec = S.data.security || {};
    var u = S.user || {};
    var mfaOn = u ? !!u.mfaEnabled : !!sec.mfaEnabled;
    var suspicious = sec.suspicious || [];
    var events = sec.events || [];
    var frozenBySelf = u && u.frozenBy === 'Customer (self)';

    var susHtml = suspicious.length
      ? suspicious.map(function (e) {
        return '<div class="alert-row">' + icon('alert', 16)
          + '<div><b>' + esc(String(e.type || 'event').replace(/_/g, ' ')) + ' — ' + esc(e.location || 'unknown location') + '</b>'
          + '<span>' + esc(e.detail || '') + ' · ' + esc(e.device || '') + ' · ' + esc(fmt.dateTime(e.ts)) + '</span></div></div>';
      }).join('')
      : '<p class="muted small" style="margin:0;">No suspicious events on record. Sign-in attempts and unusual activity are monitored continuously (simulated).</p>';

    var evRows = events.slice(0, 12).map(function (e) {
      return '<tr>'
        + '<td><span class="cell-main">' + esc(String(e.type || '—').replace(/_/g, ' ')) + '</span>' + (e.suspicious ? '<span class="cell-sub" style="color:var(--danger);">suspicious</span>' : '') + '</td>'
        + '<td>' + esc(e.device || '—') + '</td>'
        + '<td class="mono">' + esc(e.ip || '—') + '</td>'
        + '<td>' + esc(e.location || '—') + '</td>'
        + '<td class="num muted">' + esc(fmt.dateTime(e.ts)) + '</td>'
        + '</tr>';
    }).join('');

    return '<div class="sec-grid">'
      + '<div>'
      + '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Password</h2></div>'
      + '<form data-form="passwordForm" novalidate>'
      + '<div class="field"><label for="pw-cur">Current password</label><input id="pw-cur" name="current" type="password" autocomplete="current-password"><p class="field-err" hidden></p></div>'
      + '<div class="field"><label for="pw-next">New password</label><input id="pw-next" name="next" type="password" autocomplete="new-password"><p class="field-hint">At least 8 characters with uppercase, lowercase and a number.</p><p class="field-err" hidden></p></div>'
      + '<div class="field"><label for="pw-conf">Confirm new password</label><input id="pw-conf" name="confirm" type="password" autocomplete="new-password"><p class="field-err" hidden></p></div>'
      + '<button class="btn btn-primary" type="submit">Update password</button>'
      + '</form>'
      + '</section>'
      + '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Security event history</h2><span class="muted small">' + events.length + ' events</span></div>'
      + (evRows
        ? '<div class="table-wrap"><table><thead><tr><th>Event</th><th>Device</th><th>IP</th><th>Location</th><th class="num">When</th></tr></thead><tbody>' + evRows + '</tbody></table></div>'
        : emptyState('history', 'No security events yet', 'Sign-ins and security changes will be recorded here.'))
      + '</section>'
      + '</div>'
      + '<div>'
      + '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Multi-factor authentication</h2></div>'
      + '<div class="sec-sum-row"><span class="lab">' + icon('shield-check', 16) + 'Status</span><span class="val">' + (mfaOn ? '<span class="dot ok"></span>Enabled' : '<span class="dot warn"></span>Disabled') + '</span></div>'
      + '<p class="muted small" style="margin:12px 0 16px;">An additional code at sign-in (simulated in this prototype). Recommended for every account.</p>'
      + '<button type="button" class="btn ' + (mfaOn ? 'btn-ghost' : 'btn-primary') + ' btn-sm" data-action="mfa:toggle">' + (mfaOn ? 'Disable MFA' : 'Enable MFA') + '</button>'
      + '</section>'
      + '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Suspicious activity</h2>' + (suspicious.length ? '<span class="badge b-failed">' + suspicious.length + ' alert' + (suspicious.length === 1 ? '' : 's') + '</span>' : '') + '</div>'
      + susHtml
      + '</section>'
      + '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Temporary freeze</h2></div>'
      + '<p class="muted small" style="margin:0 0 14px;">Freezing blocks sign-ins and financial activity until unfrozen. Use it if you lose a device or suspect unusual access.</p>'
      + (frozenBySelf
        ? '<button type="button" class="btn btn-primary btn-sm" data-action="unfreeze:self">Unfreeze my account</button>'
        : '<button type="button" class="btn btn-ghost btn-sm" data-action="freeze:self">' + icon('snowflake', 14) + ' Freeze my account</button>')
      + '</section>'
      + '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Account recovery</h2></div>'
      + '<p class="muted small" style="margin:0 0 14px;">Lost access? The password reset flow uses a simulated email token in this prototype.</p>'
      + '<a class="btn btn-ghost btn-sm" href="#/forgot">Reset password</a>'
      + '</section>'
      + '</div>'
      + '</div>';
  };

  /* ======================================================================
       SESSIONS
       ====================================================================== */
  V.sessions = function (S) {
    var d = S.data.sessionsData || { active: [], history: [] };
    var active = d.active || [];
    var history = d.history || [];

    var activeHtml = active.length
      ? '<div class="ses-grid">'
        + active.map(function (x) {
          return '<article class="ses-card' + (x.current ? ' is-current' : '') + '">'
            + '<div class="ses-device">' + icon(x.device && x.device.toLowerCase().indexOf('phone') > -1 ? 'smartphone' : 'dashboard', 17) + esc(x.device || 'Unknown device') + (x.current ? '<span class="badge b-current">This device</span>' : '') + '</div>'
            + '<div class="ses-rows">'
            + '<div class="kv"><dt>Browser</dt><dd>' + esc(x.browser || '—') + ' · ' + esc(x.os || '—') + '</dd></div>'
            + '<div class="kv"><dt>IP address</dt><dd class="mono">' + esc(x.ip || '—') + '</dd></div>'
            + '<div class="kv"><dt>Location</dt><dd>' + esc(x.location || '—') + '</dd></div>'
            + '<div class="kv"><dt>Last active</dt><dd>' + esc(fmt.dateTime(x.lastActive)) + '</dd></div>'
            + '</div>'
            + (x.current
              ? '<span class="muted small">Sign out from the sidebar to end this session.</span>'
              : '<button type="button" class="btn btn-ghost btn-sm" data-action="session:revoke" data-id="' + esc(x.id) + '">Revoke session</button>')
            + '</article>';
        }).join('')
        + '</div>'
      : emptyState('history', 'No active sessions', 'Signed-in devices for your account will appear here.');

    var histRows = history.map(function (x) {
      return '<tr>'
        + '<td><span class="cell-main">' + esc(x.device || '—') + '</span></td>'
        + '<td>' + esc(x.browser || '—') + ' · ' + esc(x.os || '—') + '</td>'
        + '<td class="mono">' + esc(x.ip || '—') + '</td>'
        + '<td>' + esc(x.location || '—') + '</td>'
        + '<td class="num muted">' + esc(fmt.dateTime(x.lastActive)) + '</td>'
        + '<td>' + badge(x.status === 'revoked' ? 'cancelled' : (x.status || 'ended')) + '</td>'
        + '</tr>';
    }).join('');

    return '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Active sessions</h2><span class="muted small">' + active.length + ' signed in</span></div>'
      + activeHtml
      + '</section>'
      + '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Session history</h2></div>'
      + (histRows
        ? '<div class="table-wrap"><table><thead><tr><th>Device</th><th>Browser</th><th>IP</th><th>Location</th><th class="num">Last active</th><th>Status</th></tr></thead><tbody>' + histRows + '</tbody></table></div>'
        : emptyState('history', 'No past sessions', 'Ended and revoked sessions will be listed here.'))
      + '</section>';
  };

  /* ======================================================================
       NOTIFICATIONS
       ====================================================================== */
  V.notifications = function (S) {
    var list = S.data.notifs || [];
    if (!list.length) {
      return emptyState('bell', 'No notifications', 'Account events, deposit updates and security alerts will appear here.');
    }
    var unread = list.filter(function (n) { return !n.read; }).length;
    var items = list.map(function (n) {
      var tone = n.kind === 'success' ? 'ok' : n.kind === 'warning' ? 'warn' : 'acc';
      var ic = n.kind === 'success' ? 'check-circle' : n.kind === 'warning' ? 'alert' : 'info';
      return '<div class="notif-item' + (n.read ? '' : ' unread') + '">'
        + '<span class="notif-ic ' + tone + '">' + icon(ic, 17) + '</span>'
        + '<div class="notif-body">'
        + '<div class="notif-head"><span class="notif-title">' + esc(n.title) + '</span><span class="notif-time">' + esc(fmt.timeAgo(n.ts)) + '</span></div>'
        + '<p class="notif-text">' + esc(n.body) + '</p>'
        + (n.read ? '' : '<button type="button" class="link-btn" data-action="notif:read" data-id="' + esc(n.id) + '">Mark read</button>')
        + '</div>'
        + '</div>';
    }).join('');

    return '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Notifications</h2>'
      + (unread ? '<button type="button" class="btn btn-ghost btn-sm" data-action="notif:read" data-id="all">Mark all read (' + unread + ')</button>' : '<span class="muted small">All read</span>')
      + '</div>'
      + '<p class="panel-sub">' + unread + ' unread · ' + list.length + ' total · demonstration data</p>'
      + items
      + '</section>';
  };

  /* ======================================================================
       SUPPORT
       ====================================================================== */
  V.support = function (S) {
    var tickets = S.data.tickets || [];
    var cats = ['General', 'Deposits', 'Currencies', 'Security', 'Account'];

    var form = '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">New request</h2></div>'
      + '<form data-form="supportForm" novalidate>'
      + '<div class="field"><label for="sp-subject">Subject</label>'
      + '<input id="sp-subject" name="subject" type="text" placeholder="How can we help?">'
      + '<p class="field-err" hidden></p></div>'
      + '<div class="field"><label for="sp-cat">Category</label>'
      + '<select id="sp-cat" name="category">'
      + cats.map(function (c) { return '<option value="' + esc(c) + '"' + (c === 'General' ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="field"><label for="sp-msg">Message</label>'
      + '<textarea id="sp-msg" name="message" placeholder="Describe the issue or question — a demo agent will reply in this prototype."></textarea>'
      + '<p class="field-err" hidden></p></div>'
      + '<button class="btn btn-primary" type="submit">' + icon('send', 15) + ' Send request</button>'
      + '</form>'
      + '</section>';

    var list = tickets.length
      ? tickets.map(function (t) {
        return '<article class="ticket-card">'
          + '<div class="ticket-head">'
          + '<span class="ticket-subject">' + esc(t.subject) + '</span>'
          + '<span class="ticket-meta">' + badge(t.status) + '<span>' + esc(fmt.dateTime(t.createdAt)) + '</span></span>'
          + '</div>'
          + '<p class="muted small" style="margin:0 0 14px;">' + esc(t.category || 'General') + ' · ' + t.messages.length + ' message' + (t.messages.length === 1 ? '' : 's') + '</p>'
          + '<div class="ticket-thread">'
          + t.messages.map(function (m) {
            return '<div class="bubble ' + (m.from === 'customer' ? 'msg-customer' : 'msg-support') + '">'
              + '<span class="bubble-tag">' + (m.from === 'customer' ? 'You' : 'Meridian support') + '</span>'
              + esc(m.text)
              + '<span class="bubble-time">' + esc(fmt.dateTime(m.ts)) + '</span>'
              + '</div>';
          }).join('')
          + '</div>'
          + '</article>';
      }).join('')
      : emptyState('message', 'No conversations yet', 'Support requests you send appear here as tracked conversations — with simulated replies from the demo team.');

    return '<div class="profile-grid">'
      + '<div>' + form + '</div>'
      + '<div>'
      + '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Your conversations</h2><span class="muted small">' + tickets.length + ' ticket' + (tickets.length === 1 ? '' : 's') + '</span></div>'
      + (tickets.length ? '<div>' + list + '</div>' : list)
      + '</section>'
      + '</div>'
      + '</div>';
  };

  /* ======================================================================
       SETTINGS
       ====================================================================== */
  V.settings = function (S) {
    var u = S.user || {};
    var p = u.prefs || {};
    var me = S.me || { accounts: [] };

    return '<div class="set-grid">'
      + '<section class="panel" style="margin:0;">'
      + '<div class="panel-head"><h2 class="panel-title">Notification preferences</h2></div>'
      + '<form data-form="prefsForm" novalidate>'
      + '<label class="toggle-row"><input type="checkbox" name="emailNotifs"' + (p.emailNotifs ? ' checked' : '') + '>'
      + '<span class="toggle-copy"><b>Email notifications</b><small>Deposit confirmations, security alerts and account events.</small></span>'
      + '<span class="switch" aria-hidden="true"></span></label>'
      + '<label class="toggle-row"><input type="checkbox" name="pushNotifs"' + (p.pushNotifs ? ' checked' : '') + '>'
      + '<span class="toggle-copy"><b>In-app notifications</b><small>Same events, delivered to your notification centre.</small></span>'
      + '<span class="switch" aria-hidden="true"></span></label>'
      + '<label class="toggle-row"><input type="checkbox" name="weeklySummary"' + (p.weeklySummary ? ' checked' : '') + '>'
      + '<span class="toggle-copy"><b>Weekly summary</b><small>A digest of balances and activity, ready in Statements each week.</small></span>'
      + '<span class="switch" aria-hidden="true"></span></label>'
      + '<p class="muted small" style="margin:14px 0 16px;">Preferences apply to this demonstration account only.</p>'
      + '<button class="btn btn-primary" type="submit">Save preferences</button>'
      + '</form>'
      + '</section>'
      + '<div>'
      + '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">Account summary</h2></div>'
      + '<div class="ro-list">'
      + '<div class="kv"><dt>Name</dt><dd>' + esc(u.name || '—') + '</dd></div>'
      + '<div class="kv"><dt>Email</dt><dd>' + esc(u.email || '—') + '</dd></div>'
      + '<div class="kv"><dt>Account ID</dt><dd class="mono">' + esc(u.accountId || '—') + '</dd></div>'
      + '<div class="kv"><dt>Default currency</dt><dd>' + esc(u.defaultCurrency || '—') + '</dd></div>'
      + '<div class="kv"><dt>Active currencies</dt><dd>' + me.accounts.map(function (a) { return esc(a.code); }).join(', ') + '</dd></div>'
      + '<div class="kv"><dt>Total (USD equivalent)</dt><dd>' + esc(fmt.usd(me.totalUsd || 0)) + '</dd></div>'
      + '</div>'
      + '<p class="muted small" style="margin-top:14px;">Demo data — stored in your browser only.</p>'
      + '</section>'
      + '<section class="panel">'
      + '<div class="panel-head"><h2 class="panel-title">More</h2></div>'
      + '<div class="links-row">'
      + '<a class="btn btn-ghost btn-sm" href="#/profile">Profile</a>'
      + '<a class="btn btn-ghost btn-sm" href="#/security">Security</a>'
      + '<a class="btn btn-ghost btn-sm" href="#/sessions">Sessions</a>'
      + '</div>'
      + '</section>'
      + '</div>'
      + '</div>';
  };

  /* ======================================================================
       BIND EXTRAS — purely visual/UX hooks for the part-2 views
       (registered into GL.Views._binds, run by views.js bind)
       ====================================================================== */
  GL.Views._binds.push(function (root) {

    /* deposit form: live method availability, limits and balance per currency */
    var sel = root.querySelector('select[name="currency"][data-dep-currency]');
    if (sel) {
      var update = function () {
        var cur = sel.value;
        if (!cur) return;
        var lim = GL.DEPOSIT_LIMITS[cur] || [10, 50000];
        var firstEnabled = null;
        root.querySelectorAll('.method-card').forEach(function (mc) {
          var inp = mc.querySelector('input[name="method"]');
          if (!inp) return;
          var any = inp.getAttribute('data-any') === '1';
          var list = (inp.getAttribute('data-cur') || '').split(',');
          var ok = any || list.indexOf(cur) > -1;
          inp.disabled = !ok;
          mc.classList.toggle('m-off', !ok);
          if (ok && !firstEnabled) firstEnabled = inp;
          if (!ok && inp.checked) inp.checked = false;
        });
        if (firstEnabled && !root.querySelector('input[name="method"]:checked')) firstEnabled.checked = true;
        var limEl = root.querySelector('[data-dep-limits]');
        if (limEl) limEl.textContent = 'Minimum ' + GL.fmt.money(lim[0], cur) + ' · maximum ' + GL.fmt.money(lim[1], cur) + ' per deposit.';
        var amt = root.querySelector('input[name="amount"]');
        if (amt) { amt.min = String(lim[0]); amt.max = String(lim[1]); }
        var balEl = root.querySelector('[data-dep-balance]');
        var nameEl = root.querySelector('[data-dep-cur-name]');
        if (GL.S && GL.S.me) {
          var acc = (GL.S.me.accounts || []).filter(function (a) { return a.code === cur; })[0];
          if (balEl) balEl.textContent = acc ? GL.fmt.money(acc.balance, cur) : '—';
          if (nameEl) nameEl.textContent = acc ? acc.code + ' — ' + acc.name : cur;
        }
      };
      sel.addEventListener('change', update);
      update();
    }

    /* transaction filters: apply on select / date change (search is live via the engine) */
    root.querySelectorAll('form[data-form="txnFilters"] select, form[data-form="txnFilters"] input[type="date"]').forEach(function (f) {
      f.addEventListener('change', function () {
        if (f.form) f.form.dispatchEvent(new Event('submit', { cancelable: true }));
      });
    });

    /* statement preview -> modal with the ledger lines */
    root.querySelectorAll('[data-stmt-preview]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-id');
        b.disabled = true;
        GL.api.statements.get(id).then(function (res) {
          var st = res.data;
          var rows = st.lines.map(function (t) {
            return '<tr><td>' + esc(fmt.date(t.ts)) + '</td><td>' + esc(t.description) + '</td>'
              + '<td class="num">' + esc(fmt.money(t.amount, st.currency)) + '</td><td>' + badge(t.status) + '</td></tr>';
          }).join('');
          GL.modal({
            title: 'Statement — ' + esc(st.period) + ' (' + esc(st.currency) + ')',
            html: '<p class="muted small" style="margin:0 0 14px;">Opening <b class="num">' + esc(fmt.money(st.opening, st.currency)) + '</b> → closing <b class="num">' + esc(fmt.money(st.closing, st.currency)) + '</b> · ' + st.lines.length + ' lines · demonstration data.</p>'
              + '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>',
            cancel: 'Close'
          });
        }).catch(GL.fail).then(function () { b.disabled = false; });
      });
    });
  });
})();
