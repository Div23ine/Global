/* ============================================================================
   MERIDIAN ADMIN — CONCEPT 03 · PREMIUM GLOBAL FINANCIAL PLATFORM
   admin/premium/src/pages-ops.jsx

   Money + platform operations pages: Currency Management (availability),
   Deposit Management (read-only by policy, with the 403 demonstration),
   Transactions and Payment Monitoring. All calls via window.GL.api.admin.*
   ========================================================================== */
import { useState } from 'react';
import {
  Badge, ConfirmDialog, DataTable, ErrorPanel, Field, Icon, Modal, PageHead,
  OUTCOME_COLORS, fail, toast, useAsync, useDebounced
} from './components.jsx';

const GL = () => window.GL;

/* --------------------------------------------------------------------------
   CURRENCIES — availability toggles (audited, live on the customer side)
   -------------------------------------------------------------------------- */
export function Currencies() {
  const { data, loading, error, reload } = useAsync(() => GL().api.admin.currencies(), []);
  const [ask, setAsk] = useState(null); /* { code, name, next, customers } */
  const [busy, setBusy] = useState(false);
  const fmt = GL().fmt;

  const apply = async () => {
    setBusy(true);
    try {
      const res = await GL().api.admin.setCurrencyAvailability(ask.code, ask.next);
      toast(res.message);
      setAsk(null);
      reload();
    } catch (err) {
      fail(err);
      setAsk(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHead eyebrow="Platform" title="Currency Management"
        sub="Platform-wide currency availability. Changes are audited and propagate live to the customer applications on this origin." />

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Supported currencies</h2>
          <span className="small muted">{loading ? 'Loading…' : ((data || []).length + ' currencies')}</span>
        </div>
        <p className="panel-sub">
          Switching a currency to unavailable hides it from the customer Activate Currency page immediately — existing accounts and balances are untouched. JPY is seeded as temporarily unavailable to demonstrate the state.
        </p>
        {error ? <ErrorPanel error={error} /> : (
          <DataTable
            loading={loading}
            columns={[
              { h: 'Code', c: (r) => <span className="cur-chip">{r.code}</span> },
              { h: 'Currency', c: (r) => <div><div className="cell-main">{r.name}</div>{r.note ? <div className="cell-sub">{r.note}</div> : null}</div> },
              { h: 'Customers', num: true, c: (r) => fmt.num(r.customers) },
              { h: 'Status', c: (r) => <Badge status={r.status} /> },
              { h: 'Availability', c: (r) => (
                <button type="button" className={'btn btn-sm ' + (r.status === 'active' ? 'btn-ghost' : 'btn-primary')}
                  onClick={() => setAsk({ code: r.code, name: r.name, next: r.status === 'active' ? 'unavailable' : 'active', customers: r.customers })}>
                  {r.status === 'active' ? 'Make unavailable' : 'Make available'}
                </button>
              ) }
            ]}
            rows={data || []} rowKey={(r) => r.code}
            empty={{ icon: 'coins', title: 'No currencies', text: 'Supported currencies will appear here.' }}
          />
        )}
      </div>

      <ConfirmDialog
        open={!!ask}
        busy={busy}
        danger={!!ask && ask.next === 'unavailable'}
        title={ask && ask.next === 'unavailable'
          ? 'Make ' + (ask ? ask.code : '') + ' unavailable?'
          : 'Make ' + (ask ? ask.code : '') + ' available?'}
        confirmLabel={ask && ask.next === 'unavailable' ? 'Make unavailable' : 'Make available'}
        onCancel={() => setAsk(null)}
        onConfirm={apply}
      >
        <p>{ask && ask.next === 'unavailable'
          ? (ask && ask.customers
            ? ask.customers + ' customer' + (ask.customers === 1 ? '' : 's') + ' currently hold' + (ask.customers === 1 ? 's' : '') + ' this currency. It disappears from the customer Activate Currency page immediately; existing accounts keep their balances.'
            : 'No customers currently hold this currency. It disappears from the customer Activate Currency page immediately.')
          : 'The currency becomes activatable again on the customer Activate Currency page.'}</p>
        <p className="field-hint">The change is audited and visible in every demo app on this origin.</p>
      </ConfirmDialog>
    </div>
  );
}

/* --------------------------------------------------------------------------
   DEPOSITS — read-only by policy + the 403 demonstration
   -------------------------------------------------------------------------- */
export function Deposits() {
  const [status, setStatus] = useState('');
  const { data, loading, error } = useAsync(() => GL().api.admin.deposits({ status }), [status]);
  const [detail, setDetail] = useState(null);
  const [restricted, setRestricted] = useState(null);
  const [trying, setTrying] = useState(false);
  const fmt = GL().fmt;

  const tryAlter = async () => {
    setTrying(true);
    try {
      await GL().api.admin.attemptRestricted('alter_deposit');
      setRestricted(null);
    } catch (err) {
      setRestricted(err);
    } finally {
      setTrying(false);
    }
  };

  return (
    <div>
      <PageHead eyebrow="Money" title="Deposit Management"
        sub="Every simulated deposit across the platform — reference, method, fee and outcome. Deposits settle through the simulated gateway only." />

      <div className="restricted">
        <div className="restricted-head">
          <Icon name="lock" size={17} />
          <div>
            <h2 className="restricted-title">Administrators cannot confirm or alter deposits</h2>
            <p className="restricted-note">Deposit confirmation is performed exclusively by the simulated payment gateway. This restriction is enforced in the service layer — the button below demonstrates the rejection every administrator receives.</p>
          </div>
        </div>
        <div className="restricted-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={tryAlter} disabled={trying}>
            <Icon name="ban" size={13} /> Attempt to alter a deposit confirmation (demo)
          </button>
        </div>
        {restricted && (
          <div className="restriction-result" role="alert">
            <div className="rr-top">
              <Badge status="failed" label={'403 · ' + (restricted.code || 'FORBIDDEN_FINANCIAL')} />
              <b>alter_deposit</b>
            </div>
            <p>{restricted.message}</p>
          </div>
        )}
      </div>

      <div className="filters">
        <div className="field">
          <label htmlFor="dep-status">Status</label>
          <select id="dep-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="pending">Pending</option>
            <option value="successful">Successful</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {error ? <ErrorPanel error={error} /> : (
        <DataTable
          loading={loading}
          columns={[
            { h: 'Reference', c: (r) => <span className="mono">{r.reference}</span> },
            { h: 'Customer', c: (r) => r.userName },
            { h: 'Currency', c: (r) => <span className="cur-chip">{r.currency}</span> },
            { h: 'Amount', num: true, c: (r) => fmt.money(r.amount, r.currency) },
            { h: 'Method', c: (r) => r.methodName },
            { h: 'Fee', num: true, c: (r) => fmt.money(r.fee, r.currency) },
            { h: 'Status', c: (r) => <Badge status={r.status} /> },
            { h: 'Created', c: (r) => fmt.date(r.createdAt) },
            { h: 'Processed', c: (r) => (r.processedAt ? fmt.date(r.processedAt) : '—') }
          ]}
          rows={data || []} rowKey={(r) => r.reference}
          onRow={setDetail}
          empty={{ icon: 'wallet', title: 'No deposits', text: 'No simulated deposits match this filter yet.' }}
        />
      )}

      {detail && (
        <Modal title="Deposit detail" onClose={() => setDetail(null)}>
          <div className="gl-modal-body">
            <dl className="kv">
              <div><dt>Reference</dt><dd className="mono">{detail.reference}</dd></div>
              <div><dt>Customer</dt><dd>{detail.userName}</dd></div>
              <div><dt>Amount</dt><dd>{fmt.money(detail.amount, detail.currency)}</dd></div>
              <div><dt>Fee</dt><dd>{fmt.money(detail.fee, detail.currency)}</dd></div>
              <div><dt>Method</dt><dd>{detail.methodName}</dd></div>
              <div><dt>Status</dt><dd><Badge status={detail.status} /></dd></div>
              <div><dt>Created</dt><dd>{fmt.dateTime(detail.createdAt)}</dd></div>
              <div><dt>Processed</dt><dd>{detail.processedAt ? fmt.dateTime(detail.processedAt) : '—'}</dd></div>
              <div><dt>Outcome source</dt><dd className="mono">{detail.outcomeSource}</dd></div>
            </dl>
            <p className="field-hint">Only successful deposits credit a balance. Administrators cannot confirm, alter or retry this record.</p>
          </div>
          <div className="gl-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   TRANSACTIONS — search + status + currency filters
   -------------------------------------------------------------------------- */
export function Transactions() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [currency, setCurrency] = useState('');
  const q = useDebounced(search, 300);
  const { data, loading, error } = useAsync(
    () => GL().api.admin.transactions({ search: q, status, currency }),
    [q, status, currency]
  );
  const fmt = GL().fmt;
  const codes = (GL().CURRENCIES || []).map((c) => c.code);

  return (
    <div>
      <PageHead eyebrow="Money" title="Transactions"
        sub="The complete demonstration ledger across every customer and currency — deposits, fees and system credits." />

      <div className="filters">
        <div className="field">
          <label htmlFor="tx-search">Search</label>
          <div className="search-wrap">
            <Icon name="search" size={15} />
            <input id="tx-search" type="search" placeholder="Reference, description or customer"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="tx-status">Status</label>
          <select id="tx-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="successful">Successful</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="tx-currency">Currency</label>
          <select id="tx-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="">Any currency</option>
            {codes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {error ? <ErrorPanel error={error} /> : (
        <DataTable
          loading={loading}
          columns={[
            { h: 'Reference', c: (r) => <span className="mono">{r.ref}</span> },
            { h: 'Customer', c: (r) => r.userName },
            { h: 'Description', c: (r) => <span className="detail-cell" title={r.description}>{r.description}</span> },
            { h: 'Currency', c: (r) => <span className="cur-chip">{r.currency}</span> },
            { h: 'Amount', num: true, c: (r) => <span className={r.amount >= 0 ? 'amt-pos' : 'amt-neg'}>{fmt.money(r.amount, r.currency)}</span> },
            { h: 'Status', c: (r) => <Badge status={r.status} /> },
            { h: 'Date', c: (r) => <span className="nowrap">{fmt.dateTime(r.ts)}</span> }
          ]}
          rows={data || []} rowKey={(r) => r.ref}
          empty={{ icon: 'exchange', title: 'No transactions match', text: 'Try clearing the search or the filters.' }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   PAYMENTS — outcome filter, stats row, attempts table
   -------------------------------------------------------------------------- */
export function Payments() {
  const [outcome, setOutcome] = useState('all');
  const { data, loading, error } = useAsync(() => GL().api.admin.payments({ outcome }), [outcome]);
  const fmt = GL().fmt;
  const stats = (data && data.stats) || {};
  const outcomes = ['successful', 'pending', 'failed', 'cancelled', 'duplicate'];

  return (
    <div>
      <PageHead eyebrow="Money" title="Payment Monitoring"
        sub="Simulated payment-gateway attempts behind every deposit — outcome, duration and whether the demo panel forced the result." />

      <div className="stat-pills" aria-label="Outcome totals for the current filter">
        {outcomes.map((o) => (
          <div className="stat-pill" key={o}>
            <span className="legend-swatch" style={{ background: OUTCOME_COLORS[o] }} />
            <span>{o}</span>
            <b>{stats[o] || 0}</b>
          </div>
        ))}
      </div>

      <div className="filters">
        <div className="field">
          <label htmlFor="pay-outcome">Outcome</label>
          <select id="pay-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="all">All outcomes</option>
            {outcomes.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {error ? <ErrorPanel error={error} /> : (
        <DataTable
          loading={loading}
          columns={[
            { h: 'Reference', c: (r) => <span className="mono">{r.reference}</span> },
            { h: 'Customer', c: (r) => r.userName },
            { h: 'Method', c: (r) => r.methodName },
            { h: 'Amount', num: true, c: (r) => (r.amount != null ? fmt.money(r.amount, r.currency) : '—') },
            { h: 'Outcome', c: (r) => <Badge status={r.outcome} /> },
            { h: 'Duration', num: true, c: (r) => (r.durationMs / 1000).toFixed(2) + ' s' },
            { h: 'Forced', c: (r) => (r.forced ? <Badge status="duplicate" label="Forced" /> : <span className="muted">—</span>) },
            { h: 'Date', c: (r) => <span className="nowrap">{fmt.dateTime(r.ts)}</span> }
          ]}
          rows={(data && data.items) || []} rowKey={(r) => r.id}
          empty={{ icon: 'card', title: 'No payment attempts', text: 'No attempts match this outcome filter yet.' }}
        />
      )}
    </div>
  );
}
