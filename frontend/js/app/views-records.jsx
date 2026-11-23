/* Customer views — records: transactions (filters + pagination + detail),
   statements (generate, preview, download). */
(function () {
  var React = window.React;
  var h = React.createElement;
  MG.views = MG.views || {};

  /* ---------------------------------------------------------- transactions */
  MG.views.transactions = function () {
    var _f = React.useState({ search: '', currency: '', status: '', from: '', to: '', page: 1 });
    var filters = _f[0]; var setFilters = _f[1];
    var _v = React.useState(false); var touched = _v[0]; var setTouched = _v[1];

    var state = MG.ui.useAsync(function () {
      return MG.api.transactions({
        search: filters.search, currency: filters.currency, status: filters.status,
        from: filters.from, to: filters.to, page: filters.page, pageSize: 20,
      });
    }, [filters.search, filters.currency, filters.status, filters.from, filters.to, filters.page]);

    function set(k, v) {
      setTouched(true);
      var next = Object.assign({}, filters);
      next[k] = v;
      if (k !== 'page') next.page = 1;
      setFilters(next);
    }

    var meta = state.meta || {};

    return h('div', { className: 'view-stack' },
      h('div', { className: 'section-head' }, h('div', null,
        h('h2', { className: 'section-title' }, 'Transactions'),
        h('p', { className: 'muted' }, 'Review, search and filter the activity recorded on your accounts.'))),
      h(MG.ui.Card, { className: 'filter-panel' },
        h('div', { className: 'filter-panel-intro' },
          h('b', null, 'Find a transaction'),
          h('span', { className: 'muted' }, 'Narrow results by reference, currency, status or date.')),
        h('form', {
          className: 'filter-bar', noValidate: true,
          onSubmit: function (e) { e.preventDefault(); },
        },
          h(MG.ui.Input, {
            placeholder: 'Search reference or description…',
            value: touched ? filters.search : filters.search,
            onChange: function (e) { set('search', e.target.value); },
            passThrough: { style: { flex: 2 } },
          }),
          h(MG.ui.Select, {
            value: filters.currency, onChange: function (e) { set('currency', e.target.value); },
            options: [
              { value: '', label: 'All currencies' },
              { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
              { value: 'USD', label: 'USD' }, { value: 'CHF', label: 'CHF' }, { value: 'PLN', label: 'PLN' },
            ],
          }),
          h(MG.ui.Select, {
            value: filters.status, onChange: function (e) { set('status', e.target.value); },
            options: [
              { value: '', label: 'All statuses' },
              { value: 'posted', label: 'Posted' }, { value: 'pending', label: 'Pending' },
              { value: 'failed', label: 'Failed' }, { value: 'cancelled', label: 'Cancelled' },
            ],
          }),
          h(MG.ui.Input, { type: 'date', value: filters.from, onChange: function (e) { set('from', e.target.value); } }),
          h(MG.ui.Input, { type: 'date', value: filters.to, onChange: function (e) { set('to', e.target.value); } }),
          h(MG.ui.Button, {
            variant: 'ghost',
            onClick: function () { setFilters({ search: '', currency: '', status: '', from: '', to: '', page: 1 }); setTouched(false); },
          }, 'Clear'))),
      h(MG.ui.Card, { title: 'Transactions' + (meta.total !== undefined ? ' (' + MG.util.num(meta.total) + ')' : '') },
        state.loading ? h(MG.ui.Skeleton, { lines: 6 })
          : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
          : (state.data || []).length === 0
            ? h(MG.ui.Empty, { title: 'No transactions match',
                hint: 'Try clearing the filters, or make your first deposit.' })
            : h(React.Fragment, null,
                h(MG.ui.Table, {
                  columns: [{ label: 'Reference' }, { label: 'Description' }, { label: 'Currency' }, { label: 'Amount', right: true }, { label: 'Status' }, { label: 'Date' }],
                  rows: state.data || [],
                  renderRow: function (t) {
                    return h('tr', { key: t.id },
                      h('td', null, h('a', { href: '#/txn/' + t.reference }, t.reference)),
                      h('td', null, t.description || '—'),
                      h('td', null, t.currency_code),
                      h('td', { style: { textAlign: 'right' } },
                        (t.direction === 'credit' ? '+' : '-') + MG.util.money(t.amount, t.currency_code)),
                      h('td', null, h(MG.ui.Badge, { status: t.status })),
                      h('td', null, MG.util.date(t.created_at)));
                  },
                }),
                meta.pages > 1 ? h('div', { className: 'pager' },
                  h(MG.ui.Button, { variant: 'ghost', disabled: filters.page <= 1,
                    onClick: function () { set('page', filters.page - 1); } }, '← Previous'),
                  h('span', { className: 'pager-info' }, 'Page ' + (meta.page || filters.page) + ' of ' + meta.pages),
                  h(MG.ui.Button, { variant: 'ghost', disabled: filters.page >= (meta.pages || 1),
                    onClick: function () { set('page', filters.page + 1); } }, 'Next →')) : null)));
  };

  /* ------------------------------------------------------------- txn/:ref */
  MG.views.txn = function (props) {
    var ref = props.route.param;
    var state = MG.ui.useAsync(function () { return MG.api.transaction(ref); }, [ref]);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var t = state.data || {};
    var rows = [
      ['Reference', t.reference], ['Type', (t.type || '').replace('_', ' ')],
      ['Description', t.description || '—'], ['Currency', t.currency_code],
      ['Amount', (t.direction === 'credit' ? '+' : '-') + MG.util.money(t.amount, t.currency_code)],
      ['Status', ''], ['Method', (t.method || '—').replace('_', ' ')],
      ['Value date', MG.util.date(t.value_date)], ['Created', MG.util.dateTime(t.created_at)],
    ];
    return h('div', { className: 'view-stack' },
    h(MG.ui.Card, { title: 'Transaction detail' },
      h('a', { className: 'text-link', href: '#/transactions' }, '← Transactions'),
      h('dl', { className: 'detail-list' }, rows.map(function (r, i) {
        return h(React.Fragment, { key: i },
          h('dt', null, r[0]),
          h('dd', null, r[0] === 'Status' ? h(MG.ui.Badge, { status: t.status }) : r[1]));
      }))));
  };

  /* ------------------------------------------------------------ statements */
  MG.views.statements = function () {
    var _a = React.useState(null); var accounts = _a[0]; var setAccounts = _a[1];
    var _p = React.useState({ accountId: '', start: '', end: '' }); var period = _p[0]; var setPeriod = _p[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _e = React.useState(null); var err = _e[0]; var setErr = _e[1];
    var listState = MG.ui.useAsync(function () { return MG.api.statements(); }, []);
    React.useEffect(function () {
      MG.api.accounts().then(function (res) { setAccounts(res.data || []); });
    }, []);

    function generate() {
      setErr(null);
      if (!period.accountId || !period.start || !period.end) {
        setErr('Choose an account and a full period.'); return;
      }
      setBusy(true);
      MG.api.generateStatement(period.accountId, period.start, period.end).then(function () {
        setBusy(false);
        MG.util.toast('Statement generated.', 'ok');
        location.reload();
      }).catch(function (e) {
        setBusy(false);
        setErr(MG.util.errMessage(e));
      });
    }

    function download(id) {
      MG.api.downloadStatement(id).then(function (text) {
        MG.util.downloadText('meridian-statement.txt', text);
      }).catch(function (e) { MG.util.toast(MG.util.errMessage(e), 'err'); });
    }

    return h('div', { className: 'view-stack' },
      h('div', { className: 'section-head' }, h('div', null,
        h('h2', { className: 'section-title' }, 'Statements'),
        h('p', { className: 'muted' }, 'Create account-period records and download your available statements.'))),
      h(MG.ui.Card, { title: 'Generate a statement' },
        h('div', { className: 'filter-bar' },
          h(MG.ui.Select, {
            value: period.accountId,
            onChange: function (e) { setPeriod(Object.assign({}, period, { accountId: e.target.value })); },
            options: [{ value: '', label: 'Choose account…' }].concat(
              (accounts || []).map(function (a) {
                return { value: a.id, label: a.currency_code + ' account' };
              })),
          }),
          h(MG.ui.Input, { type: 'date', value: period.start,
            onChange: function (e) { setPeriod(Object.assign({}, period, { start: e.target.value })); } }),
          h(MG.ui.Input, { type: 'date', value: period.end,
            onChange: function (e) { setPeriod(Object.assign({}, period, { end: e.target.value })); } }),
          h(MG.ui.Button, { variant: 'primary', busy: busy, onClick: generate }, 'Generate')),
        err ? h('p', { className: 'field-err' }, err) : null,
        h('p', { className: 'muted' }, 'Statements are deterministic: the same account and period always produce the same numbers. The download uses a provisional text format until a licensed statement provider is contracted.')),
      h(MG.ui.Card, { title: 'Your statements' },
        listState.loading ? h(MG.ui.Skeleton, { lines: 4 })
          : (listState.data || []).length === 0
            ? h(MG.ui.Empty, { title: 'No statements yet',
                hint: 'Generate your first statement above after your account has activity.' })
            : h(MG.ui.Table, {
                columns: [{ label: 'Period' }, { label: 'Opening', right: true }, { label: 'Closing', right: true }, { label: 'Entries' }, { label: 'Generated' }, { label: '' }],
                rows: listState.data || [],
                renderRow: function (s) {
                  return h('tr', { key: s.id },
                    h('td', null, MG.util.date(s.period_start) + ' → ' + MG.util.date(s.period_end)),
                    h('td', { style: { textAlign: 'right' } }, s.opening_balance),
                    h('td', { style: { textAlign: 'right' } }, s.closing_balance),
                    h('td', null, s.entry_count),
                    h('td', null, MG.util.date(s.generated_at)),
                    h('td', null, h('button', { className: 'btn btn-ghost btn-sm', onClick: function () { download(s.id); } }, 'Download')));
                },
              })));
  };
})();
