/* ==========================================================================
   MERIDIAN ADMIN — Hong Kong International Fintech (Design 2)
   admin/hongkong/src/pages-sys.jsx

   Security Monitoring · Reports · Support · Admin Roles · Audit Logs ·
   Settings.
   ========================================================================== */
import React, { useState, useEffect } from 'react';
import {
  Icon, Badge, StatCard, DataTable, PageSkeleton, Empty, Notice, ErrorPanel,
  Panel, PageHead, toast, useConfirm, useFetch, useDebounced, Chip,
  useChart, Avatar, STATUS_COLORS
} from './components.jsx';
import { FeedItem } from './pages-core.jsx';

const GL = window.GL;

/* ==========================================================================
   SECURITY MONITORING
   ========================================================================== */
export function Security({ navigate }) {
  const [suspOnly, setSuspOnly] = useState(false);
  const [evSt, refreshEvents] = useFetch(
    () => GL.api.admin.securityEvents({ suspiciousOnly: suspOnly }),
    [suspOnly]
  );
  const [usersSt, refreshUsers] = useFetch(() => GL.api.admin.users({}), []);
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const confirm = useConfirm();

  const selected = (usersSt.data || []).find((x) => x.id === userId) || null;

  const freeze = async () => {
    if (!selected) { toast('Select a customer first.', 'err'); return; }
    const r = await confirm({
      title: 'Freeze ' + selected.name + '?',
      tone: 'danger',
      confirmLabel: 'Freeze account',
      withReason: 'Reason (recorded in the audit log)',
      placeholder: 'e.g. Multiple failed sign-ins from a new location',
      body: 'The customer will be blocked from signing in and shown this reason. They are not notified automatically.'
    });
    if (r === null) return;
    setBusy('freeze');
    try {
      const res = await GL.api.admin.freezeUser(selected.id, r || reason || 'Security review');
      toast(res.message, 'ok');
      setReason('');
      refreshUsers(); refreshEvents();
    } catch (err) { toast(err.message, 'err'); } finally { setBusy(''); }
  };

  const unfreeze = async () => {
    if (!selected) { toast('Select a customer first.', 'err'); return; }
    const r = await confirm({
      title: 'Unfreeze ' + selected.name + '?',
      tone: 'primary',
      confirmLabel: 'Unfreeze account',
      withReason: 'Note for the audit log (optional)',
      body: 'Full access will be restored immediately.'
    });
    if (r === null) return;
    setBusy('unfreeze');
    try {
      const res = await GL.api.admin.unfreezeUser(selected.id, r);
      toast(res.message, 'ok');
      refreshUsers(); refreshEvents();
    } catch (err) { toast(err.message, 'err'); } finally { setBusy(''); }
  };

  const events = evSt.data || [];
  const suspiciousCount = events.filter((e) => e.suspicious).length;

  return (
    <>
      <PageHead icon="shield" title="Security monitoring"
        sub="Sign-in activity, MFA changes and flagged events across the platform (demo data)."
        actions={<button className="btn btn-ghost btn-sm" onClick={refreshEvents}><Icon name="refresh" size={14} /> Refresh</button>} />

      <div className="stat-row">
        <StatCard icon="shield" tone="info" label="Events in view" value={events.length}
          sub={suspOnly ? 'Suspicious only' : 'All security events'} />
        <StatCard icon="alert" tone="danger" label="Suspicious" value={suspiciousCount} sub="Highlighted in the feed" />
        <StatCard icon="snowflake" tone="warn" label="Frozen accounts"
          value={(usersSt.data || []).filter((u) => u.status === 'frozen').length} sub="Blocked from signing in" />
      </div>

      <div className="grid-side">
        <div className="grid-side-main">
          <Panel title="Event feed"
            actions={
              <label className="switch">
                <input type="checkbox" checked={suspOnly} onChange={(e) => setSuspOnly(e.target.checked)} />
                <span className="switch-track" aria-hidden="true" />
                <span className="switch-label">Suspicious only</span>
              </label>
            }>
            {evSt.loading ? <PageSkeleton variant="list" /> : evSt.error ? <ErrorPanel error={evSt.error} retry={refreshEvents} /> : (
              events.length ? (
                <ul className="feed">
                  {events.map((ev) => <FeedItem key={ev.id} ev={ev} />)}
                </ul>
              ) : (
                <Empty icon="shield-check" title="No security events"
                  note={suspOnly ? 'Nothing is currently flagged as suspicious.' : 'Security events will appear here as customers sign in.'} />
              )
            )}
          </Panel>
        </div>

        <div className="grid-side-aside">
          <Panel title={<h3 className="panel-title"><Icon name="snowflake" size={15} /> Freeze / unfreeze</h3>}>
            <div className="field">
              <label htmlFor="sec-user">Customer</label>
              <select id="sec-user" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Select a customer…</option>
                {(usersSt.data || []).map((u) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.email} ({u.status})</option>
                ))}
              </select>
            </div>
            {selected ? (
              <div className={'freeze-preview ' + (selected.status === 'frozen' ? 'is-frozen' : '')}>
                <Avatar name={selected.name} />
                <div>
                  <b>{selected.name}</b>
                  <small>{selected.country} · joined {GL.fmt.date(selected.createdAt)}</small>
                  <Badge status={selected.status} />
                </div>
              </div>
            ) : null}
            {selected && selected.status === 'frozen' ? (
              <Notice tone="warn" icon="snowflake"><p>This account is frozen. {selected.name} cannot sign in until it is unfrozen.</p></Notice>
            ) : null}
            <div className="freeze-actions">
              <button className="btn btn-danger" onClick={freeze} disabled={!selected || busy === 'freeze'}>
                <Icon name="snowflake" size={15} /> Freeze…
              </button>
              <button className="btn btn-ghost" onClick={unfreeze} disabled={!selected || selected.status !== 'frozen' || busy === 'unfreeze'}>
                <Icon name="check-circle" size={15} /> Unfreeze…
              </button>
            </div>
            <p className="panel-note">Freeze reasons are shown to the customer on the frozen screen and stored in the audit log. <button className="linklike" onClick={() => navigate('#/users')}>Open user management</button> for full account tools.</p>
          </Panel>

          <Panel title={<h3 className="panel-title"><Icon name="info" size={15} /> What is flagged?</h3>}>
            <ul className="policy-list">
              <li><Icon name="alert" size={14} /> Repeated failed sign-ins and invalid MFA codes are marked suspicious.</li>
              <li><Icon name="snowflake" size={14} /> Administrator freezes are recorded as suspicious security events.</li>
              <li><Icon name="eye" size={14} /> Takeover sessions appear in the audit log, not in the customer's event feed.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

