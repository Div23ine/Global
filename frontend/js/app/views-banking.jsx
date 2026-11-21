/* Customer views — banking: overview, accounts, account detail, activate,
   deposits. Four states everywhere: loading, empty, error, populated. */
(function () {
  var React = window.React;
  var h = React.createElement;
  MG.views = MG.views || {};

  /* ------------------------------------------------------------- overview */
  MG.views.overview = function (props) {
    var accounts = MG.ui.useAsync(function () { return MG.api.accounts(); }, []);
    var txns = MG.ui.useAsync(function () { return MG.api.transactions({ pageSize: 6 }); }, []);
    var notifs = MG.ui.useAsync(function () { return MG.api.notifications(); }, []);

    // Track unread for the sidebar badge.
    React.useEffect(function () {
      if (notifs.data) MG.app.unreadCount = notifs.meta && notifs.meta.unread ? notifs.meta.unread : 0;
    }, [notifs.data]);

    if (accounts.loading) return h('div', { className: 'view-stack' },
      h(MG.ui.LoadingPanel), h(MG.ui.LoadingPanel));
    if (accounts.error) return h(MG.ui.ErrorPanel, { error: accounts.error, onRetry: function () { location.reload(); } });

    var list = accounts.data || [];
    var totalEur = list.reduce(function (acc, a) { return acc + (Number(a.equivalent_eur) || 0); }, 0);

    return h('div', { className: 'view-stack' },
      h('div', { className: 'panel hero-panel' },
        h('small', null, 'TOTAL BALANCE · EUR EQUIVALENT (INDICATIVE)'),
        h('b', { className: 'hero-balance' }, MG.util.money(totalEur, 'EUR')),
        h('div', { className: 'hero-actions' },
          h('a', { className: 'btn btn-primary', href: '#/deposits' }, 'Deposit'),
          h('a', { className: 'btn btn-ghost', href: '#/activate' }, 'Activate currency'))),
      h('div', { className: 'grid-3' },
        list.length === 0
          ? h('div', { className: 'panel', style: { gridColumn: '1/-1' } },
              h(MG.ui.Empty, {
                title: 'No currency accounts yet',
                hint: 'Your default currency account is created during registration. If it is missing, contact support.',
                action: h('a', { className: 'btn btn-primary', href: '#/activate' }, 'Activate a currency') }))
          : list.map(function (a) {
              return h('div', { key: a.id, className: 'stat-card cur-stat' },
                h('small', null, a.currency_code + ' · ' + (a.currency_name || '')),
                h('b', null, MG.util.money(a.balance, a.currency_code)),
                h('span', { className: 'stat-hint' },
                  (a.txn_count || 0) + ' transactions · opened ' + MG.util.date(a.opened_at)));
            })),
      h(MG.ui.Card, { title: 'Recent transactions', action: h('a', { className: 'text-link', href: '#/transactions' }, 'View all →') },
        txns.loading ? h(MG.ui.Skeleton, { lines: 4 })
          : (txns.data || []).length === 0
            ? h(MG.ui.Empty, { title: 'No transactions yet',
                hint: 'Your ledger entries will appear here after your first confirmed deposit.' })
            : h(MG.ui.Table, {
                columns: [{ label: 'Reference' }, { label: 'Description' }, { label: 'Amount', right: true }, { label: 'Status' }, { label: 'Date' }],
                rows: txns.data || [],
                renderRow: function (t) {
                  return h('tr', { key: t.id },
                    h('td', null, h('a', { href: '#/txn/' + t.reference }, t.reference)),
                    h('td', null, t.description || '—'),
                    h('td', { style: { textAlign: 'right' } },
                      (t.direction === 'credit' ? '+' : '-') + MG.util.money(t.amount, t.currency_code)),
                    h('td', null, h(MG.ui.Badge, { status: t.status })),
                    h('td', null, MG.util.date(t.created_at)));
                },
              })),
      h(MG.ui.Card, { title: 'Notifications preview', action: h('a', { className: 'text-link', href: '#/notifications' }, 'All notifications →') },
        notifs.loading ? h(MG.ui.Skeleton, { lines: 3 })
          : (notifs.data || []).length === 0
            ? h(MG.ui.Empty, { title: 'Nothing yet', hint: 'Deposit and security updates will appear here.' })
            : h('ul', { className: 'mini-list' },
                (notifs.data || []).slice(0, 3).map(function (n) {
                  return h('li', { key: n.id, className: n.read_at ? '' : 'unread' },
                    h('b', null, n.title),
                    h('span', null, n.body),
                    h('small', null, MG.util.timeAgo(n.created_at)));
                }))));
  };

  /* -------------------------------------------------------------- accounts */
  MG.views.accounts = function () {
    var state = MG.ui.useAsync(function () { return MG.api.accounts(); }, []);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.hash = '#/accounts'; location.reload(); } });
    var list = state.data || [];
    return h('div', { className: 'view-stack' },
      list.length === 0
        ? h(MG.ui.Card, null, h(MG.ui.Empty, {
            title: 'No accounts yet', hint: 'Activate your first currency to get started.',
            action: h('a', { className: 'btn btn-primary', href: '#/activate' }, 'Activate a currency') }))
        : h('div', { className: 'grid-2' }, list.map(function (a) {
            return h(MG.ui.Card, { key: a.id, className: 'acc-card' },
              h('div', { className: 'acc-head' },
                h('div', null,
                  h('h3', null, a.currency_code, ' ', h('small', { className: 'muted' }, a.currency_name || '')),
                  h(MG.ui.Badge, { status: a.status })),
                h('b', { className: 'acc-balance' }, MG.util.money(a.balance, a.currency_code))),
              h('p', { className: 'muted' },
                (a.txn_count || 0) + ' transactions · opened ' + MG.util.date(a.opened_at)),
              h('a', { className: 'btn btn-ghost btn-sm', href: '#/account/' + a.currency_code }, 'View account →'));
          })));
  };

  /* --------------------------------------------------------- account/:code */
  MG.views.account = function (props) {
    var code = props.route.param;
    var state = MG.ui.useAsync(function () { return MG.api.account(code); }, [code]);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var d = state.data || {};
    return h('div', { className: 'view-stack' },
      h(MG.ui.Card, null,
        h('div', { className: 'acc-head' },
          h('div', null,
            h('h3', null, d.account.currency_code, ' ', h('small', { className: 'muted' }, 'currency account')),
            h(MG.ui.Badge, { status: d.account.status })),
          h('b', { className: 'acc-balance' }, MG.util.money(d.account.balance, d.account.currency_code))),
        h('p', { className: 'muted' }, 'Opened ' + MG.util.date(d.account.opened_at)),
        h('a', { className: 'text-link', href: '#/accounts' }, '← All accounts')),
      h(MG.ui.Card, { title: 'Recent transactions' },
        (d.transactions || []).length === 0
          ? h(MG.ui.Empty, { title: 'No entries yet', hint: 'Confirmed deposits appear here as ledger entries.' })
          : h(MG.ui.Table, {
              columns: [{ label: 'Reference' }, { label: 'Description' }, { label: 'Amount', right: true }, { label: 'Status' }, { label: 'Date' }],
              rows: d.transactions || [],
              renderRow: function (t) {
                return h('tr', { key: t.id },
                  h('td', null, h('a', { href: '#/txn/' + t.reference }, t.reference)),
                  h('td', null, t.description || '—'),
                  h('td', { style: { textAlign: 'right' } },
                    (t.direction === 'credit' ? '+' : '-') + MG.util.money(t.amount, t.currency_code)),
                  h('td', null, h(MG.ui.Badge, { status: t.status })),
                  h('td', null, MG.util.date(t.created_at)));
              },
            })),
      h(MG.ui.Card, { title: 'Deposit records' },
        (d.deposits || []).length === 0
          ? h(MG.ui.Empty, { title: 'No deposits yet', hint: 'Deposit requests for this currency appear here.' })
          : h(MG.ui.Table, {
              columns: [{ label: 'Reference' }, { label: 'Amount', right: true }, { label: 'Method' }, { label: 'Status' }, { label: 'Requested' }],
              rows: d.deposits || [],
              renderRow: function (d2) {
                return h('tr', { key: d2.id },
                  h('td', null, d2.reference),
                  h('td', { style: { textAlign: 'right' } }, MG.util.money(d2.amount, d2.currency_code)),
                  h('td', null, (d2.method || '').replace('_', ' ')),
                  h('td', null, h(MG.ui.Badge, { status: d2.status })),
                  h('td', null, MG.util.date(d2.requested_at)));
              },
            })));
  };

  /* -------------------------------------------------------------- activate */
  MG.views.activate = function () {
    var _s = React.useState(null); var selected = _s[0]; var setSelected = _s[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    var state = MG.ui.useAsync(function () { return MG.api.currencies(); }, []);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });

    function activate(code) {
      setBusy(true); setSelected(code);
      MG.api.activateCurrency(code).then(function () {
        MG.util.toast(code + ' account activated with a zero balance.', 'ok');
        location.hash = '#/account/' + code;
      }).catch(function (err) {
        MG.util.toast(MG.util.errMessage(err), 'err');
        setBusy(false); setSelected(null);
      });
    }

    return h('div', { className: 'view-stack' },
      h('p', { className: 'muted' },
        'Activating a currency opens a new account with a zero balance. Existing balances are never converted.'),
      h('div', { className: 'grid-3' }, (state.data || []).map(function (c) {
        var isDefault = c.code === MG.config.DEFAULT_CURRENCY;
        var card;
        if (c.activeForMe) {
          card = h(MG.ui.Card, { key: c.code, className: 'cur-card' },
            h('h3', null, c.code, ' ', h('small', { className: 'muted' }, c.name)),
            h(MG.ui.Badge, { status: 'active' }),
            h('p', { className: 'muted' }, 'Already active for you.'),
            h('a', { className: 'btn btn-ghost btn-sm', href: '#/account/' + c.code }, 'View account →'));
        } else if (c.status !== 'active') {
          card = h(MG.ui.Card, { key: c.code, className: 'cur-card cur-unavailable' },
            h('h3', null, c.code, ' ', h('small', { className: 'muted' }, c.name)),
            h(MG.ui.Badge, { status: 'unavailable' }),
            h('p', { className: 'muted' }, 'Temporarily unavailable for activation.'));
        } else {
          card = h(MG.ui.Card, { key: c.code, className: 'cur-card' },
            h('h3', null, c.code, ' ', h('small', { className: 'muted' }, c.name)),
            isDefault ? h('span', { className: 'badge b-open' }, 'Default') : null,
            h('p', { className: 'muted' }, 'Starts at zero — no conversion, no fees to activate.'),
            h(MG.ui.Button, {
              variant: 'primary', busy: busy && selected === c.code,
              disabled: busy, onClick: function () { activate(c.code); },
            }, 'Activate ' + c.code));
        }
        return card;
      })));
  };

  /* -------------------------------------------------------------- deposits */
  MG.views.deposits = function () {
    var _f = React.useState(null); var form = _f[0]; var setForm = _f[1];
    var _r = React.useState(null); var result = _r[0]; var setResult = _r[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _e = React.useState(null); var err = _e[0]; var setErr = _e[1];
    var _sel = React.useState(null); var selected = _sel[0]; var setSelected = _sel[1];
    var _notes = React.useState(''); var reportNotes = _notes[0]; var setReportNotes = _notes[1];
    var accountsState = MG.ui.useAsync(function () { return MG.api.accounts(); }, []);
    var historyState = MG.ui.useAsync(function () { return MG.api.deposits(1); }, [result]);

    if (accountsState.loading) return h(MG.ui.LoadingPanel);
    if (accountsState.error) return h(MG.ui.ErrorPanel, { error: accountsState.error, onRetry: function () { location.reload(); } });

    var accounts = (accountsState.data || []).filter(function (a) { return a.status === 'active'; });

    function submit(e) {
      e.preventDefault();
      setErr(null);
      if (!form || !form.currency || !form.amount) {
        setErr('Choose a currency and an amount.');
        return;
      }
      var amt = String(form.amount).replace(',', '.');
      if (!/^\d+(\.\d{1,4})?$/.test(amt) || Number(amt) <= 0) {
        setErr('Enter a valid positive amount.');
        return;
      }
      setBusy(true);
      MG.api.createDeposit(form.currency, amt, form.notes || undefined, 'dep-' + Date.now()).then(function (res) {
        setResult(res.data && res.data.deposit ? res.data.deposit : res.data);
        setBusy(false);
        MG.util.toast('Deposit request submitted — awaiting bank details from administrator.', 'ok');
      }).catch(function (error) {
        setBusy(false);
        setErr(MG.util.errMessage(error));
      });
    }

    function reportPayment(d) {
      setBusy(true);
      MG.api.reportPayment(d.reference, reportNotes || undefined).then(function () {
        MG.util.toast('Payment reported — awaiting administrator verification. No balance credited yet.', 'ok');
        setSelected(null); setReportNotes('');
        setResult({ _refresh: Date.now() });
        setBusy(false);
      }).catch(function (error) {
        setBusy(false);
        MG.util.toast(MG.util.errMessage(error), 'err');
      });
    }

    var wizard;
    if (result && result.reference) {
      var bank = result.receiving_bank_accounts;
      wizard = h(MG.ui.Card, { title: 'Deposit ' + result.reference },
        h('p', { className: 'deposit-status deposit-' + result.status },
          h(MG.ui.Badge, { status: result.status }), ' ',
          MG.util.money(result.requested_amount || result.amount, result.currency_code)),
        result.status === 'pending_admin_action' ? h('p', { className: 'muted' },
          'Your request has been received. An administrator will assign receiving bank details shortly. You will be notified when they appear here. Do not transfer funds yet.')
        : null,
        (result.status === 'awaiting_payment' || result.status === 'payment_reported' || result.status === 'partially_fulfilled') && bank ? h('div', { className: 'bank-details-panel' },
          h('h4', null, 'Transfer instructions'),
          h('p', null, h('b', null, 'Bank: '), bank.bank_name),
          h('p', null, h('b', null, 'Beneficiary: '), bank.beneficiary_name),
          bank.iban ? h('p', null, h('b', null, 'IBAN: '), bank.iban) : null,
          bank.account_number ? h('p', null, h('b', null, 'Account number: '), bank.account_number) : null,
          bank.swift_bic ? h('p', null, h('b', null, 'SWIFT/BIC: '), bank.swift_bic) : null,
          h('p', null, h('b', null, 'Reference to include: '), h('code', null, result.reference)),
          bank.transfer_instructions ? h('p', { className: 'muted' }, bank.transfer_instructions) : null,
          h('p', { className: 'muted' }, 'Always include the deposit reference in the bank transfer narration where supported.')
        ) : null,
        (result.status === 'awaiting_payment' || result.status === 'partially_fulfilled') ? h('div', { className: 'btn-row', style: { marginTop: 12 } },
          h(MG.ui.Button, { variant: 'primary', onClick: function () { setSelected(result); } }, 'I have sent the payment'),
          (result.status === 'awaiting_payment') ? h(MG.ui.Button, { variant: 'ghost', onClick: function () {
            MG.api.cancelDeposit(result.reference).then(function () {
              MG.util.toast('Deposit cancelled.', 'ok'); setResult(null);
            }).catch(function (error) { MG.util.toast(MG.util.errMessage(error), 'err'); });
          } }, 'Cancel request') : null
        ) : null,
        result.status === 'completed' ? h('p', { className: 'muted' },
          'Credited: ', MG.util.money(result.credited_amount || result.amount, result.currency_code),
          '. Funds are available in your Meridian balance.') : null,
        h(MG.ui.Button, { variant: 'ghost', size: 'sm', onClick: function () { setResult(null); } }, 'New deposit request')
      );
    } else if (accounts.length === 0) {
      wizard = h(MG.ui.Card, { title: 'Deposit' },
        h(MG.ui.Empty, {
          title: 'No active currency accounts',
          hint: 'Activate a currency first — deposits fund a specific currency account.',
          action: h('a', { className: 'btn btn-primary', href: '#/activate' }, 'Activate a currency'),
        }));
    } else {
      wizard = h(MG.ui.Card, { title: 'Request a deposit' },
        h('form', { onSubmit: submit },
          err ? h('p', { className: 'form-error' }, err) : null,
          h('label', null, 'Currency'),
          h(MG.ui.Select, {
            value: form && form.currency || '',
            onChange: function (e) { setForm(Object.assign({}, form || {}, { currency: e.target.value })); },
            options: [{ value: '', label: 'Select currency…' }].concat(
              accounts.map(function (a) { return { value: a.currency_code, label: a.currency_code + ' — ' + (a.currency_name || '') }; })
            ),
          }),
          h('label', null, 'Amount'),
          h(MG.ui.Input, {
            type: 'text', placeholder: '0.00',
            value: form && form.amount || '',
            onChange: function (e) { setForm(Object.assign({}, form || {}, { amount: e.target.value })); },
          }),
          h('label', null, 'Optional notes'),
          h(MG.ui.Input, {
            type: 'text', placeholder: 'Payment notes for the operations team',
            value: form && form.notes || '',
            onChange: function (e) { setForm(Object.assign({}, form || {}, { notes: e.target.value })); },
          }),
          h(MG.ui.Button, { type: 'submit', variant: 'primary', size: 'lg', busy: busy }, 'Submit deposit request'),
          h('p', { className: 'muted', style: { marginTop: 10 } },
            'After you submit, an administrator will provide receiving bank details. Transfer the funds using those details and include your unique deposit reference. Your Meridian balance is credited only after the administrator verifies the incoming payment.')));
    }

    return h('div', { className: 'view-stack' },
      wizard,
      selected ? h(MG.ui.Card, { title: 'Report payment — ' + selected.reference },
        h('p', { className: 'muted' },
          'Reporting a payment does not credit your balance. An administrator must verify the funds arrived before any credit is applied.'),
        h('label', null, 'Optional notes'),
        h(MG.ui.Input, { value: reportNotes, onChange: function (e) { setReportNotes(e.target.value); }, placeholder: 'e.g. transferred via SEPA on …' }),
        h('div', { className: 'btn-row' },
          h(MG.ui.Button, { variant: 'primary', busy: busy, onClick: function () { reportPayment(selected); } }, 'Confirm I have sent the payment'),
          h(MG.ui.Button, { variant: 'ghost', onClick: function () { setSelected(null); } }, 'Cancel'))
      ) : null,
      h(MG.ui.Card, { title: 'Deposit history' },
        historyState.loading ? h(MG.ui.Skeleton, { lines: 4 })
          : (historyState.data || []).length === 0
            ? h(MG.ui.Empty, { title: 'No deposits yet', hint: 'Your deposit requests and their outcomes appear here.' })
            : h(MG.ui.Table, {
                columns: [
                  { label: 'Reference' }, { label: 'Requested', right: true },
                  { label: 'Credited', right: true }, { label: 'Status' }, { label: 'Requested' }, { label: '' },
                ],
                rows: historyState.data || [],
                renderRow: function (d) {
                  var bank = d.receiving_bank_accounts;
                  return h('tr', { key: d.id },
                    h('td', null, h('b', null, d.reference)),
                    h('td', { style: { textAlign: 'right' } }, MG.util.money(d.requested_amount || d.amount, d.currency_code)),
                    h('td', { style: { textAlign: 'right' } }, MG.util.money(d.credited_amount || 0, d.currency_code)),
                    h('td', null, h(MG.ui.Badge, { status: d.status })),
                    h('td', null, MG.util.date(d.requested_at)),
                    h('td', null,
                      h(MG.ui.Button, { size: 'sm', variant: 'ghost', onClick: function () { setResult(d); } }, 'View'),
                      (d.status === 'pending_admin_action' || d.status === 'awaiting_payment')
                        ? h('button', {
                            className: 'btn btn-ghost btn-sm',
                            onClick: function () {
                              MG.api.cancelDeposit(d.reference).then(function () {
                                MG.util.toast('Deposit cancelled.', 'ok');
                                setResult({ _refresh: Date.now() });
                              }).catch(function (error) { MG.util.toast(MG.util.errMessage(error), 'err'); });
                            },
                          }, 'Cancel')
                        : null
                    ));
                },
              })));
  };
})();
