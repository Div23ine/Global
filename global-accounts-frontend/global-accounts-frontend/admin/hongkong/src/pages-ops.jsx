/* ==========================================================================
   MERIDIAN ADMIN — Hong Kong International Fintech (Design 2)
   admin/hongkong/src/pages-ops.jsx

   Currency Management · Deposit Management · Transactions ·
   Payment Monitoring. Money movement is monitored, never mutated — the
   service layer rejects every financial admin operation.
   ========================================================================== */
import React, { useState } from 'react';
import {
  Icon, Badge, StatCard, DataTable, PageSkeleton, Empty, Notice, ErrorPanel,
  Panel, PageHead, toast, useConfirm, useFetch, useDebounced, Chip,
  RestrictedPanel
} from './components.jsx';

const GL = window.GL;

/* ==========================================================================
   CURRENCIES
   ========================================================================== */
export function Currencies() {
  const confirm = useConfirm();
  const [{ loading, data, error }, refresh] = useFetch(() => GL.api.admin.currencies(), []);
  const [busy, setBusy] = useState('');

  const setAvailability = async (c, status) => {
    const making = status === 'unavailable';
    const ok = await confirm({
      title: 'Set ' + c.code + ' to ' + (making ? 'temporarily unavailable' : 'available') + '?',
      tone: making ? 'warn' : 'primary',
      confirmLabel: making ? 'Set unavailable' : 'Set available',
      body: making
        ? c.customers + ' customer account(s) already hold ' + c.code + ' — existing accounts keep working, but no new activations are possible while it is unavailable.'
        : c.code + ' will become activatable again from the customer Activate page.'
    });
    if (!ok) return;
    setBusy(c.code);
    try {
      const res = await GL.api.admin.setCurrencyAvailability(c.code, status);
      toast(res.message + ' The customer Activate page reflects this immediately.', 'ok');
      refresh();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <PageHead icon="coins" title="Currency management"
        sub="Control which of the supported platform currencies customers can activate. Changes are audited and take effect live in the customer apps." />

      <Notice tone="info" icon="globe">
        <p>Availability is a <b>live platform setting</b> — the customer Activate page re-reads it on every visit and on cross-tab storage events. JPY is seeded as <b>temporarily unavailable</b> to demonstrate the state.</p>
      </Notice>

      {loading ? <PageSkeleton variant="list" /> : error ? <ErrorPanel error={error} retry={refresh} /> : (
        <DataTable
          rows={data}
          rowKey={(c) => c.code}
          empty={<Empty icon="coins" title="No currencies" note="The supported currency list is empty." />}
          columns={[
            { th: 'Currency', td: (c) => (
              <span className="cell-cur">
                <span className="cur-glyph">{c.symbol}</span>
                <span><b>{c.code}</b><small>{c.name}</small></span>
              </span>
            ) },
            { th: 'Customers', align: 'right', td: (c) => <b>{c.customers}</b> },
            { th: 'Status', td: (c) => <Badge status={c.status} label={c.status === 'active' ? 'available' : 'unavailable'} /> },
            { th: 'Note', td: (c) => <span className="td-plain">{c.note || '—'}</span> },
            { th: 'Availability', align: 'right', td: (c) => (
              c.status === 'active' ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setAvailability(c, 'unavailable')} disabled={busy === c.code}>
                  <Icon name="pause" size={13} /> Set unavailable
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={() => setAvailability(c, 'active')} disabled={busy === c.code}>
                  <Icon name="check" size={13} /> Set available
                </button>
              )
            ) }
          ]} />
      )}
    </>
  );
}

/* ==========================================================================
   DEPOSITS
   ========================================================================== */
