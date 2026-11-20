/* ==========================================================================
   MERIDIAN ADMIN — Hong Kong International Fintech (Design 2)
   admin/hongkong/src/components.jsx

   Shared UI kit for the React admin console: icons, badges, stat cards,
   data table, skeletons, empty states, toast system, confirm dialogs,
   modals, page heads, panels + the fetch/chart hooks every page uses.
   All data access goes through window.GL (loaded by main.jsx).
   ========================================================================== */
import React, { useState, useEffect, useRef, useContext, createContext } from 'react';

const GL = window.GL;

/* ------------------------------------------------------------------ palette */
export const PALETTE = ['#1F6FEB', '#6172F3', '#12B76A', '#F79009', '#7A5AF8'];
export const STATUS_COLORS = {
  successful: '#12B76A', pending: '#F79009', failed: '#F04438',
  cancelled: '#98A2B3', duplicate: '#7A5AF8'
};
export const kUsd = (v) =>
  v >= 1000 ? '$' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : '$' + Math.round(Number(v) || 0);

/* --------------------------------------------------------------------- icon */
export function Icon({ name, size = 18, cls }) {
  return <span className={cls ? cls : 'ic'} aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: GL.icon(name, size) }} />;
}

/* -------------------------------------------------------------------- badge */
export function Badge({ status, label }) {
  return <span className={'badge b-' + status}>{label || status}</span>;
}

