/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — Design Concept 1 · “Swiss Private Banking”
   customer/swiss/assets/views-more.js

   GL.Views — part 2: account, deposits (full wizard), transactions, txn,
   statements, profile, security, sessions, notifications, support, settings.
   Loads after views.js and extends the same GL.Views object; the engine
   (shared/app-core.js) binds every form and action centrally.
   ========================================================================== */
(function () {
  var V = window.GL.Views;
  var esc = GL.esc, icon = GL.icon, fmt = GL.fmt;
  var badge = V._badge, methodLabel = V._methodLabel, activeAccounts = V._activeAccounts;
  var emptyState = V._emptyState, moneyHtml = V._moneyHtml, depMethodsHtml = V._depMethodsHtml;

  function depStatusBadge(st) { return badge(st); }

  function depositsTable(rows, emptyText) {
    if (!rows || !rows.length) {
      return '<div class="card-b">' + emptyState('card', 'No deposits yet', emptyText,
        '<a class="btn btn-primary btn-sm" href="#/deposits">Make a deposit</a>') + '</div>';
    }
    return '<div class="table-wrap"><table><thead><tr>' +
      '<th>Reference</th><th>Currency</th><th class="ta-r">Amount</th><th>Method</th>' +
      '<th class="ta-r">Fee</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
      rows.map(function (d) {
        return '<tr><td class="num">' + esc(d.reference) + '</td><td>' + esc(d.currency) + '</td>' +
          '<td class="ta-r">' + moneyHtml(d.amount, d.currency) + '</td>' +
          '<td>' + esc(methodLabel(d.method)) + '</td>' +
          '<td class="ta-r"><span class="num">' + fmt.money(d.fee, d.currency) + '</span></td>' +
          '<td>' + depStatusBadge(d.status) + '</td>' +
          '<td class="td-date">' + fmt.date(d.createdAt) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ========================================================================
     #/account/:code
     ======================================================================== */
  V.account = function (S) {
    if (S.data.accountError) {
      return '<a class="link-sm" href="#/accounts">← All accounts</a>' +
        '<div class="card card-b" style="margin-top:14px">' +
        emptyState('search', 'Account not found', S.data.accountError,
          '<a class="btn btn-ghost btn-sm" href="#/accounts">Back to accounts</a>') + '</div>';
    }
    var d = S.data.account || {};
    var a = d.account || {};
    var txns = d.transactions || [];
    var deps = d.deposits || [];
    return '<a class="link-sm" href="#/accounts">← All accounts</a>' +
      '<section class="card" style="margin-top:14px"><div class="card-b">' +
        '<div class="acct-head"><span class="acct-code" style="font-size:16px">' + esc(a.code) + '</span>' +
          badge(a.status) + '<span class="muted small">' + esc(a.name) + '</span></div>' +
        '<p class="acct-bal" style="font-size:36px;margin:10px 0 4px">' + fmt.money(a.balance, a.code) + '</p>' +
        '<p class="muted small" style="margin:0">Demo data · opened ' + fmt.date(a.openedAt) +
          ' · ≈ ' + fmt.usd(a.equivalentUsd) + ' · ' + a.txCount + ' transaction' + (a.txCount === 1 ? '' : 's') + '</p>' +
      '</div></section>' +
      '<section class="card" style="margin-top:18px"><div class="card-h"><h2>Transactions</h2>' +
        '<a class="link-sm" href="#/transactions">All transactions →</a></div>' +
        (txns.length
          ? '<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Description</th>' +
            '<th class="ta-r">Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
            txns.map(function (t) {
              return '<tr data-href="#/txn/' + esc(t.ref) + '"><td><a href="#/txn/' + esc(t.ref) + '">' + esc(t.ref) + '</a></td>' +
                '<td class="td-desc">' + esc(t.description) + '</td>' +
                '<td class="ta-r">' + moneyHtml(t.amount, t.currency) + '</td>' +
                '<td>' + badge(t.status) + '</td><td class="td-date">' + fmt.date(t.ts) + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : '<div class="card-b">' + emptyState('receipt', 'No transactions yet',
              'Simulated deposits into ' + esc(a.code) + ' will appear here.', '') + '</div>') +
      '</section>' +
      '<section class="card" style="margin-top:18px"><div class="card-h"><h2>Deposit records</h2></div>' +
        (deps.length
          ? depositsTable(deps, '')
          : '<div class="card-b">' + emptyState('card', 'No deposits yet',
              'Deposit records for ' + esc(a.code) + ' will appear here.', '') + '</div>') +
      '</section>';
  };

  /* ========================================================================
     #/deposits — the deposit simulation state machine
     ======================================================================== */
  V.deposits = function (S) {
    var history = S.data.deposits || [];

    /* financial operations are blocked during an administrative takeover */
    if (S.takeover) {
      return '<section class="card"><div class="card-b">' +
        '<div class="restrict">' + icon('ban', 22) + '<div>' +
        '<h2>Financial operations are blocked</h2>' +
        '<p>Deposits cannot be initiated during an administrative takeover session. This restriction is ' +
        'enforced in the service layer — the mock API rejects the request with HTTP 403 — not by hiding buttons.</p>' +
        '</div></div></div></section>' +
        '<section class="card" style="margin-top:18px"><div class="card-h"><h2>Deposit history</h2></div>' +
        depositsTable(history, 'No deposits have been recorded for this account.') + '</section>';
    }

    if (!S.dep) return depLanding(S, history);
    if (S.dep.step === 'form') return depFormView(S);
    if (S.dep.step === 'gateway') return depGatewayView(S);
    if (S.dep.step === 'processing') return depProcessingView(S);
    return depResultView(S);
  };

  function depLanding(S, history) {
    var acts = activeAccounts(S);
    var picks = acts.map(function (a) {
      return '<button type="button" class="dep-pick" data-action="dep:new" data-cur="' + esc(a.code) + '">' +
        '<span class="dp-l"><b>' + esc(a.code) + '</b><span>' + esc(a.name) + '</span></span>' +
        '<span class="dp-r"><b>' + fmt.money(a.balance, a.code) + '</b>' + badge(a.status) + '</span></button>';
    }).join('');
    return '<section class="card"><div class="card-h"><h2>Start a new deposit</h2>' +
      '<span class="preview-chip">Simulated</span></div><div class="card-b">' +
      (acts.length
        ? '<p class="page-intro" style="margin-bottom:16px">Choose an active currency account. The payment ' +
          'gateway is simulated end-to-end — no real money moves.</p><div class="dep-picks">' + picks + '</div>'
        : emptyState('wallet', 'No active currency accounts',
          'Activate a currency account to make your first simulated deposit.',
          '<a class="btn btn-primary btn-sm" href="#/activate">Activate a currency</a>')) +
      '</div></section>' +
      '<section class="card" style="margin-top:18px"><div class="card-h"><h2>Deposit history</h2></div>' +
      depositsTable(history, 'Complete a simulated deposit to build a history.') + '</section>';
  }

  function depFormView(S) {
    var acts = activeAccounts(S);
    if (!acts.length) {
      return '<section class="card"><div class="card-b">' +
        emptyState('wallet', 'No active currency accounts', 'Activate a currency before depositing.',
          '<a class="btn btn-primary btn-sm" href="#/activate">Activate a currency</a>') + '</div></section>';
    }
    var preset = (S.dep && S.dep.currency) || '';
    if (!preset && GL.Views._presetCur) { preset = GL.Views._presetCur; }
    GL.Views._presetCur = null;
    if (!acts.some(function (a) { return a.code === preset; })) preset = acts[0].code;
    var lim = (GL.DEPOSIT_LIMITS || {})[preset] || [10, 50000];
    var method = (S.dep && S.dep.method) || '';
    var allowed = (GL.DEPOSIT_METHODS || []).filter(function (m) {
      return !m.currencies || m.currencies.indexOf(preset) > -1;
    }).map(function (m) { return m.id; });
    if (allowed.indexOf(method) === -1) method = '';
    return '<section class="card"><div class="card-b">' +
      '<div class="wiz-head"><h2>New deposit</h2>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="dep:cancel-wizard">Cancel</button></div>' +
      '<p class="gateway-note">' + icon('info', 15) +
        '<span>Simulated payment — no real money moves and no payment provider is contacted.</span></p>' +
      '<form data-form="depForm" novalidate>' +
        '<div class="field"><label for="dep-cur">Currency account</label>' +
          '<select id="dep-cur" name="currency">' +
          acts.map(function (a) {
            return '<option value="' + esc(a.code) + '"' + (a.code === preset ? ' selected' : '') + '>' +
              esc(a.code) + ' — ' + esc(a.name) + ' · ' + fmt.money(a.balance, a.code) + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label for="dep-amt">Amount</label>' +
          '<input id="dep-amt" name="amount" type="number" inputmode="decimal" step="0.01" min="' + lim[0] +
          '" max="' + lim[1] + '" value="' + esc(S.dep && S.dep.amount || '') + '" required>' +
          '<p class="hint" data-dep-limits>Minimum ' + fmt.money(lim[0], preset) + ' — maximum ' +
            fmt.money(lim[1], preset) + ' per deposit.</p>' +
          '<p class="field-err" hidden></p></div>' +
        '<div class="field"><span class="lab">Payment method</span>' +
          '<div class="dep-methods" role="radiogroup" aria-label="Payment method">' +
            depMethodsHtml(preset, method) + '</div>' +
          '<input type="hidden" name="method" value="' + esc(method) + '">' +
          '<p class="field-err" hidden></p></div>' +
        '<div class="wiz-actions">' +
          '<button type="button" class="btn btn-ghost" data-action="dep:cancel-wizard">Back</button>' +
          '<button class="btn btn-primary" type="submit">Review payment</button>' +
        '</div>' +
      '</form></div></section>';
  }

  function depGatewayView(S) {
    var d = S.dep;
    var isBank = d.method === 'bank_transfer';
    var u = S.user || {};
    var payLabel = isBank ? 'Confirm transfer' : 'Pay ' + fmt.money(d.amount, d.currency);
    var summary =
      '<div><span>Reference</span><b>' + esc(d.ref) + '</b></div>' +
      '<div><span>Currency account</span><b>' + esc(d.currency) + '</b></div>' +
      '<div><span>Amount</span><b>' + fmt.money(d.amount, d.currency) + '</b></div>' +
      '<div><span>Fee</span><b>' + fmt.money(d.fee, d.currency) + '</b></div>' +
      '<div><span>Method</span><b>' + esc(d.methodName) + '</b></div>';
    var fields;
    if (isBank) {
      fields = '<div class="bank-inst"><p>Simulated settlement instructions</p><dl>' +
        '<div><dt>Beneficiary</dt><dd>Meridian Demo Settlements</dd></div>' +
        '<div><dt>IBAN</dt><dd>CH00 0012 3456 7890 1234 5</dd></div>' +
        '<div><dt>BIC</dt><dd>MGADEMZZXXX</dd></div>' +
        '<div><dt>Reference</dt><dd>' + esc(d.ref) + '</dd></div>' +
        '<div><dt>Amount</dt><dd>' + fmt.money(d.amount, d.currency) + '</dd></div>' +
        '</dl><p class="hint">Confirming marks the simulated transfer as received. Bank transfers settle ' +
        'as PENDING until the platform confirms them — the balance is not credited yet.</p></div>';
    } else {
      fields = '<div class="field"><label for="gw-name">Name on card</label>' +
          '<input id="gw-name" name="cardName" type="text" autocomplete="cc-name" value="' + esc(u.name || '') + '"></div>' +
        '<div class="field"><label for="gw-num">Card number</label>' +
          '<input id="gw-num" name="cardNumber" type="text" inputmode="numeric" autocomplete="cc-number" value="4242 4242 4242 4242"></div>' +
        '<div class="gw-row">' +
          '<div class="field"><label for="gw-exp">Expiry</label>' +
            '<input id="gw-exp" name="cardExpiry" type="text" inputmode="numeric" autocomplete="cc-exp" value="12/28"></div>' +
          '<div class="field"><label for="gw-cvc">CVC</label>' +
            '<input id="gw-cvc" name="cardCvc" type="text" inputmode="numeric" autocomplete="cc-csc" value="123"></div>' +
        '</div>' +
        '<p class="hint">Demo values are prefilled. Details are never validated or sent anywhere.</p>';
    }
    return '<section class="card"><div class="card-b">' +
      '<div class="wiz-head"><h2>Confirm and pay</h2>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="dep:cancel-wizard">Cancel deposit</button></div>' +
      '<p class="gateway-note">' + icon('info', 15) +
        '<span>Simulated payment — no real money moves. The gateway is part of the demonstration.</span></p>' +
      '<div class="dep-summary">' + summary + '</div>' +
      '<form data-form="gatewayForm" novalidate>' + fields +
        '<div class="wiz-actions">' +
          '<button type="button" class="btn btn-ghost" data-action="dep:gateway-cancel">Cancel payment</button>' +
          '<button class="btn btn-primary btn-lg" type="submit">' + esc(payLabel) + '</button>' +
        '</div>' +
      '</form></div></section>';
  }

  function depProcessingView(S) {
    var d = S.dep;
    return '<section class="card"><div class="card-b dep-processing" role="status">' +
      '<div class="spinner" aria-hidden="true"></div>' +
      '<h2>Processing payment…</h2>' +
      '<p>Reference ' + esc(d.ref) + ' · ' + fmt.money(d.amount, d.currency) + ' via ' + esc(d.methodName) +
      '.<br>The simulated gateway is confirming your payment.</p>' +
      '</div></section>';
  }

  function depResultView(S) {
    var d = S.dep;

    if (d.duplicate) {
      return '<section class="card dep-result r-duplicate">' +
        '<div class="res-ic">' + icon('alert', 24) + '</div>' +
        '<h2>Duplicate payment</h2>' +
        '<p>' + esc(d.message || 'This payment reference has already been processed.') + '</p>' +
        '<div class="res-rows"><div><span>Reference</span><b>' + esc(d.ref) + '</b></div>' +
        '<div><span>HTTP status</span><b>409 Conflict</b></div></div>' +
        '<div class="res-actions">' +
          '<button type="button" class="btn btn-primary" data-action="dep:done">Done</button>' +
        '</div>' +
      '</section>';
    }

    var st = d.result ? d.result.status : 'pending';
    var ic, title, text, rows, actions;

    if (st === 'successful') {
      ic = 'check-circle'; title = 'Payment successful';
      text = 'The deposit has been credited to your ' + esc(d.currency) + ' account. ' +
        (d.message ? esc(d.message) : '');
      rows = '<div><span>Reference</span><b>' + esc(d.ref) + '</b></div>' +
        '<div><span>Amount credited</span><b>' + fmt.money(d.amount, d.currency) + '</b></div>' +
        '<div><span>Method</span><b>' + esc(d.methodName) + '</b></div>' +
        (d.balanceAfter != null ? '<div><span>New ' + esc(d.currency) + ' balance</span><b>' +
          fmt.money(d.balanceAfter, d.currency) + '</b></div>' : '');
      actions = '<button type="button" class="btn btn-ghost" data-action="dep:view-txn">View transactions</button>' +
        '<button type="button" class="btn btn-primary" data-action="dep:done">Done</button>';
    } else if (st === 'pending') {
      ic = 'clock'; title = 'Payment pending';
      text = 'The payment is awaiting confirmation. Your ' + esc(d.currency) +
        ' balance has NOT been credited yet — it will update only if the payment is confirmed.';
      rows = '<div><span>Reference</span><b>' + esc(d.ref) + '</b></div>' +
        '<div><span>Amount</span><b>' + fmt.money(d.amount, d.currency) + '</b></div>' +
        '<div><span>Method</span><b>' + esc(d.methodName) + '</b></div>' +
        '<div><span>Credited</span><b>No — awaiting confirmation</b></div>';
      actions = '<button type="button" class="btn btn-primary" data-action="dep:done">Done</button>';
    } else if (st === 'failed') {
      ic = 'x-circle'; title = 'Payment failed';
      text = 'The simulated payment was declined. Nothing was credited to your account.';
      rows = '<div><span>Reference</span><b>' + esc(d.ref) + '</b></div>' +
        '<div><span>Amount</span><b>' + fmt.money(d.amount, d.currency) + '</b></div>' +
        '<div><span>Credited</span><b>No</b></div>';
      actions = '<button type="button" class="btn btn-primary" data-action="dep:retry">Try again</button>' +
        '<button type="button" class="btn btn-ghost" data-action="dep:done">Done</button>';
    } else {
      ic = 'ban'; title = 'Payment cancelled';
      text = 'The payment was cancelled before completion. Nothing was credited to your account.';
      rows = '<div><span>Reference</span><b>' + esc(d.ref) + '</b></div>' +
        '<div><span>Amount</span><b>' + fmt.money(d.amount, d.currency) + '</b></div>' +
        '<div><span>Credited</span><b>No</b></div>';
      actions = '<button type="button" class="btn btn-primary" data-action="dep:retry">Try again</button>' +
        '<button type="button" class="btn btn-ghost" data-action="dep:done">Done</button>';
    }

    return '<section class="card dep-result r-' + esc(st) + '">' +
      '<div class="res-ic">' + icon(ic, 24) + '</div>' +
      '<h2>' + esc(title) + '</h2>' +
      '<p>' + text + '</p>' +
      '<div class="res-rows">' + rows + '</div>' +
      '<div class="res-actions">' + actions + '</div>' +
      '<p class="demo-link"><button type="button" class="linklike" data-action="dep:duplicate">' +
        'Attempt duplicate (demo)</button> — re-submits the same reference to show the 409 response.</p>' +
    '</section>';
  }

  /* ========================================================================
     #/transactions
     ======================================================================== */
  V.transactions = function (S) {
    var f = S.txnFilters || {};
    var d = S.data.transactions;
    var err = S.data.txnError;
    var curOpts = (GL.CURRENCIES || []).map(function (c) {
      return '<option value="' + esc(c.code) + '"' + (f.currency === c.code ? ' selected' : '') + '>' + esc(c.code) + '</option>';
    }).join('');
    var stOpts = ['successful', 'pending', 'failed', 'cancelled'].map(function (s) {
      return '<option value="' + s + '"' + (f.status === s ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
    }).join('');
    var count = d ? d.total : 0;

    return '<section class="card filt-card">' +
      '<form data-form="txnFilters" novalidate>' +
        '<div class="filt-grid">' +
          '<div class="field"><label for="tf-s">Search</label>' +
            '<input id="tf-s" name="search" type="search" value="' + esc(f.search || '') + '" placeholder="Reference or description"></div>' +
          '<div class="field"><label for="tf-c">Currency</label>' +
            '<select id="tf-c" name="currency"><option value="">All</option>' + curOpts + '</select></div>' +
          '<div class="field"><label for="tf-st">Status</label>' +
            '<select id="tf-st" name="status"><option value="">All</option>' + stOpts + '</select></div>' +
          '<div class="field"><label for="tf-from">From</label>' +
            '<input id="tf-from" name="from" type="date" value="' + esc(f.from || '') + '"></div>' +
          '<div class="field"><label for="tf-to">To</label>' +
            '<input id="tf-to" name="to" type="date" value="' + esc(f.to || '') + '"></div>' +
          '<div class="filt-acts">' +
            '<button class="btn btn-primary btn-sm" type="submit">Apply</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="txn:clear">Clear</button>' +
          '</div>' +
        '</div>' +
      '</form></section>' +
      '<section class="card"><div class="card-h"><h2>Results</h2>' +
        '<span class="res-count">' + count + ' record' + (count === 1 ? '' : 's') + '</span></div>' +
      (err
        ? '<div class="card-b">' + emptyState('alert', 'Could not load transactions', err, '') + '</div>'
        : (d && d.items && d.items.length)
          ? '<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Description</th><th>Currency</th>' +
            '<th class="ta-r">Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
            d.items.map(function (t) {
              return '<tr data-href="#/txn/' + esc(t.ref) + '"><td><a href="#/txn/' + esc(t.ref) + '">' + esc(t.ref) + '</a></td>' +
                '<td class="td-desc">' + esc(t.description) + '</td><td>' + esc(t.currency) + '</td>' +
                '<td class="ta-r">' + moneyHtml(t.amount, t.currency) + '</td>' +
                '<td>' + badge(t.status) + '</td><td class="td-date">' + fmt.date(t.ts) + '</td></tr>';
            }).join('') + '</tbody></table></div>' + pagerHtml(d)
          : '<div class="card-b">' + emptyState('search', 'No transactions found',
              'Try adjusting the filters, or make a simulated deposit to create activity.',
              '<a class="btn btn-primary btn-sm" href="#/deposits">Make a deposit</a>') + '</div>') +
      '</section>';
  };

  function pagerHtml(d) {
    if (!d || !d.pages || d.pages <= 1) return '';
    var html = '<nav class="pager" aria-label="Transactions pages">';
    if (d.page > 1) {
      html += '<button type="button" class="pg pg-nav" data-action="txn:page" data-page="' + (d.page - 1) +
        '" aria-label="Previous page">' + icon('chevron-l', 14) + '</button>';
    }
    for (var i = 1; i <= d.pages; i++) {
      html += '<button type="button" class="pg' + (i === d.page ? ' cur' : '') + '" data-action="txn:page" data-page="' + i +
        '"' + (i === d.page ? ' aria-current="page" disabled' : '') + '>' + i + '</button>';
    }
    if (d.page < d.pages) {
      html += '<button type="button" class="pg pg-nav" data-action="txn:page" data-page="' + (d.page + 1) +
        '" aria-label="Next page">' + icon('chevron', 14) + '</button>';
    }
    return html + '</nav>';
  }

  /* ========================================================================
     #/txn/:ref
     ======================================================================== */
  V.txn = function (S) {
    if (S.data.txnError) {
      return '<a class="link-sm" href="#/transactions">← Transactions</a>' +
        '<div class="card card-b" style="margin-top:14px">' +
        emptyState('search', 'Transaction not found', S.data.txnError,
          '<a class="btn btn-ghost btn-sm" href="#/transactions">Back to transactions</a>') + '</div>';
    }
    var t = S.data.txn || {};
    return '<a class="link-sm" href="#/transactions">← Transactions</a>' +
      '<section class="card" style="margin-top:14px"><div class="card-h"><h2>Transaction detail</h2>' +
        badge(t.status) + '</div><div class="card-b"><dl class="detail-list">' +
        '<div><dt>Reference</dt><dd>' + esc(t.ref) + '</dd></div>' +
        '<div><dt>Description</dt><dd>' + esc(t.description) + '</dd></div>' +
        '<div><dt>Type</dt><dd>' + esc(t.type) + '</dd></div>' +
        '<div><dt>Currency</dt><dd>' + esc(t.currency) + '</dd></div>' +
        '<div><dt>Amount</dt><dd>' + moneyHtml(t.amount, t.currency) + '</dd></div>' +
        '<div><dt>Method</dt><dd>' + esc(t.methodName || t.method || '—') + '</dd></div>' +
        '<div><dt>Status</dt><dd>' + badge(t.status) + '</dd></div>' +
        '<div><dt>Date</dt><dd>' + fmt.dateTime(t.ts) + '</dd></div>' +
      '</dl></div></section>';
  };

  /* ========================================================================
     #/statements
     ======================================================================== */
  V.statements = function (S) {
    var list = S.data.statements || [];
    return '<div class="page-head"><p class="page-intro">Monthly statements are generated per currency ' +
      'from your ledger. Preview on screen or download — statement downloads are demo text files.</p></div>' +
      (list.length
        ? '<section class="card"><div class="table-wrap"><table><thead><tr><th>Period</th><th>Currency</th>' +
          '<th class="ta-r">Opening</th><th class="ta-r">Closing</th><th class="ta-r">Entries</th>' +
          '<th class="ta-r">Actions</th></tr></thead><tbody>' +
          list.map(function (s) {
            return '<tr><td>' + esc(s.period) + '</td><td>' + esc(s.currency) + '</td>' +
              '<td class="ta-r"><span class="num">' + fmt.money(s.opening, s.currency) + '</span></td>' +
              '<td class="ta-r"><span class="num">' + fmt.money(s.closing, s.currency) + '</span></td>' +
              '<td class="ta-r"><span class="num">' + s.count + '</span></td>' +
              '<td class="ta-r" style="white-space:nowrap">' +
                '<button type="button" class="btn btn-ghost btn-sm" data-stmt-preview="' + esc(s.id) + '">Preview</button> ' +
                '<button type="button" class="btn btn-ghost btn-sm" data-action="statement:download" data-id="' + esc(s.id) + '">Download</button>' +
              '</td></tr>';
          }).join('') + '</tbody></table></div></section>'
        : '<section class="card"><div class="card-b">' +
          emptyState('doc', 'No statements yet', 'Statements appear once your accounts have activity.', '') +
          '</div></section>');
  };

  /* ========================================================================
     #/profile
     ======================================================================== */
  V.profile = function (S) {
    var u = S.user || {};
    return '<div class="page-head"><p class="page-intro">Permitted profile fields can be edited; identity ' +
      'and account identifiers are read-only.</p></div>' +
      '<div class="grid-2">' +
      '<section class="card"><div class="card-h"><h2>Edit profile</h2></div><div class="card-b">' +
        (S.takeover
          ? '<p class="gateway-note">' + icon('eye', 15) + '<span>Takeover session — edits made here are ' +
            'permitted edits, recorded in the audit log. The customer is not notified automatically.</span></p>'
          : '') +
        '<form data-form="profileForm" novalidate>' +
          '<div class="gw-row">' +
            '<div class="field"><label for="pf-first">First name</label>' +
              '<input id="pf-first" name="firstName" type="text" value="' + esc(u.firstName || '') + '" required>' +
              '<p class="field-err" hidden></p></div>' +
            '<div class="field"><label for="pf-last">Last name</label>' +
              '<input id="pf-last" name="lastName" type="text" value="' + esc(u.lastName || '') + '" required>' +
              '<p class="field-err" hidden></p></div>' +
          '</div>' +
          '<div class="field"><label for="pf-phone">Phone number</label>' +
            '<input id="pf-phone" name="phone" type="tel" value="' + esc(u.phone || '') + '">' +
            '<p class="field-err" hidden></p></div>' +
          '<div class="field"><label for="pf-addr">Address</label>' +
            '<textarea id="pf-addr" name="address" rows="2">' + esc(u.address || '') + '</textarea>' +
            '<p class="hint">City and country are sufficient for the demonstration.</p></div>' +
          '<button class="btn btn-primary" type="submit">Save changes</button>' +
        '</form></div></section>' +
      '<section class="card"><div class="card-h"><h2>Account details</h2></div><div class="card-b">' +
        '<dl class="ro-list">' +
          '<div><span>Email address</span><b>' + esc(u.email || '—') + '</b></div>' +
          '<div><span>Country</span><b>' + esc(u.country || '—') + '</b></div>' +
          '<div><span>Account ID</span><b class="num">' + esc(u.accountId || '—') + '</b></div>' +
          '<div><span>Default currency</span><b>' + esc(u.defaultCurrency || '—') + '</b></div>' +
          '<div><span>Member since</span><b>' + (u.createdAt ? fmt.date(u.createdAt) : '—') + '</b></div>' +
        '</dl>' +
        '<p class="muted small" style="margin-top:14px">These fields are read-only — they are set at ' +
        'registration and verified.</p>' +
      '</div></section>' +
      '</div>';
  };

  /* ========================================================================
     #/security
     ======================================================================== */
  V.security = function (S) {
    var sec = S.data.security || { mfaEnabled: false, events: [], loginHistory: [], suspicious: [] };
    var u = S.user || {};
    var typeLabels = {
      login: 'Sign-in', login_failed: 'Failed sign-in', password_change: 'Password changed',
      mfa_enabled: 'MFA enabled', mfa_disabled: 'MFA disabled', account_frozen: 'Account frozen'
    };
    return '<div class="stack">' +
      '<section class="card"><div class="card-h"><h2>Multi-factor authentication</h2>' +
        badge(sec.mfaEnabled ? 'active' : 'unavailable') + '</div>' +
        '<div class="card-b" style="display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap">' +
          '<p class="muted" style="margin:0;max-width:52ch">MFA is currently <b>' + (sec.mfaEnabled ? 'enabled' : 'disabled') +
          '</b> (simulated). When enabled, sign-ins ask for a second factor.</p>' +
          '<button type="button" class="btn ' + (sec.mfaEnabled ? 'btn-ghost' : 'btn-primary') + '" data-action="mfa:toggle">' +
            (sec.mfaEnabled ? 'Disable MFA' : 'Enable MFA') + '</button>' +
        '</div></section>' +
      '<section class="card"><div class="card-h"><h2>Change password</h2></div><div class="card-b">' +
        '<form data-form="passwordForm" novalidate style="max-width:420px">' +
          '<div class="field"><label for="pw-cur">Current password</label>' +
            '<input id="pw-cur" name="current" type="password" autocomplete="current-password" required>' +
            '<p class="field-err" hidden></p></div>' +
          '<div class="field"><label for="pw-next">New password</label>' +
            '<input id="pw-next" name="next" type="password" autocomplete="new-password" required>' +
            '<p class="hint">At least 8 characters with uppercase, lowercase and a number.</p>' +
            '<p class="field-err" hidden></p></div>' +
          '<div class="field"><label for="pw-conf">Confirm new password</label>' +
            '<input id="pw-conf" name="confirm" type="password" autocomplete="new-password" required>' +
            '<p class="field-err" hidden></p></div>' +
          '<button class="btn btn-primary" type="submit">Update password</button>' +
        '</form></div></section>' +
      '<section class="card"><div class="card-h"><h2>Suspicious activity</h2>' +
        '<span class="res-count">' + (sec.suspicious ? sec.suspicious.length : 0) + ' alert' +
        (((sec.suspicious || []).length) === 1 ? '' : 's') + '</span></div>' +
        '<div class="card-b">' +
        ((sec.suspicious && sec.suspicious.length)
          ? '<div class="alert-list">' + sec.suspicious.map(function (e) {
              return '<div class="alert-item">' + icon('alert', 17) + '<div><b>' +
                esc(typeLabels[e.type] || e.type) + ' · ' + esc(e.location || 'unknown location') + '</b>' +
                '<span>' + esc(e.detail || '') + ' — ' + fmt.dateTime(e.ts) + ' · IP ' + esc(e.ip) + '</span></div></div>';
            }).join('') + '</div>'
          : '<p class="muted small" style="margin:0">No suspicious events on record.</p>') +
        '</div></section>' +
      '<div class="grid-2">' +
        '<section class="card"><div class="card-h"><h2>Temporary freeze</h2></div><div class="card-b">' +
          '<p class="muted" style="margin:0 0 14px">Freezing blocks sign-ins and financial activity until ' +
            'unfrozen. Useful if you lose a device while travelling.</p>' +
          '<button type="button" class="btn btn-danger" data-action="freeze:self">Freeze my account</button>' +
        '</div></section>' +
        '<section class="card"><div class="card-h"><h2>Account recovery</h2></div><div class="card-b">' +
          '<p class="muted" style="margin:0 0 14px">Locked out? The recovery flow uses your email address ' +
            'to set a new password (simulated in this prototype).</p>' +
          '<a class="btn btn-ghost" href="#/forgot">Start password recovery</a>' +
        '</div></section>' +
      '</div>' +
      '<section class="card"><div class="card-h"><h2>Security event history</h2></div>' +
        ((sec.events && sec.events.length)
          ? '<div class="table-wrap"><table><thead><tr><th>Event</th><th>Detail</th><th>Device</th>' +
            '<th>Location</th><th>IP</th><th>Date</th></tr></thead><tbody>' +
            sec.events.map(function (e) {
              return '<tr><td>' + esc(typeLabels[e.type] || e.type) + (e.suspicious ? ' ' + badge('failed') : '') + '</td>' +
                '<td class="td-desc">' + esc(e.detail || '—') + '</td><td>' + esc(e.device) + '</td>' +
                '<td>' + esc(e.location || '—') + '</td><td class="num">' + esc(e.ip) + '</td>' +
                '<td class="td-date">' + fmt.dateTime(e.ts) + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : '<div class="card-b">' + emptyState('shield', 'No security events yet',
              'Sign-ins, password changes and MFA updates will be listed here.', '') + '</div>') +
      '</section>' +
      '</div>';
  };

  /* ========================================================================
     #/sessions
     ======================================================================== */
  V.sessions = function (S) {
    var data = S.data.sessionsData || { active: [], history: [] };
    return '<section class="card"><div class="card-h"><h2>Active sessions</h2>' +
      '<a class="link-sm" href="#/security">Security →</a></div><div class="card-b">' +
      (data.active.length
        ? data.active.map(function (s) {
            return '<div class="sess-card">' +
              '<div class="sess-main"><b>' + esc(s.device) + ' · ' + esc(s.browser) + ' on ' + esc(s.os) + '</b>' +
              '<span>' + esc(s.ip) + ' · ' + esc(s.location) + ' · last active ' + fmt.timeAgo(s.lastActive) + '</span></div>' +
              '<div class="sess-acts">' +
                (s.current ? '<span class="badge b-active">This device</span>'
                  : '<button type="button" class="btn btn-ghost btn-sm" data-action="session:revoke" data-id="' + esc(s.id) + '">Revoke</button>') +
              '</div></div>';
          }).join('')
        : emptyState('smartphone', 'No active sessions', 'Sign-in sessions appear here as you use the app.', '')) +
      '</div></section>' +
      '<section class="card" style="margin-top:18px"><div class="card-h"><h2>Session history</h2></div>' +
      ((data.history && data.history.length)
        ? '<div class="table-wrap"><table><thead><tr><th>Device</th><th>Browser</th><th>OS</th>' +
          '<th>IP</th><th>Location</th><th>Status</th><th>Last active</th></tr></thead><tbody>' +
          data.history.map(function (s) {
            return '<tr><td>' + esc(s.device) + '</td><td>' + esc(s.browser) + '</td><td>' + esc(s.os) + '</td>' +
              '<td class="num">' + esc(s.ip) + '</td><td>' + esc(s.location) + '</td>' +
              '<td>' + badge(s.status) + '</td><td class="td-date">' + fmt.timeAgo(s.lastActive) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="card-b">' + emptyState('history', 'No past sessions',
            'Ended and revoked sessions will be listed here.', '') + '</div>') +
      '</section>';
  };

  /* ========================================================================
     #/notifications
     ======================================================================== */
  V.notifications = function (S) {
    var list = S.data.notifs || [];
    var unread = list.filter(function (n) { return !n.read; }).length;
    return '<section class="card"><div class="card-h"><h2>All notifications</h2>' +
      '<span class="res-count">' + unread + ' unread</span>' +
      (list.length && unread
        ? '<button type="button" class="btn btn-ghost btn-sm" data-action="notif:read" data-id="all">Mark all read</button>'
        : '') +
      '</div><div class="card-b" style="padding-top:6px;padding-bottom:6px">' +
      (list.length
        ? list.map(function (n) {
            var ic = n.kind === 'success' ? 'check-circle' : n.kind === 'warning' ? 'alert' : 'info';
            return '<div class="notif-item kind-' + esc(n.kind || 'info') + (n.read ? '' : ' unread') + '">' +
              '<span class="n-ic">' + icon(ic, 18) + '</span>' +
              '<div class="n-body"><div class="n-title">' + esc(n.title) + '</div>' +
              '<p class="n-text">' + esc(n.body) + '</p>' +
              '<div class="n-meta"><time>' + fmt.timeAgo(n.ts) + '</time>' +
              (n.read ? '' : '<button type="button" class="linklike" data-action="notif:read" data-id="' + esc(n.id) + '">Mark read</button>') +
              '</div></div></div>';
          }).join('')
        : emptyState('bell', 'You’re all caught up', 'Account notifications will appear here.', '')) +
      '</div></section>';
  };

  /* ========================================================================
     #/support
     ======================================================================== */
  V.support = function (S) {
    var tickets = S.data.tickets || [];
    return '<div class="grid-2">' +
      '<section class="card"><div class="card-h"><h2>New support request</h2></div><div class="card-b">' +
        '<form data-form="supportForm" novalidate>' +
          '<div class="field"><label for="sp-sub">Subject</label>' +
            '<input id="sp-sub" name="subject" type="text" required>' +
            '<p class="field-err" hidden></p></div>' +
          '<div class="field"><label for="sp-cat">Category</label>' +
            '<select id="sp-cat" name="category">' +
              '<option value="General">General</option><option value="Deposits">Deposits</option>' +
              '<option value="Currencies">Currencies</option><option value="Security">Security</option>' +
              '<option value="Account">Account</option></select></div>' +
          '<div class="field"><label for="sp-msg">Message</label>' +
            '<textarea id="sp-msg" name="message" rows="5" required></textarea>' +
            '<p class="field-err" hidden></p></div>' +
          '<button class="btn btn-primary" type="submit">Send request</button>' +
        '</form></div></section>' +
      '<section class="card"><div class="card-h"><h2>Your requests</h2>' +
        '<span class="res-count">' + tickets.length + ' ticket' + (tickets.length === 1 ? '' : 's') + '</span></div>' +
        (tickets.length
          ? '<div class="card-b" style="display:grid;gap:16px">' + tickets.map(function (t) {
              return '<div class="ticket">' +
                '<div class="ticket-h"><h3>' + esc(t.subject) + '</h3><div class="t-meta">' +
                  '<span>' + esc(t.category) + '</span>' + badge(t.status) +
                  '<span>' + fmt.date(t.createdAt) + '</span></div></div>' +
                '<div class="ticket-b">' + t.messages.map(function (m) {
                  return '<div class="msg msg-' + (m.from === 'customer' ? 'customer' : 'support') + '">' +
                    esc(m.text) + '<time>' + (m.from === 'customer' ? 'You' : 'Meridian support') + ' · ' +
                    fmt.dateTime(m.ts) + '</time></div>';
                }).join('') + '</div></div>';
            }).join('') + '</div>'
          : '<div class="card-b">' + emptyState('message', 'No support requests',
              'Your conversations with the demo support desk will appear here.', '') + '</div>') +
      '</section></div>';
  };

  /* ========================================================================
     #/settings
     ======================================================================== */
  V.settings = function (S) {
    var u = S.user || {};
    var p = u.prefs || {};
    var me = S.me || { accounts: [] };
    return '<div class="grid-2">' +
      '<section class="card"><div class="card-h"><h2>Notification preferences</h2></div><div class="card-b">' +
        '<form data-form="prefsForm" novalidate>' +
          '<div class="field field-check"><input type="checkbox" id="st-em" name="emailNotifs"' + (p.emailNotifs ? ' checked' : '') + '>' +
            '<label for="st-em">Email notifications — deposits, verification and security events.</label></div>' +
          '<div class="field field-check"><input type="checkbox" id="st-pu" name="pushNotifs"' + (p.pushNotifs ? ' checked' : '') + '>' +
            '<label for="st-pu">In-app notifications while you are signed in.</label></div>' +
          '<div class="field field-check"><input type="checkbox" id="st-wk" name="weeklySummary"' + (p.weeklySummary ? ' checked' : '') + '>' +
            '<label for="st-wk">Weekly account summary (demo delivery).</label></div>' +
          '<button class="btn btn-primary" type="submit">Save preferences</button>' +
        '</form></div></section>' +
      '<div class="stack">' +
        '<section class="card"><div class="card-h"><h2>Account summary</h2></div><div class="card-b">' +
          '<dl class="ro-list">' +
            '<div><span>Account holder</span><b>' + esc(u.name || '—') + '</b></div>' +
            '<div><span>Account ID</span><b class="num">' + esc(u.accountId || '—') + '</b></div>' +
            '<div><span>Default currency</span><b>' + esc(u.defaultCurrency || '—') + '</b></div>' +
            '<div><span>Active currencies</span><b>' + (me.accounts.length
              ? me.accounts.map(function (a) { return esc(a.code); }).join(' · ')
              : '—') + '</b></div>' +
            '<div><span>Total ≈ USD</span><b>' + fmt.usd(me.totalUsd) + '</b></div>' +
          '</dl>' +
          '<p class="muted small" style="margin-top:12px">Demo data — figures are computed from the ' +
            'demonstration ledger in your browser.</p>' +
        '</div></section>' +
        '<nav class="link-cards" aria-label="Account management">' +
          '<a class="link-card" href="#/profile">' + icon('user', 19) +
            '<span><b>Profile</b><span>Name, phone and address</span></span>' +
            '<span class="lc-go">' + icon('chevron', 16) + '</span></a>' +
          '<a class="link-card" href="#/security">' + icon('shield', 19) +
            '<span><b>Security</b><span>MFA, password, freeze and events</span></span>' +
            '<span class="lc-go">' + icon('chevron', 16) + '</span></a>' +
          '<a class="link-card" href="#/sessions">' + icon('smartphone', 19) +
            '<span><b>Sessions</b><span>Devices signed in to your account</span></span>' +
            '<span class="lc-go">' + icon('chevron', 16) + '</span></a>' +
        '</nav>' +
      '</div></div>';
  };
})();