export function Deposits() {
  const [status, setStatus] = useState('all');
  const [{ loading, data, error }, refresh] = useFetch(
    () => GL.api.admin.deposits({ status: status === 'all' ? '' : status }),
    [status]
  );
  const STATUSES = ['all', 'pending', 'successful', 'failed', 'cancelled'];

  return (
    <>
      <PageHead icon="wallet" title="Deposit management"
        sub="Monitor every deposit attempt across the platform — confirmation stays with the payment provider."
        actions={<span className="panel-chip">{loading ? 'Loading…' : (data ? data.length : 0) + ' deposits'}</span>} />

      <Notice tone="warn" icon="lock">
        <p><b>Administrators cannot confirm or alter deposits.</b> Deposit outcomes come from the (simulated) payment provider; not even a Super Administrator can flip a pending deposit to successful or change an amount. The service layer enforces this — try it below.</p>
      </Notice>

      <RestrictedPanel
        payload={() => ({ detail: 'attempted from deposit management' })}
        intro="Demonstration — attempt to alter a deposit confirmation:"
        ops={[{ op: 'alter_deposit', label: 'Alter deposit confirmation' }]} />

      <div className="filter-bar">
        <div className="field">
          <label>Status</label>
          <div className="seg" role="group" aria-label="Filter deposits by status">
            {STATUSES.map((s) => (
              <button key={s} type="button" className={'seg-btn' + (status === s ? ' on' : '')}
                aria-pressed={status === s} onClick={() => setStatus(s)}>{s === 'all' ? 'All' : s}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <PageSkeleton variant="list" /> : error ? <ErrorPanel error={error} retry={refresh} /> : (
        <DataTable
          rows={data}
          rowKey={(d) => d.reference}
          empty={<Empty icon="wallet" title="No deposits"
            note={status !== 'all' ? 'No deposits with status “' + status + '”.' : 'No deposit attempts have been made yet.'} />}
          columns={[
            { th: 'Reference', td: (d) => <code>{d.reference}</code> },
            { th: 'Customer', td: (d) => d.userName },
            { th: 'Currency', td: (d) => <Chip>{d.currency}</Chip> },
            { th: 'Amount', align: 'right', td: (d) => <span className="td-amount">{GL.fmt.money(d.amount, d.currency)}</span> },
            { th: 'Method', td: (d) => d.methodName },
            { th: 'Fee', align: 'right', td: (d) => <span className="td-amount muted">{GL.fmt.money(d.fee, d.currency)}</span> },
            { th: 'Status', td: (d) => <Badge status={d.status} /> },
            { th: 'Created', td: (d) => <span className="td-date">{GL.fmt.dateTime(d.createdAt)}</span> },
            { th: 'Processed', td: (d) => <span className="td-date">{d.processedAt ? GL.fmt.dateTime(d.processedAt) : '—'}</span> }
          ]} />
      )}
    </>
  );
}

/* ==========================================================================
   TRANSACTIONS
   ========================================================================== */
export function Transactions() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [status, setStatus] = useState('all');
  const [currency, setCurrency] = useState('');
  const [{ loading, data, error }, refresh] = useFetch(
    () => GL.api.admin.transactions({
      search: search,
      status: status === 'all' ? '' : status,
      currency: currency
    }),
    [search, status, currency]
  );
  const STATUSES = ['all', 'successful', 'pending', 'failed', 'cancelled'];

  return (
    <>
      <PageHead icon="receipt" title="Transactions"
        sub="The complete customer ledger — read-only for administrators, as it records real money movement in the production system."
        actions={<span className="panel-chip">{loading ? 'Loading…' : (data ? data.length : 0) + ' entries'}</span>} />

      <div className="filter-bar">
        <div className="field field-search">
          <label htmlFor="tx-search">Search</label>
          <input id="tx-search" type="search" placeholder="Reference, description or customer…" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="tx-cur">Currency</label>
          <select id="tx-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="">All currencies</option>
            {GL.CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <div className="seg" role="group" aria-label="Filter transactions by status">
            {STATUSES.map((s) => (
              <button key={s} type="button" className={'seg-btn' + (status === s ? ' on' : '')}
                aria-pressed={status === s} onClick={() => setStatus(s)}>{s === 'all' ? 'All' : s}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <PageSkeleton variant="list" /> : error ? <ErrorPanel error={error} retry={refresh} /> : (
        <DataTable
          rows={data}
          rowKey={(t) => t.ref}
          empty={<Empty icon="receipt" title="No transactions"
            note={search || status !== 'all' || currency ? 'No ledger entries match the current filters.' : 'The ledger is empty.'} />}
          columns={[
            { th: 'Reference', td: (t) => <code>{t.ref}</code> },
            { th: 'Customer', td: (t) => t.userName },
            { th: 'Description', td: (t) => <span className="td-desc">{t.description || '—'}</span> },
            { th: 'Currency', td: (t) => <Chip>{t.currency}</Chip> },
            { th: 'Amount', align: 'right', td: (t) => <span className={'td-amount ' + (t.amount < 0 ? 'neg' : 'pos')}>{GL.fmt.money(t.amount, t.currency)}</span> },
            { th: 'Status', td: (t) => <Badge status={t.status} /> },
            { th: 'Date', td: (t) => <span className="td-date">{GL.fmt.dateTime(t.ts)}</span> }
          ]} />
      )}
    </>
  );
}

/* ==========================================================================
   PAYMENTS
   ========================================================================== */
export function Payments() {
  const [outcome, setOutcome] = useState('all');
  const [{ loading, data, error }, refresh] = useFetch(
    () => GL.api.admin.payments({ outcome: outcome }),
    [outcome]
  );
  const OUTCOMES = ['all', 'successful', 'pending', 'failed', 'cancelled', 'duplicate'];
  const stats = (data && data.stats) || {};

  return (
    <>
      <PageHead icon="card" title="Payment monitoring"
        sub="Every simulated gateway attempt with its outcome, duration and whether the demo panel forced it."
        actions={<span className="panel-chip">{loading ? 'Loading…' : data ? data.items.length + ' attempts' : ''}</span>} />

      <div className="filter-bar">
        <div className="field">
          <label>Outcome</label>
          <div className="seg seg-wrap" role="group" aria-label="Filter payment attempts by outcome">
            {OUTCOMES.map((s) => (
              <button key={s} type="button" className={'seg-btn' + (outcome === s ? ' on' : '')}
                aria-pressed={outcome === s} onClick={() => setOutcome(s)}>{s === 'all' ? 'All' : s}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <PageSkeleton variant="page" />
      ) : error ? <ErrorPanel error={error} retry={refresh} /> : (
        <>
          <div className="stat-row stat-row-six">
            {OUTCOMES.slice(1).map((s) => (
              <StatCard key={s} icon={s === 'successful' ? 'check-circle' : s === 'pending' ? 'clock' : s === 'failed' ? 'x-circle' : s === 'cancelled' ? 'x' : 'alert'}
                tone={s === 'successful' ? 'success' : s === 'pending' ? 'warn' : s === 'failed' ? 'danger' : 'info'}
                label={s + ' attempts'} value={stats[s] || 0} />
            ))}
          </div>

          <DataTable
            rows={data.items}
            rowKey={(p) => p.id}
            empty={<Empty icon="card" title="No payment attempts"
              note={outcome !== 'all' ? 'No attempts with outcome “' + outcome + '”.' : 'No gateway attempts have been made yet.'} />}
            columns={[
              { th: 'Reference', td: (p) => <code>{p.reference}</code> },
              { th: 'Customer', td: (p) => p.userName },
              { th: 'Method', td: (p) => p.methodName },
              { th: 'Amount', align: 'right', td: (p) => <span className="td-amount">{p.amount != null ? GL.fmt.money(p.amount, p.currency) : '—'}</span> },
              { th: 'Outcome', td: (p) => <Badge status={p.outcome} /> },
              { th: 'Duration', align: 'right', td: (p) => <span className="mono">{p.durationMs} ms</span> },
              { th: 'Forced', td: (p) => p.forced ? <Chip tone="warn">forced (demo)</Chip> : <span className="td-date">—</span> },
              { th: 'When', td: (p) => <span className="td-date">{GL.fmt.dateTime(p.ts)}</span> }
            ]} />
        </>
      )}
    </>
  );
}