/* ==========================================================================
   REPORTS
   ========================================================================== */
export function Reports() {
  const [{ loading, data, error }, refresh] = useFetch(() => GL.api.admin.reports(), []);

  const SHORT_METHOD = { 'Debit card': 'Debit', 'Credit card': 'Credit', 'Payment gateway': 'Gateway', 'Bank transfer': 'Bank' };
  const methodRef = useChart((cv) => GL.charts.bars(cv, {
    values: data.byMethod.map((m) => m.count),
    labels: data.byMethod.map((m) => SHORT_METHOD[m.method] || m.method),
    color: '#1F6FEB',
    yFmt: (v) => Math.round(v),
    tipFmt: (v) => v + ' deposits'
  }), [data]);
  const outcomeRef = useChart((cv) => GL.charts.donut(cv, {
    segments: data.outcomeMix.filter((x) => x.count > 0).map((x) => ({ value: x.count, color: STATUS_COLORS[x.status], label: x.status })),
    centre: 'attempts'
  }), [data]);

  if (loading) return <PageSkeleton variant="charts" />;
  if (error) return <ErrorPanel error={error} retry={refresh} />;

  const countries = Object.keys(data.byCountry).sort((a, b) => data.byCountry[b] - data.byCountry[a]);
  const totalUsers = data.totals.users;

  const exportCsv = () => {
    const rows = [['Meridian platform report (DEMO)', ''], ['Generated', GL.fmt.dateTime(Date.now())], []];
    rows.push(['Deposits by method', 'Count', 'Successful volume (USD)']);
    data.byMethod.forEach((m) => rows.push([m.method, m.count, GL.fmt.usd(m.volumeUsd)]));
    rows.push([]);
    rows.push(['Payment outcome mix', 'Attempts']);
    data.outcomeMix.forEach((x) => rows.push([x.status, x.count]));
    rows.push([]);
    rows.push(['Users by country', 'Customers']);
    countries.forEach((c) => rows.push([c, data.byCountry[c]]));
    rows.push([]);
    rows.push(['Totals', '']);
    rows.push(['Users', totalUsers]);
    rows.push(['Deposits', data.totals.deposits]);
    rows.push(['Transactions', data.totals.transactions]);
    GL.util.downloadText('meridian-report-DEMO.csv', GL.util.toCsv(rows));
    toast('Report exported — meridian-report-DEMO.csv (demo text file).', 'ok');
  };

  return (
    <>
      <PageHead icon="chart" title="Reports"
        sub="Aggregated demo analytics across deposits, payment outcomes and customers."
        actions={<button className="btn btn-primary btn-sm" onClick={exportCsv}><Icon name="download" size={14} /> Export CSV</button>} />

      <div className="stat-row">
        <StatCard icon="users" label="Customers" value={totalUsers} sub={'Across ' + countries.length + ' countries'} />
        <StatCard icon="wallet" tone="success" label="Deposits" value={data.totals.deposits} sub="All statuses" />
        <StatCard icon="receipt" tone="info" label="Ledger entries" value={data.totals.transactions} sub="Read-only history" />
      </div>

      <div className="grid-main">
        <Panel title="Deposits by method">
          <canvas ref={methodRef} className="chart chart-mid" role="img" aria-label="Bar chart of deposit counts by method" />
        </Panel>
        <Panel title="Payment outcome mix">
          <canvas ref={outcomeRef} className="chart chart-donut" role="img" aria-label="Donut chart of payment attempts by outcome" />
          <div className="chart-chips">
            {data.outcomeMix.map((x) => <span key={x.status} className={'badge b-' + x.status}>{x.status} · {x.count}</span>)}
          </div>
        </Panel>
      </div>

      <div className="grid-two">
        <Panel title="Method totals" actions={<span className="panel-chip">successful volume</span>}>
          <DataTable
            compact
            rows={data.byMethod}
            rowKey={(m) => m.method}
            empty={null}
            columns={[
              { th: 'Method', td: (m) => <b>{m.method}</b> },
              { th: 'Deposits', align: 'right', td: (m) => m.count },
              { th: 'Volume (USD)', align: 'right', td: (m) => <span className="td-amount">{GL.fmt.usd(m.volumeUsd)}</span> }
            ]} />
        </Panel>
        <Panel title="Users by country" actions={<span className="panel-chip">{countries.length} countries</span>}>
          <DataTable
            compact
            rows={countries}
            rowKey={(c) => c}
            empty={<Empty icon="globe" title="No customers" note="Country distribution appears once customers exist." />}
            columns={[
              { th: 'Country', td: (c) => c },
              { th: 'Customers', align: 'right', td: (c) => <b>{data.byCountry[c]}</b> },
              { th: 'Share', td: (c) => (
                <span className="share-bar"><span style={{ width: Math.max(4, Math.round((data.byCountry[c] / totalUsers) * 100)) + '%' }} /></span>
              ) }
            ]} />
        </Panel>
      </div>
    </>
  );
}