/* --------------------------------------------------------------- stat card */
export function StatCard({ icon, label, value, sub, tone = 'primary' }) {
  return (
    <div className={'stat-card tone-' + tone}>
      <span className="stat-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon(icon, 19) }} />
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {sub ? <span className="stat-sub">{sub}</span> : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- page head */
export function PageHead({ icon, title, sub, actions, children }) {
  return (
    <header className="page-head">
      <span className="page-head-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon(icon, 20) }} />
      <div className="page-head-txt">
        <h2>{title}</h2>
        {sub ? <p>{sub}</p> : null}
        {children}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </header>
  );
}

/* -------------------------------------------------------------------- panel */
export function Panel({ title, actions, children, className, flush }) {
  return (
    <section className={'panel' + (className ? ' ' + className : '') + (flush ? ' panel-flush' : '')}>
      {title || actions ? (
        <div className="panel-head">
          {typeof title === 'string' ? <h3 className="panel-title">{title}</h3> : title}
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- data table */
/* columns: [{ th, td(row), tdClass?, align?, width? }]                    */
export function DataTable({ columns, rows, rowKey, rowClass, onRowClick, empty, footer, compact }) {
  if (!rows || !rows.length) return empty || <Empty icon="search" title="Nothing to show" note="No records match the current filters." />;
  return (
    <div className={'table-wrap' + (compact ? ' table-compact' : '')}>
      <table>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{ textAlign: c.align === 'right' ? 'right' : undefined, width: c.width }}>{c.th}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={rowKey ? rowKey(r) : ri}
              className={rowClass ? rowClass(r) : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c, i) => (
                <td key={i} className={c.tdClass}
                  style={{ textAlign: c.align === 'right' ? 'right' : undefined }}>{c.td(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
}

/* ----------------------------------------------------------------- skeleton */
export function PageSkeleton({ variant = 'page' }) {
  return (
    <div className="skel-page" aria-busy="true" aria-label="Loading">
      <div className="skel sk-title" />
      {variant === 'charts' ? (
        <>
          <div className="skel sk-hero" />
          <div className="skel-row">
            <div className="skel sk-block" /><div className="skel sk-block" /><div className="skel sk-block" />
          </div>
          <div className="skel-cols">
            <div className="skel sk-panel" /><div className="skel sk-panel" />
          </div>
        </>
      ) : variant === 'list' ? (
        <>
          <div className="skel sk-bar" /><div className="skel sk-bar" />
          <div className="skel sk-panel sk-tall" />
        </>
      ) : (
        <>
          <div className="skel sk-bar" /><div className="skel sk-bar" />
          <div className="skel-row">
            <div className="skel sk-block" /><div className="skel sk-block" /><div className="skel sk-block" /><div className="skel sk-block" />
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- empty state */
export function Empty({ icon = 'search', title, note, action }) {
  return (
    <div className="empty">
      <span className="empty-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon(icon, 26) }} />
      <h3>{title}</h3>
      {note ? <p>{note}</p> : null}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ notices */
export function Notice({ tone = 'info', icon, title, children }) {
  const ic = icon || (tone === 'danger' ? 'ban' : tone === 'warn' ? 'alert' : tone === 'ok' ? 'check-circle' : 'info');
  return (
    <div className={'notice notice-' + tone}>
      <span className="notice-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon(ic, 18) }} />
      <div className="notice-body">
        {title ? <b>{title}</b> : null}
        {children}
      </div>
    </div>
  );
}

export function ErrorPanel({ error, retry }) {
  return (
    <Notice tone="danger" title="Could not load this view">
      <p>{error && error.message ? error.message : 'An unexpected error occurred.'}</p>
      {retry ? <div className="notice-actions"><button className="btn btn-ghost btn-sm" onClick={retry}><Icon name="refresh" size={14} /> Try again</button></div> : null}
    </Notice>
  );
}

/* ------------------------------------------------------------------- toasts */
let toastSeq = 0;
const toastSubs = new Set();
export function toast(message, tone) {
  const t = { id: ++toastSeq, message: String(message), tone: tone || 'info' };
  toastSubs.forEach((fn) => fn(t));
}
const TOAST_IC = { ok: 'check-circle', err: 'x-circle', info: 'info' };
export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (t) => {
      setItems((x) => [...x.slice(-3), t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 4600);
    };
    toastSubs.add(fn);
    return () => toastSubs.delete(fn);
  }, []);
  return (
    <div className="gl-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={'gl-toast tone-' + t.tone}>
          <span dangerouslySetInnerHTML={{ __html: GL.icon(TOAST_IC[t.tone] || 'info', 17) }} />
          <div>{t.message}</div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- modal */
export function Modal({ open, title, onClose, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="gl-modal-root" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Dialog'}>
      <div className="gl-modal-backdrop" onClick={onClose} />
      <div className={'gl-modal' + (wide ? ' modal-wide' : '')}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog"><Icon name="x" size={16} /></button>
        </div>
        <div className="gl-modal-body">{children}</div>
        {footer ? <div className="gl-modal-actions">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- confirm dialog */
const ConfirmCtx = createContext(() => Promise.resolve(null));
export function useConfirm() { return useContext(ConfirmCtx); }

export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null);
  const [reason, setReason] = useState('');
  const confirm = (opts) => new Promise((resolve) => { setReason(''); setReq({ ...opts, resolve }); });
  const settle = (val) => { if (req) req.resolve(val); setReq(null); };
  const cancel = () => settle(null);
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!req} title={req ? req.title : ''} onClose={cancel}>
        {req ? (
          <>
            <div className={'confirm-ic tone-' + (req.tone || 'primary')}
              aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon(req.tone === 'danger' ? 'alert' : req.tone === 'warn' ? 'eye' : 'help', 24) }} />
            {req.body ? <p className="confirm-body">{req.body}</p> : null}
            {req.list ? (
              <ul className="confirm-list">
                {req.list.map((li, i) => <li key={i}>{li}</li>)}
              </ul>
            ) : null}
            {req.withReason ? (
              <div className="field" style={{ marginTop: 14 }}>
                <label htmlFor="confirm-reason">{req.withReason}</label>
                <textarea id="confirm-reason" rows="3" value={reason} placeholder={req.placeholder || ''}
                  onChange={(e) => setReason(e.target.value)} />
              </div>
            ) : null}
            <div className="gl-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={cancel}>Cancel</button>
              <button type="button" className={'btn ' + (req.tone === 'danger' ? 'btn-danger' : 'btn-primary')}
                onClick={() => settle(req.withReason ? reason : true)}>
                {req.confirmLabel || 'Confirm'}
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </ConfirmCtx.Provider>
  );
}

/* ------------------------------------------------- financial-restrictions demo */
/* Five (or fewer) attempt buttons — every call is rejected by the service
   layer with HTTP 403; the rejection renders inline as proof of enforcement. */
export function RestrictedPanel({ ops, payload, intro }) {
  const [rej, setRej] = useState(null);
  const [busy, setBusy] = useState('');
  const attempt = async (op) => {
    setBusy(op.op);
    try {
      await GL.api.admin.attemptRestricted(op.op, payload ? payload(op) : undefined);
    } catch (err) {
      setRej({ op: op.op, label: op.label, err });
      toast('Blocked by policy — ' + op.label, 'err');
    } finally {
      setBusy('');
    }
  };
  return (
    <Panel className="panel-restricted" title={<h3 className="panel-title"><Icon name="lock" size={16} /> Financial restrictions — enforced in the service layer</h3>}>
      {intro ? <p className="panel-note">{intro}</p> : null}
      <div className="restriction-grid">
        {ops.map((op) => (
          <button key={op.op} type="button" className="btn btn-ghost btn-sm" disabled={busy === op.op}
            onClick={() => attempt(op)}>
            {busy === op.op ? <span className="mini-spin" aria-hidden="true" /> : <Icon name="ban" size={14} />}
            {op.label}
          </button>
        ))}
      </div>
      {rej ? (
        <div className="restriction-reject" role="alert">
          <div className="restriction-reject-head">
            <Icon name="x-circle" size={17} />
            <b>Request rejected — {rej.label}</b>
          </div>
          <p>{rej.err.message}</p>
          <code>HTTP {rej.err.status} · {rej.err.code}</code>
          <p className="restriction-note">The attempt was recorded in the audit log as a denied action. In production this restriction is enforced server-side — hiding the button in the UI would not be sufficient.</p>
        </div>
      ) : (
        <p className="restriction-hint">These buttons demonstrate the restriction: every attempt is rejected by <code>GL.api.admin.attemptRestricted</code> with HTTP 403.</p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------- hooks */
/* useFetch(fn, deps) — real loading/error states (the API has simulated latency) */
export function useFetch(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((res) => { if (alive) setState({ loading: false, data: res.data, error: null }); })
      .catch((err) => { if (alive) setState({ loading: false, data: null, error: err }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...(deps || []), nonce]);
  return [state, () => setNonce((n) => n + 1)];
}

/* useChart(draw, deps) — draws on a canvas ref, guarded by try/catch, redrawn on resize */
export function useChart(draw, deps) {
  const ref = useRef(null);
  useEffect(() => {
    let alive = true;
    const render = () => {
      if (!alive || !ref.current) return;
      try { draw(ref.current); } catch (e) { /* chart guard — never break the page */ }
    };
    render();
    const onResize = GL.util.debounce(render, 160);
    window.addEventListener('resize', onResize);
    return () => { alive = false; window.removeEventListener('resize', onResize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/* useDebounced(value, ms) — debounce search inputs */
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* small building blocks used by several pages */
export function Avatar({ name, size }) {
  return <span className={'avatar' + (size ? ' avatar-' + size : '')}>{GL.fmt.initials(name)}</span>;
}

export function Chip({ children, tone }) {
  return <span className={'chip' + (tone ? ' chip-' + tone : '')}>{children}</span>;
}

export function currencyChip(code) {
  return <span key={code} className="chip chip-currency">{code}</span>;
}
