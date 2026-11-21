/* ============================================================================
   MERIDIAN ADMIN — Design Concept 1 · “Swiss Private Banking”
   admin/swiss/src/pages-ops.jsx

   Currencies · Deposits · Transactions · Payments
   ========================================================================== */
import React, { useState } from 'react';
import {
  Icon, Badge, DataTable, Skeleton, Empty, LoadError, PageHead, Modal,
  toast, toastErr, confirmDialog, SelectField, BusyButton,
  useData, useDebounced
} from './components.jsx';

const GL = () => window.GL;
const fmt = () => GL().fmt;

/* ============================================================================
   CURRENCIES — availability configuration (live for the customer app)
   ========================================================================== */
export function Currencies() {
  const { data, loading, error, reload } = useData(() => GL().api.admin.currencies(), []);
  const [busy, setBusy] = useState('');

  if (loading) return <Skeleton />;
  if (error) return <LoadError error={error} retry={reload} />;

  const toggle = async (c) => {
    const making = c.status === 'active' ? 'unavailable' : 'active';
    const ok = await confirmDialog(
      making === 'unavailable'
        ? {
            title: 'Make ' + c.code + ' unavailable?',
            danger: true,
            confirmLabel: 'Make unavailable',
            message: 'Customers can no longer activate ' + c.code + '. Existing ' + c.code + ' accounts keep their balances and history.',
            note: 'The change takes effect live on the customer Activate Currency page and is written to the audit log.'
          }
        : {
            title: 'Make ' + c.code + ' available?',
            confirmLabel: 'Make available',
            message: 'Customers can activate ' + c.code + ' again from the Activate Currency page.',
            note: 'The change takes effect live on the customer side and is written to the audit log.'
          }
    );
    if (!ok) return;
    setBusy(c.code);
    try {
      const res = await GL().api.admin.setCurrencyAvailability(c.code, making);
      toast(res.message, 'ok');
      reload();
    } catch (e) { toastErr(e); }
    setBusy('');
  };

  return (
    <>
      <PageHead
        eyebrow="Platform"
        title="Currency management"
        sub="Supported currencies and their activation availability. Toggling a currency is audited and is reflected immediately on the customer Activate Currency page (demo data is shared per browser)."
      />

      <div className="notice">
        <Icon name="info" size={16} />
        <p>
          Availability controls <b>new activations</b> only — existing accounts are never removed or
          converted. JPY ships as “temporarily unavailable” to demonstrate that state.
        </p>
      </div>

      <DataTable
        rows={data}
        rowKey={(c) => c.code}
        empty={<Empty icon="coins" title="No currencies" text="The currency catalogue is empty." />}
        cols={[
          { label: 'Code', cell: (c) => <b className="code-cell">{c.code}</b> },
          { label: 'Name', cell: (c) => c.name },
          { label: 'Customers', class: 'num', cell: (c) => fmt().num(c.customers) },
          { label: 'Status', cell: (c) => <Badge status={c.status} /> },
          {
            label: 'Note',
            class: 'td-desc',
            cell: (c) => (c.note ? <span className="muted small">{c.note}</span> : <span className="muted">—</span>)
          },
          {
            label: 'Availability',
            cell: (c) => (
              <BusyButton
                busy={busy === c.code}
                className={'btn btn-sm ' + (c.status === 'active' ? 'btn-ghost' : 'btn-primary')}
                onClick={() => toggle(c)}
              >
                {c.status === 'active' ? 'Make unavailable' : 'Make available'}
              </BusyButton>
            )
          }
        ]}
      />
    </>
  );
}

/* ============================================================================
   DEPOSITS — read-only monitoring; the 403 demonstration lives here
   ========================================================================== */
