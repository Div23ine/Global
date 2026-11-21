/* ==========================================================================
   MERIDIAN ADMIN — Hong Kong International Fintech (Design 2)
   admin/hongkong/src/pages-core.jsx

   Login · Dashboard · Users · UserViewer (individual account viewer) ·
   Account Takeover. Every view loads through GL.api.admin.* with real
   loading / empty / error states (the mock API has simulated latency).
   ========================================================================== */
import React, { useState, useEffect } from 'react';
import {
  Icon, Badge, StatCard, DataTable, PageSkeleton, Empty, Notice, ErrorPanel,
  Panel, PageHead, toast, useConfirm, useFetch, useChart, useDebounced,
  Avatar, Chip, currencyChip, RestrictedPanel, PALETTE, STATUS_COLORS, kUsd
} from './components.jsx';

const GL = window.GL;

/* ==========================================================================
   LOGIN
   ========================================================================== */
export function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const demo = GL.DEMO_CREDENTIALS.admin;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await GL.api.admin.login(email, password);
      toast(res.message + ' Welcome back, ' + res.data.admin.name + '.', 'ok');
      onLogin();
    } catch (err) {
      setError(err.message || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-viewport">
      <a className="skip-link" href="#main"
        onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); if (m) m.focus(); }}>Skip to content</a>
      <div className="auth-wrap">
        <main id="main">
          <div className="auth-brand">
            <span className="brand-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon('globe', 20) }} />
            <span className="brand-text">Meridian <small>ADMIN CONSOLE</small></span>
          </div>
          <div className="auth-card">
            <div className="auth-head">
              <span className="auth-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon('shield-check', 26) }} />
              <h2>Administrator sign in</h2>
              <p>Meridian Global Accounts · operations console (demo)</p>
            </div>
            {error ? (
              <div className="form-error" role="alert">
                <Icon name="x-circle" size={16} /> {error}
              </div>
            ) : null}
            <form onSubmit={submit} noValidate>
              <div className="field">
                <label htmlFor="adm-email">Email address</label>
                <input id="adm-email" type="email" autoComplete="username" value={email}
                  placeholder="you@meridian.example" onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="adm-pass">Password</label>
                <input id="adm-pass" type="password" autoComplete="current-password" value={password}
                  placeholder="••••••••" onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button type="submit" className={'btn btn-primary btn-block' + (busy ? ' is-busy' : '')} disabled={busy}>
                {busy ? 'Signing in…' : <><Icon name="logout" size={15} /> Sign in</>}
              </button>
            </form>
            <div className="demo-fill">
              <p className="demo-fill-note">
                <Icon name="info" size={14} />
                Demo environment — administrator credentials are shown here and pre-filled on request.
              </p>
              <div className="demo-creds">
                <div><span>Email</span><code>{demo.email}</code></div>
                <div><span>Password</span><code>{demo.password}</code></div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm btn-block"
                onClick={() => { setEmail(demo.email); setPassword(demo.password); setError(null); }}>
                <Icon name="key" size={14} /> Use demo credentials
              </button>
            </div>
          </div>
          <p className="auth-foot">
            Design prototype — not a live financial service.<br />
            <a href="../../customer/hongkong/index.html">Open the customer demo site</a>
          </p>
        </main>
      </div>
    </div>
  );
}

/* ==========================================================================
   DASHBOARD
   ========================================================================== */
