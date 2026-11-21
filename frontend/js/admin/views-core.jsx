/* Admin views — core: dashboard, user management, individual user viewer
   (permitted edits, ban/unban/delete, manual notification). Financial
   restriction: there are intentionally NO balance/ledger/deposit mutation
   controls — the backend exposes no such endpoints. */
(function () {
  var React = window.React;
  var h = React.createElement;
  MGA.views = MGA.views || {};

  /* -------------------------------------------------------------- dashboard */
  MGA.views.dashboard = function () {
    var state = MG.ui.useAsync(function () { return MGA.api.overview(); }, []);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var d = state.data || {};
    return h('div', { className: 'view-stack' },
      h('div', { className: 'grid-4' },
        h(MG.ui.StatCard, { label: 'Customers', value: MG.util.num(d.users) }),
        h(MG.ui.StatCard, { label: 'Active', value: MG.util.num(d.active), tone: 'success' }),
        h(MG.ui.StatCard, { label: 'Suspended / banned', value: MG.util.num((d.suspended || 0) + (d.banned || 0)), tone: 'warn' }),
        h(MG.ui.StatCard, { label: 'Pending deposits', value: MG.util.num(d.pendingDeposits) }),
        h(MG.ui.StatCard, { label: 'Open tickets', value: MG.util.num(d.openTickets) }),
        h(MG.ui.StatCard, { label: 'Critical security events', value: MG.util.num(d.criticalEvents), tone: 'danger' })),
      h(MG.ui.Card, { title: 'Operational notes' },
        h('ul', { className: 'mini-list' },
          h('li', null, h('b', null, 'Deposits are provider-confirmed only.'),
            h('span', null, ' No administrator can confirm, alter or reverse a deposit — the only transition path is the signed payment-provider webhook.')),
          h('li', null, h('b', null, 'Financially read-only by construction.'),
            h('span', null, ' Balances, ledger entries and transactions have no administrative mutation endpoints. Attempting any is refused (403) and audit-logged.')),
          h('li', null, h('b', null, 'Every action is audited.'),
            h('span', null, ' Permitted edits, bans, deletions and denied attempts all land in the append-only audit log.')))));
  };

  /* ------------------------------------------------------------------ users */
  MGA.views.users = function () {
    var _f = React.useState({ q: '', status: '', country: '', page: 1 }); var filters = _f[0]; var setFilters = _f[1];
    var state = MG.ui.useAsync(function () {
      return MGA.api.users({ q: filters.q, status: filters.status, country: filters.country, page: filters.page });
    }, [filters.q, filters.status, filters.country, filters.page]);
    var meta = state.data ? state.data.meta || {} : {};
    function set(k, v) {
      var next = Object.assign({}, filters); next[k] = v;
      if (k !== 'page') next.page = 1;
      setFilters(next);
    }
    return h('div', { className: 'view-stack' },
      h(MG.ui.Card, null,
        h('div', { className: 'filter-bar' },
          h(MG.ui.Input, { placeholder: 'Search name or email…', value: filters.q,
            onChange: function (e) { set('q', e.target.value); }, passThrough: { style: { flex: 2 } } }),
          h(MG.ui.Select, {
            value: filters.status, onChange: function (e) { set('status', e.target.value); },
            options: [
              { value: '', label: 'All statuses' }, { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' }, { value: 'banned', label: 'Banned' },
              { value: 'deleted', label: 'Deleted' },
            ],
          }),
          h(MG.ui.Input, { placeholder: 'Country (e.g. DE)', maxLength: 2, value: filters.country,
            onChange: function (e) { set('country', e.target.value.toUpperCase()); } }))),
      h(MG.ui.Card, { title: 'Customers' + (meta.total !== undefined ? ' (' + MG.util.num(meta.total) + ')' : '') },
        state.loading ? h(MG.ui.Skeleton, { lines: 6 })
          : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
          : (state.data || []).length === 0
            ? h(MG.ui.Empty, { title: 'No customers match', hint: 'Adjust the search or filters.' })
            : h(React.Fragment, null,
                h(MG.ui.Table, {
                  columns: [{ label: 'Name' }, { label: 'Email' }, { label: 'Country' }, { label: 'Default ccy' }, { label: 'Status' }, { label: 'Joined' }],
                  rows: state.data || [],
                  renderRow: function (u) {
                    return h('tr', { key: u.id },
                      h('td', null, h('a', { href: '#/user/' + u.id }, u.full_name || u.email)),
                      h('td', null, u.email),
                      h('td', null, u.country_code || '—'),
                      h('td', null, u.default_currency),
                      h('td', null, h(MG.ui.Badge, { status: u.status })),
                      h('td', null, MG.util.date(u.created_at)));
                  },
                }),
                meta.pages > 1 ? h('div', { className: 'pager' },
                  h(MG.ui.Button, { variant: 'ghost', disabled: filters.page <= 1,
                    onClick: function () { set('page', filters.page - 1); } }, '← Previous'),
                  h('span', { className: 'pager-info' }, 'Page ' + (meta.page || filters.page) + ' of ' + meta.pages),
                  h(MG.ui.Button, { variant: 'ghost', disabled: filters.page >= (meta.pages || 1),
                    onClick: function () { set('page', filters.page + 1); } }, 'Next →')) : null)));
  };

  /* ------------------------------------------------------- user detail view */
  MGA.views.user = function (props) {
    var id = props.route.param;
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MGA.api.user(id); }, [id, _r[0]]);
    var _e = React.useState({ first: '', last: '', phone: '' }); var edit = _e[0]; var setEdit = _e[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _c = React.useState(null); var confirmBox = _c[0]; var setConfirm = _c[1];
    var _n = React.useState({ title: '', body: '', alsoSms: false }); var note = _n[0]; var setNote = _n[1];

    React.useEffect(function () {
      if (state.data && state.data.profile) {
        setEdit({
          first: state.data.profile.first_name || '',
          last: state.data.profile.last_name || '',
          phone: state.data.profile.phone || '',
        });
      }
    }, [state.data]);

    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var d = state.data || {};
    var p = d.profile || {};
    var refresh = function () { reload(function (x) { return x + 1; }); };

    function saveEdit(e) {
      e.preventDefault();
      setBusy(true);
      var patch = {};
      if (edit.first !== (p.first_name || '')) patch.firstName = edit.first;
      if (edit.last !== (p.last_name || '')) patch.lastName = edit.last;
      if (edit.phone !== (p.phone || '')) patch.phone = edit.phone || null;
      MGA.api.updateUser(id, patch).then(function () {
        setBusy(false);
        MG.util.toast('Permitted fields updated. The customer is not notified automatically.', 'ok');
        refresh();
      }).catch(function (err) { setBusy(false); MG.util.toast(MG.util.errMessage(err), 'err'); });
    }

    function runConfirmed(action, label) {
      setBusy(true);
      action().then(function () {
        setBusy(false); setConfirm(null);
        MG.util.toast(label + ' completed.', 'ok');
        refresh();
      }).catch(function (err) { setBusy(false); setConfirm(null); MG.util.toast(MG.util.errMessage(err), 'err'); });
    }

    return h('div', { className: 'view-stack' },
      h('a', { className: 'text-link', href: '#/users' }, '← User Management'),
      h(MG.ui.Card, { title: 'Customer profile' },
        h('dl', { className: 'detail-list' },
          h('dt', null, 'Clerk id'), h('dd', { style: { fontFamily: 'var(--font-mono)', fontSize: 12 } }, p.id),
          h('dt', null, 'Email'), h('dd', null, p.email),
          h('dt', null, 'Country'), h('dd', null, p.country_code || '—'),
          h('dt', null, 'Default currency'), h('dd', null, p.default_currency),
          h('dt', null, 'Status'), h('dd', null, h(MG.ui.Badge, { status: p.status })),
          h('dt', null, 'KYC'), h('dd', null, h(MG.ui.Badge, { status: p.kyc_status === 'verified' ? 'active' : 'pending' })),
          h('dt', null, 'Joined'), h('dd', null, MG.util.dateTime(p.created_at))),
        h('form', { onSubmit: saveEdit, noValidate: true, style: { marginTop: 16 } },
          h('p', { className: 'muted' }, 'Permitted edits (names, phone). Status, balances and financial records are not editable.'),
          h('div', { className: 'grid-3' },
            h(MG.ui.Field, { id: 'ed-first', label: 'First name' },
              h(MG.ui.Input, { id: 'ed-first', value: edit.first,
                onChange: function (e) { setEdit(Object.assign({}, edit, { first: e.target.value })); } })),
            h(MG.ui.Field, { id: 'ed-last', label: 'Last name' },
              h(MG.ui.Input, { id: 'ed-last', value: edit.last,
                onChange: function (e) { setEdit(Object.assign({}, edit, { last: e.target.value })); } })),
            h(MG.ui.Field, { id: 'ed-phone', label: 'Phone (E.164)' },
              h(MG.ui.Input, { id: 'ed-phone', value: edit.phone,
                onChange: function (e) { setEdit(Object.assign({}, edit, { phone: e.target.value })); } }))),
          h(MG.ui.Button, { type: 'submit', variant: 'primary', busy: busy }, 'Save permitted fields'))),

      h(MG.ui.Card, { title: 'Account actions' },
        h('div', { className: 'adm-note' }, '⚠ ',
          'Suspension and banning are enforced through Clerk (sessions end immediately) and are fully audited. ',
          'Deleting a user removes the Clerk identity and anonymizes the profile; financial records are retained per policy.'),
        h('div', { className: 'cta-actions' },
          p.status === 'active' || p.status === 'suspended'
            ? h(MG.ui.Button, { variant: 'ghost', onClick: function () { setConfirm({ kind: 'suspend' }); } }, 'Suspend')
            : null,
          p.status !== 'banned' && p.status !== 'deleted'
            ? h(MG.ui.Button, { variant: 'danger', onClick: function () { setConfirm({ kind: 'ban' }); } }, 'Ban')
            : null,
          p.status === 'banned' || p.status === 'suspended'
            ? h(MG.ui.Button, { variant: 'ghost', onClick: function () { setConfirm({ kind: 'unban' }); } }, 'Unban')
            : null,
          p.status !== 'deleted'
            ? h(MG.ui.Button, { variant: 'danger', onClick: function () { setConfirm({ kind: 'delete' }); } }, 'Delete identity')
            : null)),

      h(MG.ui.Card, { title: 'Manual notification (users are never notified automatically)' },
        h(MG.ui.Field, { id: 'nt-title', label: 'Title' },
          h(MG.ui.Input, { id: 'nt-title', value: note.title,
            onChange: function (e) { setNote(Object.assign({}, note, { title: e.target.value })); } })),
        h(MG.ui.Field, { id: 'nt-body', label: 'Message' },
          h('textarea', { className: 'input', id: 'nt-body', rows: 3, value: note.body,
            onChange: function (e) { setNote(Object.assign({}, note, { body: e.target.value })); } })),
        h('label', { className: 'pref-line' },
          h('input', { type: 'checkbox', checked: note.alsoSms,
            onChange: function (e) { setNote(Object.assign({}, note, { alsoSms: e.target.checked })); } }),
          ' Also send by SMS (uses the customer verified phone)'),
        h(MG.ui.Button, {
          variant: 'primary', style: { marginTop: 10 },
          onClick: function () {
            setBusy(true);
            MGA.api.notifyUser(id, note.title, note.body, note.alsoSms).then(function () {
              setBusy(false);
              setNote({ title: '', body: '', alsoSms: false });
              MG.util.toast('Notification sent.', 'ok');
            }).catch(function (err) { setBusy(false); MG.util.toast(MG.util.errMessage(err), 'err'); });
          },
        }, 'Send notification')),

      h(MG.ui.Card, { title: 'Currency accounts' },
        (d.accounts || []).length === 0
          ? h(MG.ui.Empty, { title: 'No accounts' })
          : h(MG.ui.Table, {
              columns: [{ label: 'Currency' }, { label: 'Balance', right: true }, { label: 'Status' }, { label: 'Opened' }],
              rows: d.accounts || [],
              renderRow: function (a) {
                return h('tr', { key: a.id },
                  h('td', null, a.currency_code),
                  h('td', { style: { textAlign: 'right' } }, MG.util.money(a.balance, a.currency_code)),
                  h('td', null, h(MG.ui.Badge, { status: a.status })),
                  h('td', null, MG.util.date(a.opened_at)));
              },
            })),

      h(MG.ui.Card, { title: 'Recent transactions (read-only ledger)' },
        (d.recentTransactions || []).length === 0
          ? h(MG.ui.Empty, { title: 'No transactions' })
          : h(MG.ui.Table, {
              columns: [{ label: 'Reference' }, { label: 'Description' }, { label: 'Amount', right: true }, { label: 'Status' }, { label: 'Date' }],
              rows: d.recentTransactions || [],
              renderRow: function (t) {
                return h('tr', { key: t.id },
                  h('td', null, t.reference),
                  h('td', null, t.description || '—'),
                  h('td', { style: { textAlign: 'right' } },
                    (t.direction === 'credit' ? '+' : '-') + MG.util.money(t.amount, t.currency_code)),
                  h('td', null, h(MG.ui.Badge, { status: t.status })),
                  h('td', null, MG.util.date(t.created_at)));
              },
            })),

      h(MG.ui.Card, { title: 'Deposits (read-only — confirmations come only from the payment provider)' },
        (d.deposits || []).length === 0
          ? h(MG.ui.Empty, { title: 'No deposits' })
          : h(MG.ui.Table, {
              columns: [{ label: 'Reference' }, { label: 'Amount', right: true }, { label: 'Status' }, { label: 'Requested' }],
              rows: d.deposits || [],
              renderRow: function (dep) {
                return h('tr', { key: dep.id },
                  h('td', null, dep.reference),
                  h('td', { style: { textAlign: 'right' } }, MG.util.money(dep.amount, dep.currency_code)),
                  h('td', null, h(MG.ui.Badge, { status: dep.status })),
                  h('td', null, MG.util.date(dep.requested_at)));
              },
            })),

      h(MG.ui.Confirm, {
        open: Boolean(confirmBox), busy: busy, danger: confirmBox && (confirmBox.kind === 'ban' || confirmBox.kind === 'delete'),
        title: confirmBox ? ({ suspend: 'Suspend customer', ban: 'Ban customer', unban: 'Unban customer', delete: 'Delete identity' })[confirmBox.kind] : '',
        message: confirmBox && confirmBox.kind === 'delete'
          ? 'This deletes the Clerk identity and anonymizes the profile. Financial and audit records are retained (pseudonymized). This cannot be undone.'
          : confirmBox && confirmBox.kind === 'suspend'
            ? 'Suspension ends the customer active sessions via Clerk. A reason is required and recorded.'
            : confirmBox ? 'Confirm this action. It is recorded in the audit log.' : '',
        confirmLabel: confirmBox ? ({ suspend: 'Suspend', ban: 'Ban', unban: 'Unban', delete: 'Delete' })[confirmBox.kind] : 'Confirm',
        onCancel: function () { setConfirm(null); },
        onConfirm: function () {
          if (!confirmBox) return;
          if (confirmBox.kind === 'suspend') runConfirmed(function () { return MGA.api.suspendUser(id, 'Suspended by administrator review'); }, 'Suspension');
          if (confirmBox.kind === 'ban') runConfirmed(function () { return MGA.api.banUser(id, 'Banned by administrator review'); }, 'Ban');
          if (confirmBox.kind === 'unban') runConfirmed(function () { return MGA.api.unbanUser(id); }, 'Unban');
          if (confirmBox.kind === 'delete') runConfirmed(function () { return MGA.api.deleteUser(id); }, 'Deletion');
        },
      }));
  };
})();