export function Deposits() {
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useData(
    () => GL().api.admin.deposits(status ? { status } : {}), [status]
  );
  const [sel, setSel] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [busy, setBusy] = useState(false);

  const tryAlter = async () => {
    setBusy(true);
    try {
      await GL().api.admin.attemptRestricted('alter_deposit', {});
    } catch (e) {
      setAttempt(e);
      toast('Rejected by the service layer (403).', 'err');
    }
    setBusy(false);
  };

  return (
    <>
      <PageHead
        eyebrow="Money"
        title="Deposit management"
        sub="All simulated deposit attempts across the platform, with their gateway outcome and fee."
      />

      <div className="notice notice-danger">
        <Icon name="ban" size={16} />
        <div>
          <p>Administrators cannot confirm or alter deposits — confirmation happens at the simulated payment gateway, exactly as a production backend would enforce.</p>
          <BusyButton busy={busy} className="btn btn-ghost btn-sm" onClick={tryAlter}>
            <Icon name="ban" size={14} /> Demonstrate: attempt to alter a deposit
          </BusyButton>
          {attempt ? (
            <div className="rejection" role="alert">
              <Icon name="ban" size={16} />
              <div>
                <b>Rejected ({attempt.status} · {attempt.code})</b>
                <p>{attempt.message}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card filt-card">
        <div className="filt-in">
          <SelectField id="dep-status" label="Status" value={status} onChange={setStatus}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'successful', label: 'Successful' },
              { value: 'pending', label: 'Pending' },
              { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'duplicate', label: 'Duplicate' }
            ]} />
          <div className="filt-acts">
            <span className="res-count">{(data || []).length} deposit{(data || []).length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      {loading ? <Skeleton /> : error ? <LoadError error={error} retry={reload} /> : (
        <DataTable
          rows={data || []}
          rowKey={(d) => d.reference}
          onRowClick={(d) => setSel(d)}
          empty={<Empty icon="plus" title="No deposits" text={status ? 'No deposits with this status.' : 'Deposit records will appear here once customers simulate deposits.'} />}
          cols={[
            { label: 'Reference', cell: (d) => <span className="td-strong">{d.reference}</span> },
            { label: 'Customer', cell: (d) => d.userName },
            { label: 'Currency', cell: (d) => d.currency },
            { label: 'Amount', class: 'num ta-r', cell: (d) => fmt().money(d.amount, d.currency) },
            { label: 'Method', cell: (d) => d.methodName },
            { label: 'Fee', class: 'num ta-r', cell: (d) => fmt().money(d.fee, d.currency) },
            { label: 'Status', cell: (d) => <Badge status={d.status} /> },
            { label: 'Created', class: 'td-date', cell: (d) => fmt().dateTime(d.createdAt) },
            { label: 'Processed', class: 'td-date', cell: (d) => (d.processedAt ? fmt().dateTime(d.processedAt) : '—') }
          ]}
        />
      )}

      {sel ? (
        <Modal title="Deposit detail" onClose={() => setSel(null)}
          footer={<button type="button" className="btn btn-ghost" onClick={() => setSel(null)}>Close</button>}>
          <dl className="detail-list">
            <div><dt>Reference</dt><dd>{sel.reference}</dd></div>
            <div><dt>Customer</dt><dd>{sel.userName}</dd></div>
            <div><dt>Amount</dt><dd>{fmt().money(sel.amount, sel.currency)}</dd></div>
            <div><dt>Fee</dt><dd>{fmt().money(sel.fee, sel.currency)}</dd></div>
            <div><dt>Method</dt><dd>{sel.methodName}</dd></div>
            <div><dt>Status</dt><dd><Badge status={sel.status} /></dd></div>
            <div><dt>Created</dt><dd>{fmt().dateTime(sel.createdAt)}</dd></div>
            <div><dt>Processed</dt><dd>{sel.processedAt ? fmt().dateTime(sel.processedAt) : '—'}</dd></div>
            <div><dt>Outcome source</dt><dd>{sel.outcomeSource || 'gateway'}</dd></div>
          </dl>
          <p className="modal-note">
            Administrators can view this record but cannot change its confirmation — the service
            layer rejects every attempt (403).
          </p>
        </Modal>
      ) : null}
    </>
  );
}

/* ============================================================================
   TRANSACTIONS
   ========================================================================== */