/* ==========================================================================
   SUPPORT
   ========================================================================== */
export function Support() {
  const [{ loading, data, error }, refresh] = useFetch(() => GL.api.admin.tickets(), []);
  const [selId, setSelId] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState('');

  const tickets = data || [];
  const sel = tickets.find((t) => t.id === selId) || tickets[0] || null;

  useEffect(() => { setReply(''); }, [selId]);

  const sendReply = async (e) => {
    e.preventDefault();
    if (!sel || !reply.trim()) { toast('Write a reply first.', 'err'); return; }
    setBusy('reply');
    try {
      const res = await GL.api.admin.replyTicket(sel.id, reply.trim());
      toast(res.message + ' The customer was notified of your reply.', 'ok');
      setReply('');
      refresh();
    } catch (err) { toast(err.message, 'err'); } finally { setBusy(''); }
  };

  const toggleResolve = async () => {
    if (!sel) return;
    setBusy('resolve');
    try {
      const res = await GL.api.admin.resolveTicket(sel.id);
      toast(res.message, 'ok');
      refresh();
    } catch (err) { toast(err.message, 'err'); } finally { setBusy(''); }
  };

  return (
    <>
      <PageHead icon="ticket" title="Support"
        sub="Customer support tickets — replies notify the customer; resolving is reversible."
        actions={<span className="panel-chip">
          {loading ? 'Loading…' : tickets.filter((t) => t.status === 'open').length + ' open · ' + tickets.length + ' total'}
        </span>} />

      {loading ? <PageSkeleton variant="list" /> : error ? <ErrorPanel error={error} retry={refresh} /> : !tickets.length ? (
        <Empty icon="ticket" title="No support tickets"
          note="Tickets submitted from the customer app's Support page will appear here." />
      ) : (
        <div className="support-grid">
          <Panel title="Tickets" className="support-list">
            <ul className="ticket-list">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button type="button" className={'ticket-item' + (sel && sel.id === t.id ? ' on' : '')}
                    onClick={() => setSelId(t.id)} aria-pressed={sel && sel.id === t.id}>
                    <span className="ticket-item-top">
                      <b>{t.subject}</b>
                      <Badge status={t.status} />
                    </span>
                    <small>{t.userName} · {t.category} · {GL.fmt.timeAgo(t.createdAt)}</small>
                    <small className="ticket-preview">{t.messages[t.messages.length - 1].text}</small>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {sel ? (
            <Panel className="support-thread"
              title={<h3 className="panel-title">{sel.subject} <Badge status={sel.status} /></h3>}
              actions={
                <button className={'btn btn-sm ' + (sel.status === 'open' ? 'btn-ghost' : 'btn-primary')} onClick={toggleResolve} disabled={busy === 'resolve'}>
                  <Icon name={sel.status === 'open' ? 'check-circle' : 'refresh'} size={14} />
                  {sel.status === 'open' ? 'Mark resolved' : 'Reopen ticket'}
                </button>
              }>
            <div className="thread-meta">
              <Avatar name={sel.userName} />
              <div>
                <b>{sel.userName}</b> <span className="muted">&lt;{sel.userEmail}&gt;</span>
                <small>Category: {sel.category} · opened {GL.fmt.dateTime(sel.createdAt)}</small>
              </div>
            </div>
            <ul className="thread">
              {sel.messages.map((m, i) => (
                <li key={i} className={m.from === 'support' ? 'from-support' : 'from-customer'}>
                  <div className="bubble">
                    <p>{m.text}</p>
                    <small>{m.from === 'support' ? 'Meridian support' : sel.userName} · {GL.fmt.dateTime(m.ts)}</small>
                  </div>
                </li>
              ))}
            </ul>
            <form className="reply-box" onSubmit={sendReply}>
              <div className="field" style={{ marginBottom: 10 }}>
                <label htmlFor="sp-reply">Reply as Meridian support</label>
                <textarea id="sp-reply" rows="3" placeholder="Write your reply…" value={reply}
                  onChange={(e) => setReply(e.target.value)} />
              </div>
              <button type="submit" className={'btn btn-primary' + (busy === 'reply' ? ' is-busy' : '')} disabled={busy === 'reply'}>
                <Icon name="send" size={14} /> Send reply
              </button>
              <span className="reply-note">The customer receives a notification when you reply.</span>
            </form>
          </Panel>
          ) : null}
        </div>
      )}
    </>
  );
}

