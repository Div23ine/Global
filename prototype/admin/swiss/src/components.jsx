/* ============================================================================
   MERIDIAN ADMIN — Design Concept 1 · “Swiss Private Banking”
   admin/swiss/src/components.jsx

   Shared UI kit for the React administrator console. Everything data-related
   flows through window.GL (loaded by main.jsx before this module renders).
   Language mirrors customer/swiss/assets/theme.css: white paper surfaces,
   hairline borders, radius 2px, navy solid / hairline ghost buttons, 11px
   uppercase table headers, tabular numerals, no decoration.
   ========================================================================== */
import React, { useCallback, useEffect, useRef, useState } from 'react';

const GL = () => window.GL;

/* ----------------------------------------------------------------------------
   Icon — renders the shared inline SVG set (already aria-hidden, currentColor)
   ---------------------------------------------------------------------------- */
export function Icon({ name, size = 20, cls }) {
  return (
    <span
      className={cls ? 'ic-wrap ' + cls : 'ic-wrap'}
      dangerouslySetInnerHTML={{ __html: GL().icon(name, size) }}
    />
  );
}

/* ----------------------------------------------------------------------------
   Badge — status pill on the shared .b-* contract
   ---------------------------------------------------------------------------- */
const BADGE_LABEL = {
  successful: 'Successful', pending: 'Pending', failed: 'Failed', cancelled: 'Cancelled',
  duplicate: 'Duplicate', active: 'Active', frozen: 'Frozen', unavailable: 'Unavailable',
  open: 'Open', resolved: 'Resolved', allowed: 'Allowed', denied: 'Denied',
  revoked: 'Revoked', initiated: 'Initiated', suspicious: 'Suspicious', none: 'None'
};
const BADGE_CLASS = {
  revoked: 'b-cancelled', allowed: 'b-active', denied: 'b-failed',
  initiated: 'b-pending', suspicious: 'b-failed', none: 'b-unavailable'
};
export function Badge({ status, label }) {
  const key = String(status == null ? '' : status).toLowerCase();
  return <span className={'badge ' + (BADGE_CLASS[key] || 'b-' + key)}>{label || BADGE_LABEL[key] || key}</span>;
}

/* ----------------------------------------------------------------------------
   StatCard — KPI block for the dashboard / reports
   ---------------------------------------------------------------------------- */
