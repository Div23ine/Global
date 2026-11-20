/* ============================================================================
   MERIDIAN ADMIN — CONCEPT 03 · PREMIUM GLOBAL FINANCIAL PLATFORM
   admin/premium/src/pages-core.jsx

   Core pages: Login, Dashboard, Users, UserViewer (individual account viewer
   with permitted edits, takeover, freeze, financial-restrictions demo) and
   the Account Takeover page. All calls go through window.GL.api.admin.*
   (simulated latency — skeletons are real loading states).
   ========================================================================== */
import { useEffect, useState } from 'react';
import {
  Badge, Chart, ConfirmDialog, DataTable, Empty, ErrorPanel, Field, Icon, PageHead,
  PageSkeleton, OUTCOME_COLORS, PALETTE, StatCard, fail, toast, useAsync, useDebounced
} from './components.jsx';

const GL = () => window.GL;

/* --------------------------------------------------------------------------
   LOGIN
   -------------------------------------------------------------------------- */
export function Login({ onAuthed, theme, onFlipTheme }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const demo = GL().DEMO_CREDENTIALS.admin;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!email.trim() || !password) { setError('Enter your email and password to continue.'); return; }
    setBusy(true);
    try {
      const res = await GL().api.admin.login(email.trim(), password);
      toast(res.message || 'Signed in.', 'ok');
      onAuthed(res);
    } catch (err) {
      setError(err.message || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setEmail(demo.email);
    setPassword(demo.password);
    setError('');
  };

  return (
    <div className="auth-wrap">
      <div className="auth-top">
        <span className="brand">
          <span className="brand-badge" aria-hidden="true">M</span>
          <span className="brand-name"><b>Meridian</b><small>Admin console</small></span>
        </span>
        <button type="button" className="theme-toggle" aria-pressed={theme === 'dark' ? 'true' : 'false'}
          aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
          title="Toggle dark / light theme" onClick={onFlipTheme}>
          <span className="tt-sun" dangerouslySetInnerHTML={{ __html: GL().icon('sun', 17) }} />
          <span className="tt-moon" dangerouslySetInnerHTML={{ __html: GL().icon('moon', 17) }} />
        </button>
      </div>
      <div className="auth-center">
        <div className="auth-card">
          <div className="eyebrow">Administrator access</div>
          <h1 className="auth-title display">Sign in to the console</h1>
          <p className="auth-lead">Meridian Global Accounts — administration console for the Premium Global Financial Platform design concept.</p>
          {error && <div className="form-err" role="alert"><Icon name="alert" size={15} /> {error}</div>}
          <form onSubmit={submit} noValidate>
            <Field label="Email" htmlFor="login-email">
              <input id="login-email" type="email" autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@meridian.example"
                aria-invalid={error ? 'true' : 'false'} />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <input id="login-password" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Your password"
                aria-invalid={error ? 'true' : 'false'} />
            </Field>
            <button type="submit" className={'btn btn-primary btn-block' + (busy ? ' is-busy' : '')} disabled={busy}>
              Sign in
            </button>
          </form>
          <div className="demo-box">
            <div className="demo-box-head"><Icon name="key" size={13} /> Demo credentials</div>
            <div className="demo-cred">
              <span className="mono">{demo.email}</span>
              <span className="mono">{demo.password}</span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm btn-block demo-fill" onClick={fillDemo}>
              <Icon name="check" size={13} /> Use demo credentials
            </button>
            <p className="demo-note">Demo environment — sample data held in your browser only. This console is part of a design prototype, not a live financial service.</p>
          </div>
        </div>
      </div>
      <footer className="auth-foot">
        <p>Design prototype — not a live financial service. Meridian provides platform accounts, not bank accounts.</p>
      </footer>
    </div>
  );
}

/* --------------------------------------------------------------------------
   DASHBOARD
   -------------------------------------------------------------------------- */
function compactUsd(v) {
  const n = Number(v) || 0;
  return n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + Math.round(n);
}