/* ==========================================================================
   ADMIN ROLES
   ========================================================================== */
export function Roles() {
  const [{ loading, data, error }, refresh] = useFetch(() => GL.api.admin.roles(), []);

  if (loading) return <PageSkeleton variant="page" />;
  if (error) return <ErrorPanel error={error} retry={refresh} />;

  const m = data.matrix;
  const cellTone = (v) =>
    v === 'Blocked' ? 'm-blocked' : v === 'Full' ? 'm-full' : v === 'Edit' ? 'm-edit'
      : v === 'None' ? 'm-none' : 'm-view';

  return (
    <>
      <PageHead icon="key" title="Admin roles"
        sub="Demonstration role model. You are signed in as the Super Administrator (demo)." />

      <Notice tone="info" icon="shield-check">
        <p><b>“Blocked” means enforced in the service layer</b> — not merely hidden from the UI. Every role, including Super Administrator, is rejected with HTTP 403 when attempting a financial mutation (see the Account Viewer's restriction panel or the Audit Log's denied entries).</p>
      </Notice>

      <div className="role-grid">
        {data.roles.map((r) => (
          <div key={r.id} className={'role-card' + (r.id === 'super-admin' ? ' role-you' : '')}>
            <div className="role-head">
              <span className="role-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon(r.id === 'super-admin' ? 'shield-check' : r.id === 'compliance' ? 'search' : r.id === 'support' ? 'ticket' : 'eye', 18) }} />
              <div>
                <h3>{r.name}</h3>
                {r.id === 'super-admin' ? <Chip tone="ok">your role</Chip> : null}
              </div>
            </div>
            <p>{r.desc}</p>
            <div className="role-members">
              {r.members.map((mm) => <span key={mm} className="chip"><Avatar name={mm} /> {mm}</span>)}
            </div>
          </div>
        ))}
      </div>

      <Panel title="Permission matrix">
        <DataTable
          rows={m.rows}
          rowKey={(r) => r.area}
          empty={null}
          columns={[
            { th: 'Area', td: (r) => <b>{r.area}</b> },
            ...m.columns.map((c, i) => ({
              th: c, td: (r) => <span className={'mtx ' + cellTone(r.v[i])}>{r.v[i] === 'Blocked' ? <Icon name="ban" size={12} /> : null}{r.v[i]}</span>
            }))
          ]} />
        <p className="panel-note">Blocked cells are refused by the API for every role — see <code>attemptRestricted</code> rejections in the audit log.</p>
      </Panel>
    </>
  );
}

