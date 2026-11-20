/* ============================================================================
   MERIDIAN ADMIN — CONCEPT 03 · PREMIUM GLOBAL FINANCIAL PLATFORM
   admin/premium/src/components.jsx

   Shared React primitives for the admin console: icons (window.GL.icon),
   badges, stat cards, data tables, skeletons, empty states, the toast system,
   modals + confirm dialogs, page headers, the persisted theme toggle and the
   small async/debounce/chart hooks every page uses. All data flows through
   window.GL (shared layer side-effect-imported by main.jsx).
   ========================================================================== */
import { useCallback, useEffect, useRef, useState } from 'react';

/* --------------------------------------------------------------------------
   palette (fixed chart colours, both themes)
   -------------------------------------------------------------------------- */
export const PALETTE = ['#4C7DFF', '#55B98A', '#D9A441', '#9BA3AF', '#7A5AF8'];
export const OUTCOME_COLORS = {
  successful: '#55B98A',
  pending: '#D9A441',
  failed: '#E07A6B',
  cancelled: '#9BA3AF',
  duplicate: '#7A5AF8'
};

/* --------------------------------------------------------------------------
   Icon — the only place dangerouslySetInnerHTML is used (GL.icon contract)
   -------------------------------------------------------------------------- */
export function Icon({ name, size = 18, className = '' }) {
  return (
    <span className={className ? 'ic ' + className : 'ic'} aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: window.GL.icon(name, size) }} />
  );
}

/* --------------------------------------------------------------------------
   Badge — status pill (b-<status> variants, both themes)
   -------------------------------------------------------------------------- */
export function Badge({ status, label }) {
  const s = String(status || '').toLowerCase();
  return <span className={'badge b-' + s}>{label || status}</span>;
}

/* --------------------------------------------------------------------------
   StatCard — KPI tile with icon, label, value, sub
   -------------------------------------------------------------------------- */
