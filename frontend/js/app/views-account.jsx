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
      h('div', { className: 'section-head' }, h('div', null,
        h('h2', { className: 'section-title' }, 'Profile'),
        h('p', { className: 'muted' }, 'Manage the personal information associated with your Meridian account.'))),
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
    var _p = React.useState(''); var password = _p[0]; var setPassword = _p[1];
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];

    function updatePassword(event) {
      event.preventDefault();
      if (password.length < 8) {
        MG.util.toast('Use a password with at least 8 characters.', 'err');
        return;
      }
      setBusy(true);
      MG.auth.updatePassword(password).then(function (result) {
        if (result.error) throw result.error;
        setPassword('');
        MG.util.toast('Password updated.', 'ok');
      }).catch(function (error) {
        MG.util.toast(error.message || 'Could not update your password.', 'err');
      }).finally(function () { setBusy(false); });
    }

    return h('div', { className: 'view-stack' },
      h('div', { className: 'section-head' }, h('div', null,
        h('h2', { className: 'section-title' }, 'Security'),
        h('p', { className: 'muted' }, 'Protect your account and manage your sign-in credentials.'))),
      h(MG.ui.Card, { title: 'Password & sign-in security (Supabase Auth)' },
        h('p', { className: 'muted' },
          'Your password, email confirmation and recovery are managed securely by Supabase Auth.'),
        h('form', { onSubmit: updatePassword },
          h(MG.ui.Field, { id: 'security-new-password', label: 'New password' },
            h(MG.ui.Input, { id: 'security-new-password', type: 'password',
              autoComplete: 'new-password', value: password, required: true, minLength: 8,
              onChange: function (event) { setPassword(event.target.value); } })),
          h(MG.ui.Button, { type: 'submit', variant: 'primary', busy: busy }, 'Update password')),
        h('p', { className: 'muted' },
          'Multi-factor enrollment and challenge screens are not yet exposed in Meridian. Do not treat MFA as enabled until it is configured in Supabase and implemented in the application.')),
      h(MG.ui.Card, { title: 'Security events' },
        h('p', { className: 'muted' },
          'Sign-in events, account suspensions and administrative actions are recorded in the platform security history. Contact support for a full report at any time.')));
  };

  /* -------------------------------------------------------------- sessions */
  MG.views.sessions = function () {
    var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];

    function signOut(scope, label) {
      setBusy(true);
      MG.auth.signOut({ scope: scope }).then(function (result) {
        if (result.error) throw result.error;
        MG.util.toast(label, 'ok');
      }).catch(function (error) {
        MG.util.toast(error.message || 'Could not update sessions.', 'err');
      }).finally(function () { setBusy(false); });
    }

    return h('div', { className: 'view-stack' },
    h('div', { className: 'section-head' }, h('div', null,
      h('h2', { className: 'section-title' }, 'Active sessions'),
      h('p', { className: 'muted' }, 'Choose where your Meridian account remains signed in.'))),
    h(MG.ui.Card, { title: 'Session controls' },
      h('p', { className: 'muted' },
        'Supabase Auth lets you sign out this device, other active sessions, or every session. Individual session inventories are not available in this screen.'),
      h('div', { className: 'cta-actions' },
        h(MG.ui.Button, { variant: 'primary', disabled: busy,
          onClick: function () { signOut('local', 'This device has been signed out.'); } },
          'Sign out this device'),
        h(MG.ui.Button, { variant: 'secondary', disabled: busy,
          onClick: function () { signOut('others', 'Other sessions have been signed out.'); } },
          'Sign out other devices'),
        h(MG.ui.Button, { variant: 'danger', disabled: busy,
          onClick: function () { signOut('global', 'All sessions have been signed out.'); } },
          'Sign out everywhere'))));
  };

  /* --------------------------------------------------------- notifications */
  MG.views.notifications = function () {
    var _r = React.useState(0); var reload = _r[1];
    var state = MG.ui.useAsync(function () { return MG.api.notifications(); }, [_r[0]]);
    if (state.loading) return h(MG.ui.LoadingPanel);
    if (state.error) return h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } });
    var list = state.data || [];
    return h('div', { className: 'view-stack' },
    h('div', { className: 'section-head' }, h('div', null,
      h('h2', { className: 'section-title' }, 'Notifications'),
      h('p', { className: 'muted' }, 'Important updates about deposits, account activity and security.'))),
    h(MG.ui.Card, {
      title: 'Your notification centre',
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
          }))));
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
      h('div', { className: 'section-head' }, h('div', null,
        h('h2', { className: 'section-title' }, 'Customer support'),
        h('p', { className: 'muted' }, 'Contact the Meridian team and follow the progress of your requests.'))),
      h(MG.ui.Card, { title: 'Create a support request' },
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
      h('div', { className: 'section-head' }, h('div', null,
        h('h2', { className: 'section-title' }, 'Preferences'),
        h('p', { className: 'muted' }, 'Control how Meridian sends updates and review your account shortcuts.'))),
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
