/* Customer views — account management: profile, security, sessions,
   notifications, support, settings. */
(function () {
  var React = window.React;
  var h = React.createElement;
  MG.views = MG.views || {};

  /* --------------------------------------------------------------- profile */
  MG.views.profile = function (props) {
    var state = MG.ui.useAsync(function () { return MG.api.profile(); }, []);
    var _f = React.useState({}); var form = _f[0]; var setForm = _f[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    React.useEffect(function () {
      if (state.data) {
        setForm({
          firstName: state.data.first_name || '',
          lastName: state.data.last_name || '',
          phone: state.data.phone || '',
        });
      }
    }, [state.data]);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var p = state.data || {};

    function save(e) {
      e.preventDefault();
      setBusy(true);
      var patch = {};
      if (form.firstName !== (p.first_name || '')) patch.firstName = form.firstName;
      if (form.lastName !== (p.last_name || '')) patch.lastName = form.lastName;
      if (form.phone !== (p.phone || '')) patch.phone = form.phone || null;
      if (Object.keys(patch).length === 0) { setBusy(false); MG.util.toast('Nothing to update.', 'info'); return; }
      MG.api.updateProfile(patch).then(function () {
        setBusy(false);
        MG.util.toast('Profile updated.', 'ok');
      }).catch(function (err) { setBusy(false); MG.util.toast(MG.util.errMessage(err), 'err'); });
    }

    return h('div', { className: 'view-stack' },
      h(MG.ui.Card, { title: 'Your details' },
        h('form', { onSubmit: save, noValidate: true },
          h('div', { className: 'grid-2' },
            h(MG.ui.Field, { id: 'pf-first', label: 'First name' },
              h(MG.ui.Input, { id: 'pf-first', value: form.firstName || '',
                onChange: function (e) { setForm(Object.assign({}, form, { firstName: e.target.value })); } })),
            h(MG.ui.Field, { id: 'pf-last', label: 'Last name' },
              h(MG.ui.Input, { id: 'pf-last', value: form.lastName || '',
                onChange: function (e) { setForm(Object.assign({}, form, { lastName: e.target.value })); } }))),
          h(MG.ui.Field, { id: 'pf-phone', label: 'Phone (E.164)', hint: 'Used for security notifications via SMS.' },
            h(MG.ui.Input, { id: 'pf-phone', type: 'tel', placeholder: '+49…', value: form.phone || '',
              onChange: function (e) { setForm(Object.assign({}, form, { phone: e.target.value })); } })),
          h(MG.ui.Button, { type: 'submit', variant: 'primary', busy: busy }, 'Save changes'))),
      h(MG.ui.Card, { title: 'Account record' },
        h('dl', { className: 'detail-list' },
          h('dt', null, 'Email'), h('dd', null, p.email || props.user.email || '—'),
          h('dt', null, 'Country'), h('dd', null, p.country_code || '—'),
          h('dt', null, 'Default currency'), h('dd', null, p.default_currency || MG.config.DEFAULT_CURRENCY),
          h('dt', null, 'Status'), h('dd', null, h(MG.ui.Badge, { status: p.status || 'active' })),
          h('dt', null, 'Member since'), h('dd', null, MG.util.date(p.created_at)))));
  };

  /* -------------------------------------------------------------- security */
  MG.views.security = function () {
    return h('div', { className: 'view-stack' },
      h(MG.ui.Card, { title: 'Sign-in & verification (managed by Clerk)' },
        h('p', { className: 'muted' },
          'Password changes, multi-factor authentication and recovery live in your identity profile. ',
          'The button below opens the secure profile managed by our identity provider.'),
        h(MG.ui.Button, { variant: 'primary', onClick: function () { MG.clerk.openUserProfile(); } },
          'Manage sign-in & MFA')),
      h(MG.ui.Card, { title: 'Security events' },
        h('p', { className: 'muted' },
          'Sign-in events, freezes and administrative actions on your account are recorded in the security event history ',
          'maintained by the platform. Contact support for a full report at any time.')));
  };

  /* -------------------------------------------------------------- sessions */
  MG.views.sessions = function () {
    var state = MG.ui.useAsync(function () { return MG.api.sessions(); }, []);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    return h(MG.ui.Card, { title: 'Active sessions' },
      (state.data || []).length === 0
        ? h(MG.ui.Empty, { title: 'No other sessions', hint: 'Only this device appears to be signed in.' })
        : h(MG.ui.Table, {
            columns: [{ label: 'Session' }, { label: 'Status' }, { label: 'Last active' }, { label: '' }],
            rows: state.data || [],
            renderRow: function (s) {
              return h('tr', { key: s.id },
                h('td', null, 'Session ' + s.id.slice(0, 12) + '…'),
                h('td', null, h(MG.ui.Badge, { status: s.status === 'active' ? 'active' : 'cancelled' })),
                h('td', null, s.lastActiveAt ? MG.util.timeAgo(new Date(s.lastActiveAt).toISOString()) : '—'),
                h('td', null, s.status === 'active'
                  ? h('button', {
                      className: 'btn btn-danger btn-sm',
                      onClick: function () {
                        MG.api.revokeSession(s.id).then(function () {
                          MG.util.toast('Session revoked.', 'ok');
                          location.reload();
                        }).catch(function (e) { MG.util.toast(MG.util.errMessage(e), 'err'); });
                      },
                    }, 'Revoke') : null));
            },
          }));
  };

  /* --------------------------------------------------------- notifications */
  MG.views.notifications = function () {
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MG.api.notifications(); }, [_r[0]]);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var list = state.data || [];
    return h(MG.ui.Card, {
      title: 'Notifications',
      action: h(MG.ui.Button, { variant: 'ghost', onClick: function () {
        MG.api.markNotificationRead('all').then(function () { reload(function (x) { return x + 1; }); });
      } }, 'Mark all read'),
    },
      list.length === 0
        ? h(MG.ui.Empty, { title: 'No notifications', hint: 'Deposit and security updates will appear here.' })
        : h('ul', { className: 'notif-list' }, list.map(function (n) {
            return h('li', { key: n.id, className: n.read_at ? '' : 'unread' },
              h('div', { className: 'notif-row' },
                h('div', null,
                  h('b', null, n.title),
                  h('p', null, n.body),
                  h('small', null, MG.util.timeAgo(n.created_at))),
                !n.read_at ? h('button', {
                  className: 'btn btn-ghost btn-sm',
                  onClick: function () {
                    MG.api.markNotificationRead(n.id).then(function () { reload(function (x) { return x + 1; }); });
                  },
                }, 'Mark read') : null));
          })));
  };

  /* --------------------------------------------------------------- support */
  MG.views.support = function () {
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MG.api.tickets(); }, [_r[0]]);
    var _f = React.useState({ subject: '', category: 'general', message: '' }); var form = _f[0]; var setForm = _f[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _e = React.useState(''); var err = _e[0]; var setErr = _e[1];

    function submit(e) {
      e.preventDefault(); setErr(null);
      if (form.subject.trim().length < 4 || form.message.trim().length < 10) {
        setErr('Subject needs 4+ characters and the message 10+.'); return;
      }
      setBusy(true);
      MG.api.createTicket(form.subject, form.category, form.message).then(function () {
        setBusy(false);
        setForm({ subject: '', category: 'general', message: '' });
        MG.util.toast('Support ticket created.', 'ok');
        reload(function (x) { return x + 1; });
      }).catch(function (error) { setBusy(false); setErr(MG.util.errMessage(error)); });
    }

    return h('div', { className: 'view-stack' },
      h(MG.ui.Card, { title: 'Open a ticket' },
        h('form', { onSubmit: submit, noValidate: true },
          h(MG.ui.Field, { id: 'st-sub', label: 'Subject' },
            h(MG.ui.Input, { id: 'st-sub', value: form.subject, maxLength: 120,
              onChange: function (e) { setForm(Object.assign({}, form, { subject: e.target.value })); } })),
          h(MG.ui.Field, { id: 'st-cat', label: 'Category' },
            h(MG.ui.Select, {
              id: 'st-cat', value: form.category,
              onChange: function (e) { setForm(Object.assign({}, form, { category: e.target.value })); },
              options: [
                { value: 'general', label: 'General' }, { value: 'deposits', label: 'Deposits' },
                { value: 'currencies', label: 'Currencies' }, { value: 'security', label: 'Security' },
                { value: 'account', label: 'Account' },
              ],
            })),
          h(MG.ui.Field, { id: 'st-msg', label: 'Message', error: err || null },
            h('textarea', {
              className: 'input', id: 'st-msg', rows: 4, maxLength: 4000, value: form.message,
              onChange: function (e) { setForm(Object.assign({}, form, { message: e.target.value })); },
            })),
          h(MG.ui.Button, { type: 'submit', variant: 'primary', busy: busy }, 'Submit ticket'))),
      h(MG.ui.Card, { title: 'Your tickets' },
        state.loading ? h(MG.ui.Skeleton, { lines: 3 })
          : (state.data || []).length === 0
            ? h(MG.ui.Empty, { title: 'No tickets yet', hint: 'Support requests and their replies appear here.' })
            : (state.data || []).map(function (t) {
                return h('div', { key: t.id, className: 'ticket' },
                  h('div', { className: 'ticket-head' },
                    h('b', null, t.subject),
                    h(MG.ui.Badge, { status: t.status })),
                  h('small', { className: 'muted' },
                    (t.category || 'general') + ' · updated ' + MG.util.timeAgo(t.updated_at || t.created_at)),
                  h('ul', { className: 'thread' }, (t.support_messages || []).map(function (m) {
                    return h('li', { key: m.id, className: 'msg msg-' + m.sender },
                      h('small', null, m.sender === 'customer' ? 'You' : 'Meridian Support', ' · ', MG.util.timeAgo(m.created_at)),
                      h('p', null, m.body));
                  })));
              })));
  };

  /* -------------------------------------------------------------- settings */
  MG.views.settings = function (props) {
    var state = MG.ui.useAsync(function () { return MG.api.profile(); }, []);
    var _p = React.useState({}); var prefs = _p[0]; var setPrefs = _p[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
    React.useEffect(function () {
      if (state.data && state.data.prefs) setPrefs(state.data.prefs);
    }, [state.data]);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });

    function toggle(key) {
      var next = Object.assign({}, prefs);
      next[key] = !prefs[key];
      setPrefs(next);
      setBusy(true);
      MG.api.updateProfile({ prefs: next }).then(function () {
        setBusy(false);
        MG.util.toast('Preferences saved.', 'ok');
      }).catch(function () {
        setBusy(false);
        MG.util.toast('Could not save preferences.', 'err');
      });
    }

    var rows = [
      ['emailNotifs', 'Email notifications', 'Deposit confirmations and security alerts by email.'],
      ['pushNotifs', 'Push notifications', 'In-app and push updates for important events.'],
      ['weeklySummary', 'Weekly summary', 'A weekly overview of account activity.'],
    ];
    return h('div', { className: 'view-stack' },
      h(MG.ui.Card, { title: 'Notification preferences' },
        h('ul', { className: 'pref-list' }, rows.map(function (r) {
          return h('li', { key: r[0] },
            h('div', null, h('b', null, r[1]), h('p', { className: 'muted' }, r[2])),
            h('label', { className: 'switch' },
              h('input', { type: 'checkbox', checked: Boolean(prefs[r[0]]), disabled: busy,
                onChange: function () { toggle(r[0]); } }),
              h('span', { className: 'switch-slider', 'aria-hidden': 'true' })));
        }))),
      h(MG.ui.Card, { title: 'Account summary' },
        h('dl', { className: 'detail-list' },
          h('dt', null, 'Name'), h('dd', null, props.user.fullName),
          h('dt', null, 'Email'), h('dd', null, props.user.email || '—'),
          h('dt', null, 'Default currency'), h('dd', null, (state.data || {}).default_currency || MG.config.DEFAULT_CURRENCY)),
        h('div', { className: 'cta-actions', style: { marginTop: 12 } },
          h('a', { className: 'btn btn-ghost', href: '#/profile' }, 'Profile'),
          h('a', { className: 'btn btn-ghost', href: '#/security' }, 'Security'),
          h('a', { className: 'btn btn-ghost', href: '#/sessions' }, 'Sessions'))));
  };
})();
