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

    React.useEffect(function () {
      if (notifs.data) {
        var unread = (notifs.meta && notifs.meta.unread != null)
          ? notifs.meta.unread
          : (notifs.data || []).filter(function (n) { return !n.read_at; }).length;
        MG.app.unreadCount = unread;
      }
    }, [notifs.data]);

    if (accounts.loading) {
      return h('div', { className: 'view-stack' },
        h('div', { className: 'ov-hero skeleton-block', style: { minHeight: 160 } }),
        h(MG.ui.LoadingPanel), h(MG.ui.LoadingPanel));
    }
    if (accounts.error) {
      return h(MG.ui.ErrorPanel, { error: accounts.error, onRetry: function () { location.reload(); } });
    }

    var list = accounts.data || [];
    var totalEur = list.reduce(function (acc, a) {
      return acc + (a.equivalent_eur == null ? 0 : (Number(a.equivalent_eur) || 0));
    }, 0);
    var activeCount = list.filter(function (a) { return a.status === 'active'; }).length;
    var totalEurAvailable = list.length === 0 || list.every(function (a) { return a.equivalent_eur != null; });
    var recent = txns.data || [];
    var notifPreview = (notifs.data || []).slice(0, 4);
    /* Distribution uses only server-provided EUR equivalents. Never compare
       raw balances across different currencies or manufacture chart values. */
    var distribution = list.map(function (a) {
      return { code: a.currency_code, value: Number(a.equivalent_eur) || 0 };
    }).filter(function (a) { return a.value > 0; });
    var distributionTotal = distribution.reduce(function (sum, a) { return sum + a.value; }, 0);
    var palette = ['#1F6FEB', '#6172F3', '#12B76A', '#F79009', '#7A5AF8', '#06A6A6'];
    var angle = 0;
    var distributionStops = distribution.map(function (a, i) {
      var start = angle;
      angle += (a.value / (distributionTotal || 1)) * 360;
      return palette[i % palette.length] + ' ' + start.toFixed(2) + 'deg ' + angle.toFixed(2) + 'deg';
    });

    return h('div', { className: 'view-stack' },
      /* Hero */
      h('section', { className: 'ov-hero', 'aria-label': 'Total balance' },
        h('div', { className: 'ov-hero-glow', 'aria-hidden': 'true' }),
        h('div', { className: 'ov-hero-main' },
          h('p', { className: 'ov-label' },
            MG.icon ? MG.icon('wallet', 15) : null, ' Total balance · EUR equivalent (indicative)'),
          h('p', { className: 'ov-total' }, totalEurAvailable ? MG.util.money(totalEur, 'EUR') : 'Unavailable'),
          h('p', { className: 'ov-sub' },
            'Across ' + list.length + ' currency account' + (list.length === 1 ? '' : 's') +
            (activeCount ? ' · ' + activeCount + ' active' : '')),
          null),
        h('div', { className: 'ov-hero-side' },
          h('a', { className: 'btn btn-primary', href: '#/deposits' },
            MG.icon ? MG.icon('arrow-up', 15) : null, ' Deposit'),
          h('a', { className: 'btn btn-outline', href: '#/activate' },
            MG.icon ? MG.icon('plus', 15) : null, ' Activate currency'))),

      /* Stats row */
      h('div', { className: 'stat-row' },
        h('div', { className: 'stat-card' },
          h('div', { className: 'stat-info' },
            h('span', { className: 'stat-ic', 'aria-hidden': 'true' }, MG.icon ? MG.icon('wallet', 17) : null),
            h('div', null,
              h('p', { className: 'stat-label' }, 'Active currencies'),
              h('p', { className: 'stat-val' }, String(activeCount)),
              h('p', { className: 'stat-sub' }, 'of ' + list.length + ' opened')))),
        h('div', { className: 'stat-card' },
          h('div', { className: 'stat-info' },
            h('span', { className: 'stat-ic', 'aria-hidden': 'true' }, MG.icon ? MG.icon('receipt', 17) : null),
            h('div', null,
              h('p', { className: 'stat-label' }, 'Latest entries'),
              h('p', { className: 'stat-val' }, String(recent.length)),
              h('p', { className: 'stat-sub' }, 'loaded for preview')))),
        h('div', { className: 'stat-card' },
          h('div', { className: 'stat-info' },
            h('span', { className: 'stat-ic', 'aria-hidden': 'true' }, MG.icon ? MG.icon('bell', 17) : null),
            h('div', null,
              h('p', { className: 'stat-label' }, 'Notifications'),
              h('p', { className: 'stat-val' }, String(MG.app.unreadCount || 0)),
              h('p', { className: 'stat-sub' }, 'unread')))),
        h('div', { className: 'stat-card' },
          h('div', { className: 'stat-info' },
            h('span', { className: 'stat-ic', 'aria-hidden': 'true' }, MG.icon ? MG.icon('shield', 17) : null),
            h('div', null,
              h('p', { className: 'stat-label' }, 'Security'),
              h('p', { className: 'stat-val' }, 'Protected'),
              h('p', { className: 'stat-sub' }, 'Supabase Auth session active'))))),

      /* Currency cards + live balance distribution — Hong Kong reference layout */
      h('div', { className: 'ov-grid2' },
        h(MG.ui.Card, {
          title: 'My currencies',
          action: h('a', { className: 'text-link', href: '#/accounts' }, 'Manage accounts →'),
        },
          list.length === 0
            ? h(MG.ui.Empty, {
                title: 'No currencies yet',
                hint: 'Activate your first currency to get started.',
                action: h('a', { className: 'btn btn-primary', href: '#/activate' }, 'Activate a currency'),
              })
            : h('div', { className: 'curcards' }, list.map(function (a) {
                return h('a', { key: a.id, className: 'curcard', href: '#/account/' + a.currency_code,
                  'aria-label': 'Open ' + (a.currency_name || a.currency_code) + ' account' },
                  h('div', { className: 'curcard-head' },
                    h('span', { className: 'curcard-sym', 'aria-hidden': 'true' },
                      a.currency_symbol || a.currency_code),
                    h('div', null,
                      h('b', null, a.currency_code),
                      h('small', null, a.currency_name || '')),
                    h(MG.ui.Badge, { status: a.status })),
                  h('span', { className: 'curcard-balance-label' }, 'Available balance'),
              h('p', { className: 'curcard-bal' }, MG.util.money(a.balance, a.currency_code)),
                  a.equivalent_eur != null
                    ? h('p', { className: 'curcard-eq' }, '≈ ' + MG.util.money(a.equivalent_eur, 'EUR'))
                    : null,
                  h('span', { className: 'curcard-link' },
                    MG.icon ? MG.icon('arrow-r', 14) : null, ' Open account'));
              }))),
        h(MG.ui.Card, {
          title: 'Balance distribution',
          action: h('span', { className: 'muted' }, 'EUR equivalent'),
        },
          distributionTotal > 0
            ? h('div', { style: { display: 'grid', justifyItems: 'center', gap: '18px', padding: '12px 4px 4px' } },
                h('div', {
                  role: 'img',
                  'aria-label': 'Currency balance distribution by EUR equivalent',
                  style: {
                    width: 'min(100%, 190px)', aspectRatio: '1', borderRadius: '50%',
                    background: 'conic-gradient(' + distributionStops.join(', ') + ')',
                    display: 'grid', placeItems: 'center',
                  },
                },
                  h('div', { style: {
                    width: '62%', height: '62%', borderRadius: '50%', background: 'var(--surface)',
                    display: 'grid', placeContent: 'center', textAlign: 'center',
                  } },
                    h('small', { className: 'muted' }, 'TOTAL'),
                    h('b', { style: { fontSize: '17px', fontVariantNumeric: 'tabular-nums' } },
                      MG.util.money(distributionTotal, 'EUR')))),
                h('div', { style: { width: '100%', display: 'grid', gap: '9px' } },
                  distribution.map(function (a, i) {
                    return h('div', {
                      key: a.code,
                      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '12px' },
                    },
                      h('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                        h('span', { 'aria-hidden': 'true', style: {
                          width: '9px', height: '9px', borderRadius: '3px',
                          background: palette[i % palette.length], display: 'inline-block',
                        } }),
                        a.code),
                      h('b', { style: { fontVariantNumeric: 'tabular-nums' } }, MG.util.money(a.value, 'EUR')));
                  })))
            : h(MG.ui.Empty, {
                title: 'Distribution unavailable',
                hint: 'A currency breakdown will appear when the service provides EUR-equivalent balances.',
              }))),
      /* Two-column: recent txns + notifications */
      h('div', { className: 'ov-grid' },
        h(MG.ui.Card, {
          title: 'Recent transactions',
          action: h('a', { className: 'text-link', href: '#/transactions' }, 'View all →'),
        },
          txns.loading ? h(MG.ui.Skeleton, { lines: 4 })
            : recent.length === 0
              ? h(MG.ui.Empty, { title: 'No transactions yet', hint: 'Confirmed deposits appear here as ledger entries.' })
              : h(MG.ui.Table, {
                  columns: [
                    { label: 'Reference' },
                    { label: 'Amount', right: true },
                    { label: 'Status' },
                    { label: 'Date' },
                  ],
                  rows: recent,
                  renderRow: function (t) {
                    var neg = t.direction === 'debit';
                    return h('tr', { key: t.id },
                      h('td', null,
                        h('a', { href: '#/txn/' + encodeURIComponent(t.reference) }, t.reference)),
                      h('td', {
                        className: 'td-amount ' + (neg ? 'neg' : 'pos'),
                        style: { textAlign: 'right' },
                      }, (neg ? '−' : '+') + MG.util.money(t.amount, t.currency_code)),
                      h('td', null, h(MG.ui.Badge, { status: t.status })),
                      h('td', null, MG.util.date(t.created_at || t.value_date)));
                  },
                })),
        h(MG.ui.Card, {
          title: 'Notifications',
          action: h('a', { className: 'text-link', href: '#/notifications' }, 'Open centre →'),
        },
          notifs.loading ? h(MG.ui.Skeleton, { lines: 3 })
            : notifPreview.length === 0
              ? h(MG.ui.Empty, { title: 'All clear', hint: 'Deposit and security updates will appear here.' })
              : h('ul', { className: 'notif-list' }, notifPreview.map(function (n) {
                  return h('li', {
                    key: n.id,
                    className: 'notif-item' + (n.read_at ? '' : ' is-unread'),
                  },
                    h('div', { className: 'notif-body' },
                      h('b', null, n.title),
                      h('p', null, n.body),
                      h('small', { className: 'muted' }, MG.util.date(n.created_at))));
                })))));
  };

  /* -------------------------------------------------------------- accounts */
  MG.views.accounts = function () {
    var state = MG.ui.useAsync(function () { return MG.api.accounts(); }, []);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.hash = '#/accounts'; location.reload(); } });
    var list = state.data || [];
    return h('div', { className: 'view-stack' },
      h('div', { className: 'section-head' },
        h('div', null,
          h('h2', { className: 'section-title' }, 'Currency accounts'),
          h('p', { className: 'muted' }, 'Each currency has its own balance and transaction history.')),
        h('a', { className: 'btn btn-primary btn-sm', href: '#/activate' },
          MG.icon ? MG.icon('plus', 14) : null, ' Activate currency')),
      list.length === 0
        ? h(MG.ui.Card, null, h(MG.ui.Empty, {
            title: 'No accounts yet', hint: 'Activate your first currency to get started.',
            action: h('a', { className: 'btn btn-primary', href: '#/activate' }, 'Activate a currency') }))
        : h('div', { className: 'curcards' }, list.map(function (a) {
            return h('a', { key: a.id, className: 'curcard', href: '#/account/' + a.currency_code,
              'aria-label': 'Open ' + (a.currency_name || a.currency_code) + ' account' },
              h('div', { className: 'curcard-head' },
                h('span', { className: 'curcard-sym', 'aria-hidden': 'true' }, a.currency_symbol || a.currency_code),
                h('div', null,
                  h('b', null, a.currency_code),
                  h('small', null, a.currency_name || '')),
                h(MG.ui.Badge, { status: a.status })),
              h('p', { className: 'curcard-bal' }, MG.util.money(a.balance, a.currency_code)),
              a.equivalent_eur != null
                ? h('p', { className: 'curcard-eq' }, '≈ ' + MG.util.money(a.equivalent_eur, 'EUR'))
                : h('p', { className: 'curcard-eq muted' },
                    (a.txn_count || 0) + ' transactions · opened ' + MG.util.date(a.opened_at)),
              h('span', { className: 'curcard-link' },
                MG.icon ? MG.icon('arrow-r', 14) : null, ' View account'));
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
      h('div', { className: 'section-head' },
        h('div', null,
          h('h2', { className: 'section-title' }, d.account.currency_code + ' account'),
          h('p', { className: 'muted' }, 'Account overview, recent activity and deposit records.')),
        h('a', { className: 'btn btn-outline btn-sm', href: '#/deposits' }, 'Make a deposit')),
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
      h('div', { className: 'section-head' },
        h('div', null,
          h('h2', { className: 'section-title' }, 'Activate a currency'),
          h('p', { className: 'muted' }, 'Choose which currency accounts to add to your Meridian profile.'))),
      h('div', { className: 'info-strip' },
        MG.icon ? MG.icon('info', 16) : null,
        h('p', null, 'Activating a currency opens a separate account with a zero balance. Existing balances are never converted.')),
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
    var history = historyState.data || [];
    var hasCreditedDeposit = history.some(function (d) {
      return d.status === 'completed' || d.status === 'partially_fulfilled';
    });
        var isFirstDeposit = !hasCreditedDeposit;
    // Indicative local units per 1 USD (must match backend policy table).
    var USD_RATES = { USD: 1, EUR: 0.95, GBP: 0.82, CHF: 0.90, PLN: 4.10 };
    var FIRST_DEPOSIT_USD = 20000;
    function firstDepositMin(code) {
      var rate = USD_RATES[code];
      if (rate == null) return null;
      return Math.ceil(FIRST_DEPOSIT_USD * rate * 100) / 100;
    }
    function fmtMin(n, code) {
      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + code;
    }

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
      if (isFirstDeposit) {
        var minFirst = firstDepositMin(form.currency);
        if (minFirst != null && Number(amt) < minFirst) {
          setErr('Your first deposit must be at least ' + fmtMin(minFirst, form.currency) +
            ' (USD 20,000 equivalent) to cover cross-border processing fees. Subsequent deposits can be smaller.');
          return;
        }
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
        h('form', { className: 'deposit-form', onSubmit: submit },
          isFirstDeposit ? h('div', { className: 'notice notice-warn', role: 'status' },
            h('b', null, 'Opening deposit required'),
            h('p', null,
              'Your first deposit must be at least the ',
              h('strong', null, 'USD 20,000 equivalent'),
              ' in the selected currency (indicative rates). This covers cross-border processing fees. After this opening deposit is credited, smaller top-ups are allowed.'),
            (form && form.currency && firstDepositMin(form.currency) != null)
              ? h('p', null, 'Minimum for ', form.currency, ': ',
                  h('strong', null, fmtMin(firstDepositMin(form.currency), form.currency)))
              : h('p', { className: 'muted' }, 'Select a currency to see the exact minimum.')) : null,
          err ? h('p', { className: 'form-error', role: 'alert' }, err) : null,
          h('div', { className: 'deposit-form-grid' },
            h(MG.ui.Field, { id: 'deposit-currency', label: 'Currency', hint: 'Choose the account you want to fund.' },
              h(MG.ui.Select, {
                id: 'deposit-currency',
                value: form && form.currency || '',
                onChange: function (e) { setForm(Object.assign({}, form || {}, { currency: e.target.value })); },
                options: [{ value: '', label: 'Select currency…' }].concat(
                  accounts.map(function (a) { return { value: a.currency_code, label: a.currency_code + ' — ' + (a.currency_name || '') }; })
                ),
              })),
            h(MG.ui.Field, {
              id: 'deposit-amount',
              label: 'Amount',
              hint: isFirstDeposit && form && form.currency && firstDepositMin(form.currency) != null
                ? ('Minimum ' + fmtMin(firstDepositMin(form.currency), form.currency) + ' (USD 20,000 equivalent).')
                : isFirstDeposit
                  ? 'Minimum is the USD 20,000 equivalent in your selected currency.'
                  : 'Enter the amount in the selected currency.',
            },
              h(MG.ui.Input, {
                id: 'deposit-amount', type: 'text', inputMode: 'decimal',
                placeholder: (isFirstDeposit && form && form.currency && firstDepositMin(form.currency) != null)
                  ? String(firstDepositMin(form.currency).toFixed(2))
                  : '0.00',
                value: form && form.amount || '',
                onChange: function (e) { setForm(Object.assign({}, form || {}, { amount: e.target.value })); },
              })),
            h('div', { className: 'deposit-notes' },
              h(MG.ui.Field, { id: 'deposit-notes', label: 'Optional notes', hint: 'Add a note for the operations team if needed.' },
                h(MG.ui.Input, {
                  id: 'deposit-notes', type: 'text', placeholder: 'Payment notes for the operations team',
                  value: form && form.notes || '',
                  onChange: function (e) { setForm(Object.assign({}, form || {}, { notes: e.target.value })); },
                })))),
          h('div', { className: 'deposit-form-actions' },
            h(MG.ui.Button, { type: 'submit', variant: 'primary', size: 'lg', busy: busy }, 'Submit deposit request')),
          h('p', { className: 'deposit-disclaimer' },
            'After you submit, an administrator will provide receiving bank details. Transfer only after those details appear, include your unique deposit reference, and wait for verification before expecting a balance credit.')));
    }

    return h('div', { className: 'view-stack' },
      h('div', { className: 'section-head' },
        h('div', null,
          h('h2', { className: 'section-title' }, 'Deposits'),
          h('p', { className: 'muted' }, 'Request a deposit, follow transfer instructions and track verification.'))),
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
