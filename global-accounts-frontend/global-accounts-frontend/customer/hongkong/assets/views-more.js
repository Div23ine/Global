/* ==========================================================================
   MERIDIAN GLOBAL ACCOUNTS — Hong Kong International Fintech (Design 2)
   customer/hongkong/assets/views-more.js

   GL.Views part 2 — deposits (full wizard incl. the five result outcomes),
   transactions (+ filters & pagination), transaction detail, statements,
   profile, security, sessions, notifications, support and settings.

   Behaviour stays with the shared engine: data-form / data-action only.
   Shared markup helpers come from GL.HK (defined in views.js).
   ========================================================================== */
window.GL = window.GL || {};
(function () {
  var V = window.GL.Views;
  var esc = GL.esc, icon = GL.icon, fmt = GL.fmt;
  var HK = GL.HK;
  var badge = HK.badge, methodLabel = HK.methodLabel, emptyState = HK.emptyState,
      sessionExpired = HK.sessionExpired, depRow = HK.depRow, PAL = HK.PAL;

  function sumRow(k, v, mono) {
    return '<div class="sum-row"><dt>' + esc(k) + '</dt><dd' + (mono ? ' class="mono"' : '') + '>' + (v == null ? '—' : v) + '</dd></div>';
  }
  function kindIcon(kind) {
    return kind === 'success' ? 'check-circle' : kind === 'warning' ? 'alert' : 'info';
  }

  /* ================================================================ deposits */
  V.deposits = function (S) {
    var me = S.me;
    if (!me) return sessionExpired();
    var deps = S.data.deposits || [];
    var actives = (me.accounts || []).filter(function (a) { return a.status === 'active'; });

    /* --- takeover: financial operations are blocked in the service layer --- */
    if (S.takeover) {
      return '<div class="empty">' +
          '<span class="empty-ic warn">' + icon('ban', 28) + '</span>' +
          '<h3>Deposits are blocked during takeover</h3>' +
          '<p>Financial operations — including deposits — are rejected by the service layer while an administrative takeover session is active (TAKEOVER_FINANCIAL_BLOCKED, HTTP 403).</p>' +
          '<a class="btn btn-primary" href="#/overview">Back to overview</a>' +
        '</div>' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Deposit history</h2><span class="panel-chip">demo data</span></div>' +
          (deps.length
            ? '<div class="table-wrap"><table>' +
                '<thead><tr><th>Reference</th><th>Cur.</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>' +
                '<tbody>' + deps.map(depRow).join('') + '</tbody></table></div>'
            : emptyState('receipt', 'No deposits', 'Deposit attempts will be listed here.')) +
        '</section>';
    }

    /* --- landing ---------------------------------------------------------- */
    if (!S.dep) {
      return '<section class="panel">' +
          '<div class="panel-head"><h2>Start a new deposit</h2><span class="panel-chip">' + icon('info', 13) + ' simulated</span></div>' +
          '<p class="muted">Choose an account to deposit into, then complete the mock payment. Only a successful outcome credits the balance — of that currency only.</p>' +
          (actives.length
            ? '<div class="dep-picker">' + actives.map(function (a) {
                return '<div class="dep-pick">' +
                  '<span class="curcard-sym" aria-hidden="true">' + esc(a.symbol) + '</span>' +
                  '<div class="dep-pick-txt"><b>' + esc(a.code) + '</b>' +
                  '<small>' + esc(fmt.money(a.balance, a.code)) + ' · ≈ ' + esc(fmt.usd(a.equivalentUsd)) + '</small></div>' +
                  '<button class="btn btn-primary btn-sm" type="button" data-action="dep:new">' + icon('arrow-up', 14) + ' Deposit</button>' +
                '</div>';
              }).join('') + '</div>'
            : emptyState('wallet', 'No active currency accounts', 'Activate a currency before depositing — new accounts start at zero.',
                '<a class="btn btn-primary" href="#/activate">Activate a currency</a>')) +
        '</section>' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Deposit history</h2><span class="panel-chip">demo data</span></div>' +
          (deps.length
            ? '<div class="table-wrap"><table>' +
                '<thead><tr><th>Reference</th><th>Cur.</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>' +
                '<tbody>' + deps.map(depRow).join('') + '</tbody></table></div>'
            : emptyState('arrow-up', 'No deposits yet', 'Your deposit attempts — successful, pending, failed or cancelled — will be listed here.',
                (actives.length ? '<a class="btn btn-primary" href="#/deposits" data-action="dep:new">Start a deposit</a>' : ''))) +
        '</section>';
    }

    var d = S.dep;

    /* --- step: form -------------------------------------------------------- */
    if (d.step === 'form') {
      var curOpts = actives.map(function (a) {
        return '<option value="' + esc(a.code) + '"' + (d.currency === a.code ? ' selected' : '') + '>' +
          esc(a.code) + ' — ' + esc(fmt.money(a.balance, a.code)) + ' available</option>';
      }).join('');
      var methods = (GL.DEPOSIT_METHODS || []).map(function (m) {
        var on = d.method === m.id;
        return '<button type="button" class="method-card' + (on ? ' is-on' : '') + '" data-method="' + esc(m.id) + '"' +
          ' data-currencies="' + (m.currencies ? m.currencies.join(',') : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          '<span class="method-ic" aria-hidden="true">' + icon(m.icon, 19) + '</span>' +
          '<span class="method-info"><b>' + esc(m.label) + '</b><small>' + esc(m.desc) + '</small><em>' + esc(m.feeNote) + '</em></span>' +
        '</button>';
      }).join('');
      return '<section class="panel wiz">' +
          '<div class="wiz-head">' +
            '<button class="icon-btn" type="button" data-action="dep:cancel-wizard" aria-label="Cancel deposit wizard">' + icon('x', 16) + '</button>' +
            '<h2>New deposit</h2><span class="panel-chip">simulated</span>' +
          '</div>' +
          '<form data-form="depForm" novalidate>' +
            '<div class="field">' +
              '<label for="dp-cur">Deposit into</label>' +
              '<select id="dp-cur" name="currency">' + curOpts + '</select>' +
            '</div>' +
            '<div class="field">' +
              '<label for="dp-amt">Amount</label>' +
              '<input id="dp-amt" name="amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="' + esc(d.amount || '') + '">' +
              '<p class="field-err" hidden></p>' +
              '<p class="hint" data-dep-limits>Choose a currency to see limits.</p>' +
            '</div>' +
            '<fieldset class="method-field">' +
              '<legend>Payment method</legend>' +
              '<div class="method-grid" role="group" aria-label="Payment method">' + methods + '</div>' +
              '<input type="hidden" name="method" value="' + esc(d.method || '') + '">' +
            '</fieldset>' +
            '<button class="btn btn-primary" type="submit">Continue to payment ' + icon('arrow-r', 14) + '</button>' +
            '<p class="preview-note">' + icon('info', 14) + ' Simulated deposit — no real money moves. Credit card is not available for NGN.</p>' +
          '</form>' +
        '</section>';
    }

    /* --- step: gateway ----------------------------------------------------- */
    if (d.step === 'gateway') {
      var isBank = d.method === 'bank_transfer';
      return '<section class="panel wiz">' +
          '<div class="wiz-head">' +
            '<button class="icon-btn" type="button" data-action="dep:gateway-cancel" aria-label="Cancel payment">' + icon('x', 16) + '</button>' +
            '<h2>Complete payment</h2>' +
            '<span class="panel-chip chip-warn">' + icon('info', 13) + ' Simulated payment — no real money moves</span>' +
          '</div>' +
          '<dl class="dep-summary">' +
            sumRow('Reference', '<code>' + esc(d.ref) + '</code>') +
            sumRow('Amount', esc(fmt.money(d.amount, d.currency)), true) +
            sumRow('Fee', esc(fmt.money(d.fee, d.currency)), true) +
            sumRow('Method', esc(d.methodName || methodLabel(d.method))) +
            sumRow('Credits', esc(d.currency) + ' account only') +
          '</dl>' +
          (isBank
            ? '<div class="bank-box">' +
                '<h3>' + icon('bank', 16) + ' Bank transfer instructions (demo)</h3>' +
                '<dl class="detail-grid bank-details">' +
                  sumRow('Beneficiary', 'Meridian Demo Platform') +
                  sumRow('Bank', 'Demo Bank AG') +
                  sumRow('IBAN', '<code>CH93 0076 2011 6238 5295 7</code>') +
                  sumRow('BIC / SWIFT', '<code>DEMOCHZZ</code>') +
                  sumRow('Amount', esc(fmt.money(d.amount, d.currency)), true) +
                  sumRow('Reference', '<b>' + esc(d.ref) + '</b> — include this exactly') +
                '</dl>' +
                '<p class="muted">These are demonstration details — nothing is transferred anywhere. Confirming marks the attempt and the simulator decides the outcome; bank transfers settle as pending.</p>' +
              '</div>' +
              '<form data-form="gatewayForm" novalidate>' +
                '<button class="btn btn-primary btn-block" type="submit">' + icon('check', 15) + ' I’ve sent the transfer — confirm</button>' +
              '</form>'
            : '<form data-form="gatewayForm" novalidate>' +
                '<div class="field">' +
                  '<label for="gw-name">Name on card</label>' +
                  '<input id="gw-name" name="cardName" type="text" autocomplete="cc-name" value="' + esc(S.user ? S.user.name : '') + '">' +
                  '<p class="field-err" hidden></p>' +
                '</div>' +
                '<div class="field">' +
                  '<label for="gw-num">Card number</label>' +
                  '<input id="gw-num" name="cardNumber" type="text" inputmode="numeric" autocomplete="cc-number" class="mono" value="4242 4242 4242 4242">' +
                  '<p class="field-err" hidden></p>' +
                  '<p class="hint">Demo card — prefilled and never sent anywhere.</p>' +
                '</div>' +
                '<div class="field-row">' +
                  '<div class="field">' +
                    '<label for="gw-exp">Expiry</label>' +
                    '<input id="gw-exp" name="cardExpiry" type="text" placeholder="MM/YY" autocomplete="cc-exp" value="12/28">' +
                    '<p class="field-err" hidden></p>' +
                  '</div>' +
                  '<div class="field">' +
                    '<label for="gw-cvc">CVC</label>' +
                    '<input id="gw-cvc" name="cardCvc" type="text" inputmode="numeric" maxlength="4" autocomplete="cc-csc" value="123">' +
                    '<p class="field-err" hidden></p>' +
                  '</div>' +
                '</div>' +
                '<button class="btn btn-primary btn-block" type="submit">' + icon('lock', 14) + ' Pay now — ' + esc(fmt.money(d.amount, d.currency)) + '</button>' +
              '</form>') +
          '<button class="btn btn-ghost btn-block" type="button" data-action="dep:gateway-cancel">Cancel payment</button>' +
        '</section>';
    }

    /* --- step: processing --------------------------------------------------- */
    if (d.step === 'processing') {
      return '<section class="panel processing">' +
          '<div class="spinner" role="status" aria-label="Processing payment"></div>' +
          '<h2>Confirming payment…</h2>' +
          '<p class="muted">The simulated gateway is deciding the outcome — this takes a moment.</p>' +
          '<p class="mono dep-ref">Ref <code>' + esc(d.ref) + '</code></p>' +
        '</section>';
    }

    /* --- step: result (five outcomes + duplicate) ---------------------------- */
    var st = d.duplicate ? 'duplicate' : (d.result ? d.result.status : 'processing');
    var meta = {
      successful: { ic: 'check-circle', cls: 'ok', title: 'Payment successful' },
      pending:    { ic: 'clock',        cls: 'warn', title: 'Awaiting confirmation' },
      failed:     { ic: 'x-circle',     cls: 'err', title: 'Payment failed' },
      cancelled:  { ic: 'ban',          cls: 'grey', title: 'Payment cancelled' },
      duplicate:  { ic: 'layers',       cls: 'dup', title: 'Duplicate reference' }
    }[st] || { ic: 'clock', cls: 'warn', title: 'Processing' };

    var body = '';
    if (st === 'successful') {
      body = '<p class="result-lead ok-text">' + icon('check-circle', 17) + ' ' +
        esc(d.message || 'Balance credited.') + '</p>' +
        '<dl class="dep-summary">' +
          sumRow('New ' + d.currency + ' balance', '<b>' + esc(fmt.money(d.balanceAfter, d.currency)) + '</b>', true) +
          sumRow('Credited', esc(fmt.money(d.amount, d.currency)), true) +
          sumRow('Fee', esc(fmt.money(d.fee, d.currency)), true) +
          sumRow('Reference', '<code>' + esc(d.ref) + '</code>') +
          sumRow('Method', esc(d.methodName || methodLabel(d.method))) +
        '</dl>' +
        '<div class="result-actions">' +
          '<button class="btn btn-primary" type="button" data-action="dep:done">Done</button>' +
          '<button class="btn btn-ghost" type="button" data-action="dep:view-txn">' + icon('receipt', 14) + ' View transactions</button>' +
        '</div>';
    } else if (st === 'pending') {
      body = '<p class="result-lead warn-text">' + icon('clock', 17) + ' ' +
        esc(d.message || 'Payment is awaiting confirmation.') + '</p>' +
        '<p class="muted"><b>Not credited yet</b> — the balance updates only after the payment provider confirms. Pending deposits never credit automatically.</p>' +
        '<dl class="dep-summary">' +
          sumRow('Amount', esc(fmt.money(d.amount, d.currency)), true) +
          sumRow('Reference', '<code>' + esc(d.ref) + '</code>') +
          sumRow('Method', esc(d.methodName || methodLabel(d.method))) +
        '</dl>' +
        '<div class="result-actions">' +
          '<button class="btn btn-primary" type="button" data-action="dep:done">Done</button>' +
          '<button class="btn btn-ghost" type="button" data-action="dep:view-txn">' + icon('receipt', 14) + ' View transactions</button>' +
        '</div>';
    } else if (st === 'failed') {
      body = '<p class="result-lead err-text">' + icon('x-circle', 17) + ' ' +
        esc(d.message || 'Payment failed. Nothing was credited.') + '</p>' +
        '<dl class="dep-summary">' +
          sumRow('Amount', esc(fmt.money(d.amount, d.currency)), true) +
          sumRow('Reference', '<code>' + esc(d.ref) + '</code>') +
        '</dl>' +
        '<div class="result-actions">' +
          '<button class="btn btn-primary" type="button" data-action="dep:retry">' + icon('refresh', 14) + ' Retry deposit</button>' +
          '<button class="btn btn-ghost" type="button" data-action="dep:done">Done</button>' +
        '</div>';
    } else if (st === 'cancelled') {
      body = '<p class="result-lead grey-text">' + icon('ban', 17) + ' ' +
        esc(d.message || 'Payment cancelled. Nothing was credited.') + '</p>' +
        '<dl class="dep-summary">' +
          sumRow('Amount', esc(fmt.money(d.amount, d.currency)), true) +
          sumRow('Reference', '<code>' + esc(d.ref) + '</code>') +
        '</dl>' +
        '<div class="result-actions">' +
          '<button class="btn btn-primary" type="button" data-action="dep:retry">' + icon('refresh', 14) + ' Try again</button>' +
          '<button class="btn btn-ghost" type="button" data-action="dep:done">Done</button>' +
        '</div>';
    } else {
      body = '<p class="result-lead dup-text">' + icon('layers', 17) + ' 409 — This payment reference has already been processed.</p>' +
        '<p class="muted">The service layer rejects a second confirmation of the same reference. Nothing was credited twice.</p>' +
        '<dl class="dep-summary">' +
          sumRow('Reference', '<code>' + esc(d.ref) + '</code>') +
          sumRow('HTTP status', '<code>409 DUPLICATE_REFERENCE</code>') +
        '</dl>' +
        '<div class="result-actions">' +
          '<button class="btn btn-primary" type="button" data-action="dep:done">Done</button>' +
          '<button class="btn btn-ghost" type="button" data-action="dep:view-txn">' + icon('receipt', 14) + ' View transactions</button>' +
        '</div>';
    }

    return '<section class="panel result-panel ' + meta.cls + '">' +
        '<span class="result-ic ' + meta.cls + '" aria-hidden="true">' + icon(meta.ic, 36) + '</span>' +
        '<h2>' + esc(meta.title) + '</h2>' + badge(st) +
        body +
        '<p class="demo-links">' + icon('info', 13) + ' Demo affordances: ' +
          '<button type="button" class="linklike" data-action="dep:duplicate">Attempt duplicate (demo)</button>' +
          '<span aria-hidden="true">·</span>' +
          '<button type="button" class="linklike" data-action="dep:done">Done</button>' +
        '</p>' +
      '</section>';
  };

  /* ============================================================ transactions */
  V.transactions = function (S) {
    var data = S.data.transactions;
    if (!data) {
      return emptyState('alert', 'Couldn’t load transactions',
        (S.data.txnError || 'Something went wrong. Try again.'),
        '<a class="btn btn-primary" href="#/transactions">Retry</a>');
    }
    var f = S.txnFilters || {};
    var curOpts = '<option value="">All currencies</option>' + (GL.CURRENCIES || []).map(function (c) {
      return '<option value="' + esc(c.code) + '"' + (f.currency === c.code ? ' selected' : '') + '>' +
        esc(c.code) + ' — ' + esc(c.name) + '</option>';
    }).join('');
    var stOpts = '<option value="">All statuses</option>' + ['successful', 'pending', 'failed', 'cancelled'].map(function (s) {
      return '<option value="' + s + '"' + (f.status === s ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
    var filtering = !!(f.search || f.currency || f.status || f.from || f.to);

    var pagerHtml = '';
    if (data.pages > 1) {
      var nums = '';
      for (var i = 1; i <= data.pages; i++) {
        nums += '<button type="button" class="pager-btn' + (i === data.page ? ' is-on' : '') +
          '" data-action="txn:page" data-page="' + i + '"' + (i === data.page ? ' aria-current="page"' : '') + '>' + i + '</button>';
      }
      pagerHtml = '<nav class="pager" aria-label="Transactions pagination">' +
        '<button type="button" class="pager-btn" data-action="txn:page" data-page="' + Math.max(1, data.page - 1) + '"' + (data.page <= 1 ? ' disabled' : '') + ' aria-label="Previous page">' + icon('chevron-l', 14) + '</button>' +
        nums +
        '<button type="button" class="pager-btn" data-action="txn:page" data-page="' + Math.min(data.pages, data.page + 1) + '"' + (data.page >= data.pages ? ' disabled' : '') + ' aria-label="Next page">' + icon('chevron', 14) + '</button>' +
        '</nav>';
    }

    return '<form class="panel filters" data-form="txnFilters" novalidate>' +
        '<div class="filter-grid">' +
          '<div class="field field-search">' +
            '<label for="tf-q">Search</label>' +
            '<input id="tf-q" name="search" type="search" placeholder="Reference, description…" value="' + esc(f.search || '') + '">' +
          '</div>' +
          '<div class="field">' +
            '<label for="tf-cur">Currency</label>' +
            '<select id="tf-cur" name="currency">' + curOpts + '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label for="tf-st">Status</label>' +
            '<select id="tf-st" name="status">' + stOpts + '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label for="tf-from">From</label>' +
            '<input id="tf-from" name="from" type="date" value="' + esc(f.from || '') + '">' +
          '</div>' +
          '<div class="field">' +
            '<label for="tf-to">To</label>' +
            '<input id="tf-to" name="to" type="date" value="' + esc(f.to || '') + '">' +
          '</div>' +
        '</div>' +
        '<div class="filter-actions">' +
          '<button class="btn btn-primary btn-sm" type="submit">' + icon('filter', 14) + ' Apply filters</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="txn:clear">Clear</button>' +
        '</div>' +
      '</form>' +
      '<div class="results-bar">' +
        '<p><b>' + data.total + '</b> transaction' + (data.total === 1 ? '' : 's') + (filtering ? ' · filtered' : '') +
          (data.pages > 1 ? ' · page ' + data.page + ' of ' + data.pages : '') + '</p>' +
        '<span class="panel-chip">' + icon('info', 13) + ' demo data</span>' +
      '</div>' +
      (data.items.length
        ? '<section class="panel"><div class="table-wrap"><table>' +
            '<thead><tr><th>Reference</th><th>Description</th><th>Cur.</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>' +
            '<tbody>' + data.items.map(HK.txnRow).join('') + '</tbody></table></div></section>' + pagerHtml
        : emptyState('search', 'No transactions found',
            filtering ? 'No transactions match the current filters — try clearing them.' : 'Successful deposits and fees will appear here once you have activity.',
            filtering ? '<button class="btn btn-primary" type="button" data-action="txn:clear">Clear filters</button>' : '')) ;
  };

  /* ========================================================= txn detail */
  V.txn = function (S) {
    if (S.data.txnError) {
      return emptyState('x-circle', 'Transaction not found', S.data.txnError,
        '<a class="btn btn-primary" href="#/transactions">Back to transactions</a>');
    }
    var t = S.data.txn;
    if (!t) return sessionExpired();
    var neg = Number(t.amount) < 0;
    return '<a class="backlink" href="#/transactions">' + icon('chevron-l', 14) + ' All transactions</a>' +
      '<section class="panel txn-detail">' +
        '<div class="panel-head"><h2><code>' + esc(t.ref) + '</code></h2>' + badge(t.status) + '</div>' +
        '<p class="txn-amount ' + (neg ? 'neg' : 'pos') + '">' + esc(fmt.money(t.amount, t.currency)) + '</p>' +
        '<dl class="detail-grid">' +
          '<div><dt>Description</dt><dd>' + esc(t.description) + '</dd></div>' +
          '<div><dt>Currency</dt><dd><b>' + esc(t.currency) + '</b></dd></div>' +
          '<div><dt>Type</dt><dd>' + esc(String(t.type || '—').replace(/_/g, ' ')) + '</dd></div>' +
          '<div><dt>Method</dt><dd>' + esc(t.methodName || methodLabel(t.method)) + '</dd></div>' +
          '<div><dt>Date</dt><dd>' + esc(fmt.dateTime(t.ts)) + '</dd></div>' +
          '<div><dt>Status</dt><dd>' + badge(t.status) + '</dd></div>' +
        '</dl>' +
        '<p class="preview-note">' + icon('info', 14) + ' Demo data — this ledger entry lives in your browser only.</p>' +
      '</section>';
  };

  /* ============================================================== statements */
  V.statements = function (S) {
    var list = S.data.statements;
    if (!list) return sessionExpired();
    return '<div class="page-callout">' + icon('doc', 16) +
        '<p>Statements are generated per currency from the ledger and download as <b>demo text files</b>. All figures are demonstration data.</p>' +
      '</div>' +
      (list.length
        ? '<section class="panel">' +
            '<div class="panel-head"><h2>Monthly statements</h2><span class="panel-chip">' + list.length + ' available</span></div>' +
            '<div class="table-wrap"><table>' +
              '<thead><tr><th>Period</th><th>Currency</th><th>Opening → Closing</th><th>Lines</th><th>Actions</th></tr></thead>' +
              '<tbody>' + list.map(function (s) {
                return '<tr>' +
                  '<td><b>' + esc(s.period) + '</b></td>' +
                  '<td>' + esc(s.currency) + '</td>' +
                  '<td class="mono">' + esc(fmt.money(s.opening, s.currency)) + ' → ' + esc(fmt.money(s.closing, s.currency)) + '</td>' +
                  '<td>' + s.count + '</td>' +
                  '<td class="stmt-actions">' +
                    '<button type="button" class="btn btn-ghost btn-sm" data-stmt-preview="' + esc(s.id) + '">' + icon('eye', 13) + ' Preview</button>' +
                    '<button type="button" class="btn btn-ghost btn-sm" data-action="statement:download" data-id="' + esc(s.id) + '">' + icon('download', 13) + ' Download</button>' +
                  '</td></tr>';
              }).join('') + '</tbody></table></div>' +
          '</section>'
        : emptyState('doc', 'No statements yet', 'Monthly statements appear once your currency accounts have activity.',
            '<a class="btn btn-primary" href="#/deposits">Make a deposit</a>'));
  };

  /* ================================================================= profile */
  V.profile = function (S) {
    var me = S.me;
    if (!me) return sessionExpired();
    var u = S.user || {};
    return '<div class="profile-grid">' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Editable details</h2></div>' +
          (S.takeover
            ? '<div class="takeover-note">' + icon('shield', 14) + ' Takeover session — edits are permitted and recorded in the audit log. The customer is not notified automatically.</div>'
            : '') +
          '<form data-form="profileForm" novalidate>' +
            '<div class="field-row">' +
              '<div class="field">' +
                '<label for="pf-first">First name</label>' +
                '<input id="pf-first" name="firstName" type="text" autocomplete="given-name" value="' + esc(u.firstName || '') + '" required>' +
                '<p class="field-err" hidden></p>' +
              '</div>' +
              '<div class="field">' +
                '<label for="pf-last">Last name</label>' +
                '<input id="pf-last" name="lastName" type="text" autocomplete="family-name" value="' + esc(u.lastName || '') + '" required>' +
                '<p class="field-err" hidden></p>' +
              '</div>' +
            '</div>' +
            '<div class="field">' +
              '<label for="pf-phone">Phone</label>' +
              '<input id="pf-phone" name="phone" type="tel" autocomplete="tel" value="' + esc(u.phone || '') + '">' +
              '<p class="field-err" hidden></p>' +
            '</div>' +
            '<div class="field">' +
              '<label for="pf-addr">Address</label>' +
              '<input id="pf-addr" name="address" type="text" autocomplete="street-address" placeholder="City, country" value="' + esc(u.address || '') + '">' +
              '<p class="field-err" hidden></p>' +
            '</div>' +
            '<button class="btn btn-primary" type="submit">' + icon('check', 14) + ' Save changes</button>' +
          '</form>' +
        '</section>' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Read-only details</h2></div>' +
          '<dl class="detail-grid">' +
            '<div><dt>Email</dt><dd>' + esc(u.email || '—') + '</dd></div>' +
            '<div><dt>Country</dt><dd>' + esc(u.country || '—') + '</dd></div>' +
            '<div><dt>Account ID</dt><dd><code>' + esc(u.accountId || '—') + '</code></dd></div>' +
            '<div><dt>Default currency</dt><dd><b>' + esc(u.defaultCurrency || '—') + '</b></dd></div>' +
            '<div><dt>Accounts</dt><dd>' + (me.accounts || []).map(function (a) { return esc(a.code); }).join(', ') + '</dd></div>' +
            '<div><dt>Status</dt><dd>' + (u.status ? badge(u.status === 'frozen' ? 'frozen' : 'active') : '—') + '</dd></div>' +
          '</dl>' +
          '<p class="muted">These fields are fixed after registration. To change them, contact support with your request.</p>' +
          '<a class="btn btn-ghost btn-sm" href="#/support">' + icon('life', 14) + ' Contact support</a>' +
        '</section>' +
      '</div>';
  };

  /* ================================================================ security */
  V.security = function (S) {
    var sec = S.data.security;
    if (!sec) return sessionExpired();
    var u = S.user || {};
    var frozen = u.status === 'frozen';
    var selfFroze = u.frozenBy === 'Customer (self)';
    var events = sec.events || [];

    return '<div class="sec-grid">' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Multi-factor authentication</h2>' +
            (sec.mfaEnabled ? '<span class="badge b-active">on</span>' : '<span class="badge b-unavailable">off</span>') + '</div>' +
          '<p class="muted">Adds a second step at sign-in (simulated in this prototype).</p>' +
          '<button class="btn ' + (sec.mfaEnabled ? 'btn-danger' : 'btn-primary') + '" type="button" data-action="mfa:toggle">' +
            (sec.mfaEnabled ? icon('x', 14) + ' Disable MFA' : icon('shield-check', 14) + ' Enable MFA') + '</button>' +
        '</section>' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Temporary freeze</h2>' +
            (frozen ? '<span class="badge b-frozen">frozen</span>' : '') + '</div>' +
          (frozen && selfFroze
            ? '<p class="muted">Your account is frozen by your own request. You can unfreeze it here (demo recovery).</p>' +
              '<button class="btn btn-primary" type="button" data-action="unfreeze:self">' + icon('refresh', 14) + ' Unfreeze my account</button>'
            : frozen
              ? '<p class="muted">An administrator froze this account for security review. Contact support to resolve it.</p>' +
                '<a class="btn btn-ghost" href="contact.html">' + icon('life', 14) + ' Contact support</a>'
              : '<p class="muted">Freezing blocks sign-ins and financial activity until you unfreeze it. Use it if you lose a device or notice unusual activity.</p>' +
                '<button class="btn btn-danger" type="button" data-action="freeze:self">' + icon('snowflake', 14) + ' Freeze my account</button>') +
        '</section>' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Account recovery</h2></div>' +
          '<p class="muted">Forgot your password? The reset flow generates a demo token instantly — no real email is sent.</p>' +
          '<a class="btn btn-ghost" href="#/forgot">' + icon('key', 14) + ' Reset password</a>' +
        '</section>' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Change password</h2></div>' +
          '<form data-form="passwordForm" novalidate>' +
            '<div class="field">' +
              '<label for="pw-cur">Current password</label>' +
              '<input id="pw-cur" name="current" type="password" autocomplete="current-password" required>' +
              '<p class="field-err" hidden></p>' +
            '</div>' +
            '<div class="field">' +
              '<label for="pw-next">New password</label>' +
              '<input id="pw-next" name="next" type="password" autocomplete="new-password" required>' +
              '<p class="field-err" hidden></p>' +
              '<p class="hint">Uppercase, lowercase and a number.</p>' +
            '</div>' +
            '<div class="field">' +
              '<label for="pw-conf">Confirm new password</label>' +
              '<input id="pw-conf" name="confirm" type="password" autocomplete="new-password" required>' +
              '<p class="field-err" hidden></p>' +
            '</div>' +
            '<button class="btn btn-primary" type="submit">' + icon('lock', 14) + ' Update password</button>' +
          '</form>' +
        '</section>' +
      '</div>' +
      '<section class="panel">' +
        '<div class="panel-head"><h2>Suspicious activity</h2><span class="panel-chip">' + (sec.suspicious || []).length + ' flagged</span></div>' +
        ((sec.suspicious || []).length
          ? '<ul class="susp-list">' + sec.suspicious.map(function (e) {
              return '<li>' +
                '<span class="susp-ic" aria-hidden="true">' + icon('alert', 17) + '</span>' +
                '<div><b>' + esc(e.detail || e.type) + '</b>' +
                '<small>' + esc(e.device || '—') + ' · ' + esc(e.location || '—') + ' · ' + esc(fmt.dateTime(e.ts)) + '</small></div>' +
              '</li>';
            }).join('') + '</ul>'
          : '<div class="empty-mini">' + icon('check-circle', 22) + '<p>No suspicious events on record.</p></div>') +
      '</section>' +
      '<section class="panel">' +
        '<div class="panel-head"><h2>Security event history</h2><span class="panel-chip">demo data</span></div>' +
        (events.length
          ? '<div class="table-wrap"><table>' +
              '<thead><tr><th>When</th><th>Event</th><th>Device</th><th>IP</th><th>Location</th><th>Detail</th></tr></thead>' +
              '<tbody>' + events.map(function (e) {
                return '<tr>' +
                  '<td class="td-date">' + esc(fmt.dateTime(e.ts)) + '</td>' +
                  '<td><b>' + esc(String(e.type).replace(/_/g, ' ')) + '</b></td>' +
                  '<td>' + esc(e.device || '—') + '</td>' +
                  '<td class="mono">' + esc(e.ip || '—') + '</td>' +
                  '<td>' + esc(e.location || '—') + '</td>' +
                  '<td class="td-desc">' + esc(e.detail || '—') + '</td>' +
                '</tr>';
              }).join('') + '</tbody></table></div>'
          : emptyState('shield', 'No security events', 'Sign-ins, password changes and security updates will be listed here.')) +
      '</section>';
  };

  /* ================================================================ sessions */
  V.sessions = function (S) {
    var d = S.data.sessionsData;
    if (!d) return sessionExpired();
    var active = d.active || [];
    var history = d.history || [];
    return '<section class="panel">' +
        '<div class="panel-head"><h2>Active sessions</h2><a class="panel-link" href="#/security">Security ' + icon('arrow-r', 13) + '</a></div>' +
        (active.length
          ? '<ul class="session-list">' + active.map(function (s) {
              var mobile = /iphone|android|phone|ios/i.test(s.device || '');
              return '<li class="session-card' + (s.current ? ' current' : '') + '">' +
                '<span class="session-ic" aria-hidden="true">' + icon(mobile ? 'smartphone' : 'grid', 18) + '</span>' +
                '<div class="session-meta">' +
                  '<b>' + esc(s.device) + ' · ' + esc(s.browser) + ' on ' + esc(s.os) + '</b>' +
                  '<small>' + esc(s.ip) + ' · ' + esc(s.location) + ' · active ' + esc(fmt.timeAgo(s.lastActive)) + '</small>' +
                '</div>' +
                (s.current
                  ? '<span class="chip chip-default">' + icon('check', 12) + ' This device</span>'
                  : '<button class="btn btn-ghost btn-sm" type="button" data-action="session:revoke" data-id="' + esc(s.id) + '">Revoke</button>') +
              '</li>';
            }).join('') + '</ul>'
          : emptyState('grid', 'No active sessions', 'Active device sessions will be listed here.')) +
      '</section>' +
      '<section class="panel">' +
        '<div class="panel-head"><h2>Session history</h2></div>' +
        (history.length
          ? '<div class="table-wrap"><table>' +
              '<thead><tr><th>Device</th><th>Browser / OS</th><th>IP</th><th>Location</th><th>Last active</th><th>Status</th></tr></thead>' +
              '<tbody>' + history.map(function (s) {
                return '<tr>' +
                  '<td><b>' + esc(s.device) + '</b></td>' +
                  '<td>' + esc(s.browser) + ' / ' + esc(s.os) + '</td>' +
                  '<td class="mono">' + esc(s.ip) + '</td>' +
                  '<td>' + esc(s.location) + '</td>' +
                  '<td class="td-date">' + esc(fmt.timeAgo(s.lastActive)) + '</td>' +
                  '<td><span class="badge b-cancelled">' + esc(s.status) + '</span></td>' +
                '</tr>';
              }).join('') + '</tbody></table></div>'
          : '<div class="empty-mini">' + icon('clock', 22) + '<p>No ended sessions yet.</p></div>') +
      '</section>';
  };

  /* =========================================================== notifications */
  V.notifications = function (S) {
    var list = S.data.notifs;
    if (!list) return sessionExpired();
    var unread = list.filter(function (n) { return !n.read; }).length;
    return '<section class="panel">' +
        '<div class="panel-head">' +
          '<h2>Notifications</h2>' +
          (unread
            ? '<button class="btn btn-ghost btn-sm" type="button" data-action="notif:read" data-id="all">' + icon('check', 13) + ' Mark all read</button>'
            : '<span class="panel-chip">' + list.length + ' · all read</span>') +
        '</div>' +
        (list.length
          ? '<ul class="notif-list">' + list.map(function (n) {
              return '<li class="notif-item' + (n.read ? '' : ' unread') + '">' +
                '<span class="notif-ic ' + esc(n.kind || 'info') + '" aria-hidden="true">' + icon(kindIcon(n.kind), 17) + '</span>' +
                '<div class="notif-body">' +
                  '<div class="notif-top"><b>' + esc(n.title) + '</b>' +
                    (n.read ? '' : '<button class="btn btn-ghost btn-sm" type="button" data-action="notif:read" data-id="' + esc(n.id) + '">Mark read</button>') +
                  '</div>' +
                  '<p>' + esc(n.body) + '</p>' +
                  '<small>' + esc(fmt.timeAgo(n.ts)) + '</small>' +
                '</div>' +
              '</li>';
            }).join('') + '</ul>'
          : emptyState('bell', 'No notifications', 'Account events — deposits, security changes and platform notices — will appear here.')) +
      '</section>';
  };

  /* ================================================================= support */
  V.support = function (S) {
    var tickets = S.data.tickets;
    if (!tickets) return sessionExpired();
    return '<div class="support-grid">' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>New support request</h2></div>' +
          '<form data-form="supportForm" novalidate>' +
            '<div class="field">' +
              '<label for="sp-subject">Subject</label>' +
              '<input id="sp-subject" name="subject" type="text" placeholder="Short summary" required>' +
              '<p class="field-err" hidden></p>' +
            '</div>' +
            '<div class="field">' +
              '<label for="sp-cat">Category</label>' +
              '<select id="sp-cat" name="category">' +
                '<option value="General" selected>General</option>' +
                '<option value="Deposits">Deposits</option>' +
                '<option value="Currencies">Currencies</option>' +
                '<option value="Security">Security</option>' +
                '<option value="Account">Account</option>' +
              '</select>' +
            '</div>' +
            '<div class="field">' +
              '<label for="sp-msg">Message</label>' +
              '<textarea id="sp-msg" name="message" rows="5" placeholder="Describe your question or issue" required></textarea>' +
              '<p class="field-err" hidden></p>' +
            '</div>' +
            '<button class="btn btn-primary" type="submit">' + icon('send', 14) + ' Send request</button>' +
            '<p class="preview-note">' + icon('info', 14) + ' Demo desk — replies are simulated from the admin console.</p>' +
          '</form>' +
        '</section>' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Your tickets</h2><span class="panel-chip">' + tickets.length + ' total</span></div>' +
          (tickets.length
            ? tickets.map(function (t) {
                return '<article class="ticket">' +
                  '<div class="ticket-head">' +
                    '<div><h3>' + esc(t.subject) + '</h3>' +
                    '<small>' + esc(t.category) + ' · opened ' + esc(fmt.date(t.createdAt)) + '</small></div>' +
                    badge(t.status) +
                  '</div>' +
                  '<div class="bubbles">' + (t.messages || []).map(function (m) {
                    return '<div class="bubble ' + (m.from === 'support' ? 'from-support' : 'from-customer') + '">' +
                      '<p>' + esc(m.text) + '</p>' +
                      '<small>' + (m.from === 'support' ? 'Meridian support' : 'You') + ' · ' + esc(fmt.timeAgo(m.ts)) + '</small>' +
                    '</div>';
                  }).join('') + '</div>' +
                '</article>';
              }).join('')
            : emptyState('life', 'No tickets yet', 'Your support conversations will be listed here with full threads.',
                '')) +
        '</section>' +
      '</div>';
  };

  /* ================================================================ settings */
  V.settings = function (S) {
    var me = S.me;
    if (!me) return sessionExpired();
    var u = S.user || {};
    var p = u.prefs || {};
    return '<div class="settings-grid">' +
        '<section class="panel">' +
          '<div class="panel-head"><h2>Notification preferences</h2></div>' +
          '<form data-form="prefsForm" novalidate>' +
            '<label class="check-row"><input type="checkbox" name="emailNotifs"' + (p.emailNotifs ? ' checked' : '') + '>' +
              '<span><b>Email notifications</b><small>Deposit confirmations, security alerts and platform notices.</small></span></label>' +
            '<label class="check-row"><input type="checkbox" name="pushNotifs"' + (p.pushNotifs ? ' checked' : '') + '>' +
              '<span><b>Push notifications</b><small>Time-sensitive events on your devices (simulated).</small></span></label>' +
            '<label class="check-row"><input type="checkbox" name="weeklySummary"' + (p.weeklySummary ? ' checked' : '') + '>' +
              '<span><b>Weekly account summary</b><small>A digest of balances and activity, once a week.</small></span></label>' +
            '<button class="btn btn-primary" type="submit">' + icon('check', 14) + ' Save preferences</button>' +
          '</form>' +
        '</section>' +
        '<div class="settings-side">' +
          '<section class="panel">' +
            '<div class="panel-head"><h2>Account summary</h2><span class="panel-chip">demo data</span></div>' +
            '<dl class="detail-grid">' +
              '<div><dt>Name</dt><dd>' + esc(u.name || '—') + '</dd></div>' +
              '<div><dt>Email</dt><dd>' + esc(u.email || '—') + '</dd></div>' +
              '<div><dt>Account ID</dt><dd><code>' + esc(u.accountId || '—') + '</code></dd></div>' +
              '<div><dt>Country</dt><dd>' + esc(u.country || '—') + '</dd></div>' +
              '<div><dt>Default currency</dt><dd><b>' + esc(u.defaultCurrency || '—') + '</b></dd></div>' +
              '<div><dt>Total balance</dt><dd><b>' + esc(fmt.usd(me.totalUsd || 0)) + '</b> ≈</dd></div>' +
            '</dl>' +
          '</section>' +
          '<section class="panel">' +
            '<div class="panel-head"><h2>Quick links</h2></div>' +
            '<div class="quicklinks">' +
              '<a href="#/profile">' + icon('user', 15) + ' Profile</a>' +
              '<a href="#/security">' + icon('shield', 15) + ' Security</a>' +
              '<a href="#/sessions">' + icon('clock', 15) + ' Sessions</a>' +
              '<a href="#/statements">' + icon('doc', 15) + ' Statements</a>' +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>';
  };
})();