export function Dashboard() {
  const { data, loading, error } = useAsync(() => GL().api.admin.dashboard(), []);
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorPanel error={error} />;
  const k = data.kpis;
  const fmt = GL().fmt;

  return (
    <div>
      <PageHead eyebrow="Overview" title="Dashboard"
        sub="Platform-wide activity across customers, deposits and payments — demonstration data stored in your browser." />

      <section className="kpi-hero" aria-label="Headline figures">
        <div className="eyebrow">Platform at a glance</div>
        <div className="kpi-nums">
          <div className="kpi-num"><span>Customers</span><b>{fmt.num(k.totalUsers)}</b></div>
          <div className="kpi-num"><span>Volume held (USD)</span><b>{fmt.usd(k.volumeUsd)}</b></div>
          <div className="kpi-num"><span>Pending deposits</span><b>{fmt.num(k.pendingDeposits)}</b></div>
        </div>
        <div className="kpi-hero-foot">
          <span><b>{k.activeUsers}</b> active</span>
          <span><b>{k.frozenUsers}</b> frozen</span>
          <span><b>{k.openTickets}</b> open tickets</span>
          <span><b>{k.suspiciousEvents}</b> suspicious events</span>
          <span className="kpi-demo">All figures are demonstration data — no real money is involved.</span>
        </div>
      </section>

      <div className="kpi-grid">
        <StatCard icon="users" tone="t-success" label="Active customers" value={fmt.num(k.activeUsers)} sub="In good standing" />
        <StatCard icon="snowflake" tone="t-danger" label="Frozen accounts" value={fmt.num(k.frozenUsers)} sub="Security holds" />
        <StatCard icon="ticket" tone="t-warn" label="Open tickets" value={fmt.num(k.openTickets)} sub="Awaiting support" />
        <StatCard icon="shield" tone="t-violet" label="Suspicious events" value={fmt.num(k.suspiciousEvents)} sub="Flagged in the security feed" />
      </div>

      <div className="cols-2">
        <div className="col">
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Successful deposits — last 30 days</h2>
              <span className="small muted nowrap">USD equivalent per day</span>
            </div>
            <Chart height={230} deps={[data]} draw={(c) => GL().charts.line(c, {
              values: data.series.depositsByDay.map((d) => d.v),
              labels: data.series.depositsByDay.map((d) => fmt.monthShort(d.t)),
              color: PALETTE[0],
              yFmt: compactUsd,
              tipFmt: (v) => fmt.usd(v)
            })} />
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Deposit outcomes</h2>
              <span className="small muted nowrap">All payment attempts</span>
            </div>
            <Chart height={190} deps={[data]} draw={(c) => GL().charts.bars(c, {
              values: data.series.outcomeMix.map((o) => o.count),
              labels: data.series.outcomeMix.map((o) => o.status),
              colors: data.series.outcomeMix.map((o) => OUTCOME_COLORS[o.status] || PALETTE[0]),
              color: PALETTE[0],
              yFmt: (v) => Math.round(v)
            })} />
            <div className="legend row">
              {data.series.outcomeMix.map((o) => (
                <div className="legend-row" key={o.status}>
                  <span className="legend-swatch" style={{ background: OUTCOME_COLORS[o.status] }} />
                  <span>{o.status} · <b>{o.count}</b></span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Recent customers</h2>
              <a className="link-sm" href="#/users">User management</a>
            </div>
            <DataTable
              columns={[
                { h: 'Customer', c: (r) => <div><div className="cell-main">{r.name}</div><div className="cell-sub">{r.email}</div></div> },
                { h: 'Country', c: (r) => r.country },
                { h: 'Currencies', c: (r) => (
                  <span className="chips">
                    {r.currencies.map((code) => (
                      <span key={code} className={'cur-chip' + (code === r.defaultCurrency ? ' def' : '')}
                        title={code === r.defaultCurrency ? 'Default currency' : ''}>{code}</span>
                    ))}
                  </span>
                ) },
                { h: 'Status', c: (r) => <Badge status={r.status} /> },
                { h: 'Joined', c: (r) => fmt.date(r.createdAt) }
              ]}
              rows={data.recentUsers} rowKey={(r) => r.id}
              onRow={(r) => { location.hash = '#/users/' + r.id; }}
              empty={{ icon: 'users', title: 'No customers yet', text: 'New registrations will appear here.' }}
            />
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">Currency distribution</h2></div>
            <Chart height={200} deps={[data]} draw={(c) => GL().charts.donut(c, {
              segments: data.series.currencyDist.map((x, i) => ({ value: x.v, color: PALETTE[i % PALETTE.length], label: x.code })),
              centre: 'USD'
            })} />
            <div className="legend">
              {data.series.currencyDist.map((x, i) => (
                <div className="legend-row" key={x.code}>
                  <span className="legend-swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <b>{x.code}</b>
                  <span className="legend-val">{fmt.usd(x.v)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Pending deposits</h2>
              <a className="link-sm" href="#/deposits">Deposit management</a>
            </div>
            {data.pendingDeposits.length ? (
              <div className="mini-list">
                {data.pendingDeposits.map((d) => (
                  <div className="mini-row" key={d.reference}>
                    <div className="mini-main">
                      <span className="mono">{d.reference}</span>
                      <small>{d.userName} · {d.methodName}</small>
                    </div>
                    <div className="mini-side">
                      <b>{fmt.money(d.amount, d.currency)}</b>
                      <Badge status={d.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon="clock" title="No pending deposits" text="Every simulated deposit has settled." />
            )}
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Recent payment attempts</h2>
              <a className="link-sm" href="#/payments">Payment monitoring</a>
            </div>
            <DataTable
              columns={[
                { h: 'Reference', c: (r) => <span className="mono">{r.reference}</span> },
                { h: 'Customer', c: (r) => r.userName },
                { h: 'Method', c: (r) => r.methodName },
                { h: 'Amount', num: true, c: (r) => (r.amount != null ? fmt.money(r.amount, r.currency) : '—') },
                { h: 'Outcome', c: (r) => <Badge status={r.outcome} /> }
              ]}
              rows={data.recentPayments} rowKey={(r) => r.id}
              empty={{ icon: 'card', title: 'No payment attempts', text: 'Simulated gateway attempts will appear here.' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   USERS — search + status + country filters
   -------------------------------------------------------------------------- */
export function Users() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [country, setCountry] = useState('');
  const q = useDebounced(search, 300);
  const { data, loading, error } = useAsync(
    () => GL().api.admin.users({ search: q, status, country }),
    [q, status, country]
  );
  const fmt = GL().fmt;
  const countries = GL().COUNTRIES || [];
  const count = data ? data.length : 0;

  return (
    <div>
      <PageHead eyebrow="Customers" title="User Management"
        sub="Every customer account on the platform. Balances are computed from the demonstration ledger, so every figure is consistent with its history." />

      <div className="filters">
        <div className="field">
          <label htmlFor="users-search">Search</label>
          <div className="search-wrap">
            <Icon name="search" size={15} />
            <input id="users-search" type="search" placeholder="Name, email or country"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="users-status">Status</label>
          <select id="users-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="frozen">Frozen</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="users-country">Country</label>
          <select id="users-country" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Any country</option>
            {countries.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <p className="result-line muted small">
        {loading ? 'Searching…' : count + ' customer' + (count === 1 ? '' : 's') + ' found'}
      </p>

      {error ? <ErrorPanel error={error} /> : (
        <DataTable
          loading={loading}
          columns={[
            { h: 'Customer', c: (r) => <div><div className="cell-main">{r.name}</div><div className="cell-sub">{r.email}</div></div> },
            { h: 'Country', c: (r) => r.country },
            { h: 'Currencies', c: (r) => (
              <span className="chips">
                {r.currencies.map((code) => (
                  <span key={code} className={'cur-chip' + (code === r.defaultCurrency ? ' def' : '')}
                    title={code === r.defaultCurrency ? 'Default currency' : ''}>{code}</span>
                ))}
              </span>
            ) },
            { h: 'Status', c: (r) => <Badge status={r.status} /> },
            { h: 'Joined', c: (r) => fmt.date(r.createdAt) },
            { h: 'Volume (USD)', num: true, c: (r) => fmt.usd(r.totalUsd) }
          ]}
          rows={data || []} rowKey={(r) => r.id}
          onRow={(r) => { location.hash = '#/users/' + r.id; }}
          empty={{ icon: 'users', title: 'No customers match', text: 'Try clearing the search or the filters — new registrations also appear here as they are created.' }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   USER VIEWER — profile, accounts, histories, takeover, freeze, restrictions
   -------------------------------------------------------------------------- */
const RESTRICTED_OPS = [
  ['edit_balance', 'Edit balance', 'wallet'],
  ['withdraw', 'Withdraw', 'upload'],
  ['transfer', 'Transfer', 'exchange'],
  ['alter_deposit', 'Alter deposit confirmation', 'receipt'],
  ['edit_ledger', 'Edit ledger entry', 'book']
];

const EVENT_LABELS = {
  login: 'Sign-in',
  login_failed: 'Failed sign-in',
  password_change: 'Password changed',
  mfa_disabled: 'MFA disabled',
  account_frozen: 'Account frozen'
};

export function UserViewer({ id }) {
  const { data, loading, error, reload } = useAsync(() => GL().api.admin.user(id), [id]);
  const currencies = useAsync(() => GL().api.admin.currencies(), []);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [askTakeover, setAskTakeover] = useState(false);
  const [askFreeze, setAskFreeze] = useState(null); /* 'freeze' | 'unfreeze' */
  const [reason, setReason] = useState('');
  const [busyAct, setBusyAct] = useState('');
  const [restricted, setRestricted] = useState(null);
  const [askCurrency, setAskCurrency] = useState(null); /* { code, action, name } */
  const [note, setNote] = useState({ title: '', body: '' });
  const [sendingNote, setSendingNote] = useState(false);
  const fmt = GL().fmt;

  /* derived so the form is usable on the first render after data arrives */
  const formOrDefault = form || (data && data.user ? {
    firstName: data.user.firstName || '',
    lastName: data.user.lastName || '',
    phone: data.user.phone || '',
    address: data.user.address || ''
  } : null);

  if (loading) return <PageSkeleton />;
  if (error) {
    return (
      <div className="panel">
        <Empty icon="user" title="Customer not found" text={error.message} />
        <div className="center-actions"><a className="btn btn-ghost" href="#/users">Back to user management</a></div>
      </div>
    );
  }

  const u = data.user;
  const verified = u.verification && u.verification.email && u.verification.phone;
  const platformCurrencies = currencies.data || [];
  const heldCodes = data.accounts.map((a) => a.code);
  const activatable = platformCurrencies.filter((c) => c.status === 'active' && heldCodes.indexOf(c.code) === -1);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await GL().api.admin.updateProfile(id, form);
      toast(res.message || 'Profile updated (audited).');
      reload();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const doFreeze = async () => {
    setBusyAct('freeze');
    try {
      const fn = askFreeze === 'freeze' ? GL().api.admin.freezeUser : GL().api.admin.unfreezeUser;
      const res = await fn(id, reason.trim());
      toast(res.message);
      setAskFreeze(null);
      setReason('');
      reload();
    } catch (err) {
      fail(err);
      setAskFreeze(null);
    } finally {
      setBusyAct('');
    }
  };

  const doTakeover = async () => {
    setBusyAct('takeover');
    try {
      const res = await GL().api.admin.takeover(id, 'premium');
      window.location.href = res.data.redirect;
    } catch (err) {
      fail(err);
      setBusyAct('');
      setAskTakeover(false);
    }
  };

  const doCurrency = async () => {
    const { code, action } = askCurrency;
    setBusyAct('currency');
    try {
      const res = await GL().api.admin.setUserCurrency(id, code, action);
      toast(res.message);
      setAskCurrency(null);
      reload();
    } catch (err) {
      fail(err);
      setAskCurrency(null);
    } finally {
      setBusyAct('');
    }
  };

  const attemptRestricted = async (op, label) => {
    setBusyAct(op);
    try {
      await GL().api.admin.attemptRestricted(op, { userId: id });
      setRestricted(null);
    } catch (err) {
      setRestricted({ op: label, err });
    } finally {
      setBusyAct('');
    }
  };

  const sendNote = async (e) => {
    e.preventDefault();
    if (!note.title.trim() && !note.body.trim()) {
      toast('Add a title or a message before sending.', 'err');
      return;
    }
    setSendingNote(true);
    try {
      const res = await GL().api.admin.notifyUser(id, note);
      toast(res.message);
      setNote({ title: '', body: '' });
    } catch (err) {
      fail(err);
    } finally {
      setSendingNote(false);
    }
  };

  return (
    <div>
      <a className="backlink" href="#/users"><Icon name="chevron-l" size={14} /> Back to user management</a>

      <div className="panel uv-head">
        <div className="uv-id">
          <span className="avatar avatar-lg" aria-hidden="true">{fmt.initials(u.name)}</span>
          <div>
            <h1 className="uv-name display">{u.name}</h1>
            <div className="uv-sub">{u.email} · {u.country} · <span className="mono">{u.accountId}</span></div>
            <div className="uv-badges">
              <Badge status={u.status} />
              {verified
                ? <Badge status="active" label="Verified" />
                : <Badge status="pending" label="Verification pending" />}
              {u.mfaEnabled
                ? <Badge status="active" label="MFA on" />
                : <Badge status="read" label="MFA off" />}
              <span className="cur-chip def">{u.defaultCurrency} default</span>
            </div>
            {u.status === 'frozen' && (
              <div className="frozen-box">
                <Icon name="alert" size={15} />
                <span>Frozen {u.frozenAt ? fmt.timeAgo(u.frozenAt) : ''} by {u.frozenBy || 'an administrator'} — {u.freezeReason || 'no reason recorded'}.</span>
              </div>
            )}
          </div>
        </div>
        <div className="uv-side">
          <div className="uv-total">
            <small>Total balance (USD equivalent)</small>
            <b>{fmt.usd(data.totalUsd)}</b>
          </div>
          <div className="uv-actions">
            <button type="button" className="btn btn-primary" onClick={() => setAskTakeover(true)}>
              <Icon name="eye" size={16} /> Enter takeover mode
            </button>
            {u.status === 'frozen' ? (
              <button type="button" className="btn btn-ghost" onClick={() => { setAskFreeze('unfreeze'); setReason(''); }}>
                <Icon name="check-circle" size={16} /> Unfreeze account
              </button>
            ) : (
              <button type="button" className="btn btn-danger" onClick={() => { setAskFreeze('freeze'); setReason(''); }}>
                <Icon name="snowflake" size={16} /> Freeze account
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="cols-2">
        <div className="col">
          <form className="panel" onSubmit={saveProfile}>
            <div className="panel-head"><h2 className="panel-title">Profile — permitted edits</h2></div>
            <p className="panel-sub">Administrators may edit the customer’s name, phone and address. Email, country and every financial field are restricted by policy.</p>
            <div className="filters" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="First name" htmlFor="uv-first">
                <input id="uv-first" value={formOrDefault.firstName} onChange={(e) => setForm({ ...formOrDefault, firstName: e.target.value })} />
              </Field>
              <Field label="Last name" htmlFor="uv-last">
                <input id="uv-last" value={formOrDefault.lastName} onChange={(e) => setForm({ ...formOrDefault, lastName: e.target.value })} />
              </Field>
            </div>
            <Field label="Phone" htmlFor="uv-phone">
              <input id="uv-phone" value={formOrDefault.phone} onChange={(e) => setForm({ ...formOrDefault, phone: e.target.value })} />
            </Field>
            <Field label="Address" htmlFor="uv-address">
              <input id="uv-address" value={formOrDefault.address} onChange={(e) => setForm({ ...formOrDefault, address: e.target.value })} />
            </Field>
            <p className="field-hint" style={{ marginBottom: 14 }}>Read-only: {u.email} · {u.country} · default currency {u.defaultCurrency}. Changes are audited; the customer is not notified automatically.</p>
            <div className="form-actions">
              <button type="submit" className={'btn btn-primary' + (saving ? ' is-busy' : '')} disabled={saving}>
                <Icon name="check" size={15} /> Save permitted edits
              </button>
            </div>
          </form>

          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">Accounts &amp; balances</h2></div>
            <DataTable
              columns={[
                { h: 'Currency', c: (a) => <div><div className="cell-main">{a.code}</div><div className="cell-sub">{a.name}</div></div> },
                { h: 'Status', c: (a) => <Badge status={a.status} /> },
                { h: 'Balance', num: true, c: (a) => fmt.money(a.balance, a.code) },
                { h: 'USD equiv.', num: true, c: (a) => fmt.usd(a.equivalentUsd) },
                { h: 'Transactions', num: true, c: (a) => fmt.num(a.txCount) },
                { h: 'Opened', c: (a) => fmt.date(a.openedAt) },
                { h: '', c: (a) => (
                  a.balance === 0
                    ? <button type="button" className="btn btn-ghost btn-sm"
                      onClick={() => setAskCurrency({ code: a.code, action: 'deactivate', name: a.name })}
                      title="Deactivate this zero-balance currency account">Deactivate</button>
                    : <span className="muted small nowrap" title="Deactivation requires a zero balance">Balance held</span>
                ) }
              ]}
              rows={data.accounts} rowKey={(a) => a.code}
              empty={{ icon: 'coins', title: 'No currency accounts', text: 'This customer has not activated any currencies yet.' }}
            />
            <div style={{ marginTop: 16 }}>
              {activatable.length ? (
                <div className="chips" style={{ gap: 8 }}>
                  {activatable.map((c) => (
                    <button type="button" key={c.code} className="btn btn-ghost btn-sm"
                      onClick={() => setAskCurrency({ code: c.code, action: 'activate', name: c.name })}>
                      <Icon name="plus" size={12} /> Activate {c.code}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="field-hint">All platform-available currencies are active for this customer. Unavailable currencies (JPY in the demo seed) cannot be activated.</p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">Recent transactions</h2></div>
            <DataTable
              columns={[
                { h: 'Reference', c: (t) => <span className="mono">{t.ref}</span> },
                { h: 'Description', c: (t) => <span className="detail-cell" title={t.description}>{t.description}</span> },
                { h: 'Currency', c: (t) => <span className="cur-chip">{t.currency}</span> },
                { h: 'Amount', num: true, c: (t) => <span className={t.amount >= 0 ? 'amt-pos' : 'amt-neg'}>{fmt.money(t.amount, t.currency)}</span> },
                { h: 'Status', c: (t) => <Badge status={t.status} /> },
                { h: 'Date', c: (t) => fmt.date(t.ts) }
              ]}
              rows={data.transactions} rowKey={(t) => t.ref}
              empty={{ icon: 'exchange', title: 'No transactions yet', text: 'New customers start at a zero balance with an empty history.' }}
            />
          </div>

          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">Deposits</h2></div>
            <DataTable
              columns={[
                { h: 'Reference', c: (d) => <span className="mono">{d.reference}</span> },
                { h: 'Amount', num: true, c: (d) => fmt.money(d.amount, d.currency) },
                { h: 'Method', c: (d) => d.methodName },
                { h: 'Status', c: (d) => <Badge status={d.status} /> },
                { h: 'Created', c: (d) => fmt.date(d.createdAt) }
              ]}
              rows={data.deposits} rowKey={(d) => d.reference}
              empty={{ icon: 'wallet', title: 'No deposits yet', text: 'Simulated deposits made by the customer will appear here.' }}
            />
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">Sessions</h2></div>
            <DataTable
              columns={[
                { h: 'Device', c: (s) => <div><div className="cell-main">{s.device}</div><div className="cell-sub">{s.browser} · {s.os}</div></div> },
                { h: 'IP', c: (s) => <span className="mono">{s.ip}</span> },
                { h: 'Last active', c: (s) => fmt.timeAgo(s.lastActive) },
                { h: 'Status', c: (s) => (s.current ? <Badge status="current" label="This device" /> : <Badge status={s.status} />) }
              ]}
              rows={data.sessions} rowKey={(s) => s.id}
              empty={{ icon: 'smartphone', title: 'No sessions recorded', text: 'Sign-in sessions for this customer will appear here.' }}
            />
          </div>

          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">Security events</h2></div>
            {data.securityEvents.length ? (
              <div className="event-feed">
                {data.securityEvents.map((ev) => (
                  <div className="event" key={ev.id}>
                    <span className={'event-ic' + (ev.suspicious ? ' warn' : '')}>
                      <Icon name={ev.suspicious ? 'alert' : 'shield'} size={14} />
                    </span>
                    <div className="event-body">
                      <div className="event-top">
                        <b>{EVENT_LABELS[ev.type] || ev.type}</b>
                        {ev.suspicious && <Badge status="failed" label="suspicious" />}
                        <span className="event-time">{fmt.dateTime(ev.ts)}</span>
                      </div>
                      <div className="event-detail">{ev.detail}</div>
                      <div className="event-meta">{ev.device} · <span className="mono">{ev.ip}</span>{ev.location && ev.location !== '—' ? ' · ' + ev.location : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon="shield-check" title="No security events" text="Security events for this customer will appear here." />
            )}
          </div>

          <form className="panel" onSubmit={sendNote}>
            <div className="panel-head"><h2 className="panel-title">Manual notification</h2></div>
            <p className="panel-sub">Manual — the customer is not notified automatically. Sends an in-app notification in this demonstration environment.</p>
            <Field label="Title" htmlFor="nt-title">
              <input id="nt-title" value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })}
                placeholder="e.g. Account review completed" />
            </Field>
            <Field label="Message" htmlFor="nt-body">
              <textarea id="nt-body" value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })}
                placeholder="Write the message the customer will see in their notifications." />
            </Field>
            <div className="form-actions">
              <button type="submit" className={'btn btn-primary' + (sendingNote ? ' is-busy' : '')} disabled={sendingNote}>
                <Icon name="send" size={14} /> Send notification
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="restricted">
        <div className="restricted-head">
          <Icon name="lock" size={18} />
          <div>
            <h2 className="restricted-title">Financial restrictions</h2>
            <p className="restricted-note">Administrators cannot move or mutate customer funds. Each attempt below is rejected by the service layer with HTTP 403 and recorded in the audit log as a denied attempt.</p>
          </div>
        </div>
        <div className="restricted-grid">
          {RESTRICTED_OPS.map(([op, label, icon]) => (
            <button type="button" key={op} className="btn btn-ghost btn-sm"
              disabled={busyAct === op} onClick={() => attemptRestricted(op, label)}>
              <Icon name={icon} size={13} /> {label}
            </button>
          ))}
        </div>
        {restricted && (
          <div className="restriction-result" role="alert">
            <div className="rr-top">
              <Badge status="failed" label={'403 · ' + (restricted.err.code || 'FORBIDDEN')} />
              <b>{restricted.op}</b>
            </div>
            <p>{restricted.err.message}</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={askTakeover}
        title="Enter takeover mode?"
        message={'You will open ' + u.name + '’s account in the premium customer application with read and permitted-edit access. The customer is not notified automatically, and every action is audited.'}
        confirmLabel="Enter takeover"
        busy={busyAct === 'takeover'}
        onCancel={() => setAskTakeover(false)}
        onConfirm={doTakeover}
      />

      <ConfirmDialog
        open={!!askFreeze}
        danger={askFreeze === 'freeze'}
        busy={busyAct === 'freeze'}
        title={askFreeze === 'freeze' ? 'Freeze this account?' : 'Unfreeze this account?'}
        confirmLabel={askFreeze === 'freeze' ? 'Freeze account' : 'Unfreeze account'}
        onCancel={() => { setAskFreeze(null); setReason(''); }}
        onConfirm={doFreeze}
      >
        <p>{askFreeze === 'freeze'
          ? 'The customer will be unable to sign in until the account is unfrozen. The reason is recorded in the audit log — the customer is not notified automatically.'
          : 'The customer will be able to sign in again. The action is recorded in the audit log.'}</p>
        <Field label="Reason (audit log)" htmlFor="fz-reason">
          <textarea id="fz-reason" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={askFreeze === 'freeze' ? 'e.g. Security review' : 'e.g. Review completed'} />
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!askCurrency}
        busy={busyAct === 'currency'}
        title={askCurrency && askCurrency.action === 'activate'
          ? 'Activate ' + (askCurrency ? askCurrency.code : '') + ' for ' + u.name + '?'
          : 'Deactivate ' + (askCurrency ? askCurrency.code : '') + '?'}
        confirmLabel={askCurrency && askCurrency.action === 'activate' ? 'Activate currency' : 'Deactivate currency'}
        danger={askCurrency && askCurrency.action === 'deactivate'}
        onCancel={() => setAskCurrency(null)}
        onConfirm={doCurrency}
      >
        <p>{askCurrency && askCurrency.action === 'activate'
          ? 'The ' + (askCurrency ? askCurrency.code : '') + ' account is created with a zero balance. The action is audited; the customer is not notified automatically.'
          : 'The currency account is removed from the customer’s profile. Only possible while its balance is zero — existing balances can never be removed by an administrator.'}</p>
      </ConfirmDialog>
    </div>
  );
}

/* --------------------------------------------------------------------------
   TAKEOVER — search users, enter takeover, active session, history, policy
   -------------------------------------------------------------------------- */
export function TakeoverPage({ session, onSessionChange }) {
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);
  const users = useAsync(() => GL().api.admin.users({ search: q }), [q]);
  const audit = useAsync(() => GL().api.admin.auditLog({}), []);
  const [ask, setAsk] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const fmt = GL().fmt;
  const active = session && session.kind === 'takeover';
  const history = (audit.data || []).filter((a) => a.action === 'takeover_start' || a.action === 'takeover_end').slice(0, 12);

  const enterTakeover = async () => {
    setBusy(true);
    try {
      const res = await GL().api.admin.takeover(ask.id, 'premium');
      window.location.href = res.data.redirect;
    } catch (err) {
      fail(err);
      setBusy(false);
      setAsk(null);
    }
  };

  const endTakeover = async () => {
    setEnding(true);
    try {
      const res = await GL().api.admin.endTakeover();
      toast(res.message);
      onSessionChange();
      audit.reload();
    } catch (err) {
      fail(err);
    } finally {
      setEnding(false);
    }
  };

  return (
    <div>
      <PageHead eyebrow="Customers" title="Account Takeover"
        sub="Open a customer’s account in the customer application to assist them — read and permitted edits only, never a financial mutation." />

      {active && (
        <div className="restricted">
          <div className="restricted-head">
            <Icon name="eye" size={18} />
            <div>
              <h2 className="restricted-title">Takeover session active</h2>
              <p className="restricted-note">
                Viewing customer <span className="mono">{session.userId}</span> since {fmt.dateTime(session.ts)}. End it here or from the banner in the customer application — the customer is not notified automatically.
              </p>
            </div>
          </div>
          <div className="restricted-actions">
            <button type="button" className={'btn btn-danger' + (ending ? ' is-busy' : '')} disabled={ending} onClick={endTakeover}>
              <Icon name="x-circle" size={15} /> End takeover
            </button>
          </div>
        </div>
      )}

      <div className="cols-2">
        <div className="col">
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Enter takeover</h2>
              <span className="small muted">{users.loading ? 'Searching…' : ((users.data || []).length + ' customers')}</span>
            </div>
            <div className="field">
              <label htmlFor="tk-search">Search customers</label>
              <div className="search-wrap">
                <Icon name="search" size={15} />
                <input id="tk-search" type="search" placeholder="Name, email or country"
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            {users.error ? <ErrorPanel error={users.error} /> : (
              <DataTable
                loading={users.loading}
                columns={[
                  { h: 'Customer', c: (r) => <div><div className="cell-main">{r.name}</div><div className="cell-sub">{r.email}</div></div> },
                  { h: 'Country', c: (r) => r.country },
                  { h: 'Status', c: (r) => <Badge status={r.status} /> },
                  { h: '', c: (r) => (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsk(r)}>
                      <Icon name="eye" size={13} /> Enter takeover
                    </button>
                  ) }
                ]}
                rows={users.data || []} rowKey={(r) => r.id}
                empty={{ icon: 'users', title: 'No customers match', text: 'Try a different search.' }}
              />
            )}
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">Takeover policy</h2></div>
            <div className="event-feed">
              <div className="event">
                <span className="event-ic"><Icon name="eye" size={14} /></span>
                <div className="event-body">
                  <div className="event-top"><b>Read + permitted edits</b></div>
                  <div className="event-detail">Administrators view the customer’s account exactly as the customer sees it, and may edit only name, phone and address.</div>
                </div>
              </div>
              <div className="event">
                <span className="event-ic"><Icon name="bell" size={14} /></span>
                <div className="event-body">
                  <div className="event-top"><b>No automatic notification</b></div>
                  <div className="event-detail">The customer is not notified when a takeover starts. Notifications are sent only manually, and every action is audited.</div>
                </div>
              </div>
              <div className="event">
                <span className="event-ic warn"><Icon name="lock" size={14} /></span>
                <div className="event-body">
                  <div className="event-top"><b>Financial operations blocked</b></div>
                  <div className="event-detail">Balances, withdrawals, transfers, deposit confirmations and ledger entries can never be mutated by an administrator — enforced in the service layer with HTTP 403.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">Takeover history</h2></div>
            <DataTable
              loading={audit.loading}
              columns={[
                { h: 'Time', c: (a) => <span className="nowrap">{fmt.dateTime(a.ts)}</span> },
                { h: 'Action', c: (a) => <Badge status={a.action === 'takeover_start' ? 'open' : 'read'} label={a.action === 'takeover_start' ? 'Started' : 'Ended'} /> },
                { h: 'Target', c: (a) => a.target },
                { h: 'Actor', c: (a) => <span className="small">{a.actorName}</span> }
              ]}
              rows={history} rowKey={(a) => a.id}
              empty={{ icon: 'history', title: 'No takeover sessions yet', text: 'Takeover starts and ends are recorded here.' }}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!ask}
        title="Enter takeover mode?"
        message={'You will open ' + (ask ? ask.name : '') + '’s account in the premium customer application with read and permitted-edit access. The customer is not notified automatically.'}
        confirmLabel="Enter takeover"
        busy={busy}
        onCancel={() => setAsk(null)}
        onConfirm={enterTakeover}
      />
    </div>
  );
}