export function Dashboard({ navigate }) {
  const [{ loading, data, error }, refresh] = useFetch(() => GL.api.admin.dashboard(), []);
  const confirm = useConfirm();

  const depRef = useChart((cv) => GL.charts.line(cv, {
    values: data.series.depositsByDay.map((d) => d.v),
    labels: data.series.depositsByDay.map((d) => GL.fmt.monthShort(d.t)),
    color: '#1F6FEB',
    yFmt: kUsd,
    tipFmt: (v) => GL.fmt.usd(v)
  }), [data]);
  const donutRef = useChart((cv) => GL.charts.donut(cv, {
    segments: data.series.currencyDist.map((c, i) => ({ value: c.v, color: PALETTE[i % PALETTE.length], label: c.code })),
    centre: 'USD eq.'
  }), [data]);
  const SHORT_OUTCOME = { successful: 'succ.', pending: 'pend.', failed: 'failed', cancelled: 'canc.', duplicate: 'dup.' };
  const mixRef = useChart((cv) => GL.charts.bars(cv, {
    values: data.series.outcomeMix.map((x) => x.count),
    labels: data.series.outcomeMix.map((x) => SHORT_OUTCOME[x.status] || x.status),
    colors: data.series.outcomeMix.map((x) => STATUS_COLORS[x.status] || '#1F6FEB'),
    yFmt: (v) => Math.round(v),
    tipFmt: (v) => v + ' attempts'
  }), [data]);

  if (loading) return <PageSkeleton variant="charts" />;
  if (error) return <ErrorPanel error={error} retry={refresh} />;

  const k = data.kpis;
  const donutTotal = data.series.currencyDist.reduce((s, c) => s + c.v, 0);

  return (
    <>
      <PageHead icon="dashboard" title="Platform overview"
        sub="Live view of the demo dataset — every figure below is sample data held in this browser."
        actions={<button className="btn btn-ghost btn-sm" onClick={refresh}><Icon name="refresh" size={14} /> Refresh</button>} />

      <section className="kpi-hero" aria-label="Key platform metrics">
        <div className="kpi-hero-main">
          <span className="kpi-hero-label"><Icon name="trend-up" size={15} /> Total volume · USD equivalent</span>
          <strong className="kpi-hero-value">{GL.fmt.usd(k.volumeUsd)}</strong>
          <span className="kpi-hero-sub">Across all customer accounts · demo data, no real funds</span>
        </div>
        <div className="kpi-hero-stats">
          <div><b>{k.totalUsers}</b><span>Total users</span></div>
          <div><b>{k.activeUsers}</b><span>Active</span></div>
          <div><b>{k.frozenUsers}</b><span>Frozen</span></div>
          <div><b>{k.pendingDeposits}</b><span>Pending deposits</span></div>
        </div>
      </section>

      <div className="stat-row">
        <StatCard icon="alert" tone="danger" label="Suspicious events" value={k.suspiciousEvents} sub="Flagged in the security feed" />
        <StatCard icon="ticket" tone="info" label="Open support tickets" value={k.openTickets} sub="Awaiting a reply" />
        <StatCard icon="coins" tone="success" label="Currencies in use" value={data.series.currencyDist.length} sub="Holding customer balances" />
      </div>

      <div className="grid-main">
        <Panel title="Successful deposits · last 30 days"
          actions={<span className="panel-chip"><Icon name="chart" size={13} /> USD equivalent</span>}>
          <canvas ref={depRef} className="chart chart-lg" role="img" aria-label="Area chart of successful deposit volume in USD over the last 30 days" />
        </Panel>
        <Panel title="Currency distribution"
          actions={<span className="panel-chip">{data.series.currencyDist.length} currencies</span>}>
          <canvas ref={donutRef} className="chart chart-donut" role="img" aria-label="Donut chart of customer balances by currency" />
          <ul className="chart-legend">
            {data.series.currencyDist.map((c, i) => (
              <li key={c.code}>
                <span className="legend-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                <b>{c.code}</b>
                <span>{GL.fmt.usd(c.v)}</span>
                <em>{Math.round((c.v / (donutTotal || 1)) * 100)}%</em>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid-main">
        <Panel title="Payment outcome mix" actions={<span className="panel-chip">All attempts</span>}>
          <canvas ref={mixRef} className="chart chart-mid" role="img" aria-label="Bar chart of payment attempts by outcome" />
          <div className="chart-chips">
            {data.series.outcomeMix.map((x) => (
              <span key={x.status} className={'badge b-' + x.status}>{x.status} · {x.count}</span>
            ))}
          </div>
        </Panel>
        <Panel title="Recent users"
          actions={<button className="panel-link" onClick={() => navigate('#/users')}>All users <Icon name="arrow-r" size={13} /></button>}>
          <DataTable
            rows={data.recentUsers}
            rowKey={(u) => u.id}
            onRowClick={(u) => navigate('#/users/' + u.id)}
            empty={<Empty icon="users" title="No customers yet" note="New registrations will appear here." />}
            columns={[
              { th: 'Customer', td: (u) => (<div className="cell-person"><Avatar name={u.name} /><div><b>{u.name}</b><small>{u.email}</small></div></div>) },
              { th: 'Status', td: (u) => <Badge status={u.status} /> },
              { th: 'Joined', td: (u) => <span className="td-date">{GL.fmt.date(u.createdAt)}</span> },
              { th: 'Volume', align: 'right', td: (u) => <span className="td-amount">{GL.fmt.usd(u.totalUsd)}</span> }
            ]} />
        </Panel>
      </div>

      <div className="grid-two">
        <Panel title="Pending deposits"
          actions={<button className="panel-link" onClick={() => navigate('#/deposits')}>Deposit management <Icon name="arrow-r" size={13} /></button>}>
          {data.pendingDeposits.length ? (
            <ul className="mini-list">
              {data.pendingDeposits.map((d) => (
                <li key={d.reference}>
                  <div className="mini-list-main">
                    <code>{d.reference}</code>
                    <small>{d.userName} · {d.methodName}</small>
                  </div>
                  <div className="mini-list-side">
                    <b>{GL.fmt.money(d.amount, d.currency)}</b>
                    <Badge status={d.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty icon="wallet" title="No pending deposits" note="Deposits awaiting confirmation will appear here." />}
          <p className="panel-note">Administrators can monitor but never confirm or alter deposits.</p>
        </Panel>
        <Panel title="Recent payment attempts"
          actions={<button className="panel-link" onClick={() => navigate('#/payments')}>Payment monitoring <Icon name="arrow-r" size={13} /></button>}>
          {data.recentPayments.length ? (
            <ul className="mini-list">
              {data.recentPayments.map((p) => (
                <li key={p.id}>
                  <div className="mini-list-main">
                    <code>{p.reference}</code>
                    <small>{p.userName} · {p.methodName} · {p.durationMs} ms</small>
                  </div>
                  <div className="mini-list-side">
                    <b>{p.amount != null ? GL.fmt.money(p.amount, p.currency) : '—'}</b>
                    <Badge status={p.outcome} />
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty icon="card" title="No payment attempts" note="Gateway attempts will appear here." />}
        </Panel>
      </div>
    </>
  );
}

/* ==========================================================================
   USERS
   ========================================================================== */
export function Users({ navigate }) {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [status, setStatus] = useState('all');
  const [country, setCountry] = useState('');
  const [{ loading, data, error }, refresh] = useFetch(
    () => GL.api.admin.users({ search: search, status: status === 'all' ? '' : status, country: country }),
    [search, status, country]
  );

  return (
    <>
      <PageHead icon="users" title="User management"
        sub="Search, filter and inspect every customer account in the demo dataset."
        actions={<span className="panel-chip">{loading ? 'Loading…' : (data ? data.length : 0) + ' customers'}</span>} />

      <div className="filter-bar">
        <div className="field field-search">
          <label htmlFor="usr-search">Search</label>
          <input id="usr-search" type="search" placeholder="Name, email or country…" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="usr-country">Country</label>
          <select id="usr-country" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All countries</option>
            {GL.COUNTRIES.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <div className="seg" role="group" aria-label="Filter by status">
            {['all', 'active', 'frozen'].map((s) => (
              <button key={s} type="button" className={'seg-btn' + (status === s ? ' on' : '')}
                aria-pressed={status === s} onClick={() => setStatus(s)}>{s === 'all' ? 'All' : s}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <PageSkeleton variant="list" /> : error ? <ErrorPanel error={error} retry={refresh} /> : (
        <DataTable
          rows={data}
          rowKey={(u) => u.id}
          onRowClick={(u) => navigate('#/users/' + u.id)}
          empty={<Empty icon="users" title="No customers found"
            note={search || status !== 'all' || country ? 'No accounts match the current filters. Try clearing them.' : 'No customer accounts exist yet — register one from the customer app.'} />}
          columns={[
            { th: 'Customer', td: (u) => (
              <div className="cell-person">
                <Avatar name={u.name} />
                <div>
                  <a className="rowlink" href={'#/users/' + u.id} onClick={(e) => e.stopPropagation()}>{u.name}</a>
                  <small>{u.email}</small>
                </div>
              </div>
            ) },
            { th: 'Country', td: (u) => <span className="td-plain">{u.country}</span> },
            { th: 'Currencies', td: (u) => <span className="chip-row">{u.currencies.map(currencyChip)}</span> },
            { th: 'Status', td: (u) => <Badge status={u.status} /> },
            { th: 'Joined', td: (u) => <span className="td-date">{GL.fmt.date(u.createdAt)}</span> },
            { th: 'Volume (USD)', align: 'right', td: (u) => <span className="td-amount">{GL.fmt.usd(u.totalUsd)}</span> }
          ]} />
      )}
    </>
  );
}

/* ==========================================================================
   USER VIEWER — individual account
   ========================================================================== */
export function UserViewer({ route, navigate, session, refreshSession }) {
  const id = route.id;
  const confirm = useConfirm();
  const [{ loading, data, error }, refresh] = useFetch(() => GL.api.admin.user(id), [id]);
  const [curSt] = useFetch(() => GL.api.admin.currencies(), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState('');
  const [notif, setNotif] = useState({ title: '', body: '' });
  const [activateCode, setActivateCode] = useState('');

  useEffect(() => {
    if (data && data.user) {
      setForm({
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        phone: data.user.phone || '',
        address: data.user.address || ''
      });
    }
  }, [data]);

  if (loading) return <PageSkeleton variant="page" />;
  if (error) return <ErrorPanel error={error} retry={refresh} />;

  const u = data.user;
  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      const res = await fn();
      toast(okMsg || res.message, 'ok');
      return res;
    } catch (err) {
      toast(err.message, 'err');
      return null;
    } finally {
      setBusy('');
    }
  };

  /* ---- takeover ---- */
  const enterTakeover = async () => {
    const ok = await confirm({
      title: 'Enter takeover mode?',
      tone: 'warn',
      confirmLabel: 'Enter takeover mode',
      body: 'You will be redirected to ' + u.name + "'s account in the customer app (this design concept).",
      list: [
        'Read access to the account, plus permitted profile edits (name, phone, address).',
        'Financial operations stay blocked — enforced in the service layer, not by hiding buttons.',
        'The customer is NOT notified automatically. Every takeover is written to the audit log.'
      ]
    });
    if (!ok) return;
    const res = await run('takeover', () => GL.api.admin.takeover(u.id, 'hongkong'));
    if (res) window.location.href = res.data.redirect;
  };

  /* ---- freeze / unfreeze ---- */
  const freeze = async () => {
    const reason = await confirm({
      title: 'Freeze ' + u.name + "'s account?",
      tone: 'danger',
      confirmLabel: 'Freeze account',
      withReason: 'Reason (recorded in the audit log)',
      placeholder: 'e.g. Suspicious login pattern — pending security review',
      body: 'The customer will be blocked from signing in and shown this reason. The customer is not notified automatically.'
    });
    if (reason === null) return;
    await run('freeze', () => GL.api.admin.freezeUser(u.id, reason || 'Security review'));
    refresh();
  };
  const unfreeze = async () => {
    const reason = await confirm({
      title: 'Unfreeze ' + u.name + "'s account?",
      tone: 'primary',
      confirmLabel: 'Unfreeze account',
      withReason: 'Note for the audit log (optional)',
      body: 'Full access will be restored immediately.'
    });
    if (reason === null) return;
    await run('unfreeze', () => GL.api.admin.unfreezeUser(u.id, reason));
    refresh();
  };

  /* ---- currencies ---- */
  const activatable = (curSt.data || []).filter(
    (c) => c.status === 'active' && !data.accounts.some((a) => a.code === c.code)
  );
  const activate = async () => {
    if (!activateCode) return;
    await run('activate', () => GL.api.admin.setUserCurrency(u.id, activateCode, 'activate'));
    setActivateCode('');
    refresh();
  };
  const deactivate = async (code) => {
    const ok = await confirm({
      title: 'Deactivate the ' + code + ' account?',
      tone: 'warn',
      confirmLabel: 'Deactivate ' + code,
      body: 'This only works while the ' + code + ' balance is exactly zero — the service layer rejects anything else (NON_ZERO_BALANCE).'
    });
    if (!ok) return;
    await run('deactivate', () => GL.api.admin.setUserCurrency(u.id, code, 'deactivate'));
    refresh();
  };

  /* ---- permitted profile edit ---- */
  const saveProfile = async (e) => {
    e.preventDefault();
    await run('profile', () => GL.api.admin.updateProfile(u.id, form));
    refresh();
  };

  /* ---- manual notification ---- */
  const sendNotif = async (e) => {
    e.preventDefault();
    if (!notif.body) { toast('Write a message before sending.', 'err'); return; }
    const res = await run('notify', () => GL.api.admin.notifyUser(u.id, notif));
    if (res) setNotif({ title: '', body: '' });
  };

  return (
    <>
      <button className="backlink" onClick={() => navigate('#/users')}>
        <Icon name="chevron-l" size={14} /> Back to user management
      </button>

      <header className="user-hero">
        <Avatar name={u.name} size="lg" />
        <div className="user-hero-main">
          <div className="user-hero-name">
            <h2>{u.name}</h2>
            <Badge status={u.status} />
            {u.mfaEnabled ? <Chip tone="ok">MFA on</Chip> : <Chip tone="warn">MFA off</Chip>}
          </div>
          <dl className="user-hero-meta">
            <div><dt>Email</dt><dd>{u.email}</dd></div>
            <div><dt>Account ID</dt><dd><code>{u.accountId}</code></dd></div>
            <div><dt>Country</dt><dd>{u.country}</dd></div>
            <div><dt>Default</dt><dd>{u.defaultCurrency}</dd></div>
            <div><dt>Joined</dt><dd>{GL.fmt.date(u.createdAt)}</dd></div>
            <div><dt>Total (USD eq.)</dt><dd><b>{GL.fmt.usd(data.totalUsd)}</b></dd></div>
          </dl>
          {u.status === 'frozen' ? (
            <p className="freeze-reason"><Icon name="snowflake" size={15} />
              Frozen {u.frozenAt ? GL.fmt.timeAgo(u.frozenAt) : ''} by {u.frozenBy || 'an administrator'} — “{u.freezeReason}”</p>
          ) : null}
        </div>
        <div className="user-hero-actions">
          <button className="btn btn-primary" onClick={enterTakeover} disabled={busy === 'takeover'}>
            <Icon name="eye" size={15} /> Enter takeover mode
          </button>
          {u.status === 'frozen' ? (
            <button className="btn btn-ghost" onClick={unfreeze} disabled={busy === 'unfreeze'}>
              <Icon name="check-circle" size={15} /> Unfreeze account
            </button>
          ) : (
            <button className="btn btn-danger" onClick={freeze} disabled={busy === 'freeze'}>
              <Icon name="snowflake" size={15} /> Freeze account
            </button>
          )}
        </div>
      </header>

      <div className="grid-side">
        <div className="grid-side-main">
          <Panel title="Accounts & balances"
            actions={<span className="panel-chip"><Icon name="eye" size={13} /> View only</span>}>
            {data.accounts.length ? (
              <DataTable
                rows={data.accounts}
                rowKey={(a) => a.code}
                empty={null}
                columns={[
                  { th: 'Currency', td: (a) => (<span className="cell-cur"><b>{a.code}</b><small>{a.name}</small></span>) },
                  { th: 'Status', td: (a) => <Badge status={a.status} /> },
                  { th: 'Balance', align: 'right', td: (a) => <span className="td-amount">{GL.fmt.money(a.balance, a.code)}</span> },
                  { th: 'USD eq.', align: 'right', td: (a) => <span className="td-amount muted">{GL.fmt.usd(a.equivalentUsd)}</span> },
                  { th: 'Txns', align: 'right', td: (a) => a.txCount },
                  { th: 'Opened', td: (a) => <span className="td-date">{GL.fmt.date(a.openedAt)}</span> },
                  { th: '', align: 'right', td: (a) => (
                    <button className="btn btn-ghost btn-sm" onClick={() => deactivate(a.code)} disabled={busy === 'deactivate'}>
                      <Icon name="minus" size={13} /> Deactivate
                    </button>
                  ) }
                ]} />
            ) : <Empty icon="wallet" title="No currency accounts" note="Activate a currency below to create this customer's first account." />}
            <div className="activate-row">
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="act-cur">Activate a currency for this customer</label>
                <select id="act-cur" value={activateCode} onChange={(e) => setActivateCode(e.target.value)}>
                  <option value="">Select currency…</option>
                  {activatable.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </select>
              </div>
              <button className="btn btn-ghost" onClick={activate} disabled={!activateCode || busy === 'activate'}>
                <Icon name="plus" size={15} /> Activate (zero balance)
              </button>
            </div>
            <p className="panel-note">Activation creates an account with a zero balance. Deactivation is rejected by the service layer while any balance remains.</p>
          </Panel>

          <Panel title="Recent transactions">
            <DataTable
              rows={data.transactions}
              rowKey={(t) => t.ref}
              empty={<Empty icon="receipt" title="No transactions" note="This customer has no ledger activity yet." />}
              columns={[
                { th: 'Reference', td: (t) => <code>{t.ref}</code> },
                { th: 'Description', td: (t) => <span className="td-desc">{t.description || '—'}</span> },
                { th: 'Currency', td: (t) => <Chip>{t.currency}</Chip> },
                { th: 'Amount', align: 'right', td: (t) => <span className={'td-amount ' + (t.amount < 0 ? 'neg' : 'pos')}>{GL.fmt.money(t.amount, t.currency)}</span> },
                { th: 'Status', td: (t) => <Badge status={t.status} /> },
                { th: 'Date', td: (t) => <span className="td-date">{GL.fmt.dateTime(t.ts)}</span> }
              ]} />
          </Panel>

          <Panel title="Deposits">
            <DataTable
              rows={data.deposits}
              rowKey={(d) => d.reference}
              empty={<Empty icon="wallet" title="No deposits" note="Deposit attempts by this customer will appear here." />}
              columns={[
                { th: 'Reference', td: (d) => <code>{d.reference}</code> },
                { th: 'Amount', align: 'right', td: (d) => <span className="td-amount">{GL.fmt.money(d.amount, d.currency)}</span> },
                { th: 'Method', td: (d) => d.methodName },
                { th: 'Status', td: (d) => <Badge status={d.status} /> },
                { th: 'Created', td: (d) => <span className="td-date">{GL.fmt.date(d.createdAt)}</span> }
              ]} />
          </Panel>

          <div className="grid-two">
            <Panel title="Sessions">
              {data.sessions.length ? (
                <ul className="mini-list">
                  {data.sessions.map((s) => (
                    <li key={s.id}>
                      <div className="mini-list-main">
                        <b>{s.device} · {s.browser} / {s.os}</b>
                        <small>{s.ip} · {s.location}</small>
                      </div>
                      <div className="mini-list-side">
                        <Badge status={s.status} />
                        <small>{s.current ? 'This device' : GL.fmt.timeAgo(s.lastActive)}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <Empty icon="smartphone" title="No sessions" note="No sign-in sessions are recorded for this customer." />}
            </Panel>
            <Panel title="Security events">
              {data.securityEvents.length ? (
                <ul className="feed feed-tight">
                  {data.securityEvents.slice(0, 6).map((ev) => <FeedItem key={ev.id} ev={ev} />)}
                </ul>
              ) : <Empty icon="shield" title="No security events" note="Nothing has been flagged for this customer." />}
            </Panel>
          </div>
        </div>

        <div className="grid-side-aside">
          <Panel title={<h3 className="panel-title"><Icon name="edit" size={15} /> Permitted profile edits</h3>}
            actions={<Chip>whitelisted fields</Chip>}>
            <form onSubmit={saveProfile}>
              <div className="field">
                <label htmlFor="pf-first">First name</label>
                <input id="pf-first" value={form ? form.firstName : ''} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="pf-last">Last name</label>
                <input id="pf-last" value={form ? form.lastName : ''} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="pf-phone">Phone</label>
                <input id="pf-phone" value={form ? form.phone : ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="pf-addr">Address</label>
                <textarea id="pf-addr" rows="2" value={form ? form.address : ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <button type="submit" className={'btn btn-primary btn-block' + (busy === 'profile' ? ' is-busy' : '')} disabled={busy === 'profile'}>
                Save changes
              </button>
            </form>
            <p className="panel-note">Only these four fields can be edited by an administrator. Email, country and anything financial are rejected by the service layer. The customer is not notified automatically — use the manual notification below.</p>
          </Panel>

          <Panel title={<h3 className="panel-title"><Icon name="bell" size={15} /> Manual notification</h3>}>
            <form onSubmit={sendNotif}>
              <div className="field">
                <label htmlFor="nt-title">Title</label>
                <input id="nt-title" placeholder="e.g. Account update" value={notif.title}
                  onChange={(e) => setNotif({ ...notif, title: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="nt-body">Message</label>
                <textarea id="nt-body" rows="3" placeholder="Write the message the customer will see…" value={notif.body}
                  onChange={(e) => setNotif({ ...notif, body: e.target.value })} />
              </div>
              <button type="submit" className={'btn btn-ghost btn-block' + (busy === 'notify' ? ' is-busy' : '')} disabled={busy === 'notify'}>
                <Icon name="send" size={14} /> Send notification
              </button>
            </form>
            <p className="panel-note"><b>Manual</b> — the customer is not notified automatically. Manual sends are recorded in the audit log.</p>
          </Panel>

          <RestrictedPanel
            payload={(op) => ({ userId: u.id, detail: 'attempted from the account viewer' })}
            intro={'Attempts against ' + u.name + "'s money are always rejected — try any of them:"}
            ops={[
              { op: 'edit_balance', label: 'Edit balance' },
              { op: 'withdraw', label: 'Withdraw' },
              { op: 'transfer', label: 'Transfer' },
              { op: 'alter_deposit', label: 'Alter deposit confirmation' },
              { op: 'edit_ledger', label: 'Edit ledger entry' }
            ]} />
        </div>
      </div>
    </>
  );
}

/* ==========================================================================
   ACCOUNT TAKEOVER
   ========================================================================== */
export function Takeover({ session, refreshSession, navigate }) {
  const confirm = useConfirm();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [usersSt, refreshUsers] = useFetch(() => GL.api.admin.users({ search: search }), [search]);
  const [auditSt, refreshAudit] = useFetch(() => GL.api.admin.auditLog({}), []);
  const [busy, setBusy] = useState('');
  const active = session && session.kind === 'takeover';

  const enter = async (u) => {
    const ok = await confirm({
      title: 'Enter takeover mode for ' + u.name + '?',
      tone: 'warn',
      confirmLabel: 'Enter takeover mode',
      body: 'You will be redirected to this customer\'s account inside the customer app.',
      list: [
        'Read access plus permitted profile edits (name, phone, address).',
        'Financial operations remain blocked for administrators.',
        'The customer is not notified automatically; the session is audited.'
      ]
    });
    if (!ok) return;
    setBusy(u.id);
    try {
      const res = await GL.api.admin.takeover(u.id, 'hongkong');
      window.location.href = res.data.redirect;
    } catch (err) {
      toast(err.message, 'err');
      setBusy('');
    }
  };

  const end = async () => {
    setBusy('end');
    try {
      const res = await GL.api.admin.endTakeover();
      toast(res.message, 'ok');
      refreshSession();
      refreshAudit();
      navigate('#/dashboard');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusy('');
    }
  };

  const history = (auditSt.data || []).filter((a) => a.action === 'takeover_start' || a.action === 'takeover_end');

  return (
    <>
      <PageHead icon="eye" title="Account takeover"
        sub="View a customer's account inside the customer app — read access plus permitted edits, with every session audited." />

      {active ? (
        <Notice tone="warn" icon="eye" title="Takeover session active">
          <p>An administrative takeover is currently open for user <code>{session.userId}</code>. You are viewing their account in the customer app — end it from the customer app banner or right here.</p>
          <div className="notice-actions">
            <button className="btn btn-primary btn-sm" onClick={end} disabled={busy === 'end'}><Icon name="x" size={14} /> End takeover</button>
          </div>
        </Notice>
      ) : null}

      <div className="grid-side">
        <div className="grid-side-main">
          <Panel title="Customers"
            actions={<span className="panel-chip">{usersSt.loading ? 'Loading…' : (usersSt.data ? usersSt.data.length : 0) + ' accounts'}</span>}>
            <div className="field field-search" style={{ marginBottom: 14 }}>
              <label htmlFor="tk-search">Search customers</label>
              <input id="tk-search" type="search" placeholder="Name, email or country…" value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)} />
            </div>
            {usersSt.loading ? <PageSkeleton variant="list" /> : usersSt.error ? <ErrorPanel error={usersSt.error} retry={refreshUsers} /> : (
              <DataTable
                rows={usersSt.data}
                rowKey={(u) => u.id}
                empty={<Empty icon="users" title="No customers found" note="No accounts match your search." />}
                columns={[
                  { th: 'Customer', td: (u) => (
                    <div className="cell-person">
                      <Avatar name={u.name} />
                      <div><b>{u.name}</b><small>{u.email}</small></div>
                    </div>
                  ) },
                  { th: 'Status', td: (u) => <Badge status={u.status} /> },
                  { th: 'Volume (USD)', align: 'right', td: (u) => <span className="td-amount">{GL.fmt.usd(u.totalUsd)}</span> },
                  { th: '', align: 'right', td: (u) => (
                    <button className="btn btn-ghost btn-sm" onClick={() => enter(u)} disabled={busy === u.id}>
                      <Icon name="eye" size={13} /> Enter takeover
                    </button>
                  ) }
                ]} />
            )}
          </Panel>

          <Panel title="Takeover history" actions={<span className="panel-chip">from the audit log</span>}>
            {auditSt.loading ? <PageSkeleton variant="list" /> : auditSt.error ? <ErrorPanel error={auditSt.error} retry={refreshAudit} /> : (
              history.length ? (
                <ul className="feed feed-tight">
                  {history.map((a) => (
                    <li key={a.id} className={'feed-item' + (a.action === 'takeover_start' ? ' feed-start' : '')}>
                      <span className="feed-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon(a.action === 'takeover_start' ? 'eye' : 'x-circle', 16) }} />
                      <div className="feed-main">
                        <b>{a.actorName}</b> — {a.action === 'takeover_start' ? 'started' : 'ended'} a takeover session
                        <small>{a.target} · {a.detail}</small>
                      </div>
                      <span className="td-date">{GL.fmt.dateTime(a.ts)}</span>
                    </li>
                  ))}
                </ul>
              ) : <Empty icon="history" title="No takeover sessions yet" note="Started and ended takeovers are recorded here." />
            )}
          </Panel>
        </div>

        <div className="grid-side-aside">
          <Panel title={<h3 className="panel-title"><Icon name="shield-check" size={15} /> Takeover policy</h3>}>
            <ul className="policy-list">
              <li><Icon name="eye" size={14} /> <b>Read + permitted edits.</b> Administrators can view the full account and edit only name, phone and address.</li>
              <li><Icon name="ban" size={14} /> <b>Financial operations blocked.</b> Balances, withdrawals, transfers, deposit confirmations and ledger entries cannot be touched — enforced in the service layer.</li>
              <li><Icon name="bell" size={14} /> <b>No automatic notification.</b> The customer is not told a takeover happened; administrators may send a manual notification and must have a reason.</li>
              <li><Icon name="history" size={14} /> <b>Fully audited.</b> Start, end and every action inside a takeover are written to the audit log.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ shared piece */
export function FeedItem({ ev }) {
  const ICONS = { login: 'key', login_failed: 'alert', account_frozen: 'snowflake', password_change: 'lock', mfa_disabled: 'shield', mfa_enabled: 'shield-check' };
  return (
    <li className={'feed-item' + (ev.suspicious ? ' susp' : '')}>
      <span className="feed-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon(ICONS[ev.type] || 'shield', 16) }} />
      <div className="feed-main">
        <b>{ev.type.replace(/_/g, ' ')}</b>
        <small>{ev.userName} · {ev.device}</small>
        <small>{ev.detail}</small>
      </div>
      <div className="feed-side">
        {ev.suspicious ? <span className="badge b-failed">suspicious</span> : null}
        <span className="td-date">{GL.fmt.timeAgo(ev.ts)}</span>
      </div>
    </li>
  );
}