export function Transactions() {
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [currency, setCurrency] = useState('');
  const search = useDebounced(searchInput.trim(), 260);

  const q = { search, status, currency };
  const { data, loading, error, reload } = useData(
    () => GL().api.admin.transactions(q), [search, status, currency]
  );
  const filtering = !!(search || status || currency);
  const clear = () => { setSearchInput(''); setStatus(''); setCurrency(''); };

  return (
    <>
      <PageHead
        eyebrow="Money"
        title="Transactions"
        sub="The full ledger behind every balance — deposits, fees and system entries, per currency."
      />
      <div className="card filt-card">
        <div className="filt-in">
          <div className="field">
            <label htmlFor="txn-search">Search</label>
            <input id="txn-search" type="search" placeholder="Reference, description or customer"
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <SelectField id="txn-status" label="Status" value={status} onChange={setStatus}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'successful', label: 'Successful' },
              { value: 'pending', label: 'Pending' },
              { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' }
            ]} />
          <SelectField id="txn-cur" label="Currency" value={currency} onChange={setCurrency}
            options={[{ value: '', label: 'All currencies' }].concat(
              GL().CURRENCIES.map((c) => ({ value: c.code, label: c.code }))
            )} />
          {filtering ? (
            <div className="filt-acts">
              <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>Clear filters</button>
            </div>
          ) : null}
        </div>
      </div>

      {loading ? <Skeleton /> : error ? <LoadError error={error} retry={reload} /> : (
        <>
          <p className="res-count">{(data || []).length} transaction{(data || []).length === 1 ? '' : 's'}</p>
          <DataTable
            rows={data || []}
            rowKey={(t) => t.ref}
            empty={
              filtering
                ? <Empty title="No transactions match" text="Try a different search term or clear the filters.">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>Clear filters</button>
                  </Empty>
                : <Empty icon="receipt" title="No transactions" text="Ledger entries will appear here." />
            }
            cols={[
              { label: 'Reference', cell: (t) => <span className="td-strong">{t.ref}</span> },
              { label: 'Customer', cell: (t) => t.userName },
              { label: 'Description', class: 'td-desc', cell: (t) => t.description },
              { label: 'Currency', cell: (t) => t.currency },
              { label: 'Amount', class: 'num ta-r', cell: (t) => <span className={t.amount < 0 ? 'neg' : ''}>{fmt().money(t.amount, t.currency)}</span> },
              { label: 'Status', cell: (t) => <Badge status={t.status} /> },
              { label: 'Date', class: 'td-date', cell: (t) => fmt().dateTime(t.ts) }
            ]}
          />
        </>
      )}
    </>
  );
}

/* ============================================================================
   PAYMENTS — simulated gateway attempts
   ========================================================================== */
const OUTCOMES = ['initiated', 'successful', 'pending', 'failed', 'cancelled', 'duplicate'];

export function Payments() {
  const [outcome, setOutcome] = useState('all');
  /* the API computes stats from the filtered list, so stats come from an
     unfiltered query while the table follows the selected outcome */
  const all = useData(() => GL().api.admin.payments({ outcome: 'all' }), []);
  const list = useData(() => GL().api.admin.payments({ outcome }), [outcome]);

  const stats = (all.data && all.data.stats) || {};
  const items = (list.data && list.data.items) || [];
  const total = OUTCOMES.reduce((s, o) => s + (stats[o] || 0), 0);

  return (
    <>
      <PageHead
        eyebrow="Money"
        title="Payment monitoring"
        sub="Every simulated gateway attempt with its outcome, duration and whether the demo controls forced it."
      />

      <div className="chip-row" role="group" aria-label="Filter by outcome">
        <button type="button" className={'chip-btn' + (outcome === 'all' ? ' on' : '')}
          onClick={() => setOutcome('all')}>
          All <b className="num">{fmt().num(total)}</b>
        </button>
        {OUTCOMES.map((o) => (
          <button key={o} type="button" className={'chip-btn' + (outcome === o ? ' on' : '')}
            onClick={() => setOutcome(o)}>
            {o.charAt(0).toUpperCase() + o.slice(1)} <b className="num">{fmt().num(stats[o] || 0)}</b>
          </button>
        ))}
      </div>

      {list.loading ? <Skeleton /> : list.error ? <LoadError error={list.error} retry={list.reload} /> : (
        <DataTable
          rows={items}
          rowKey={(p) => p.id}
          empty={<Empty icon="card" title="No payment attempts" text={outcome === 'all' ? 'Simulate a deposit in the customer app to record an attempt.' : 'No attempts with this outcome.'} />}
          cols={[
            { label: 'Reference', cell: (p) => <span className="td-strong">{p.reference}</span> },
            { label: 'Customer', cell: (p) => p.userName },
            { label: 'Method', cell: (p) => p.methodName },
            { label: 'Amount', class: 'num ta-r', cell: (p) => (p.amount != null ? fmt().money(p.amount, p.currency) : '—') },
            { label: 'Outcome', cell: (p) => <Badge status={p.outcome} /> },
            { label: 'Duration', class: 'num ta-r', cell: (p) => fmt().num(p.durationMs) + ' ms' },
            { label: 'Source', cell: (p) => (p.forced ? <span className="cur-chip warn">Forced (demo)</span> : <span className="muted small">Gateway</span>) },
            { label: 'Time', class: 'td-date', cell: (p) => fmt().dateTime(p.ts) }
          ]}
        />
      )}
    </>
  );
}