export function StatCard({ label, value, icon, tone, sub }) {
  return (
    <div className={'stat-card' + (tone ? ' tone-' + tone : '')}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon ? <Icon name={icon} size={17} /> : null}
      </div>
      <div className="stat-value">{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   DataTable — hairline table with 11px uppercase headers.
   cols: [{ label, class?, cell(row) }]
   ---------------------------------------------------------------------------- */
export function DataTable({ cols, rows, rowKey, rowClass, onRowClick, empty }) {
  if (!rows || !rows.length) return empty || <Empty title="No records" text="Nothing to show for the current selection." />;
  const clickable = !!onRowClick;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={c.label + i} className={c.class || ''}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr
              key={rowKey ? rowKey(r, ri) : ri}
              className={(rowClass ? rowClass(r) : '') + (clickable ? ' clickable' : '')}
              onClick={clickable ? () => onRowClick(r) : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={clickable
                ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(r); } }
                : undefined}
            >
              {cols.map((c, i) => (
                <td key={i} className={c.class || ''}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Skeleton — generic page shimmer (title + stat row + two panels)
   ---------------------------------------------------------------------------- */
export function Skeleton() {
  return (
    <div className="skel-page" aria-hidden="true">
      <div className="skel skel-title"></div>
      <div className="skel-grid">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skel skel-stat"></div>)}
      </div>
      <div className="skel-cols">
        <div className="skel skel-panel"></div>
        <div className="skel skel-panel"></div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Empty — quiet empty state
   ---------------------------------------------------------------------------- */
export function Empty({ icon = 'search', title, text, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={26} />
      <h3>{title || 'Nothing here yet'}</h3>
      {text ? <p>{text}</p> : null}
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   LoadError — failed view with retry
   ---------------------------------------------------------------------------- */
export function LoadError({ error, retry }) {
  return (
    <div className="empty err-state">
      <Icon name="alert" size={26} />
      <h3>Could not load this view</h3>
      <p>{(error && error.message) || 'Unexpected error.'}</p>
      {retry ? <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>Try again</button> : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   PageHead — eyebrow + serif title + intro + actions
   ---------------------------------------------------------------------------- */
export function PageHead({ eyebrow, title, sub, children }) {
  return (
    <div className="page-head">
      <div className="ph-text">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="ph-title">{title}</h2>
        {sub ? <p className="page-intro">{sub}</p> : null}
      </div>
      {children ? <div className="ph-actions">{children}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Modal — centred dialog, whisper shadow, Esc + backdrop close
   ---------------------------------------------------------------------------- */
export function Modal({ title, onClose, children, footer, wide }) {
  const boxRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    if (boxRef.current) boxRef.current.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="gl-modal-root" role="dialog" aria-modal="true" aria-label={title}>
      <div className="gl-modal-backdrop" onClick={onClose}></div>
      <div className={'gl-modal' + (wide ? ' modal-wide' : '')} ref={boxRef} tabIndex={-1}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="gl-modal-body">{children}</div>
        {footer ? <div className="gl-modal-actions">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   ConfirmDialog — promise-based confirmation, optional single-line input.
   Resolves: null (cancel) | true (confirm) | string (confirm with input).
   ---------------------------------------------------------------------------- */
let openConfirmFn = null;
export function confirmDialog(opts) {
  return new Promise((resolve) => {
    if (openConfirmFn) openConfirmFn(opts, resolve);
    else resolve(null);
  });
}
export function ConfirmHost() {
  const [st, setSt] = useState(null);
  const [value, setValue] = useState('');
  useEffect(() => {
    openConfirmFn = (opts, resolve) => {
      setValue(opts.input ? (opts.input.value || '') : '');
      setSt({ opts, resolve });
    };
    return () => { openConfirmFn = null; };
  }, []);
  useEffect(() => {
    if (!st) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { st.resolve(null); setSt(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [st]);
  if (!st) return null;
  const { opts, resolve } = st;
  const done = (val) => { setSt(null); resolve(val); };
  return (
    <div className="gl-modal-root" role="dialog" aria-modal="true" aria-label={opts.title}>
      <div className="gl-modal-backdrop" onClick={() => done(null)}></div>
      <div className="gl-modal confirm">
        <h3>{opts.title}</h3>
        <div className="gl-modal-body">
          <p className="confirm-msg">{opts.message}</p>
          {opts.note ? <p className="modal-note">{opts.note}</p> : null}
          {opts.input ? (
            <div className="field">
              <label htmlFor="gl-confirm-input">{opts.input.label}</label>
              <input
                id="gl-confirm-input"
                value={value}
                placeholder={opts.input.placeholder}
                autoFocus
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          ) : null}
        </div>
        <div className="gl-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => done(null)}>Cancel</button>
          <button
            type="button"
            autoFocus={!opts.input}
            className={'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary')}
            onClick={() => done(opts.input ? value : true)}
          >
            {opts.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Toast system — module-level emitter + host. Every mutation reports back.
   ---------------------------------------------------------------------------- */
let pushToastFn = null;
export function toast(message, tone) {
  if (pushToastFn) pushToastFn({ message, tone: tone || 'ok' });
}
export function toastErr(err) {
  toast((err && err.message) || 'Something went wrong.', 'err');
}
export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    pushToastFn = (t) => {
      const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      setItems((list) => list.concat([{ id, message: t.message, tone: t.tone }]));
      window.setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 4600);
    };
    return () => { pushToastFn = null; };
  }, []);
  return (
    <div className="gl-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={'gl-toast tone-' + t.tone}
          onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}
        >
          <Icon name={t.tone === 'ok' ? 'check-circle' : t.tone === 'err' ? 'x-circle' : 'info'} size={17} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Form fields
   ---------------------------------------------------------------------------- */
export function TextField({ id, label, value, onChange, placeholder, type = 'text', textarea, hint, autoComplete }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {textarea ? (
        <textarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)} />
      )}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function SelectField({ id, label, value, onChange, options, hint }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function FilterBar({ children }) {
  return <div className="card filt-card"><div className="filt-in">{children}</div></div>;
}

/* ----------------------------------------------------------------------------
   BusyButton — shows the .is-busy spinner while pending
   ---------------------------------------------------------------------------- */
export function BusyButton({ busy, className = 'btn', children, ...rest }) {
  return (
    <button {...rest} className={className + (busy ? ' is-busy' : '')} disabled={busy || rest.disabled}>
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------------------
   useData — fetch + skeleton + error + reload for every admin view
   ---------------------------------------------------------------------------- */
export function useData(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ data: null, loading: true, error: null });
    fn()
      .then((res) => { if (alive) setState({ data: res && res.data !== undefined ? res.data : res, loading: false, error: null }); })
      .catch((err) => { if (alive) setState({ data: null, loading: false, error: err }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps.concat([tick]));
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: state.data, loading: state.loading, error: state.error, reload };
}

/* ----------------------------------------------------------------------------
   useDebounced — debounce a search string into query state
   ---------------------------------------------------------------------------- */
export function useDebounced(value, ms) {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setOut(value), ms || 260);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return out;
}

/* ----------------------------------------------------------------------------
   Chart — canvas host for GL.charts.* with resize repaint + try/catch guard
   ---------------------------------------------------------------------------- */
export function Chart({ draw, deps = [], height = 180, label = 'Chart' }) {
  const ref = useRef(null);
  const paint = useCallback(() => {
    if (!ref.current) return;
    try { draw(ref.current); } catch (e) { /* chart failure is non-fatal */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);
  useEffect(() => {
    paint();
    const onResize = () => paint();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paint].concat(deps));
  return <canvas ref={ref} className="chart-canvas" style={{ height, width: '100%', display: 'block' }} role="img" aria-label={label} />;
}

/* Single-hue chart palette shared by every admin chart */
export const CHART_COLORS = ['#14263F', '#2E5A88', '#6E8FB5', '#9FB6CF', '#C3CEDC'];

export function usdK(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1000) return '$' + GL().fmt.num(Math.round(n / 1000)) + 'k';
  return '$' + GL().fmt.num(Math.round(n));
}