/* ==========================================================================
   AUDIT LOGS
   ========================================================================== */
export function Audit() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [result, setResult] = useState('all');
  const [{ loading, data, error }, refresh] = useFetch(
    () => GL.api.admin.auditLog({ search: search, result: result === 'all' ? '' : result }),
    [search, result]
  );

  const rows = data || [];
  const denied = rows.filter((a) => a.result === 'denied').length;

  return (
    <>
      <PageHead icon="history" title="Audit logs"
        sub="Every administrative action — allowed and denied — with actor, target and reason."
        actions={<span className="panel-chip">{loading ? 'Loading…' : rows.length + ' entries · ' + denied + ' denied'}</span>} />

      <div className="filter-bar">
        <div className="field field-search">
          <label htmlFor="au-search">Search</label>
          <input id="au-search" type="search" placeholder="Action, target, actor or detail…" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <div className="field">
          <label>Result</label>
          <div className="seg" role="group" aria-label="Filter audit entries by result">
            {['all', 'allowed', 'denied'].map((r) => (
              <button key={r} type="button" className={'seg-btn' + (result === r ? ' on' : '')}
                aria-pressed={result === r} onClick={() => setResult(r)}>{r === 'all' ? 'All' : r}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <PageSkeleton variant="list" /> : error ? <ErrorPanel error={error} retry={refresh} /> : (
        <DataTable
          rows={rows}
          rowKey={(a) => a.id}
          rowClass={(a) => (a.result === 'denied' ? 'tr-denied' : '')}
          empty={<Empty icon="history" title="No audit entries"
            note={search || result !== 'all' ? 'No entries match the current filters.' : 'Administrative actions will be recorded here.'} />}
          columns={[
            { th: 'Time', td: (a) => <span className="td-date">{GL.fmt.dateTime(a.ts)}</span> },
            { th: 'Actor', td: (a) => (<div className="cell-person cell-person-sm"><Avatar name={a.actorName} /><div><b>{a.actorName}</b><small>{a.actor}</small></div></div>) },
            { th: 'Action', td: (a) => <span className="chip chip-mono">{a.action}</span> },
            { th: 'Target', td: (a) => <span className="td-plain">{a.target}</span> },
            { th: 'Detail', td: (a) => <span className="td-desc">{a.detail}</span> },
            { th: 'Result', td: (a) => <Badge status={a.result === 'denied' ? 'failed' : 'successful'} label={a.result} /> }
          ]} />
      )}
    </>
  );
}

/* ==========================================================================
   SETTINGS
   ========================================================================== */
export function Settings() {
  const [{ loading, data, error }, refresh] = useFetch(() => GL.api.admin.settings(), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !form) {
      setForm({ platformName: data.platformName, maintenanceMode: !!data.maintenanceMode, supportEmail: data.supportEmail });
    }
  }, [data, form]);

  if (loading) return <PageSkeleton variant="page" />;
  if (error) return <ErrorPanel error={error} retry={refresh} />;
  if (!form) return null;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await GL.api.admin.updateSettings(form);
      toast(res.message + ' Recorded in the audit log.', 'ok');
      refresh();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead icon="settings" title="Settings"
        sub="Platform-wide configuration (demo). Changes apply to the customer apps on this origin immediately." />

      <div className="grid-side">
        <div className="grid-side-main">
          <Panel title="Platform settings">
            <form onSubmit={save}>
              <div className="field">
                <label htmlFor="st-name">Platform name</label>
                <input id="st-name" value={form.platformName} onChange={(e) => setForm({ ...form, platformName: e.target.value })} />
                <p className="hint">Shown in the customer apps' shell and emails (demo).</p>
              </div>
              <div className="field">
                <label htmlFor="st-email">Support email</label>
                <input id="st-email" type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
                <p className="hint">Displayed on the public contact page and frozen-account screens.</p>
              </div>
              <div className="switch-row">
                <label className="switch">
                  <input type="checkbox" checked={form.maintenanceMode} onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })} />
                  <span className="switch-track" aria-hidden="true" />
                  <span className="switch-label">Maintenance mode</span>
                </label>
                <p className="hint">Shows a thin banner in the customer apps: “Scheduled platform maintenance (demo)”. Sign-in keeps working in this prototype.</p>
              </div>
              <button type="submit" className={'btn btn-primary' + (busy ? ' is-busy' : '')} disabled={busy}>
                Save settings
              </button>
            </form>
          </Panel>
        </div>

        <div className="grid-side-aside">
          <Panel title={<h3 className="panel-title"><Icon name="info" size={15} /> Read-only</h3>}>
            <dl className="detail-grid detail-stack">
              <div><dt>Indicative rates updated</dt><dd>{GL.fmt.dateTime(data.lastRatesUpdate)}</dd></div>
              <div><dt>Console</dt><dd>Hong Kong International Fintech (design 2)</dd></div>
              <div><dt>Data</dt><dd>Demo dataset in this browser's localStorage</dd></div>
            </dl>
            <p className="panel-note">Currency availability is managed in <b>Currency Management</b>; role permissions in <b>Admin Roles</b>. Everything else is fixed by the service layer.</p>
          </Panel>
          <Notice tone="warn" icon="alert">
            <p>This console is part of a design prototype — not a live financial service. All settings and data are demonstration values.</p>
          </Notice>
        </div>
      </div>
    </>
  );
}
