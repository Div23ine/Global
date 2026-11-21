/* Shared React UI components used by both the customer app and the admin
   console. Same class names as the approved design system (theme.css), so
   the visual language is preserved exactly. */
(function () {
  var React = window.React;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var esc = function (s) { return s == null ? '' : String(s); };

  /* ---------------------------------------------------------------- badges */
  var STATUS_TONE = {
    posted: 'successful', completed: 'successful', active: 'active', allowed: 'successful',
    resolved: 'resolved', read: 'read', open: 'open',
    pending: 'pending', initiated: 'pending',
    failed: 'failed', denied: 'failed',
    cancelled: 'cancelled',
    duplicate: 'duplicate', duplicate_ignored: 'duplicate',
    suspended: 'frozen', banned: 'frozen', frozen: 'frozen',
    unavailable: 'unavailable', signature_invalid: 'failed',
  };

  MG.ui = {};

  MG.ui.Badge = function (props) {
    var st = esc(props.status || props.children);
    return React.createElement('span',
      { className: 'badge b-' + (STATUS_TONE[st] || st) }, st);
  };

  /* ------------------------------------------------------------------ card */
  MG.ui.Card = function (props) {
    return React.createElement('div',
      { className: 'panel' + (props.className ? ' ' + props.className : '') },
      props.title
        ? React.createElement('div', { className: 'panel-head' },
            React.createElement('h3', null, props.title),
            props.action || null)
        : null,
      props.children);
  };

  MG.ui.StatCard = function (props) {
    return React.createElement('div', { className: 'stat-card' + (props.tone ? ' stat-' + props.tone : '') },
      React.createElement('small', null, props.label),
      React.createElement('b', null, props.value),
      props.hint ? React.createElement('span', { className: 'stat-hint' }, props.hint) : null);
  };

  /* ----------------------------------------------------------------- table */
  MG.ui.Table = function (props) {
    return React.createElement('div', { className: 'table-wrap' },
      React.createElement('table', { className: 'table' },
        React.createElement('thead', null,
          React.createElement('tr', null, props.columns.map(function (c, i) {
            return React.createElement('th', { key: i, style: c.right ? { textAlign: 'right' } : null }, c.label);
          }))),
        React.createElement('tbody', null,
          props.rows.length === 0
            ? React.createElement('tr', null,
                React.createElement('td', { colSpan: props.columns.length },
                  React.createElement(MG.ui.Empty, { title: props.emptyTitle || 'Nothing here yet', hint: props.emptyHint })))
            : props.rows.map(function (row, i) { return props.renderRow(row, i); }))));
  };

  MG.ui.Empty = function (props) {
    return React.createElement('div', { className: 'empty' },
      React.createElement('div', { className: 'empty-ic', 'aria-hidden': 'true' }, '○'),
      React.createElement('h4', null, props.title),
      props.hint ? React.createElement('p', null, props.hint) : null,
      props.action || null);
  };

  MG.ui.Skeleton = function (props) {
    var lines = props.lines || 4;
    return React.createElement('div', { className: 'skel-block', 'aria-label': 'Loading' },
      React.createElement('div', { className: 'skel skel-title' }),
      Array.from({ length: lines }).map(function (_, i) {
        return React.createElement('div', { key: i, className: 'skel skel-line' });
      }));
  };

  /* ----------------------------------------------------------------- forms */
  MG.ui.Field = function (props) {
    return React.createElement('div', { className: 'field' + (props.error ? ' field-invalid' : '') },
      React.createElement('label', { htmlFor: props.id }, props.label),
      props.children,
      props.error ? React.createElement('p', { className: 'field-err', role: 'alert' }, props.error) : null,
      props.hint ? React.createElement('p', { className: 'field-hint' }, props.hint) : null);
  };

  MG.ui.Input = function (props) {
    return React.createElement('input', Object.assign({
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
    return React.createElement('select',
      {
        className: 'input', id: props.id, value: props.value,
        onChange: props.onChange, disabled: props.disabled,
      },
      (props.options || []).map(function (o) {
        return React.createElement('option', { key: o.value, value: o.value }, o.label);
      }));
  };

  /* ---------------------------------------------------------------- button */
  MG.ui.Button = function (props) {
    var cls = 'btn' + (props.variant ? ' btn-' + props.variant : '')
      + (props.size ? ' btn-' + props.size : '')
      + (props.block ? ' btn-block' : '')
      + (props.busy ? ' is-busy' : '');
    return React.createElement('button',
      {
        className: cls, type: props.type || 'button',
        onClick: props.onClick,
        disabled: props.disabled || props.busy,
      },
      props.busy ? React.createElement('span', { className: 'btn-spinner', 'aria-hidden': 'true' }) : null,
      props.children);
  };

  /* ----------------------------------------------------------------- modal */
  MG.ui.Modal = function (props) {
    if (!props.open) return null;
    return React.createElement('div', { className: 'gl-modal-root' },
      React.createElement('div', {
        className: 'gl-modal-backdrop',
        onClick: props.onClose,
      }),
      React.createElement('div', {
        className: 'gl-modal', role: 'dialog', 'aria-modal': 'true',
        'aria-label': props.title,
      },
        React.createElement('div', { className: 'gl-modal-head' },
          React.createElement('h3', null, props.title),
          React.createElement('button', {
            className: 'icon-btn', 'aria-label': 'Close',
            onClick: props.onClose,
          }, '×')),
        React.createElement('div', { className: 'gl-modal-body' }, props.children),
        props.footer
          ? React.createElement('div', { className: 'gl-modal-actions' }, props.footer)
          : null));
  };

  /* -------------------------------------------------------------- confirm  */
  MG.ui.Confirm = function (props) {
    return React.createElement(MG.ui.Modal, {
      open: props.open, title: props.title, onClose: props.onCancel,
      footer: [
        React.createElement(MG.ui.Button, { key: 'c', variant: 'ghost', onClick: props.onCancel }, 'Cancel'),
        React.createElement(MG.ui.Button, {
          key: 'ok', variant: props.danger ? 'danger' : 'primary',
          busy: props.busy, onClick: props.onConfirm,
        }, props.confirmLabel || 'Confirm'),
      ],
    }, React.createElement('p', null, props.message));
  };

  /* ------------------------------------------------------- hooks: fetch    */
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

  /* -------------------------------------------------------- view fallbacks */
  MG.ui.LoadingPanel = function () {
    return React.createElement('div', { className: 'panel' },
      React.createElement(MG.ui.Skeleton, { lines: 5 }));
  };

  MG.ui.ErrorPanel = function (props) {
    return React.createElement('div', { className: 'panel' },
      React.createElement(MG.ui.Empty, {
        title: 'Something went wrong',
        hint: MG.util.errMessage(props.error),
        action: React.createElement(MG.ui.Button, { variant: 'primary', onClick: props.onRetry }, 'Try again'),
      }));
  };
})();
