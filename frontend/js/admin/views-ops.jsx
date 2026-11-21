/* Admin views — operations: currencies, deposits, transactions, payments,
   security, reports, support, roles, audit, settings. */
(function () {
  var React = window.React;
  var h = React.createElement;
  MGA.views = MGA.views || {};

  /* ------------------------------------------------------------- currencies */
  MGA.views.currencies = function () {
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MGA.api.currencies(); }, [_r[0]]);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    return h(MG.ui.Card, { title: 'Currency availability' },
      h('p', { className: 'muted' }, 'Availability changes take effect immediately for customer activation attempts and are audit-logged.'),
      h(MG.ui.Table, {
        columns: [{ label: 'Code' }, { label: 'Name' }, { label: 'Symbol' }, { label: 'Status' }, { label: '' }],
        rows: state.data || [],
        renderRow: function (c) {
          return h('tr', { key: c.code },
            h('td', null, h('b', null, c.code)),
            h('td', null, c.name),
            h('td', null, c.symbol),
            h('td', null, h(MG.ui.Badge, { status: c.status })),
            h('td', null,
              h(MG.ui.Button, {
                variant: c.status === 'active' ? 'ghost' : 'primary', size: 'sm',
                onClick: function () {
                  var next = c.status === 'active' ? 'unavailable' : 'active';
                  MGA.api.setCurrencyStatus(c.code, next).then(function () {
                    MG.util.toast(c.code + ' set to ' + next + '.', 'ok');
                    reload(function (x) { return x + 1; });
                  }).catch(function (e) { MG.util.toast(MG.util.errMessage(e), 'err'); });
                },
              }, c.status === 'active' ? 'Set unavailable' : 'Set active')));
        },
      }));
  };

  /* --------------------------------------------------------------- deposits */
  MGA.views.deposits = function () {
    var _s = React.useState(''); var status = _s[0]; var setStatus = _s[1];
    var _r = React.useState(0); var reload = _r[1];
    var _sel = React.useState(null); var selected = _sel[0]; var setSelected = _sel[1];
    var _banks = React.useState([]); var banks = _banks[0]; var setBanks = _banks[1];
    var _bankId = React.useState(''); var bankId = _bankId[0]; var setBankId = _bankId[1];
    var _amt = React.useState(''); var amountReceived = _amt[0]; var setAmountReceived = _amt[1];
    var _txn = React.useState(''); var bankTxnId = _txn[0]; var setBankTxnId = _txn[1];
    var _notes = React.useState(''); var notes = _notes[0]; var setNotes = _notes[1];
    var _busy = React.useState(false); var busy = _busy[0]; var setBusy = _busy[1];
    var _confirm = React.useState(null); var confirm = _confirm[0]; var setConfirm = _confirm[1];

    var state = MG.ui.useAsync(function () { return MGA.api.depositQueue(1, status); }, [status, _r[0]]);

    React.useEffect(function () {
      MGA.api.receivingBanks().then(function (res) {
        setBanks((res && res.data) || res || []);
      }).catch(function () {});
    }, []);

    function doAssign() {
      if (!selected || !bankId) return;
      setBusy(true);
      MGA.api.assignBank(selected.id, bankId).then(function () {
        MG.util.toast('Bank details assigned — customer notified.', 'ok');
        setSelected(null); setBankId('');
        reload(function (x) { return x + 1; });
      }).catch(function (e) { MG.util.toast(MG.util.errMessage(e), 'err'); })
        .finally(function () { setBusy(false); });
    }

    function doVerify() {
      if (!selected || !amountReceived) return;
      setConfirm({
        type: 'credit',
        customer: selected.profiles ? (selected.profiles.full_name || selected.profiles.email) : selected.profile_id,
        reference: selected.reference,
        amount: amountReceived,
        currency: selected.currency_code,
        impact: 'Credit ' + amountReceived + ' ' + selected.currency_code + ' to customer Meridian balance',
      });
    }

    function executeConfirm() {
      if (!confirm || !selected) return;
      setBusy(true);
      if (confirm.type === 'credit') {
        MGA.api.verifyCredit(selected.id, {
          amountReceived: amountReceived,
          currencyCode: selected.currency_code,
          bankTransactionId: bankTxnId || undefined,
          notes: notes || undefined,
        }).then(function (res) {
          MG.util.toast('Payment verified and balance credited.', 'ok');
          setSelected(null); setAmountReceived(''); setBankTxnId(''); setNotes('');
          setConfirm(null);
          reload(function (x) { return x + 1; });
        }).catch(function (e) { MG.util.toast(MG.util.errMessage(e), 'err'); })
          .finally(function () { setBusy(false); });
      } else if (confirm.type === 'reject') {
        MGA.api.rejectDeposit(selected.id, notes || 'Rejected by administrator').then(function () {
          MG.util.toast('Deposit rejected.', 'ok');
          setSelected(null); setNotes(''); setConfirm(null);
          reload(function (x) { return x + 1; });
        }).catch(function (e) { MG.util.toast(MG.util.errMessage(e), 'err'); })
          .finally(function () { setBusy(false); });
      }
    }

    var statusOpts = [
      { value: '', label: 'Actionable queue' },
      { value: 'pending_admin_action', label: 'Pending admin action' },
      { value: 'awaiting_payment', label: 'Awaiting payment' },
      { value: 'payment_reported', label: 'Payment reported' },
      { value: 'under_verification', label: 'Under verification' },
      { value: 'partially_fulfilled', label: 'Partially fulfilled' },
      { value: 'completed', label: 'Completed' },
      { value: 'rejected', label: 'Rejected' },
      { value: 'cancelled', label: 'Cancelled' },
    ];

    return h('div', { className: 'view-stack' },
      h('div', { className: 'adm-note' },
        'Manual bank-transfer workflow. Customer identity for credits is taken from the original deposit request — never selected by the administrator.'),
      h(MG.ui.Card, null,
        h('div', { className: 'filter-bar' },
          h(MG.ui.Select, {
            value: status, onChange: function (e) { setStatus(e.target.value); },
            options: statusOpts,
          }))),
      h(MG.ui.Card, { title: 'Deposit management queue' },
        state.loading ? h(MG.ui.Skeleton, { lines: 6 })
          : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
          : (state.data || []).length === 0
            ? h(MG.ui.Empty, { title: 'No deposits in queue' })
            : h(MG.ui.Table, {
                columns: [
                  { label: 'Reference' }, { label: 'Customer' },
                  { label: 'Requested', right: true }, { label: 'Credited', right: true },
                  { label: 'Status' }, { label: 'Requested' }, { label: '' },
                ],
                rows: state.data || [],
                renderRow: function (d) {
                  var cust = d.profiles ? (d.profiles.full_name || d.profiles.email) : '—';
                  var reqAmt = d.requested_amount != null ? d.requested_amount : d.amount;
                  var cred = d.credited_amount != null ? d.credited_amount : '0';
                  return h('tr', { key: d.id, className: selected && selected.id === d.id ? 'row-selected' : '' },
                    h('td', null, h('b', null, d.reference)),
                    h('td', null, cust),
                    h('td', { style: { textAlign: 'right' } }, MG.util.money(reqAmt, d.currency_code)),
                    h('td', { style: { textAlign: 'right' } }, MG.util.money(cred, d.currency_code)),
                    h('td', null, h(MG.ui.Badge, { status: d.status })),
                    h('td', null, MG.util.date(d.requested_at)),
                    h('td', null,
                      h(MG.ui.Button, { size: 'sm', variant: 'ghost', onClick: function () { setSelected(d); setAmountReceived(String(reqAmt)); } }, 'Manage')));
                },
              })),
      selected ? h(MG.ui.Card, { title: 'Manage deposit — ' + selected.reference },
        h('div', { className: 'form-grid' },
          h('p', null, h('b', null, 'Customer: '), selected.profiles ? (selected.profiles.full_name || selected.profiles.email) : selected.profile_id),
          h('p', null, h('b', null, 'Requested: '), MG.util.money(selected.requested_amount || selected.amount, selected.currency_code),
            ' · Credited: ', MG.util.money(selected.credited_amount || 0, selected.currency_code),
            ' · Status: ', h(MG.ui.Badge, { status: selected.status })),
          (selected.status === 'pending_admin_action' || selected.status === 'awaiting_payment') ? h('div', { className: 'form-row' },
            h('label', null, 'Assign receiving bank'),
            h(MG.ui.Select, {
              value: bankId, onChange: function (e) { setBankId(e.target.value); },
              options: [{ value: '', label: 'Select bank account…' }].concat(
                (banks || []).filter(function (b) { return b.currency_code === selected.currency_code && b.is_active !== false; })
                  .map(function (b) { return { value: b.id, label: b.label + ' — ' + b.bank_name }; })
              ),
            }),
            h(MG.ui.Button, { variant: 'primary', disabled: busy || !bankId, onClick: doAssign }, 'Assign bank details')
          ) : null,
          (['awaiting_payment','payment_reported','under_verification','partially_fulfilled'].indexOf(selected.status) >= 0) ? h('div', { className: 'form-row' },
            h('label', null, 'Amount received (will be credited)'),
            h(MG.ui.Input, { value: amountReceived, onChange: function (e) { setAmountReceived(e.target.value); }, placeholder: 'e.g. 1000.00' }),
            h('label', null, 'Bank transaction ID (optional, unique)'),
            h(MG.ui.Input, { value: bankTxnId, onChange: function (e) { setBankTxnId(e.target.value); } }),
            h('label', null, 'Verification notes'),
            h(MG.ui.Input, { value: notes, onChange: function (e) { setNotes(e.target.value); } }),
            h('div', { className: 'btn-row' },
              h(MG.ui.Button, { variant: 'primary', disabled: busy || !amountReceived, onClick: doVerify }, 'Approve and credit'),
              h(MG.ui.Button, { variant: 'ghost', disabled: busy, onClick: function () {
                setConfirm({ type: 'reject', customer: selected.profiles ? (selected.profiles.full_name || selected.profiles.email) : selected.profile_id,
                  reference: selected.reference, amount: selected.requested_amount || selected.amount, currency: selected.currency_code,
                  impact: 'Reject deposit — no balance change' });
              } }, 'Reject'))
          ) : null,
          h(MG.ui.Button, { variant: 'ghost', size: 'sm', onClick: function () { setSelected(null); } }, 'Close')
        )
      ) : null,
      confirm ? h('div', { className: 'modal-overlay' },
        h('div', { className: 'modal-card' },
          h('h3', null, 'Confirm financial operation'),
          h('p', null, h('b', null, 'Customer: '), confirm.customer),
          h('p', null, h('b', null, 'Reference: '), confirm.reference),
          h('p', null, h('b', null, 'Amount: '), confirm.amount, ' ', confirm.currency),
          h('p', null, h('b', null, 'Impact: '), confirm.impact),
          h('div', { className: 'btn-row' },
            h(MG.ui.Button, { variant: 'primary', disabled: busy, onClick: executeConfirm }, 'Confirm'),
            h(MG.ui.Button, { variant: 'ghost', onClick: function () { setConfirm(null); } }, 'Cancel'))
        )
      ) : null
    );
  };

  /* ----------------------------------------------------------------- refunds */
  MGA.views.refunds = function () {
    var _s = React.useState(''); var status = _s[0]; var setStatus = _s[1];
    var _r = React.useState(0); var reload = _r[1];
    var _sel = React.useState(null); var selected = _sel[0]; var setSelected = _sel[1];
    var _amt = React.useState(''); var approvedAmount = _amt[0]; var setApprovedAmount = _amt[1];
    var _notes = React.useState(''); var notes = _notes[0]; var setNotes = _notes[1];
    var _busy = React.useState(false); var busy = _busy[0]; var setBusy = _busy[1];
    var _confirm = React.useState(null); var confirm = _confirm[0]; var setConfirm = _confirm[1];

    var state = MG.ui.useAsync(function () { return MGA.api.refunds(1, status); }, [status, _r[0]]);

    function doApprove() {
      if (!selected) return;
      setConfirm({
        type: 'approve',
        customer: selected.profile_id,
        reference: selected.reference,
        amount: approvedAmount || selected.requested_amount,
        currency: selected.currency_code,
        impact: 'Credit ' + (approvedAmount || selected.requested_amount) + ' ' + selected.currency_code + ' to customer Meridian balance (internal refund)',
      });
    }

    function executeConfirm() {
      if (!confirm || !selected) return;
      setBusy(true);
      if (confirm.type === 'approve') {
        MGA.api.approveRefund(selected.id, approvedAmount || undefined, notes || undefined).then(function () {
          MG.util.toast('Refund approved — Meridian balance credited.', 'ok');
          setSelected(null); setApprovedAmount(''); setNotes(''); setConfirm(null);
          reload(function (x) { return x + 1; });
        }).catch(function (e) { MG.util.toast(MG.util.errMessage(e), 'err'); })
          .finally(function () { setBusy(false); });
      } else {
        MGA.api.rejectRefund(selected.id, notes || 'Rejected').then(function () {
          MG.util.toast('Refund rejected.', 'ok');
          setSelected(null); setNotes(''); setConfirm(null);
          reload(function (x) { return x + 1; });
        }).catch(function (e) { MG.util.toast(MG.util.errMessage(e), 'err'); })
          .finally(function () { setBusy(false); });
      }
    }

    return h('div', { className: 'view-stack' },
      h('div', { className: 'adm-note' },
        'All refunds are internal. Approving a refund credits the customer\'s Meridian balance. No external bank payout is performed.'),
      h(MG.ui.Card, null,
        h('div', { className: 'filter-bar' },
          h(MG.ui.Select, {
            value: status, onChange: function (e) { setStatus(e.target.value); },
            options: [
              { value: '', label: 'All statuses' },
              { value: 'requested', label: 'Requested' },
              { value: 'under_review', label: 'Under review' },
              { value: 'approved', label: 'Approved' },
              { value: 'completed', label: 'Completed' },
              { value: 'rejected', label: 'Rejected' },
            ],
          }))),
      h(MG.ui.Card, { title: 'Refund requests' },
        state.loading ? h(MG.ui.Skeleton, { lines: 6 })
          : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
          : (state.data || []).length === 0
            ? h(MG.ui.Empty, { title: 'No refunds' })
            : h(MG.ui.Table, {
                columns: [
                  { label: 'Reference' }, { label: 'Original' },
                  { label: 'Requested', right: true }, { label: 'Status' }, { label: 'Created' }, { label: '' },
                ],
                rows: state.data || [],
                renderRow: function (r) {
                  return h('tr', { key: r.id },
                    h('td', null, h('b', null, r.reference)),
                    h('td', null, r.original_reference),
                    h('td', { style: { textAlign: 'right' } }, MG.util.money(r.requested_amount, r.currency_code)),
                    h('td', null, h(MG.ui.Badge, { status: r.status })),
                    h('td', null, MG.util.date(r.created_at)),
                    h('td', null,
                      h(MG.ui.Button, { size: 'sm', variant: 'ghost', onClick: function () {
                        setSelected(r); setApprovedAmount(String(r.requested_amount));
                      } }, 'Review')));
                },
              })),
      selected ? h(MG.ui.Card, { title: 'Review refund — ' + selected.reference },
        h('div', { className: 'form-grid' },
          h('p', null, h('b', null, 'Original transaction: '), selected.original_reference,
            ' (', MG.util.money(selected.original_amount, selected.currency_code), ')'),
          h('p', null, h('b', null, 'Customer: '), selected.profile_id),
          h('p', null, h('b', null, 'Reason: '), selected.reason),
          h('p', null, h('b', null, 'Status: '), h(MG.ui.Badge, { status: selected.status })),
          (['requested','under_review','approved'].indexOf(selected.status) >= 0) ? h('div', { className: 'form-row' },
            h('label', null, 'Approved amount'),
            h(MG.ui.Input, { value: approvedAmount, onChange: function (e) { setApprovedAmount(e.target.value); } }),
            h('label', null, 'Notes'),
            h(MG.ui.Input, { value: notes, onChange: function (e) { setNotes(e.target.value); } }),
            h('div', { className: 'btn-row' },
              h(MG.ui.Button, { variant: 'primary', disabled: busy, onClick: doApprove }, 'Approve and credit Meridian balance'),
              h(MG.ui.Button, { variant: 'ghost', disabled: busy, onClick: function () {
                setConfirm({ type: 'reject', customer: selected.profile_id, reference: selected.reference,
                  amount: selected.requested_amount, currency: selected.currency_code, impact: 'Reject refund — no balance change' });
              } }, 'Reject'))
          ) : null,
          h(MG.ui.Button, { variant: 'ghost', size: 'sm', onClick: function () { setSelected(null); } }, 'Close')
        )
      ) : null,
      confirm ? h('div', { className: 'modal-overlay' },
        h('div', { className: 'modal-card' },
          h('h3', null, 'Confirm financial operation'),
          h('p', null, h('b', null, 'Customer: '), confirm.customer),
          h('p', null, h('b', null, 'Reference: '), confirm.reference),
          h('p', null, h('b', null, 'Amount: '), confirm.amount, ' ', confirm.currency),
          h('p', null, h('b', null, 'Impact: '), confirm.impact),
          h('div', { className: 'btn-row' },
            h(MG.ui.Button, { variant: 'primary', disabled: busy, onClick: executeConfirm }, 'Confirm'),
            h(MG.ui.Button, { variant: 'ghost', onClick: function () { setConfirm(null); } }, 'Cancel'))
        )
      ) : null
    );
  };

  /* ----------------------------------------------------------- transactions */
  MGA.views.transactions = function () {
    var _f = React.useState({ q: '', currency: '', status: '' }); var filters = _f[0]; var setFilters = _f[1];
    var state = MG.ui.useAsync(function () {
      return MGA.api.transactions({ q: filters.q, currency: filters.currency, status: filters.status });
    }, [filters.q, filters.currency, filters.status]);
    return h('div', { className: 'view-stack' },
      h(MG.ui.Card, null,
        h('div', { className: 'filter-bar' },
          h(MG.ui.Input, { placeholder: 'Search reference…', value: filters.q,
            onChange: function (e) { setFilters(Object.assign({}, filters, { q: e.target.value })); },
            passThrough: { style: { flex: 2 } } }),
          h(MG.ui.Select, {
            value: filters.currency, onChange: function (e) { setFilters(Object.assign({}, filters, { currency: e.target.value })); },
            options: [
              { value: '', label: 'All currencies' }, { value: 'EUR', label: 'EUR' },
              { value: 'GBP', label: 'GBP' }, { value: 'USD', label: 'USD' },
              { value: 'CHF', label: 'CHF' }, { value: 'PLN', label: 'PLN' },
            ],
          }),
          h(MG.ui.Select, {
            value: filters.status, onChange: function (e) { setFilters(Object.assign({}, filters, { status: e.target.value })); },
            options: [
              { value: '', label: 'All statuses' }, { value: 'posted', label: 'Posted' },
              { value: 'pending', label: 'Pending' }, { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          }))),
      h(MG.ui.Card, { title: 'Ledger (immutable — no administrative edits exist)' },
        state.loading ? h(MG.ui.Skeleton, { lines: 8 })
          : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
          : (state.data || []).length === 0
            ? h(MG.ui.Empty, { title: 'No transactions match' })
            : h(MG.ui.Table, {
                columns: [{ label: 'Reference' }, { label: 'Customer' }, { label: 'Amount', right: true }, { label: 'Status' }, { label: 'Date' }],
                rows: state.data || [],
                renderRow: function (t) {
                  var cust = t.profiles ? (t.profiles.full_name || t.profiles.email) : '—';
                  return h('tr', { key: t.id },
                    h('td', null, t.reference),
                    h('td', null, cust),
                    h('td', { style: { textAlign: 'right' } },
                      (t.direction === 'credit' ? '+' : '-') + MG.util.money(t.amount, t.currency_code)),
                    h('td', null, h(MG.ui.Badge, { status: t.status })),
                    h('td', null, MG.util.date(t.created_at)));
                },
              })));
  };

  /* --------------------------------------------------------------- payments */
  MGA.views.payments = function () {
    var state = MG.ui.useAsync(function () { return MGA.api.payments(1); }, []);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var list = state.data || [];
    var stats = {};
    list.forEach(function (a) { stats[a.outcome] = (stats[a.outcome] || 0) + 1; });
    return h('div', { className: 'view-stack' },
      h('div', { className: 'grid-4' },
        Object.keys(stats).map(function (k) {
          return h(MG.ui.StatCard, { key: k, label: k.replace('_', ' '), value: MG.util.num(stats[k]) });
        })),
      h(MG.ui.Card, { title: 'Payment attempts' },
        list.length === 0
          ? h(MG.ui.Empty, { title: 'No payment attempts yet' })
          : h(MG.ui.Table, {
              columns: [{ label: 'Deposit' }, { label: 'Provider' }, { label: 'Outcome' }, { label: 'Recorded' }],
              rows: list,
              renderRow: function (a) {
                var dep = a.deposits ? a.deposits.reference : '—';
                return h('tr', { key: a.id },
                  h('td', null, dep),
                  h('td', null, a.provider),
                  h('td', null, h(MG.ui.Badge, { status: a.outcome })),
                  h('td', null, MG.util.dateTime(a.created_at)));
              },
            })));
  };

  /* --------------------------------------------------------------- security */
  MGA.views.security = function () {
    var _u = React.useState(''); var freezeUser = _u[0]; var setFreezeUser = _u[1];
    var _rs = React.useState(''); var freezeReason = _rs[0]; var setFreezeReason = _rs[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    var state = MG.ui.useAsync(function () { return MGA.api.securityEvents(1); }, []);
    return h('div', { className: 'view-stack' },
      h(MG.ui.Card, { title: 'Freeze an account' },
        h('p', { className: 'muted' }, 'Freezing suspends the customer via Clerk (sessions end immediately) and records a security event with your reason.'),
        h('div', { className: 'filter-bar' },
          h(MG.ui.Input, { placeholder: 'Clerk user id (user_…)', value: freezeUser,
            onChange: function (e) { setFreezeUser(e.target.value); } }),
          h(MG.ui.Input, { placeholder: 'Reason (recorded)', value: freezeReason,
            onChange: function (e) { setFreezeReason(e.target.value); } }),
          h(MG.ui.Button, {
            variant: 'danger', busy: busy,
            onClick: function () {
              if (!freezeUser || freezeReason.trim().length < 3) {
                MG.util.toast('Provide the user id and a reason.', 'err'); return;
              }
              setBusy(true);
              MGA.api.freeze(freezeUser, freezeReason).then(function () {
                setBusy(false);
                MG.util.toast('Account frozen.', 'ok');
                location.reload();
              }).catch(function (e) { setBusy(false); MG.util.toast(MG.util.errMessage(e), 'err'); });
            },
          }, 'Freeze'))),
      h(MG.ui.Card, { title: 'Security events' },
        state.loading ? h(MG.ui.Skeleton, { lines: 6 })
          : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
          : (state.data || []).length === 0
            ? h(MG.ui.Empty, { title: 'No security events' })
            : h(MG.ui.Table, {
                columns: [{ label: 'Type' }, { label: 'Customer' }, { label: 'Severity' }, { label: 'Detail' }, { label: 'When' }],
                rows: state.data || [],
                renderRow: function (e) {
                  var cust = e.profiles ? (e.profiles.email || e.profiles.full_name) : e.profile_id;
                  return h('tr', { key: e.id },
                    h('td', null, (e.type || '').replace('_', ' ')),
                    h('td', null, cust),
                    h('td', null, h(MG.ui.Badge, { status: e.severity === 'critical' ? 'failed' : e.severity === 'warning' ? 'pending' : 'posted' })),
                    h('td', null, e.detail ? JSON.stringify(e.detail).slice(0, 80) : '—'),
                    h('td', null, MG.util.dateTime(e.created_at)));
                },
              })));
  };

  /* ---------------------------------------------------------------- reports */
  MGA.views.reports = function () {
    var state = MG.ui.useAsync(function () { return MGA.api.reports(); }, []);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var d = state.data || {};
    function rowsOf(obj) {
      return Object.keys(obj || {}).map(function (k) { return [k, obj[k]]; });
    }
    return h('div', { className: 'view-stack' },
      h('div', { className: 'grid-3' },
        h(MG.ui.Card, { title: 'Deposits by method' },
          h(MG.ui.Table, {
            columns: [{ label: 'Method' }, { label: 'Count', right: true }],
            rows: rowsOf(d.depositsByMethod), emptyTitle: 'No deposits yet',
            renderRow: function (r) { return h('tr', { key: r[0] }, h('td', null, r[0].replace('_', ' ')), h('td', { style: { textAlign: 'right' } }, MG.util.num(r[1]))); },
          })),
        h(MG.ui.Card, { title: 'Deposits by status' },
          h(MG.ui.Table, {
            columns: [{ label: 'Status' }, { label: 'Count', right: true }],
            rows: rowsOf(d.depositsByStatus), emptyTitle: 'No deposits yet',
            renderRow: function (r) { return h('tr', { key: r[0] }, h('td', null, h(MG.ui.Badge, { status: r[0] })), h('td', { style: { textAlign: 'right' } }, MG.util.num(r[1]))); },
          })),
        h(MG.ui.Card, { title: 'Customers by country' },
          h(MG.ui.Table, {
            columns: [{ label: 'Country' }, { label: 'Customers', right: true }],
            rows: rowsOf(d.usersByCountry), emptyTitle: 'No customers yet',
            renderRow: function (r) { return h('tr', { key: r[0] }, h('td', null, r[0]), h('td', { style: { textAlign: 'right' } }, MG.util.num(r[1]))); },
          }))));
  };

  /* ---------------------------------------------------------------- support */
  MGA.views.support = function () {
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MGA.api.tickets(); }, [_r[0]]);
    var _m = React.useState({}); var replies = _m[0]; var setReplies = _m[1];
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var list = state.data || [];
    return h(MG.ui.Card, { title: 'Support tickets' },
      list.length === 0
        ? h(MG.ui.Empty, { title: 'No tickets' })
        : list.map(function (t) {
            var cust = t.profiles ? (t.profiles.full_name || t.profiles.email) : '—';
            return h('div', { key: t.id, className: 'ticket' },
              h('div', { className: 'ticket-head' },
                h('div', null, h('b', null, t.subject), h('small', { className: 'muted' }, ' · ' + cust + ' · ' + t.category)),
                h(MG.ui.Badge, { status: t.status })),
              h('ul', { className: 'thread' }, (t.support_messages || []).map(function (m) {
                return h('li', { key: m.id, className: 'msg msg-' + m.sender },
                  h('small', null, m.sender === 'customer' ? 'Customer' : 'Support', ' · ', MG.util.timeAgo(m.created_at)),
                  h('p', null, m.body));
              })),
              t.status !== 'resolved' ? h('div', { className: 'filter-bar' },
                h(MG.ui.Input, {
                  placeholder: 'Write a reply…', value: replies[t.id] || '',
                  onChange: function (e) { var n = Object.assign({}, replies); n[t.id] = e.target.value; setReplies(n); },
                  passThrough: { style: { flex: 3 } },
                }),
                h(MG.ui.Button, {
                  variant: 'primary', onClick: function () {
                    var msg = (replies[t.id] || '').trim();
                    if (msg.length < 2) return;
                    MGA.api.replyTicket(t.id, msg).then(function () {
                      MG.util.toast('Reply posted.', 'ok');
                      reload(function (x) { return x + 1; });
                    }).catch(function (e) { MG.util.toast(MG.util.errMessage(e), 'err'); });
                  },
                }, 'Reply'),
                h(MG.ui.Button, {
                  variant: 'ghost', onClick: function () {
                    MGA.api.resolveTicket(t.id).then(function () {
                      MG.util.toast('Ticket resolved.', 'ok');
                      reload(function (x) { return x + 1; });
                    }).catch(function (e) { MG.util.toast(MG.util.errMessage(e), 'err'); });
                  },
                }, 'Resolve')) : null);
          }));
  };

  /* ------------------------------------------------------------------ roles */
  MGA.views.roles = function () {
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MGA.api.roles(); }, [_r[0]]);
    var _a = React.useState({ clerkUserId: '', roleId: 'support', displayName: '' }); var assign = _a[0]; var setAssign = _a[1];
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var d = state.data || {};
    var allPerms = [];
    (d.roles || []).forEach(function (r) { (r.permissions || []).forEach(function (p) { if (allPerms.indexOf(p) < 0) allPerms.push(p); }); });
    allPerms.sort();
    return h('div', { className: 'view-stack' },
      h(MG.ui.Card, { title: 'Assign a role' },
        h('p', { className: 'muted' }, 'Requires the Clerk user id (user_…). The backend verifies the identity exists in Clerk before granting administrative power.'),
        h('div', { className: 'filter-bar' },
          h(MG.ui.Input, { placeholder: 'Clerk user id (user_…)', value: assign.clerkUserId,
            onChange: function (e) { setAssign(Object.assign({}, assign, { clerkUserId: e.target.value })); } }),
          h(MG.ui.Select, {
            value: assign.roleId, onChange: function (e) { setAssign(Object.assign({}, assign, { roleId: e.target.value })); },
            options: (d.roles || []).map(function (r) { return { value: r.id, label: r.id }; }),
          }),
          h(MG.ui.Button, {
            variant: 'primary', onClick: function () {
              MGA.api.assignRole(assign.clerkUserId, assign.roleId, assign.displayName || undefined).then(function () {
                MG.util.toast('Role assigned.', 'ok');
                reload(function (x) { return x + 1; });
              }).catch(function (e) { MG.util.toast(MG.util.errMessage(e), 'err'); });
            },
          }, 'Assign')),
        h(MG.ui.Table, {
          columns: [{ label: 'Holder' }, { label: 'Role' }, { label: 'Assigned' }, { label: '' }],
          rows: d.holders || [], emptyTitle: 'No administrators assigned yet',
          renderRow: function (u) {
            return h('tr', { key: u.clerk_user_id },
              h('td', null, (u.display_name || '') + ' ', h('small', { className: 'muted' }, u.clerk_user_id)),
              h('td', null, h('span', { className: 'adm-chip' }, u.role_id)),
              h('td', null, MG.util.date(u.assigned_at)),
              h('td', null, h(MG.ui.Button, {
                variant: 'ghost', size: 'sm',
                onClick: function () {
                  MGA.api.revokeRole(u.clerk_user_id).then(function () {
                    MG.util.toast('Role revoked.', 'ok');
                    reload(function (x) { return x + 1; });
                  }).catch(function (e) { MG.util.toast(MG.util.errMessage(e), 'err'); });
                },
              }, 'Revoke')));
          },
        })),
      h(MG.ui.Card, { title: 'Permission matrix (enforced server-side on every request)' },
        h('div', { className: 'table-wrap' },
          h('table', { className: 'table matrix' },
            h('thead', null, h('tr', null,
              h('th', null, 'Role'),
              allPerms.map(function (p) { return h('th', { key: p }, p); }))),
            h('tbody', null, (d.roles || []).map(function (r) {
              return h('tr', { key: r.id },
                h('td', null, h('b', null, r.id)),
                allPerms.map(function (p) {
                  var has = (r.permissions || []).indexOf(p) >= 0;
                  return h('td', { key: p, className: has ? 'yes' : 'no' }, has ? '✓' : '—');
                }));
            }))))));
  };

  /* ------------------------------------------------------------------ audit */
  MGA.views.audit = function () {
    var _f = React.useState({ q: '', result: '', page: 1 }); var filters = _f[0]; var setFilters = _f[1];
    var state = MG.ui.useAsync(function () {
      return MGA.api.audit({ q: filters.q, result: filters.result, page: filters.page });
    }, [filters.q, filters.result, filters.page]);
    var meta = state.data ? state.data.meta || {} : {};
    function set(k, v) {
      var next = Object.assign({}, filters); next[k] = v;
      if (k !== 'page') next.page = 1;
      setFilters(next);
    }
    return h('div', { className: 'view-stack' },
      h(MG.ui.Card, null,
        h('div', { className: 'filter-bar' },
          h(MG.ui.Input, { placeholder: 'Search action, actor or target…', value: filters.q,
            onChange: function (e) { set('q', e.target.value); }, passThrough: { style: { flex: 2 } } }),
          h(MG.ui.Select, {
            value: filters.result, onChange: function (e) { set('result', e.target.value); },
            options: [
              { value: '', label: 'All results' }, { value: 'allowed', label: 'Allowed' },
              { value: 'denied', label: 'Denied' },
            ],
          }))),
      h(MG.ui.Card, { title: 'Audit log (append-only)' },
        state.loading ? h(MG.ui.Skeleton, { lines: 8 })
          : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
          : (state.data || []).length === 0
            ? h(MG.ui.Empty, { title: 'No entries match' })
            : h(React.Fragment, null,
                h(MG.ui.Table, {
                  columns: [{ label: 'When' }, { label: 'Actor' }, { label: 'Action' }, { label: 'Target' }, { label: 'Result' }, { label: 'Detail' }],
                  rows: state.data || [],
                  renderRow: function (l) {
                    return h('tr', { key: l.id, className: l.result === 'denied' ? 'denied-row' : '' },
                      h('td', null, MG.util.dateTime(l.created_at)),
                      h('td', null, l.actor_id),
                      h('td', null, l.action),
                      h('td', null, (l.target_type || '') + (l.target_id ? ' · ' + String(l.target_id).slice(0, 18) : '')),
                      h('td', null, h(MG.ui.Badge, { status: l.result })),
                      h('td', null, l.detail ? JSON.stringify(l.detail).slice(0, 60) : '—'));
                  },
                }),
                meta.pages > 1 ? h('div', { className: 'pager' },
                  h(MG.ui.Button, { variant: 'ghost', disabled: filters.page <= 1,
                    onClick: function () { set('page', filters.page - 1); } }, '← Previous'),
                  h('span', { className: 'pager-info' }, 'Page ' + (meta.page || filters.page) + ' of ' + meta.pages),
                  h(MG.ui.Button, { variant: 'ghost', disabled: filters.page >= (meta.pages || 1),
                    onClick: function () { set('page', filters.page + 1); } }, 'Next →')) : null)));
  };

  /* --------------------------------------------------------------- settings */
  MGA.views.settings = function () {
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MGA.api.settings(); }, [_r[0]]);
    var _m = React.useState(null); var maintenance = _m[0]; var setMaintenance = _m[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    React.useEffect(function () {
      if (state.data && !maintenance) {
        var found = (state.data || []).find(function (s) { return s.key === 'platform.maintenance_mode'; });
        if (found) setMaintenance(found.value === true || found.value === 'true');
      }
    }, [state.data]);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    return h(MG.ui.Card, { title: 'Platform settings' },
      h('label', { className: 'pref-line' },
        h('input', {
          type: 'checkbox', checked: Boolean(maintenance),
          onChange: function (e) { setMaintenance(e.target.checked); },
        }),
        h('span', null, h('b', null, 'Maintenance mode'), ' — shows a maintenance notice in the customer application')),
      h(MG.ui.Button, {
        variant: 'primary', busy: busy, style: { marginTop: 12 },
        onClick: function () {
          setBusy(true);
          MGA.api.updateSettings({ maintenanceMode: Boolean(maintenance) }).then(function () {
            setBusy(false);
            MG.util.toast('Settings updated.', 'ok');
            reload(function (x) { return x + 1; });
          }).catch(function (e) { setBusy(false); MG.util.toast(MG.util.errMessage(e), 'err'); });
        },
      }, 'Save settings'),
      h('p', { className: 'muted', style: { marginTop: 14 } },
        'All settings changes are audit-logged. Support email and platform name are managed in the database settings table by the deployment runbook.'));
  };
})();
