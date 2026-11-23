/* ==========================================================================
   MERIDIAN ADMIN — Hong Kong International Fintech (Design 2)
   admin views-core.jsx — Dashboard · Users · User Viewer

   Every view uses the prototype design patterns: PageHead, StatCard with
   icon tones, KPI hero, DataTable with cell-person/avatars, filter bars,
   restricted panels, mini-lists, feeds. Financial restriction: there are
   intentionally NO balance/ledger/deposit mutation controls.
   ========================================================================== */
(function () {
  var React = window.React;
  var h = React.createElement;
  MGA.views = MGA.views || {};

  /* -------------------------------------------------------------- dashboard */
  MGA.views.dashboard = function () {
    var state = MG.ui.useAsync(function () { return MGA.api.overview(); }, []);
    if (state.loading) return h(MG.ui.PageSkeleton, { variant: 'charts' });
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var d = state.data || {};

    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'dashboard', title: 'Platform overview',
        sub: 'Live view of the platform \u2014 every figure below is from the connected service.',
        actions: h('button', { className: 'btn btn-ghost btn-sm', onClick: function () { location.reload(); } },
          h(MG.ui.Icon, { name: 'refresh', size: 14 }), ' Refresh') }),

      h('section', { className: 'kpi-hero', 'aria-label': 'Key platform metrics' },
        h('div', { className: 'kpi-hero-main' },
          h('span', { className: 'kpi-hero-label' },
            h(MG.ui.Icon, { name: 'trend-up', size: 15 }), ' Total customers'),
          h('strong', { className: 'kpi-hero-value' }, MG.util.num(d.users || 0)),
          h('span', { className: 'kpi-hero-sub' }, 'Across all customer accounts')),
        h('div', { className: 'kpi-hero-stats' },
          h('div', null, h('b', null, MG.util.num(d.active || 0)), h('span', null, 'Active')),
          h('div', null, h('b', null, MG.util.num((d.suspended || 0) + (d.banned || 0))), h('span', null, 'Suspended / banned')),
          h('div', null, h('b', null, MG.util.num(d.pendingDeposits || 0)), h('span', null, 'Pending deposits')),
          h('div', null, h('b', null, MG.util.num(d.openTickets || 0)), h('span', null, 'Open tickets')))),

      h('div', { className: 'stat-row' },
        h(MG.ui.StatCard, { icon: 'alert', tone: 'danger', label: 'Critical security events',
          value: MG.util.num(d.criticalEvents || 0), sub: 'Flagged in the security feed' }),
        h(MG.ui.StatCard, { icon: 'ticket', tone: 'info', label: 'Open support tickets',
          value: MG.util.num(d.openTickets || 0), sub: 'Awaiting a reply' }),
        h(MG.ui.StatCard, { icon: 'coins', tone: 'success', label: 'Pending deposits',
          value: MG.util.num(d.pendingDeposits || 0), sub: 'Awaiting provider confirmation' })),

      h(MG.ui.Card, { title: 'Operational notes' },
        h('ul', { className: 'policy-list' },
          h('li', null, h(MG.ui.Icon, { name: 'shield-check', size: 14 }),
            h('b', null, 'Deposits are provider-confirmed only.'),
            ' No administrator can confirm, alter or reverse a deposit \u2014 the only transition path is the signed payment-provider webhook.'),
          h('li', null, h(MG.ui.Icon, { name: 'lock', size: 14 }),
            h('b', null, 'Financially read-only by construction.'),
            ' Balances, ledger entries and transactions have no administrative mutation endpoints. Attempting any is refused (403) and audit-logged.'),
          h('li', null, h(MG.ui.Icon, { name: 'history', size: 14 }),
            h('b', null, 'Every action is audited.'),
            ' Permitted edits, bans, deletions and denied attempts all land in the append-only audit log.'))));
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
    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'users', title: 'User management',
        sub: 'Search, filter and inspect every customer account.',
        actions: h('span', { className: 'panel-chip' },
          state.loading ? 'Loading\u2026' : (meta.total !== undefined ? MG.util.num(meta.total) + ' customers' : '')) }),

      h('div', { className: 'filter-bar' },
        h('div', { className: 'field field-search' },
          h('label', { htmlFor: 'usr-search' }, 'Search'),
          h('input', { id: 'usr-search', type: 'search', placeholder: 'Name or email\u2026',
            value: filters.q, onChange: function (e) { set('q', e.target.value); } })),
        h('div', { className: 'field' },
          h('label', { htmlFor: 'usr-status' }, 'Status'),
          h('select', { id: 'usr-status', value: filters.status, onChange: function (e) { set('status', e.target.value); } },
            h('option', { value: '' }, 'All statuses'),
            h('option', { value: 'active' }, 'Active'),
            h('option', { value: 'suspended' }, 'Suspended'),
            h('option', { value: 'banned' }, 'Banned'),
            h('option', { value: 'deleted' }, 'Deleted'))),
        h('div', { className: 'field' },
          h('label', { htmlFor: 'usr-country' }, 'Country'),
          h('input', { id: 'usr-country', placeholder: 'e.g. DE', maxLength: 2,
            value: filters.country, onChange: function (e) { set('country', e.target.value.toUpperCase()); } }))),

      state.loading ? h(MG.ui.PageSkeleton, { variant: 'list' })
        : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
        : h(MG.ui.DataTable, {
            rows: state.data || [],
            rowKey: function (u) { return u.id; },
            onRowClick: function (u) { location.hash = '#/users/' + u.id; },
            empty: h(MG.ui.Empty, { icon: 'users', title: 'No customers found',
              note: 'No accounts match the current filters. Try clearing them.' }),
            columns: [
              { th: 'Customer', td: function (u) {
                return h('div', { className: 'cell-person' },
                  h(MG.ui.Avatar, { name: u.full_name || u.email }),
                  h('div', null,
                    h('a', { className: 'rowlink', href: '#/users/' + u.id,
                      onClick: function (e) { e.stopPropagation(); } }, u.full_name || u.email),
                    h('small', null, u.email))); } },
              { th: 'Country', td: function (u) { return h('span', { className: 'td-plain' }, u.country_code || '\u2014'); } },
              { th: 'Currency', td: function (u) { return h('span', { className: 'chip chip-currency' }, u.default_currency); } },
              { th: 'Status', td: function (u) { return h(MG.ui.Badge, { status: u.status }); } },
              { th: 'Joined', td: function (u) { return h('span', { className: 'td-date' }, MG.util.date(u.created_at)); } },
            ] }),
      meta.pages > 1 ? h('div', { className: 'pager' },
        h(MG.ui.Button, { variant: 'ghost', disabled: filters.page <= 1,
          onClick: function () { set('page', filters.page - 1); } }, '\u2190 Previous'),
        h('span', { className: 'pager-info' }, 'Page ' + (meta.page || filters.page) + ' of ' + meta.pages),
        h(MG.ui.Button, { variant: 'ghost', disabled: filters.page >= (meta.pages || 1),
          onClick: function () { set('page', filters.page + 1); } }, 'Next \u2192')) : null);
  };

  /* ------------------------------------------------------- user detail view */
  MGA.views.user = function (props) {
    var id = props.route.param;
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MGA.api.user(id); }, [id, _r[0]]);
    var _e = React.useState({ first: '', last: '', phone: '' }); var edit = _e[0]; var setEdit = _e[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _n = React.useState({ title: '', body: '', alsoSms: false }); var note = _n[0]; var setNote = _n[1];
    var confirm = MG.ui.useConfirm();

    React.useEffect(function () {
      if (state.data && state.data.profile) {
        setEdit({
          first: state.data.profile.first_name || '',
          last: state.data.profile.last_name || '',
          phone: state.data.profile.phone || '',
        });
      }
    }, [state.data]);

    if (state.loading) return h(MG.ui.PageSkeleton, { variant: 'page' });
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
        MG.ui.toast('Permitted fields updated. The customer is not notified automatically.', 'ok');
        refresh();
      }).catch(function (err) { setBusy(false); MG.ui.toast(MG.util.errMessage(err), 'err'); });
    }

    /* ---- account status controls (audit F-3: moderation reachable from UI) */
    var status = p.status || 'active';

    function requireReason(value, what) {
      var v = String(value || '').trim();
      if (v.length < 3) { MG.ui.toast(what + ' requires a reason of at least 3 characters.', 'err'); return null; }
      return v;
    }

    function doSuspend() {
      confirm({
        title: 'Suspend ' + (p.full_name || p.email || 'this customer'),
        body: 'A suspended customer cannot sign in or transact until reactivated. Existing balances and financial records are preserved.',
        withReason: 'Reason shown to the customer and recorded in the audit log (3\u2013500 characters).',
        placeholder: 'e.g. KYC document review pending',
        confirmLabel: 'Suspend account', tone: 'warn',
      }).then(function (reason) {
        if (reason === null || reason === undefined) return;
        var r = requireReason(reason, 'Suspending');
        if (!r) return;
        setBusy(true);
        MGA.api.suspendUser(id, r).then(function () {
          MG.ui.toast('Account suspended \u2014 customer notified with the reason.', 'ok');
          refresh();
        }).catch(function (err) { MG.ui.toast(MG.util.errMessage(err), 'err'); })
          .finally(function () { setBusy(false); });
      });
    }

    function doBan() {
      confirm({
        title: 'Ban ' + (p.full_name || p.email || 'this customer'),
        body: 'A banned customer is permanently blocked from signing in. Financial records are preserved for audit.',
        withReason: 'Reason recorded in the security event feed and audit log (3\u2013500 characters).',
        placeholder: 'e.g. Confirmed fraud pattern on deposit attempts',
        confirmLabel: 'Ban account', tone: 'danger',
      }).then(function (reason) {
        if (reason === null || reason === undefined) return;
        var r = requireReason(reason, 'Banning');
        if (!r) return;
        setBusy(true);
        MGA.api.banUser(id, r).then(function () {
          MG.ui.toast('Account banned and security event recorded.', 'ok');
          refresh();
        }).catch(function (err) { MG.ui.toast(MG.util.errMessage(err), 'err'); })
          .finally(function () { setBusy(false); });
      });
    }

    function doUnban() {
      confirm({
        title: 'Reactivate ' + (p.full_name || p.email || 'this customer'),
        body: 'The account returns to active status and the customer can sign in again.',
        confirmLabel: 'Reactivate account', tone: 'primary',
      }).then(function (okc) {
        if (!okc) return;
        setBusy(true);
        MGA.api.unbanUser(id).then(function () {
          MG.ui.toast('Account reactivated.', 'ok');
          refresh();
        }).catch(function (err) { MG.ui.toast(MG.util.errMessage(err), 'err'); })
          .finally(function () { setBusy(false); });
      });
    }

    function doDelete() {
      confirm({
        title: 'Delete ' + (p.full_name || p.email || 'this customer') + '?',
        body: 'This permanently removes the login identity and anonymises the profile. It cannot be undone.',
        list: [
          'The Supabase Auth identity is deleted \u2014 the customer can never sign in again.',
          'Personal data is anonymised; financial records are retained for audit.',
          'Any administrator role this profile held is revoked.',
        ],
        confirmLabel: 'Delete permanently', tone: 'danger',
      }).then(function (okc) {
        if (!okc) return;
        setBusy(true);
        MGA.api.deleteUser(id).then(function () {
          MG.ui.toast('Identity deleted; profile anonymised; financial records retained.', 'ok');
          location.hash = '#/users';
        }).catch(function (err) { MG.ui.toast(MG.util.errMessage(err), 'err'); })
          .finally(function () { setBusy(false); });
      });
    }

    return h(React.Fragment, null,
      h('button', { className: 'backlink', onClick: function () { location.hash = '#/users'; } },
        h(MG.ui.Icon, { name: 'chevron-l', size: 14 }), ' Back to user management'),

      /* user hero */
      h('header', { className: 'user-hero' },
        h(MG.ui.Avatar, { name: p.full_name || p.email, size: 'lg' }),
        h('div', { className: 'user-hero-main' },
          h('div', { className: 'user-hero-name' },
            h('h2', null, p.full_name || p.email),
            h(MG.ui.Badge, { status: p.status })),
          h('dl', { className: 'user-hero-meta' },
            h('div', null, h('dt', null, 'Email'), h('dd', null, p.email || '\u2014')),
            h('div', null, h('dt', null, 'Country'), h('dd', null, p.country_code || '\u2014')),
            h('div', null, h('dt', null, 'Default currency'), h('dd', null, p.default_currency || '\u2014')),
            h('div', null, h('dt', null, 'KYC'), h('dd', null, h(MG.ui.Badge, { status: p.kyc_status === 'verified' ? 'active' : 'pending' }))),
            h('div', null, h('dt', null, 'Joined'), h('dd', null, MG.util.dateTime(p.created_at)))))),

      h('div', { className: 'grid-side' },
        h('div', { className: 'grid-side-main' },
          h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'wallet', size: 15 }), ' Currency accounts'),
            action: h('span', { className: 'panel-chip' }, h(MG.ui.Icon, { name: 'eye', size: 13 }), ' View only') },
            (d.accounts || []).length === 0
              ? h(MG.ui.Empty, { icon: 'wallet', title: 'No accounts', note: 'No currency accounts have been opened.' })
              : h(MG.ui.DataTable, {
                  rows: d.accounts || [],
                  rowKey: function (a) { return a.id; },
                  empty: null,
                  columns: [
                    { th: 'Currency', td: function (a) { return h('span', { className: 'cell-cur' }, h('b', null, a.currency_code)); } },
                    { th: 'Balance', align: 'right', td: function (a) { return h('span', { className: 'td-amount' }, MG.util.money(a.balance, a.currency_code)); } },
                    { th: 'Status', td: function (a) { return h(MG.ui.Badge, { status: a.status }); } },
                    { th: 'Opened', td: function (a) { return h('span', { className: 'td-date' }, MG.util.date(a.opened_at)); } },
                  ] })),

          h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'receipt', size: 15 }), ' Recent transactions') },
            (d.recentTransactions || []).length === 0
              ? h(MG.ui.Empty, { icon: 'receipt', title: 'No transactions', note: 'This customer has no ledger activity yet.' })
              : h(MG.ui.DataTable, {
                  rows: d.recentTransactions || [],
                  rowKey: function (t) { return t.id; },
                  empty: null,
                  columns: [
                    { th: 'Reference', td: function (t) { return h('code', null, t.reference); } },
                    { th: 'Description', td: function (t) { return h('span', { className: 'td-desc' }, t.description || '\u2014'); } },
                    { th: 'Amount', align: 'right', td: function (t) {
                      return h('span', { className: 'td-amount ' + (t.direction === 'credit' ? 'pos' : 'neg') },
                        (t.direction === 'credit' ? '+' : '-') + MG.util.money(t.amount, t.currency_code)); } },
                    { th: 'Status', td: function (t) { return h(MG.ui.Badge, { status: t.status }); } },
                    { th: 'Date', td: function (t) { return h('span', { className: 'td-date' }, MG.util.date(t.created_at)); } },
                  ] })),

          h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'wallet', size: 15 }), ' Deposits') },
            h('p', { className: 'panel-note' }, 'Read-only \u2014 confirmations come only from the payment provider.'),
            (d.deposits || []).length === 0
              ? h(MG.ui.Empty, { icon: 'wallet', title: 'No deposits', note: 'No deposit attempts by this customer.' })
              : h(MG.ui.DataTable, {
                  rows: d.deposits || [],
                  rowKey: function (dep) { return dep.id; },
                  empty: null,
                  columns: [
                    { th: 'Reference', td: function (dep) { return h('code', null, dep.reference); } },
                    { th: 'Amount', align: 'right', td: function (dep) { return h('span', { className: 'td-amount' }, MG.util.money(dep.amount, dep.currency_code)); } },
                    { th: 'Status', td: function (dep) { return h(MG.ui.Badge, { status: dep.status }); } },
                    { th: 'Requested', td: function (dep) { return h('span', { className: 'td-date' }, MG.util.date(dep.requested_at)); } },
                  ] }))),

        h('div', { className: 'grid-side-aside' },
          h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'edit', size: 15 }), ' Permitted profile edits'),
            action: h(MG.ui.Chip, null, 'whitelisted fields') },
            h('form', { onSubmit: saveEdit, noValidate: true },
              h('div', { className: 'field' },
                h('label', { htmlFor: 'ed-first' }, 'First name'),
                h('input', { id: 'ed-first', value: edit.first,
                  onChange: function (e) { setEdit(Object.assign({}, edit, { first: e.target.value })); } })),
              h('div', { className: 'field' },
                h('label', { htmlFor: 'ed-last' }, 'Last name'),
                h('input', { id: 'ed-last', value: edit.last,
                  onChange: function (e) { setEdit(Object.assign({}, edit, { last: e.target.value })); } })),
              h('div', { className: 'field' },
                h('label', { htmlFor: 'ed-phone' }, 'Phone (E.164)'),
                h('input', { id: 'ed-phone', value: edit.phone,
                  onChange: function (e) { setEdit(Object.assign({}, edit, { phone: e.target.value })); } })),
              h('button', { type: 'submit', className: 'btn btn-primary btn-block' + (busy ? ' is-busy' : ''), disabled: busy },
                'Save changes')),
            h('p', { className: 'panel-note' }, 'Only these fields can be edited by an administrator. Email, country and anything financial are rejected by the service layer.')),

          h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'bell', size: 15 }), ' Manual notification') },
            h('form', { onSubmit: function (e) {
              e.preventDefault();
              if (!note.body) { MG.ui.toast('Write a message before sending.', 'err'); return; }
              setBusy(true);
              MGA.api.notifyUser(id, note.title, note.body, note.alsoSms).then(function () {
                setBusy(false);
                setNote({ title: '', body: '', alsoSms: false });
                MG.ui.toast('Notification sent.', 'ok');
              }).catch(function (err) { setBusy(false); MG.ui.toast(MG.util.errMessage(err), 'err'); });
            } },
              h('div', { className: 'field' },
                h('label', { htmlFor: 'nt-title' }, 'Title'),
                h('input', { id: 'nt-title', value: note.title,
                  onChange: function (e) { setNote(Object.assign({}, note, { title: e.target.value })); } })),
              h('div', { className: 'field' },
                h('label', { htmlFor: 'nt-body' }, 'Message'),
                h('textarea', { id: 'nt-body', rows: 3, value: note.body,
                  onChange: function (e) { setNote(Object.assign({}, note, { body: e.target.value })); } })),
              h('label', { className: 'switch' },
                h('input', { type: 'checkbox', checked: note.alsoSms,
                  onChange: function (e) { setNote(Object.assign({}, note, { alsoSms: e.target.checked })); } }),
                h('span', { className: 'switch-track', 'aria-hidden': 'true' }),
                h('span', { className: 'switch-label' }, 'Also send by SMS')),
              h('button', { type: 'submit', className: 'btn btn-ghost btn-block' + (busy ? ' is-busy' : ''), disabled: busy, style: { marginTop: 12 } },
                h(MG.ui.Icon, { name: 'send', size: 14 }), ' Send notification')),
            h('p', { className: 'panel-note' }, h('b', null, 'Manual'), ' \u2014 the customer is not notified automatically. Manual sends are recorded in the audit log.')),

          h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'shield', size: 15 }), ' Account status') },
            h('p', { className: 'panel-note' },
              'Every change is permission-checked server-side, recorded in the audit log and, where shown, sent to the customer. Financial records are never modified by status changes.'),
            status === 'deleted'
              ? h('p', { className: 'panel-note' },
                  h(MG.ui.Badge, { status: 'cancelled', label: 'deleted' }),
                  ' This profile is anonymised \u2014 no status controls remain.')
              : h('div', { className: 'btn-row', style: { flexWrap: 'wrap' } },
                  status === 'active' ? h('button', { type: 'button', className: 'btn btn-ghost btn-sm', disabled: busy, onClick: doSuspend },
                    h(MG.ui.Icon, { name: 'pause', size: 14 }), ' Suspend') : null,
                  status === 'suspended' || status === 'banned'
                    ? h('button', { type: 'button', className: 'btn btn-primary btn-sm', disabled: busy, onClick: doUnban },
                        h(MG.ui.Icon, { name: 'check', size: 14 }), ' Reactivate') : null,
                  status !== 'banned' ? h('button', { type: 'button', className: 'btn btn-ghost btn-sm', disabled: busy, onClick: doBan },
                    h(MG.ui.Icon, { name: 'ban', size: 14 }), ' Ban') : null,
                  h('button', { type: 'button', className: 'btn btn-danger btn-sm', disabled: busy, onClick: doDelete },
                    h(MG.ui.Icon, { name: 'x-circle', size: 14 }), ' Delete')),
            status !== 'deleted' ? h('p', { className: 'panel-note' },
              'Suspend and ban ask for a reason (3\u2013500 characters) \u2014 the service layer rejects anything shorter. Delete removes the login identity and anonymises the profile; it cannot be undone.') : null),

          h(MG.ui.RestrictedPanel, {
            intro: 'Attempts against this customer\u2019s money are always rejected \u2014 try any of them:',
            ops: [
              { op: 'edit_balance', label: 'Edit balance' },
              { op: 'withdraw', label: 'Withdraw' },
              { op: 'transfer', label: 'Transfer' },
              { op: 'alter_deposit', label: 'Alter deposit confirmation' },
              { op: 'edit_ledger', label: 'Edit ledger entry' },
            ] }))));
  };
})();