export function StatCard({ icon, label, value, sub, tone }) {
  return (
    <div className={'stat-card' + (tone ? ' ' + tone : '')}>
      {icon && <span className="stat-ic"><Icon name={icon} size={17} /></span>}
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   PageHead — display heading + sub + action slot
   -------------------------------------------------------------------------- */
export function PageHead({ eyebrow, title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title display">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Field — labelled form control wrapper (customer-app styling contract)
   -------------------------------------------------------------------------- */
export function Field({ label, htmlFor, hint, children }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Empty state
   -------------------------------------------------------------------------- */
export function Empty({ icon = 'search', title = 'Nothing here yet', text }) {
  return (
    <div className="empty">
      <div className="empty-ic"><Icon name={icon} size={20} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Error panel (failed views)
   -------------------------------------------------------------------------- */
export function ErrorPanel({ error, onRetry }) {
  return (
    <div className="error-panel" role="alert">
      <span className="ep-ic"><Icon name="alert" size={17} /></span>
      <div>
        <h3>Could not load this view</h3>
        <p>{(error && error.message) || 'An unexpected error occurred.'}</p>
      </div>
      {onRetry && <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Skeletons
   -------------------------------------------------------------------------- */
export function PageSkeleton() {
  return (
    <div className="skel-page" aria-hidden="true">
      <div className="skel sk-title" />
      <div className="sk-stats">{[0, 1, 2, 3].map((i) => <div key={i} className="skel sk-stat" />)}</div>
      <div className="sk-cols">
        <div className="skel sk-panel" />
        <div className="skel sk-panel" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="table-wrap" aria-hidden="true">
      <table>
        <thead>
          <tr>{Array.from({ length: cols }).map((_, i) => <th key={i}><div className="skel sk-th" /></th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => <td key={c}><div className="skel sk-td" /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------------
   DataTable — columns: [{ h, c(row), num }], optional row click / row class
   -------------------------------------------------------------------------- */
export function DataTable({ columns, rows, rowKey, onRow, rowClass, empty, loading, skeletonRows = 6 }) {
  if (loading) return <TableSkeleton rows={skeletonRows} cols={columns.length} />;
  if (!rows || !rows.length) {
    const e = empty || {};
    return (
      <div className="table-wrap empty-wrap">
        <Empty icon={e.icon} title={e.title} text={e.text} />
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c, i) => <th key={i} className={c.num ? 'num' : ''}>{c.h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const cls = [onRow ? 'rowlink' : '', rowClass ? rowClass(r) : ''].filter(Boolean).join(' ');
            return (
              <tr key={rowKey ? rowKey(r) : ri} className={cls || undefined}
                onClick={onRow ? () => onRow(r) : undefined}>
                {columns.map((c, ci) => (
                  <td key={ci} className={c.num ? 'num' : ''}>{c.c(r)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Toast system — module-level store + React host (role=status)
   -------------------------------------------------------------------------- */
let _toastList = [];
let _setToastList = null;

function _dismiss(id) {
  _toastList = _toastList.filter((t) => t.id !== id);
  if (_setToastList) _setToastList(_toastList);
}

export function toast(message, tone = 'ok') {
  const t = tone === 'err' || tone === 'error' ? 'err' : tone === 'info' ? 'info' : 'ok';
  const id = 'toast-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  _toastList = [..._toastList, { id, message, tone: t }];
  if (_setToastList) _setToastList(_toastList);
  setTimeout(() => _dismiss(id), 4600);
}

export function fail(err) {
  toast((err && err.message) ? err.message : 'Something went wrong.', 'err');
}

/* expose on GL so the shared demo panel integrates with the React toasts */
try {
  if (window.GL) {
    if (!window.GL.toast) window.GL.toast = (msg, tone) => toast(msg, tone);
    if (!window.GL.fail) window.GL.fail = fail;
  }
} catch (e) { /* shared layer guard */ }

export function ToastHost() {
  const [list, setList] = useState(_toastList);
  useEffect(() => {
    _setToastList = setList;
    return () => { if (_setToastList === setList) _setToastList = null; };
  }, []);
  return (
    <div className="gl-toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={'gl-toast tone-' + t.tone} onClick={() => _dismiss(t.id)}>
          <Icon name={t.tone === 'err' ? 'x-circle' : t.tone === 'info' ? 'info' : 'check-circle'} size={16} />
          <div>{t.message}</div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Modal + ConfirmDialog
   -------------------------------------------------------------------------- */
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="gl-modal-root" role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
      <div className="gl-modal-backdrop" onClick={onClose} />
      <div className="gl-modal">
        <button type="button" className="icon-btn modal-x" onClick={onClose} aria-label="Close dialog">
          <Icon name="x" size={16} />
        </button>
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, children, confirmLabel = 'Confirm', busy = false, danger = false, onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !busy && onCancel) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return (
    <div className="gl-modal-root" role="dialog" aria-modal="true" aria-label={title || 'Confirmation'}>
      <div className="gl-modal-backdrop" onClick={busy ? undefined : onCancel} />
      <div className="gl-modal">
        <button type="button" className="icon-btn modal-x" onClick={onCancel} aria-label="Cancel" disabled={busy}>
          <Icon name="x" size={16} />
        </button>
        <h3>{title}</h3>
        <div className="gl-modal-body">
          {message && <p>{message}</p>}
          {children}
        </div>
        <div className="gl-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={'btn ' + (danger ? 'btn-danger' : 'btn-primary') + (busy ? ' is-busy' : '')}
            onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   ThemeToggle — persisted dark/light (localStorage: gl_premium_theme)
   -------------------------------------------------------------------------- */
export function ThemeToggle({ theme, onFlip }) {
  const dark = theme === 'dark';
  return (
    <button type="button" className="theme-toggle"
      aria-pressed={dark ? 'true' : 'false'}
      aria-label={dark ? 'Switch to the light theme' : 'Switch to the dark theme'}
      title="Toggle dark / light theme"
      onClick={onFlip}>
      <span className="tt-sun" dangerouslySetInnerHTML={{ __html: window.GL.icon('sun', 17) }} />
      <span className="tt-moon" dangerouslySetInnerHTML={{ __html: window.GL.icon('moon', 17) }} />
    </button>
  );
}

/* --------------------------------------------------------------------------
   Chart — canvas host: draws via GL.charts.* in try/catch, redraws on resize
   -------------------------------------------------------------------------- */
export function Chart({ draw, height = 220, deps = [] }) {
  const ref = useRef(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const render = () => {
      try { setError(false); draw(canvas); } catch (e) { setError(true); }
    };
    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="chart-box">
      <canvas ref={ref} className="chart-canvas" style={{ height }} />
      {error && <p className="chart-err">This chart could not be drawn in the current browser.</p>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   useAsync — promise → { loading, data, error, reload }; simulated latency
   makes every loading / empty / error state a real state.
   -------------------------------------------------------------------------- */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then((res) => { if (alive) setState({ loading: false, data: res ? res.data : null, error: null }); })
      .catch((err) => { if (alive) setState({ loading: false, data: null, error: err }); });
    return () => { alive = false; };
  }, deps.concat(tick)); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

/* --------------------------------------------------------------------------
   useDebounced — search inputs (300ms)
   -------------------------------------------------------------------------- */
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
