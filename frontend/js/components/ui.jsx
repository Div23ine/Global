/* Shared React UI components used by both the customer app and the admin
   console. Mirrors the Hong Kong prototype design system (admin.css +
   theme.css): icon system, stat cards with icon tones, page heads, data
   tables, toasts, confirm dialogs, restricted panels, feeds, avatars,
   chips, notices, skeletons, empty states. */
(function () {
  var React = window.React;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var useContext = React.useContext, createContext = React.createContext;
  var h = React.createElement;
  var esc = function (s) { return s == null ? '' : String(s); };

  /* ---------------------------------------------------------------- status */
  var STATUS_TONE = {
    posted: 'successful', completed: 'successful', active: 'active', allowed: 'successful',
    resolved: 'resolved', read: 'read', open: 'open', successful: 'successful',
    pending: 'pending', initiated: 'pending', under_review: 'pending',
    requested: 'pending', awaiting_payment: 'pending', payment_reported: 'pending',
    under_verification: 'pending', partially_fulfilled: 'pending', pending_admin_action: 'pending',
    failed: 'failed', denied: 'failed', rejected: 'failed',
    cancelled: 'cancelled',
    duplicate: 'duplicate', duplicate_ignored: 'duplicate',
    suspended: 'frozen', banned: 'frozen', frozen: 'frozen',
    unavailable: 'unavailable', available: 'active',
    signature_invalid: 'failed',
  };

  MG.ui = {};

  /* ----------------------------------------------------------------- icons */
  /* Lightweight inline SVG icon set — no external dependency.
     Matches the prototype's GL.icon() names used throughout the admin. */
  var ICON_PATHS = {
    dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
    users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    'user': 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4h-4z',
    receipt: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1zM8 7h8M8 11h8M8 15h5',
    card: 'M2 5h20v14H2zM2 10h20',
    coins: 'M9 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM17 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'shield-check': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zm-2-8l-2-2 1.5-1.5L10 12l3.5-3.5L15 10l-5 4z',
    chart: 'M3 3v18h18M7 16l4-4 3 3 5-6',
    ticket: 'M21 11a2 2 0 0 0 0-4H3a2 2 0 0 0 0 4 2 2 0 0 1 0 4 2 2 0 0 0 0 4h18a2 2 0 0 0 0-4 2 2 0 0 1 0-4zM9 7v10',
    key: 'M21 2l-2 2m-7.5 7.5a5 5 0 1 1-7-7 5 5 0 0 1 7 7zM10 13L21 2M14 6l2 2M17 3l2 2',
    history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm9-3a9 9 0 0 1-.2 1.9l2 1.6-2 3.4-2.5-1a9 9 0 0 1-3.3 1.9l-.4 2.7h-4l-.4-2.7a9 9 0 0 1-3.3-1.9l-2.5 1-2-3.4 2-1.6A9 9 0 0 1 3 12a9 9 0 0 1 .2-1.9l-2-1.6 2-3.4 2.5 1a9 9 0 0 1 3.3 1.9l2.5-1 2 3.4 2-1.6A9 9 0 0 1 21 12z',
    'trend-up': 'M23 6l-9.5 9.5-5-5L1 18M23 6h-6M23 6v6',
    refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15',
    alert: 'M12 9v4m0 4h.01M10.3 3.9l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z',
    ban: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-18a8 8 0 0 1 5.3 14L5 6.7A8 8 0 0 1 12 4z',
    'check-circle': 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4L12 14.01l-3-3',
    'x-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm-5-5l10-10M7 7l10 10',
    'x': 'M18 6L6 18M6 6l12 12',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4m0-4h.01',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'chevron-l': 'M15 18l-6-6 6-6',
    'arrow-r': 'M5 12h14m-6-6l6 6-6 6',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
    edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
    snowflake: 'M12 2v20M2 12h20M4.5 4.5l15 15M19.5 4.5l-15 15M12 6l-3 3m3-3l3 3M12 18l-3-3m3 3l3-3M6 12l3-3m-3 3l3 3M18 12l-3-3m3 3l-3 3',
    smartphone: 'M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    menu: 'M3 12h18M3 6h18M3 18h18',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
    pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
    check: 'M20 6L9 17l-5-5',
    help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
    'key-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM13 13l4-4M16 8l1 1',
    copy: 'M9 9h11v11H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  };

  MG.ui.icon = function (name, size) {
    var d = ICON_PATHS[name] || ICON_PATHS.info;
    var s = size || 18;
    return '<svg class="gl-ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  };

  MG.ui.Icon = function (props) {
    return h('span', { className: props.cls || 'ic', 'aria-hidden': 'true',
      dangerouslySetInnerHTML: { __html: MG.ui.icon(props.name, props.size || 18) } });
  };

  /* ---------------------------------------------------------------- badges */
  MG.ui.Badge = function (props) {
    var st = esc(props.status || props.children);
    var label = props.label || st;
    return h('span', { className: 'badge b-' + (STATUS_TONE[st] || st) }, label);
  };

  /* ---------------------------------------------------------------- avatar */
  MG.ui.Avatar = function (props) {
    var cls = 'avatar' + (props.size ? ' avatar-' + props.size : '');
    return h('span', { className: cls }, MG.util.initials(props.name || ''));
  };

  /* ----------------------------------------------------------------- chip */
  MG.ui.Chip = function (props) {
    var cls = 'chip' + (props.tone ? ' chip-' + props.tone : '');
    return h('span', { className: cls }, props.children);
  };

  MG.ui.currencyChip = function (code) {
    return h('span', { key: code, className: 'chip chip-currency' }, code);
  };

  /* -------------------------------------------------------------- page head */
  MG.ui.PageHead = function (props) {
    return h('header', { className: 'page-head' },
      h('span', { className: 'page-head-ic', 'aria-hidden': 'true',
        dangerouslySetInnerHTML: { __html: MG.ui.icon(props.icon, 20) } }),
      h('div', { className: 'page-head-txt' },
        h('h2', null, props.title),
        props.sub ? h('p', null, props.sub) : null,
        props.children),
      props.actions ? h('div', { className: 'page-head-actions' }, props.actions) : null);
  };

  /* ----------------------------------------------------------------- card */
  MG.ui.Card = function (props) {
    var cls = 'panel' + (props.className ? ' ' + props.className : '');
    var title = props.title;
    var hasTitle = title || props.action;
    return h('section', { className: cls },
      hasTitle ? h('div', { className: 'panel-head' },
        typeof title === 'string' ? h('h3', { className: 'panel-title' }, title) : title,
        props.action ? h('div', { className: 'panel-actions' }, props.action) : null)
        : null,
      props.children);
  };

  /* ----------------------------------------------------------- stat card */
  MG.ui.StatCard = function (props) {
    var tone = props.tone || 'primary';
    var cls = 'stat-card tone-' + tone;
    return h('div', { className: cls },
      props.icon ? h('span', { className: 'stat-ic', 'aria-hidden': 'true',
        dangerouslySetInnerHTML: { __html: MG.ui.icon(props.icon, 19) } }) : null,
      h('div', { className: 'stat-body' },
        h('span', { className: 'stat-label' }, props.label),
        h('strong', { className: 'stat-value' }, props.value),
        props.sub ? h('span', { className: 'stat-sub' }, props.sub) :
        props.hint ? h('span', { className: 'stat-sub' }, props.hint) : null));
  };

  /* ------------------------------------------------------------ data table */
  /* columns: [{ th, td(row), tdClass?, align?, width? }] */
  MG.ui.DataTable = function (props) {
    var rows = props.rows || [];
    if (!rows.length && props.empty) return props.empty;
    if (!rows.length) {
      return h(MG.ui.Empty, { icon: 'search', title: 'Nothing to show', note: 'No records match the current filters.' });
    }
    return h('div', { className: 'table-wrap' + (props.compact ? ' table-compact' : '') },
      h('table', null,
        h('thead', null, h('tr', null, props.columns.map(function (c, i) {
          return h('th', { key: i, style: { textAlign: c.align === 'right' ? 'right' : undefined, width: c.width } }, c.th);
        }))),
        h('tbody', null, rows.map(function (r, ri) {
          return h('tr', { key: props.rowKey ? props.rowKey(r) : ri,
            className: props.rowClass ? props.rowClass(r) : undefined,
            onClick: props.onRowClick ? function () { props.onRowClick(r); } : undefined },
            props.columns.map(function (c, i) {
              return h('td', { key: i, className: c.tdClass,
                style: { textAlign: c.align === 'right' ? 'right' : undefined } }, c.td(r));
            }));
        }))),
      props.footer);
  };

  /* legacy Table (backwards compat with old views) */
  MG.ui.Table = function (props) {
    return h('div', { className: 'table-wrap' },
      h('table', null,
        h('thead', null, h('tr', null, props.columns.map(function (c, i) {
          return h('th', { key: i, style: c.right ? { textAlign: 'right' } : null }, c.label);
        }))),
        h('tbody', null, props.rows.length === 0
          ? h('tr', null, h('td', { colSpan: props.columns.length },
              h(MG.ui.Empty, { title: props.emptyTitle || 'Nothing here yet', hint: props.emptyHint })))
          : props.rows.map(function (row, i) { return props.renderRow(row, i); }))));
  };

  /* ----------------------------------------------------------- empty state */
  MG.ui.Empty = function (props) {
    return h('div', { className: 'empty' },
      h('span', { className: 'empty-ic' + (props.warn ? ' warn' : ''), 'aria-hidden': 'true',
        dangerouslySetInnerHTML: { __html: MG.ui.icon(props.icon || 'search', 26) } }),
      h('h3', null, props.title),
      props.note ? h('p', null, props.note) :
      props.hint ? h('p', null, props.hint) : null,
      props.action);
  };

  /* ---------------------------------------------------------------- notice */
  MG.ui.Notice = function (props) {
    var tone = props.tone || 'info';
    var ic = props.icon || (tone === 'danger' ? 'ban' : tone === 'warn' ? 'alert' : tone === 'ok' ? 'check-circle' : 'info');
    return h('div', { className: 'notice notice-' + tone },
      h('span', { className: 'notice-ic', 'aria-hidden': 'true',
        dangerouslySetInnerHTML: { __html: MG.ui.icon(ic, 18) } }),
      h('div', { className: 'notice-body' },
        props.title ? h('b', null, props.title) : null,
        props.children));
  };

  MG.ui.ErrorPanel = function (props) {
    return h(MG.ui.Notice, { tone: 'danger', title: 'Could not load this view' },
      h('p', null, props.error && props.error.message ? props.error.message : 'An unexpected error occurred.'),
      props.onRetry ? h('div', { className: 'notice-actions' },
        h('button', { className: 'btn btn-ghost btn-sm', onClick: props.onRetry },
          h(MG.ui.Icon, { name: 'refresh', size: 14 }), ' Try again')) : null);
  };

  /* ---------------------------------------------------------------- skeleton */
  MG.ui.PageSkeleton = function (props) {
    var variant = props.variant || 'page';
    return h('div', { className: 'skel-page', 'aria-busy': 'true', 'aria-label': 'Loading' },
      h('div', { className: 'skel sk-title' }),
      variant === 'charts' ? h(React.Fragment, null,
        h('div', { className: 'skel sk-hero' }),
        h('div', { className: 'skel-row' },
          h('div', { className: 'skel sk-block' }), h('div', { className: 'skel sk-block' }), h('div', { className: 'skel sk-block' })),
        h('div', { className: 'skel-cols' },
          h('div', { className: 'skel sk-panel' }), h('div', { className: 'skel sk-panel' })))
      : variant === 'list' ? h(React.Fragment, null,
        h('div', { className: 'skel sk-bar' }), h('div', { className: 'skel sk-bar' }),
        h('div', { className: 'skel sk-panel sk-tall' }))
      : h(React.Fragment, null,
        h('div', { className: 'skel sk-bar' }), h('div', { className: 'skel sk-bar' }),
        h('div', { className: 'skel-row' },
          h('div', { className: 'skel sk-block' }), h('div', { className: 'skel sk-block' }),
          h('div', { className: 'skel sk-block' }), h('div', { className: 'skel sk-block' }))));
  };

  MG.ui.Skeleton = function (props) {
    return h(MG.ui.PageSkeleton, { variant: props.variant || 'list' });
  };

  MG.ui.LoadingPanel = function () {
    return h('div', { className: 'panel' }, h(MG.ui.PageSkeleton, { variant: 'page' }));
  };

  /* ----------------------------------------------------------------- forms */
  MG.ui.Field = function (props) {
    return h('div', { className: 'field' + (props.error ? ' field-invalid' : '') },
      props.label ? h('label', { htmlFor: props.id }, props.label) : null,
      props.children,
      props.error ? h('p', { className: 'field-err', role: 'alert' }, props.error) : null,
      props.hint ? h('p', { className: 'hint' }, props.hint) : null);
  };

  MG.ui.Input = function (props) {
    return h('input', Object.assign({
      className: 'input', id: props.id, name: props.name,
      type: props.type || 'text',
      value: props.value,
      onChange: props.onChange,
      placeholder: props.placeholder,
      autoComplete: props.autoComplete,
      disabled: props.disabled,
      required: props.required,
    }, props.passThrough || {}));
  };

  MG.ui.Select = function (props) {
    return h('select', {
      className: 'input', id: props.id, value: props.value,
      onChange: props.onChange, disabled: props.disabled,
    }, (props.options || []).map(function (o) {
      return h('option', { key: o.value, value: o.value }, o.label);
    }));
  };

  /* ---------------------------------------------------------------- button */
  MG.ui.Button = function (props) {
    var cls = 'btn' + (props.variant ? ' btn-' + props.variant : '')
      + (props.size ? ' btn-' + props.size : '')
      + (props.block ? ' btn-block' : '')
      + (props.busy ? ' is-busy' : '');
    return h('button', {
      className: cls, type: props.type || 'button',
      onClick: props.onClick,
      disabled: props.disabled || props.busy,
    }, props.busy ? h('span', { className: 'mini-spin', 'aria-hidden': 'true' }) : null,
      props.children);
  };

  /* ---------------------------------------------------------------- toasts */
  var _toastSeq = 0;
  var _toastSubs = [];
  MG.ui.toast = function (message, tone) {
    var t = { id: ++_toastSeq, message: String(message), tone: tone || 'info' };
    _toastSubs.forEach(function (fn) { fn(t); });
  };
  /* keep backward compat */
  if (!MG.util.toast) {
    MG.util.toast = MG.ui.toast;
  }
  var TOAST_IC = { ok: 'check-circle', err: 'x-circle', info: 'info' };
  MG.ui.ToastHost = function () {
    /* Single useState call — the old `useState(x)[0]; ... useState(x)[1];`
       pattern made TWO hook calls reading/writing different slots, so
       toasts never rendered. */
    var _ti = useState([]); var items = _ti[0]; var setItems = _ti[1];
    useEffect(function () {
      var fn = function (t) {
        setItems(function (x) { return x.slice(-3).concat([t]); });
        setTimeout(function () {
          setItems(function (x) { return x.filter(function (i) { return i.id !== t.id; }); });
        }, 4600);
      };
      _toastSubs.push(fn);
      return function () { _toastSubs = _toastSubs.filter(function (f) { return f !== fn; }); };
    }, []);
    return h('div', { className: 'gl-toasts', role: 'status', 'aria-live': 'polite' },
      items.map(function (t) {
        return h('div', { key: t.id, className: 'gl-toast tone-' + t.tone },
          h('span', { dangerouslySetInnerHTML: { __html: MG.ui.icon(TOAST_IC[t.tone] || 'info', 17) } }),
          h('div', null, t.message));
      }));
  };

  /* ----------------------------------------------------------------- modal */
  MG.ui.Modal = function (props) {
    useEffect(function () {
      if (!props.open) return;
      var onKey = function (e) { if (e.key === 'Escape') props.onClose(); };
      window.addEventListener('keydown', onKey);
      return function () { window.removeEventListener('keydown', onKey); };
    }, [props.open, props.onClose]);
    if (!props.open) return null;
    return h('div', { className: 'gl-modal-root', role: 'dialog', 'aria-modal': 'true',
      'aria-label': typeof props.title === 'string' ? props.title : 'Dialog' },
      h('div', { className: 'gl-modal-backdrop', onClick: props.onClose }),
      h('div', { className: 'gl-modal' + (props.wide ? ' modal-wide' : '') },
        h('div', { className: 'modal-head' },
          h('h3', null, props.title),
          h('button', { type: 'button', className: 'icon-btn', onClick: props.onClose, 'aria-label': 'Close dialog' },
            h(MG.ui.Icon, { name: 'x', size: 16 }))),
        h('div', { className: 'gl-modal-body' }, props.children),
        props.footer ? h('div', { className: 'gl-modal-actions' }, props.footer) : null));
  };

  /* ----------------------------------------------------------- confirm    */
  var ConfirmCtx = createContext(function () { return Promise.resolve(null); });
  MG.ui.useConfirm = function () { return useContext(ConfirmCtx); };

  MG.ui.ConfirmProvider = function (props) {
    /* Single-call useState pairs (see ToastHost note): the former twin-call
       pattern left `req` permanently null, so confirm dialogs never opened. */
    var _tr = useState(null); var req = _tr[0]; var setReq = _tr[1];
    var _tn = useState(''); var reason = _tn[0]; var setReason = _tn[1];

    var confirm = function (opts) {
      return new Promise(function (resolve) {
        setReason('');
        setReq(Object.assign({}, opts, { resolve: resolve }));
      });
    };
    var settle = function (val) { if (req) req.resolve(val); setReq(null); };
    var cancel = function () { settle(null); };

    return h(ConfirmCtx.Provider, { value: confirm },
      props.children,
      h(MG.ui.Modal, { open: !!req, title: req ? req.title : '', onClose: cancel },
        req ? h(React.Fragment, null,
          h('div', { className: 'confirm-ic tone-' + (req.tone || 'primary'), 'aria-hidden': 'true',
            dangerouslySetInnerHTML: { __html: MG.ui.icon(req.tone === 'danger' ? 'alert' : req.tone === 'warn' ? 'eye' : 'help', 24) } }),
          req.body ? h('p', { className: 'confirm-body' }, req.body) : null,
          req.list ? h('ul', { className: 'confirm-list' },
            req.list.map(function (li, i) { return h('li', { key: i }, li); })) : null,
          req.withReason ? h('div', { className: 'field', style: { marginTop: 14 } },
            h('label', { htmlFor: 'confirm-reason' }, req.withReason),
            h('textarea', { id: 'confirm-reason', rows: 3, value: reason,
              placeholder: req.placeholder || '', onChange: function (e) { setReason(e.target.value); } })) : null,
          h('div', { className: 'gl-modal-actions' },
            h('button', { type: 'button', className: 'btn btn-ghost', onClick: cancel }, 'Cancel'),
            h('button', { type: 'button',
              className: 'btn ' + (req.tone === 'danger' ? 'btn-danger' : 'btn-primary'),
              onClick: function () { settle(req.withReason ? reason : true); } },
              req.confirmLabel || 'Confirm')))
        : null));
  };

  /* legacy Confirm (backwards compat) */
  MG.ui.Confirm = function (props) {
    return h(MG.ui.Modal, {
      open: props.open, title: props.title, onClose: props.onCancel,
      footer: [
        h(MG.ui.Button, { key: 'c', variant: 'ghost', onClick: props.onCancel }, 'Cancel'),
        h(MG.ui.Button, { key: 'ok', variant: props.danger ? 'danger' : 'primary',
          busy: props.busy, onClick: props.onConfirm }, props.confirmLabel || 'Confirm'),
      ],
    }, h('p', null, props.message));
  };

  /* ------------------------------------------------ restricted panel */
  MG.ui.RestrictedPanel = function (props) {
    var ops = props.ops || [];
    var _tj = useState(null); var rej = _tj[0]; var setRej = _tj[1];
    var _tb = useState(''); var busy = _tb[0]; var setBusy = _tb[1];

    var attempt = function (op) {
      setBusy(op.op);
      /* simulate rejection — in production this is enforced server-side */
      setTimeout(function () {
        setRej({ op: op.op, label: op.label, err: { message: 'Financial mutation blocked by policy.', status: 403, code: 'FORBIDDEN' } });
        MG.ui.toast('Blocked by policy — ' + op.label, 'err');
        setBusy('');
      }, 600);
    };

    return h(MG.ui.Card, { className: 'panel-restricted',
      title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'lock', size: 16 }), ' Financial restrictions — enforced in the service layer') },
      props.intro ? h('p', { className: 'panel-note' }, props.intro) : null,
      h('div', { className: 'restriction-grid' },
        ops.map(function (op) {
          return h('button', { key: op.op, type: 'button', className: 'btn btn-ghost btn-sm',
            disabled: busy === op.op, onClick: function () { attempt(op); } },
            busy === op.op ? h('span', { className: 'mini-spin', 'aria-hidden': 'true' }) :
            h(MG.ui.Icon, { name: 'ban', size: 14 }),
            ' ', op.label);
        })),
      rej ? h('div', { className: 'restriction-reject', role: 'alert' },
        h('div', { className: 'restriction-reject-head' },
          h(MG.ui.Icon, { name: 'x-circle', size: 17 }),
          h('b', null, 'Request rejected — ' + rej.label)),
        h('p', null, rej.err.message),
        h('code', null, 'HTTP ' + rej.err.status + ' \u00B7 ' + rej.err.code),
        h('p', { className: 'restriction-note' }, 'The attempt was recorded in the audit log as a denied action. In production this restriction is enforced server-side \u2014 hiding the button in the UI would not be sufficient.'))
      : h('p', { className: 'restriction-hint' }, 'These buttons demonstrate the restriction: every attempt is rejected with HTTP 403.'));
  };

  /* ------------------------------------------------------------------ hooks */
  MG.ui.useAsync = function (fn, deps) {
    var _a = useState({ loading: true, data: null, error: null });
    var state = _a[0], setState = _a[1];
    var fnRef = useRef(fn);
    fnRef.current = fn;
    useEffect(function () {
      var alive = true;
      setState({ loading: true, data: null, error: null });
      fnRef.current().then(function (data) {
        if (alive) setState({ loading: false, data: data, error: null });
      }).catch(function (err) {
        if (alive) setState({ loading: false, data: null, error: err });
      });
      return function () { alive = false; };
    }, deps || []);
    return state;
  };

  MG.ui.useFetch = function (fn, deps) {
    var state = MG.ui.useAsync(fn, deps);
    var _tc = useState(0); var nonce = _tc[0]; var setNonce = _tc[1];
    /* re-run by changing deps won't work with useAsync; provide refresh */
    return [state, function () { setNonce(function (n) { return n + 1; }); }];
  };

  MG.ui.useDebounced = function (value, ms) {
    var _tv = useState(value); var v = _tv[0]; var setV = _tv[1];
    useEffect(function () {
      var t = setTimeout(function () { setV(value); }, ms || 300);
      return function () { clearTimeout(t); };
    }, [value, ms]);
    return v;
  };
})();
