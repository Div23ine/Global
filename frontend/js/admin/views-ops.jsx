/* ==========================================================================
   MERIDIAN ADMIN — Hong Kong International Fintech (Design 2)
   admin views-ops.jsx — Currencies · Deposits · Transactions · Payments ·
   Security · Reports · Support · Roles · Audit · Settings

   (Refunds moved to views-refunds.jsx — file-size ratchet.)

   Every view uses the prototype design: PageHead, StatCard with icons,
   DataTable with cell patterns, filter bars with segmented controls,
   restricted panels, feeds, mini-lists, role cards, support threads.
   ========================================================================== */
(function () {
  var React = window.React;
  var h = React.createElement;
  MGA.views = MGA.views || {};

  /** Unwrap http envelope { data, meta } or raw arrays from useAsync. */
  function adminList(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;
    if (payload.data && Array.isArray(payload.data.items)) return payload.data.items;
    if (payload.data && Array.isArray(payload.data.rows)) return payload.data.rows;
    if (payload.data && Array.isArray(payload.data.deposits)) return payload.data.deposits;
    if (payload.data && Array.isArray(payload.data.events)) return payload.data.events;
    if (payload.data && Array.isArray(payload.data.tickets)) return payload.data.tickets;
    if (payload.data && Array.isArray(payload.data.payments)) return payload.data.payments;
    return [];
  }
  function adminMeta(payload) {
    if (!payload || typeof payload !== 'object') return {};
    return payload.meta || (payload.data && payload.data.meta) || {};
  }
  MGA.adminList = adminList;
  MGA.adminMeta = adminMeta;


  /* ------------------------------------------------------------- currencies */
  MGA.views.currencies = function () {
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MGA.api.currencies(); }, [_r[0]]);
    if (state.loading) return h(MG.ui.PageSkeleton, { variant: 'list' });
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'coins', title: 'Currency management',
        sub: 'Control which currencies customers can activate. Changes are audited and take effect immediately.' }),
      h(MG.ui.Notice, { tone: 'info', icon: 'globe' },
        h('p', null, 'Availability is a ', h('b', null, 'live platform setting'),
          ' \u2014 the customer Activate page re-reads it on every visit.')),
      h(MG.ui.DataTable, {
        rows: adminList(state.data),
        rowKey: function (c) { return c.code; },
        empty: h(MG.ui.Empty, { icon: 'coins', title: 'No currencies', note: 'The supported currency list is empty.' }),
        columns: [
          { th: 'Currency', td: function (c) {
            return h('span', { className: 'cell-cur' },
              h('span', { className: 'cur-glyph' }, c.symbol),
              h('span', null, h('b', null, c.code), h('small', null, c.name))); } },
          { th: 'Status', td: function (c) { return h(MG.ui.Badge, { status: c.status, label: c.status === 'active' ? 'available' : 'unavailable' }); } },
          { th: 'Availability', align: 'right', td: function (c) {
            return c.status === 'active'
              ? h('button', { className: 'btn btn-ghost btn-sm', onClick: function () {
                  var next = 'unavailable';
                  MGA.api.setCurrencyStatus(c.code, next).then(function () {
                    MG.ui.toast(c.code + ' set to ' + next + '.', 'ok');
                    reload(function (x) { return x + 1; });
                  }).catch(function (e) { MG.ui.toast(MG.util.errMessage(e), 'err'); });
                } }, h(MG.ui.Icon, { name: 'pause', size: 13 }), ' Set unavailable')
              : h('button', { className: 'btn btn-primary btn-sm', onClick: function () {
                  var next = 'active';
                  MGA.api.setCurrencyStatus(c.code, next).then(function () {
                    MG.ui.toast(c.code + ' set to ' + next + '.', 'ok');
                    reload(function (x) { return x + 1; });
                  }).catch(function (e) { MG.ui.toast(MG.util.errMessage(e), 'err'); });
                } }, h(MG.ui.Icon, { name: 'check', size: 13 }), ' Set available');
          } },
        ] }));
  };

  /* --------------------------------------------------------------- deposits */
  MGA.views.deposits = function () {
    var _s = React.useState(''); var status = _s[0]; var setStatus = _s[1];
    var _r = React.useState(0); var reload = _r[1];
    var _sel = React.useState(null); var selected = _sel[0]; var setSelected = _sel[1];
    var _bankName = React.useState(''); var bankName = _bankName[0]; var setBankName = _bankName[1];
    var _accountNumber = React.useState(''); var accountNumber = _accountNumber[0]; var setAccountNumber = _accountNumber[1];
    var _narration = React.useState(''); var narration = _narration[0]; var setNarration = _narration[1];
    var _amt = React.useState(''); var amountReceived = _amt[0]; var setAmountReceived = _amt[1];
    var _txn = React.useState(''); var bankTxnId = _txn[0]; var setBankTxnId = _txn[1];
    var _notes = React.useState(''); var notes = _notes[0]; var setNotes = _notes[1];
    var _busy = React.useState(false); var busy = _busy[0]; var setBusy = _busy[1];
    var _txnRef = React.useState(''); var bankTxnRef = _txnRef[0]; var setBankTxnRef = _txnRef[1];

    var state = MG.ui.useAsync(function () { return MGA.api.depositQueue(1, status); }, [status, _r[0]]);

    function doSendBankDetails() {
      if (!selected || !bankName.trim() || !accountNumber.trim()) return;
      setBusy(true);
      MGA.api.sendDepositBankDetails(selected.id, {
        bankName: bankName.trim(), accountNumber: accountNumber.trim(),
        narration: narration.trim() || selected.reference,
      }).then(function () {
        MG.ui.toast('Bank details emailed and added to customer notifications.', 'ok');
        setSelected(Object.assign({}, selected, { status: 'awaiting_payment' }));
        setBankName(''); setAccountNumber(''); setNarration('');
        reload(function (x) { return x + 1; });
      }).catch(function (e) { MG.ui.toast(MG.util.errMessage(e), 'err'); })
        .finally(function () { setBusy(false); });
    }

    function doVerify() {
      if (!selected || !amountReceived) return;
      setBusy(true);
      MGA.api.verifyCredit(selected.id, {
        amountReceived: amountReceived,
        currencyCode: selected.currency_code,
        bankTransactionId: bankTxnId || undefined,
        bankTransactionRef: bankTxnRef || undefined,
        notes: notes || undefined,
      }).then(function () {
        MG.ui.toast('Payment verified and balance credited.', 'ok');
        setSelected(null); setAmountReceived(''); setBankTxnId(''); setBankTxnRef(''); setNotes('');
        reload(function (x) { return x + 1; });
      }).catch(function (e) { MG.ui.toast(MG.util.errMessage(e), 'err'); })
        .finally(function () { setBusy(false); });
    }

    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'wallet', title: 'Deposit management',
        sub: 'Send one-time bank instructions to each customer, then verify incoming transfers before crediting balances.',
        actions: h('span', { className: 'panel-chip' },
          state.loading ? 'Loading\u2026' : (adminList(state.data).length + ' deposits')) }),

      h('div', { className: 'filter-bar' },
        h('div', { className: 'field' },
          h('label', null, 'Status'),
          h('select', { value: status, onChange: function (e) { setStatus(e.target.value); } },
            h('option', { value: '' }, 'Actionable queue'),
            h('option', { value: 'pending_admin_action' }, 'Pending admin action'),
            h('option', { value: 'awaiting_payment' }, 'Awaiting payment'),
            h('option', { value: 'payment_reported' }, 'Payment reported'),
            h('option', { value: 'under_verification' }, 'Under verification'),
            h('option', { value: 'partially_fulfilled' }, 'Partially fulfilled'),
            h('option', { value: 'completed' }, 'Completed'),
            h('option', { value: 'rejected' }, 'Rejected'),
            h('option', { value: 'cancelled' }, 'Cancelled')))),

      state.loading ? h(MG.ui.PageSkeleton, { variant: 'list' })
        : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
        : h(MG.ui.DataTable, {
            rows: adminList(state.data),
            rowKey: function (d) { return d.id; },
            empty: h(MG.ui.Empty, { icon: 'wallet', title: 'No deposits in queue', note: 'No deposit attempts match the current filter.' }),
            columns: [
              { th: 'Reference', td: function (d) { return h('code', null, d.reference); } },
              { th: 'Customer', td: function (d) {
                return h('div', { className: 'cell-person' },
                  h(MG.ui.Avatar, { name: d.profiles ? (d.profiles.full_name || d.profiles.email) : d.profile_id }),
                  h('div', null, h('b', null, d.profiles ? (d.profiles.full_name || d.profiles.email) : d.profile_id))); } },
              { th: 'Requested', align: 'right', td: function (d) {
                var reqAmt = d.requested_amount != null ? d.requested_amount : d.amount;
                return h('span', { className: 'td-amount' }, MG.util.money(reqAmt, d.currency_code)); } },
              { th: 'Status', td: function (d) { return h(MG.ui.Badge, { status: d.status }); } },
              { th: 'Requested', td: function (d) { return h('span', { className: 'td-date' }, MG.util.date(d.requested_at)); } },
              { th: '', align: 'right', td: function (d) {
                return h('button', { className: 'btn btn-ghost btn-sm', onClick: function () {
                  setSelected(d); setAmountReceived(String(d.requested_amount != null ? d.requested_amount : d.amount));
                } }, h(MG.ui.Icon, { name: 'eye', size: 13 }), ' Manage'); } },
            ] }),

      selected ? h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, 'Manage deposit \u2014 ', selected.reference) },
        h('div', { className: 'grid-two' },
          h('div', null,
            h('p', null, h('b', null, 'Customer: '), selected.profiles ? (selected.profiles.full_name || selected.profiles.email) : selected.profile_id),
            h('p', null, h('b', null, 'Requested: '), MG.util.money(selected.requested_amount || selected.amount, selected.currency_code),
              ' \u00B7 Status: ', h(MG.ui.Badge, { status: selected.status })),
            selected.payment_notes ? h('p', null, h('b', null, 'Customer payment notes: '), selected.payment_notes) : null,
            selected.customer_bank_reference ? h('p', null, h('b', null, 'Customer bank reference: '), selected.customer_bank_reference) : null,
            selected.receipt_url ? h('p', null, h('a', { href: selected.receipt_url, target: '_blank', rel: 'noopener noreferrer' }, 'Open payment evidence')) : null,
            h('p', null, h('b', null, 'Customer email: '), selected.profiles && selected.profiles.email ? selected.profiles.email : 'Email unavailable'),
            (selected.status === 'pending_admin_action' || selected.status === 'awaiting_payment') ? h('div', { className: 'field', style: { marginTop: 14 } },
              h('h4', null, 'Send one-time bank details'),
              h('p', { className: 'muted' }, 'These details are sent only to this customer by email and in-app notification. They are not saved as a reusable bank account.'),
              h('label', null, 'Bank name'),
              h('input', { value: bankName, onChange: function (e) { setBankName(e.target.value); }, placeholder: 'Enter the bank name' }),
              h('label', null, 'Account number'),
              h('input', { value: accountNumber, onChange: function (e) { setAccountNumber(e.target.value); }, placeholder: 'Enter the account number' }),
              h('label', null, 'Transfer narration (optional)'),
              h('input', { value: narration, onChange: function (e) { setNarration(e.target.value); }, placeholder: selected.reference }),
              h('button', { className: 'btn btn-primary btn-sm', style: { marginTop: 8 }, disabled: busy || !bankName.trim() || !accountNumber.trim(), onClick: doSendBankDetails },
                'Email bank details')) : null),
          h('div', null,
            (['awaiting_payment','payment_reported','under_verification','partially_fulfilled'].indexOf(selected.status) >= 0) ? h(React.Fragment, null,
              h('div', { className: 'field' },
                h('label', null, 'Amount received (will be credited)'),
                h('input', { value: amountReceived, onChange: function (e) { setAmountReceived(e.target.value); }, placeholder: 'e.g. 1000.00' })),
              h('div', { className: 'field' },
                h('label', null, 'Bank transaction ID'),
                h('input', { value: bankTxnId, onChange: function (e) { setBankTxnId(e.target.value); } })),
              h('div', { className: 'field' },
                h('label', null, 'Receiving-bank transaction reference'),
                h('input', { value: bankTxnRef, onChange: function (e) { setBankTxnRef(e.target.value); } })),
              h('div', { className: 'field' },
                h('label', null, 'Verification notes'),
                h('input', { value: notes, onChange: function (e) { setNotes(e.target.value); } })),
              h('div', { className: 'btn-row' },
                h('button', { className: 'btn btn-primary', disabled: busy || !amountReceived, onClick: doVerify }, 'Approve and credit'),
                h('button', { className: 'btn btn-ghost', disabled: busy, onClick: function () {
                  setBusy(true);
                  MGA.api.rejectDeposit(selected.id, notes || 'Rejected by administrator').then(function () {
                    MG.ui.toast('Deposit rejected.', 'ok');
                    setSelected(null); setNotes('');
                    reload(function (x) { return x + 1; });
                  }).catch(function (e) { MG.ui.toast(MG.util.errMessage(e), 'err'); })
                    .finally(function () { setBusy(false); });
                } }, 'Reject'))) : null)),
        h('button', { className: 'btn btn-ghost btn-sm', style: { marginTop: 12 }, onClick: function () { setSelected(null); } }, 'Close')) : null);
  };


  /* ----------------------------------------------------------- transactions */
  MGA.views.transactions = function () {
    var _f = React.useState({ q: '', currency: '', status: '' }); var filters = _f[0]; var setFilters = _f[1];
    var state = MG.ui.useAsync(function () {
      return MGA.api.transactions({ q: filters.q, currency: filters.currency, status: filters.status });
    }, [filters.q, filters.currency, filters.status]);
    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'receipt', title: 'Transactions',
        sub: 'The complete customer ledger \u2014 read-only for administrators.',
        actions: h('span', { className: 'panel-chip' },
          state.loading ? 'Loading\u2026' : (adminList(state.data).length + ' entries')) }),

      h('div', { className: 'filter-bar' },
        h('div', { className: 'field field-search' },
          h('label', { htmlFor: 'tx-search' }, 'Search'),
          h('input', { id: 'tx-search', type: 'search', placeholder: 'Reference\u2026',
            value: filters.q, onChange: function (e) { setFilters(Object.assign({}, filters, { q: e.target.value })); } })),
        h('div', { className: 'field' },
          h('label', null, 'Currency'),
          h('select', { value: filters.currency, onChange: function (e) { setFilters(Object.assign({}, filters, { currency: e.target.value })); } },
            h('option', { value: '' }, 'All currencies'),
            h('option', { value: 'EUR' }, 'EUR'), h('option', { value: 'GBP' }, 'GBP'),
            h('option', { value: 'USD' }, 'USD'), h('option', { value: 'CHF' }, 'CHF'),
            h('option', { value: 'PLN' }, 'PLN'))),
        h('div', { className: 'field' },
          h('label', null, 'Status'),
          h('select', { value: filters.status, onChange: function (e) { setFilters(Object.assign({}, filters, { status: e.target.value })); } },
            h('option', { value: '' }, 'All statuses'),
            h('option', { value: 'posted' }, 'Posted'),
            h('option', { value: 'pending' }, 'Pending'),
            h('option', { value: 'failed' }, 'Failed'),
            h('option', { value: 'cancelled' }, 'Cancelled')))),

      state.loading ? h(MG.ui.PageSkeleton, { variant: 'list' })
        : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
        : h(MG.ui.DataTable, {
            rows: adminList(state.data),
            rowKey: function (t) { return t.id; },
            empty: h(MG.ui.Empty, { icon: 'receipt', title: 'No transactions match', note: 'No ledger entries match the current filters.' }),
            columns: [
              { th: 'Reference', td: function (t) { return h('code', null, t.reference); } },
              { th: 'Customer', td: function (t) {
                var cust = t.profiles ? (t.profiles.full_name || t.profiles.email) : '\u2014';
                return cust; } },
              { th: 'Amount', align: 'right', td: function (t) {
                return h('span', { className: 'td-amount ' + (t.direction === 'credit' ? 'pos' : 'neg') },
                  (t.direction === 'credit' ? '+' : '-') + MG.util.money(t.amount, t.currency_code)); } },
              { th: 'Status', td: function (t) { return h(MG.ui.Badge, { status: t.status }); } },
              { th: 'Date', td: function (t) { return h('span', { className: 'td-date' }, MG.util.date(t.created_at)); } },
              { th: '', align: 'right', td: function (t) {
                /* Bridges the refund workflow: the create-refund form needs the
                   transaction UUID (audit F-3). */
                return h('button', { className: 'btn btn-ghost btn-sm',
                  title: 'Copy transaction UUID for a refund request',
                  onClick: function (e) { e.stopPropagation(); MG.util.copyText(t.id).then(function () {
                    MG.ui.toast('Transaction ID copied \u2014 paste it into a new refund request.', 'ok');
                  }, function () {
                    MG.ui.toast('Copy failed \u2014 copy the UUID manually: ' + t.id, 'err');
                  }); } },
                  h(MG.ui.Icon, { name: 'copy', size: 13 }), ' Copy ID'); } },
            ] }));
  };

  /* --------------------------------------------------------------- payments */
  MGA.views.payments = function () {
    var state = MG.ui.useAsync(function () { return MGA.api.payments(1); }, []);
    if (state.loading) return h(MG.ui.PageSkeleton, { variant: 'page' });
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var list = adminList(state.data);
    var stats = {};
    list.forEach(function (a) { stats[a.outcome] = (stats[a.outcome] || 0) + 1; });
    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'card', title: 'Payment monitoring',
        sub: 'Every gateway attempt with its outcome and timing.',
        actions: h('span', { className: 'panel-chip' }, list.length + ' attempts') }),
      h('div', { className: 'stat-row stat-row-six' },
        Object.keys(stats).map(function (k) {
          var tone = k === 'successful' ? 'success' : k === 'pending' ? 'warn' : k === 'failed' ? 'danger' : 'info';
          var icon = k === 'successful' ? 'check-circle' : k === 'pending' ? 'clock' : k === 'failed' ? 'x-circle' : 'alert';
          return h(MG.ui.StatCard, { key: k, icon: icon, tone: tone,
            label: k.replace('_', ' '), value: MG.util.num(stats[k]) });
        })),
      h(MG.ui.DataTable, {
        rows: list,
        rowKey: function (a) { return a.id; },
        empty: h(MG.ui.Empty, { icon: 'card', title: 'No payment attempts yet', note: 'Gateway attempts will appear here.' }),
        columns: [
          { th: 'Deposit', td: function (a) { var dep = a.deposits ? a.deposits.reference : '\u2014'; return dep; } },
          { th: 'Provider', td: function (a) { return a.provider; } },
          { th: 'Outcome', td: function (a) { return h(MG.ui.Badge, { status: a.outcome }); } },
          { th: 'Recorded', td: function (a) { return h('span', { className: 'td-date' }, MG.util.dateTime(a.created_at)); } },
        ] }));
  };

  /* --------------------------------------------------------------- security */
  MGA.views.security = function () {
    var _u = React.useState(''); var freezeUser = _u[0]; var setFreezeUser = _u[1];
    var _rs = React.useState(''); var freezeReason = _rs[0]; var setFreezeReason = _rs[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    var state = MG.ui.useAsync(function () { return MGA.api.securityEvents(1); }, []);
    var events = adminList(state.data);
    var suspiciousCount = events.filter(function (e) { return e.severity === 'critical'; }).length;

    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'shield', title: 'Security monitoring',
        sub: 'Sign-in activity, MFA changes and flagged events across the platform.',
        actions: h('button', { className: 'btn btn-ghost btn-sm', onClick: function () { location.reload(); } },
          h(MG.ui.Icon, { name: 'refresh', size: 14 }), ' Refresh') }),

      h('div', { className: 'stat-row' },
        h(MG.ui.StatCard, { icon: 'shield', tone: 'info', label: 'Events in view', value: MG.util.num(events.length), sub: 'All security events' }),
        h(MG.ui.StatCard, { icon: 'alert', tone: 'danger', label: 'Critical', value: MG.util.num(suspiciousCount), sub: 'Highlighted in the feed' }),
        h(MG.ui.StatCard, { icon: 'snowflake', tone: 'warn', label: 'Freeze tool', value: 'Ready', sub: 'Suspend via Supabase Auth' })),

      h('div', { className: 'grid-side' },
        h('div', { className: 'grid-side-main' },
          h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'shield', size: 15 }), ' Event feed') },
            state.loading ? h(MG.ui.PageSkeleton, { variant: 'list' })
              : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
              : events.length === 0
                ? h(MG.ui.Empty, { icon: 'shield-check', title: 'No security events', note: 'Security events will appear here as customers sign in.' })
                : h('ul', { className: 'feed' },
                    events.map(function (e) {
                      var cust = e.profiles ? (e.profiles.email || e.profiles.full_name) : e.profile_id;
                      return h('li', { key: e.id, className: 'feed-item' + (e.severity === 'critical' ? ' susp' : '') },
                        h('span', { className: 'feed-ic', 'aria-hidden': 'true',
                          dangerouslySetInnerHTML: { __html: MG.ui.icon(e.severity === 'critical' ? 'alert' : 'shield', 16) } }),
                        h('div', { className: 'feed-main' },
                          h('b', null, (e.type || '').replace(/_/g, ' ')),
                          h('small', null, cust, ' \u00B7 ', e.detail ? JSON.stringify(e.detail).slice(0, 80) : '\u2014')),
                        h('div', { className: 'feed-side' },
                          h(MG.ui.Badge, { status: e.severity === 'critical' ? 'failed' : e.severity === 'warning' ? 'pending' : 'posted' }),
                          h('span', { className: 'td-date' }, MG.util.timeAgo(e.created_at))));
                    })))),
        h('div', { className: 'grid-side-aside' },
          h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'snowflake', size: 15 }), ' Freeze an account') },
            h('p', { className: 'muted' }, 'Freezing marks the Meridian profile as suspended, applies a Supabase Auth ban when linked, and records a security event with your reason.'),
            h('div', { className: 'field' },
              h('label', { htmlFor: 'frz-user' }, 'Meridian profile ID'),
              h('input', { id: 'frz-user', placeholder: 'profile ID', value: freezeUser,
                onChange: function (e) { setFreezeUser(e.target.value); } })),
            h('div', { className: 'field' },
              h('label', { htmlFor: 'frz-reason' }, 'Reason (recorded)'),
              h('input', { id: 'frz-reason', placeholder: 'e.g. Suspicious login pattern', value: freezeReason,
                onChange: function (e) { setFreezeReason(e.target.value); } })),
            h('button', { className: 'btn btn-danger btn-block', disabled: busy,
              onClick: function () {
                if (!freezeUser || freezeReason.trim().length < 3) {
                  MG.ui.toast('Provide the user id and a reason.', 'err'); return;
                }
                setBusy(true);
                MGA.api.freeze(freezeUser, freezeReason).then(function () {
                  setBusy(false);
                  MG.ui.toast('Account frozen.', 'ok');
                  location.reload();
                }).catch(function (e) { setBusy(false); MG.ui.toast(MG.util.errMessage(e), 'err'); });
              } },
              h(MG.ui.Icon, { name: 'snowflake', size: 15 }), ' Freeze account')))));  };

  /* ---------------------------------------------------------------- reports */
  MGA.views.reports = function () {
    var state = MG.ui.useAsync(function () { return MGA.api.reports(); }, []);
    if (state.loading) return h(MG.ui.PageSkeleton, { variant: 'charts' });
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var d = state.data || {};
    function rowsOf(obj) {
      return Object.keys(obj || {}).map(function (k) { return [k, obj[k]]; });
    }
    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'chart', title: 'Reports',
        sub: 'Aggregated analytics across deposits, payment outcomes and customers.',
        actions: h('button', { className: 'btn btn-primary btn-sm', onClick: function () {
          var rows = [['Meridian platform report', ''], ['Generated', MG.util.dateTime(new Date().toISOString())], []];
          rows.push(['Deposits by method', 'Count']);
          rowsOf(d.depositsByMethod).forEach(function (r) { rows.push(r); });
          rows.push([]);
          rows.push(['Deposits by status', 'Count']);
          rowsOf(d.depositsByStatus).forEach(function (r) { rows.push(r); });
          rows.push([]);
          rows.push(['Users by country', 'Customers']);
          rowsOf(d.usersByCountry).forEach(function (r) { rows.push(r); });
          MG.util.downloadText('meridian-report.csv', MG.util.toCsv(rows), 'text/csv');
          MG.ui.toast('Report exported \u2014 meridian-report.csv', 'ok');
        } }, h(MG.ui.Icon, { name: 'download', size: 14 }), ' Export CSV') }),

      h('div', { className: 'stat-row' },
        h(MG.ui.StatCard, { icon: 'users', label: 'Customers', value: MG.util.num(rowsOf(d.usersByCountry).length), sub: 'Across countries' }),
        h(MG.ui.StatCard, { icon: 'wallet', tone: 'success', label: 'Deposits', value: MG.util.num(rowsOf(d.depositsByStatus).reduce(function (s, r) { return s + r[1]; }, 0)), sub: 'All statuses' }),
        h(MG.ui.StatCard, { icon: 'receipt', tone: 'info', label: 'Ledger entries', value: '\u2014', sub: 'Read-only history' })),

      h('div', { className: 'grid-two' },
        h(MG.ui.Card, { title: 'Deposits by method' },
          h(MG.ui.DataTable, {
            compact: true, rows: rowsOf(d.depositsByMethod), rowKey: function (r) { return r[0]; }, empty: null,
            columns: [
              { th: 'Method', td: function (r) { return h('b', null, r[0].replace(/_/g, ' ')); } },
              { th: 'Count', align: 'right', td: function (r) { return MG.util.num(r[1]); } },
            ] })),
        h(MG.ui.Card, { title: 'Deposits by status' },
          h(MG.ui.DataTable, {
            compact: true, rows: rowsOf(d.depositsByStatus), rowKey: function (r) { return r[0]; }, empty: null,
            columns: [
              { th: 'Status', td: function (r) { return h(MG.ui.Badge, { status: r[0] }); } },
              { th: 'Count', align: 'right', td: function (r) { return MG.util.num(r[1]); } },
            ] })),
        h(MG.ui.Card, { title: 'Customers by country' },
          h(MG.ui.DataTable, {
            compact: true, rows: rowsOf(d.usersByCountry), rowKey: function (r) { return r[0]; },
            empty: h(MG.ui.Empty, { icon: 'globe', title: 'No customers', note: 'Country distribution appears once customers exist.' }),
            columns: [
              { th: 'Country', td: function (r) { return r[0]; } },
              { th: 'Customers', align: 'right', td: function (r) { return h('b', null, MG.util.num(r[1])); } },
            ] }))));
  };

  /* ---------------------------------------------------------------- support */
  MGA.views.support = function () {
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MGA.api.tickets(); }, [_r[0]]);
    var _m = React.useState({}); var replies = _m[0]; var setReplies = _m[1];
    if (state.loading) return h(MG.ui.PageSkeleton, { variant: 'list' });
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var list = adminList(state.data);
    var openCount = list.filter(function (t) { return t.status !== 'resolved'; }).length;
    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'ticket', title: 'Support',
        sub: 'Customer support tickets \u2014 replies notify the customer; resolving is reversible.',
        actions: h('span', { className: 'panel-chip' }, openCount + ' open \u00B7 ' + list.length + ' total') }),
      list.length === 0
        ? h(MG.ui.Empty, { icon: 'ticket', title: 'No support tickets', note: 'Tickets submitted from the customer app will appear here.' })
        : h(MG.ui.Card, null,
            list.map(function (t) {
              var cust = t.profiles ? (t.profiles.full_name || t.profiles.email) : '\u2014';
              return h('div', { key: t.id, style: { marginBottom: 16 } },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
                  h('div', null, h('b', null, t.subject),
                    h('small', { className: 'muted', style: { marginLeft: 8 } }, cust + ' \u00B7 ' + t.category)),
                  h(MG.ui.Badge, { status: t.status })),
                (t.support_messages || []).length > 0 ? h('ul', { className: 'thread' },
                  (t.support_messages || []).map(function (m) {
                    return h('li', { key: m.id, className: m.sender === 'customer' ? 'from-customer' : 'from-support' },
                      h('div', { className: 'bubble' },
                        h('p', null, m.body),
                        h('small', null, m.sender === 'customer' ? 'Customer' : 'Support', ' \u00B7 ', MG.util.timeAgo(m.created_at))));
                  })) : null,
                t.status !== 'resolved' ? h('div', { className: 'filter-bar', style: { marginTop: 8 } },
                  h('input', { className: 'input', placeholder: 'Write a reply\u2026', value: replies[t.id] || '',
                    onChange: function (e) { var n = Object.assign({}, replies); n[t.id] = e.target.value; setReplies(n); },
                    style: { flex: 3 } }),
                  h('button', { className: 'btn btn-primary', onClick: function () {
                    var msg = (replies[t.id] || '').trim();
                    if (msg.length < 2) return;
                    MGA.api.replyTicket(t.id, msg).then(function () {
                      MG.ui.toast('Reply posted.', 'ok');
                      reload(function (x) { return x + 1; });
                    }).catch(function (e) { MG.ui.toast(MG.util.errMessage(e), 'err'); });
                  } }, h(MG.ui.Icon, { name: 'send', size: 14 }), ' Reply'),
                  h('button', { className: 'btn btn-ghost', onClick: function () {
                    MGA.api.resolveTicket(t.id).then(function () {
                      MG.ui.toast('Ticket resolved.', 'ok');
                      reload(function (x) { return x + 1; });
                    }).catch(function (e) { MG.ui.toast(MG.util.errMessage(e), 'err'); });
                  } }, 'Resolve')) : null);
            })));
  };

  /* ------------------------------------------------------------------ roles */
  MGA.views.roles = function () {
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MGA.api.roles(); }, [_r[0]]);
    var _a = React.useState({ email: '', roleId: 'support', displayName: '' }); var assign = _a[0]; var setAssign = _a[1];
    if (state.loading) return h(MG.ui.PageSkeleton, { variant: 'page' });
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var d = state.data || {};
    var allPerms = [];
    (d.roles || []).forEach(function (r) { (r.permissions || []).forEach(function (p) { if (allPerms.indexOf(p) < 0) allPerms.push(p); }); });
    allPerms.sort();
    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'key', title: 'Admin roles',
        sub: 'Role model with server-side permission enforcement.' }),

      h(MG.ui.Notice, { tone: 'info', icon: 'shield-check' },
        h('p', null, h('b', null, '\u201CBlocked\u201D means enforced in the service layer'),
          ' \u2014 not merely hidden from the UI. Every role, including Super Administrator, is rejected with HTTP 403 when attempting a financial mutation.')),

      h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'key', size: 15 }), ' Assign a role') },
        h('p', { className: 'muted' }, 'Enter the email of an active Supabase Auth user who has signed in to Meridian at least once. The backend verifies the linked profile before granting administrator access.'),
        h('div', { className: 'filter-bar' },
          h('div', { className: 'field', style: { flex: 1 } },
            h('label', null, 'Supabase Auth email'),
            h('input', { placeholder: 'person@example.com', value: assign.email,
              onChange: function (e) { setAssign(Object.assign({}, assign, { email: e.target.value })); } })),
          h('div', { className: 'field' },
            h('label', null, 'Role'),
            h('select', { value: assign.roleId, onChange: function (e) { setAssign(Object.assign({}, assign, { roleId: e.target.value })); } },
              (d.roles || []).map(function (r) { return h('option', { key: r.id, value: r.id }, r.id); }))),
          h('button', { className: 'btn btn-primary', onClick: function () {
            MGA.api.assignRole(assign.email, assign.roleId, assign.displayName || undefined).then(function () {
              MG.ui.toast('Role assigned.', 'ok');
              reload(function (x) { return x + 1; });
            }).catch(function (e) { MG.ui.toast(MG.util.errMessage(e), 'err'); });
          } }, 'Assign')),
        h(MG.ui.DataTable, {
          compact: true, rows: d.holders || [], rowKey: function (u) { return u.profile_id; },
          empty: h(MG.ui.Empty, { icon: 'key', title: 'No administrators assigned yet', note: 'Assigned roles will appear here.' }),
          columns: [
            { th: 'Holder', td: function (u) { return h('div', null, h('b', null, u.display_name || ''), h('small', { className: 'muted', style: { display: 'block' } }, u.profile_id)); } },
            { th: 'Role', td: function (u) { return h('span', { className: 'chip chip-currency' }, u.role_id); } },
            { th: 'Assigned', td: function (u) { return h('span', { className: 'td-date' }, MG.util.date(u.assigned_at)); } },
            { th: '', align: 'right', td: function (u) {
              return h('button', { className: 'btn btn-ghost btn-sm', onClick: function () {
                MGA.api.revokeRole(u.profile_id).then(function () {
                  MG.ui.toast('Role revoked.', 'ok');
                  reload(function (x) { return x + 1; });
                }).catch(function (e) { MG.ui.toast(MG.util.errMessage(e), 'err'); });
              } }, 'Revoke'); } },
          ] })),

      h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'shield-check', size: 15 }), ' Permission matrix') },
        h('p', { className: 'panel-note' }, 'Enforced server-side on every request.'),
        h('div', { className: 'table-wrap' },
          h('table', null,
            h('thead', null, h('tr', null,
              h('th', null, 'Role'),
              allPerms.map(function (p) { return h('th', { key: p }, p); }))),
            h('tbody', null, (d.roles || []).map(function (r) {
              return h('tr', { key: r.id },
                h('td', null, h('b', null, r.id)),
                allPerms.map(function (p) {
                  var has = (r.permissions || []).indexOf(p) >= 0;
                  return h('td', { key: p, style: { textAlign: 'center' } },
                    has ? h('span', { className: 'mtx m-full' }, 'Full') : h('span', { className: 'mtx m-none' }, '\u2014'));
                }));
            }))))));
  };

  /* ------------------------------------------------------------------ audit */
  MGA.views.audit = function () {
    var _f = React.useState({ q: '', result: '', page: 1 }); var filters = _f[0]; var setFilters = _f[1];
    var state = MG.ui.useAsync(function () {
      return MGA.api.audit({ q: filters.q, result: filters.result, page: filters.page });
    }, [filters.q, filters.result, filters.page]);
    var meta = adminMeta(state.data);
    function set(k, v) {
      var next = Object.assign({}, filters); next[k] = v;
      if (k !== 'page') next.page = 1;
      setFilters(next);
    }
    var rows = adminList(state.data);
    var denied = rows.filter(function (a) { return a.result === 'denied'; }).length;
    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'history', title: 'Audit logs',
        sub: 'Every administrative action \u2014 allowed and denied \u2014 with actor, target and reason.',
        actions: h('span', { className: 'panel-chip' },
          state.loading ? 'Loading\u2026' : (rows.length + ' entries \u00B7 ' + denied + ' denied')) }),

      h('div', { className: 'filter-bar' },
        h('div', { className: 'field field-search' },
          h('label', { htmlFor: 'au-search' }, 'Search'),
          h('input', { id: 'au-search', type: 'search', placeholder: 'Action, actor or target\u2026',
            value: filters.q, onChange: function (e) { set('q', e.target.value); } })),
        h('div', { className: 'field' },
          h('label', null, 'Result'),
          h('select', { value: filters.result, onChange: function (e) { set('result', e.target.value); } },
            h('option', { value: '' }, 'All results'),
            h('option', { value: 'allowed' }, 'Allowed'),
            h('option', { value: 'denied' }, 'Denied')))),

      state.loading ? h(MG.ui.PageSkeleton, { variant: 'list' })
        : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
        : h(React.Fragment, null,
            h(MG.ui.DataTable, {
              rows: rows,
              rowKey: function (l) { return l.id; },
              rowClass: function (l) { return l.result === 'denied' ? 'tr-denied' : ''; },
              empty: h(MG.ui.Empty, { icon: 'history', title: 'No entries match', note: 'No audit entries match the current filters.' }),
              columns: [
                { th: 'When', td: function (l) { return h('span', { className: 'td-date' }, MG.util.dateTime(l.created_at)); } },
                { th: 'Actor', td: function (l) { return l.actor_id; } },
                { th: 'Action', td: function (l) { return h('span', { className: 'chip chip-mono' }, l.action); } },
                { th: 'Target', td: function (l) { return h('span', { className: 'td-plain' }, (l.target_type || '') + (l.target_id ? ' \u00B7 ' + String(l.target_id).slice(0, 18) : '')); } },
                { th: 'Result', td: function (l) { return h(MG.ui.Badge, { status: l.result === 'denied' ? 'failed' : 'successful', label: l.result }); } },
                { th: 'Detail', td: function (l) { return h('span', { className: 'td-desc' }, l.detail ? JSON.stringify(l.detail).slice(0, 60) : '\u2014'); } },
              ] }),
            meta.pages > 1 ? h('div', { className: 'pager' },
              h(MG.ui.Button, { variant: 'ghost', disabled: filters.page <= 1,
                onClick: function () { set('page', filters.page - 1); } }, '\u2190 Previous'),
              h('span', { className: 'pager-info' }, 'Page ' + (meta.page || filters.page) + ' of ' + meta.pages),
              h(MG.ui.Button, { variant: 'ghost', disabled: filters.page >= (meta.pages || 1),
                onClick: function () { set('page', filters.page + 1); } }, 'Next \u2192')) : null));
  };

  /* --------------------------------------------------------------- settings */
  MGA.views.settings = function () {
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MGA.api.settings(); }, [_r[0]]);
    var _m = React.useState(null); var maintenance = _m[0]; var setMaintenance = _m[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    // http.get returns { data, meta, message } — never treat the envelope as an array.
    React.useEffect(function () {
      if (state.data && maintenance === null) {
        var list = adminList(state.data);
        var found = list.find(function (s) { return s && s.key === 'platform.maintenance_mode'; });
        if (found) {
          var v = found.value;
          if (v && typeof v === 'object' && v.enabled != null) v = v.enabled;
          setMaintenance(v === true || v === 'true' || v === '1');
        } else {
          setMaintenance(false);
        }
      }
    }, [state.data]);
    if (state.loading) return h(MG.ui.PageSkeleton, { variant: 'page' });
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });

    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'settings', title: 'Settings',
        sub: 'Platform-wide configuration. Changes apply immediately and are audit-logged.' }),

      h('div', { className: 'grid-side' },
        h('div', { className: 'grid-side-main' },
          h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'settings', size: 15 }), ' Platform settings') },
            h('div', { className: 'switch-row' },
              h('label', { className: 'switch' },
                h('input', { type: 'checkbox', checked: Boolean(maintenance),
                  onChange: function (e) { setMaintenance(e.target.checked); } }),
                h('span', { className: 'switch-track', 'aria-hidden': 'true' }),
                h('span', { className: 'switch-label' }, 'Maintenance mode')),
              h('p', { className: 'hint' }, 'Shows a maintenance notice in the customer application.')),
            h('button', { className: 'btn btn-primary' + (busy ? ' is-busy' : ''), disabled: busy, style: { marginTop: 12 },
              onClick: function () {
                setBusy(true);
                MGA.api.updateSettings({ maintenanceMode: Boolean(maintenance) }).then(function () {
                  setBusy(false);
                  MG.ui.toast('Settings updated.', 'ok');
                  reload(function (x) { return x + 1; });
                }).catch(function (e) { setBusy(false); MG.ui.toast(MG.util.errMessage(e), 'err'); });
              } }, 'Save settings'))),
        h('div', { className: 'grid-side-aside' },
          h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'info', size: 15 }), ' Read-only') },
            h('dl', { className: 'detail-grid detail-stack' },
              h('div', null, h('dt', null, 'Console'), h('dd', null, 'Hong Kong International Fintech (design 2)')),
              h('div', null, h('dt', null, 'Data'), h('dd', null, 'Connected service')),
              h('div', null, h('dt', null, 'Currency availability'), h('dd', null, 'Managed in Currency Management'))),
            h('p', { className: 'panel-note' }, 'All settings changes are audit-logged. Support email and platform name are managed in the database settings table.')),
          h(MG.ui.Notice, { tone: 'warn', icon: 'alert' },
            h('p', null, 'All settings and data are managed through the connected backend service.')))));
  };
})();
