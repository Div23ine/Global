/* ============================================================================
   MERIDIAN ADMIN — Design Concept 1 · “Swiss Private Banking”
   admin/swiss/src/pages-core.jsx

   Login · Dashboard · Users · UserViewer · Takeover
   ========================================================================== */
import React, { useEffect, useState } from 'react';
import {
  Icon, Badge, StatCard, DataTable, Skeleton, Empty, LoadError, PageHead,
  toast, toastErr, confirmDialog, TextField, SelectField, BusyButton,
  useData, useDebounced, Chart, CHART_COLORS, usdK
} from './components.jsx';

const GL = () => window.GL;
const fmt = () => GL().fmt;

/* ============================================================================
   LOGIN
   ========================================================================== */
export function Login({ onDone }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const demo = GL().DEMO_CREDENTIALS.admin;

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) { setErr('Enter your email and password.'); return; }
    setBusy(true); setErr(null);
    GL().api.admin.login(email.trim(), password)
      .then(() => { toast('Signed in as administrator (demo).', 'ok'); onDone(); })
      .catch((e2) => { setErr(e2.message); setBusy(false); });
  };

  return (
    <div className="auth-outer">
      <div className="auth-wrap">
        <div className="card auth-card">
          <div className="auth-brand">
            <span className="brand-mark" dangerouslySetInnerHTML={{
              __html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                'stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
                '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 3.5v17M3.5 12h17"></path></svg>'
            }} />
            <span className="brand-text">Meridian<small>Administration</small></span>
          </div>
          <h1 className="auth-title">Administration console</h1>
          <p className="auth-sub">
            Swiss Private Banking concept. Demo environment — every user, balance and audit entry
            is sample data held in this browser only.
          </p>
          {err ? (
            <div className="form-err" role="alert">
              <Icon name="alert" size={16} />
              <span>{err}</span>
            </div>
          ) : null}
          <form onSubmit={submit} noValidate>
            <TextField id="adm-email" label="Email" type="email" value={email}
              onChange={setEmail} placeholder="administrator@meridian.example" autoComplete="username" />
            <TextField id="adm-pass" label="Password" type="password" value={password}
              onChange={setPassword} placeholder="Password" autoComplete="current-password" />
            <BusyButton type="submit" busy={busy} className="btn btn-primary btn-block btn-lg">
              Sign in
            </BusyButton>
          </form>
          <p className="auth-foot">
            Administrators can view accounts through an audited takeover mode and make permitted
            edits only — financial mutations are blocked in the service layer.
          </p>
        </div>

        <div className="card auth-demo">
          <p className="eyebrow">Demo credentials</p>
          <p className="auth-demo-text">
            This prototype ships with one administrator account. Use the quick-fill button or
            type the credentials manually.
          </p>
          <dl className="cred-list">
            <div><dt>Email</dt><dd><code>{demo.email}</code></dd></div>
            <div><dt>Password</dt><dd><code>{demo.password}</code></dd></div>
            <div><dt>Role</dt><dd>Super Administrator — {demo.name}</dd></div>
          </dl>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setEmail(demo.email); setPassword(demo.password); setErr(null); }}
          >
            <Icon name="key" size={15} /> Use demo credentials
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   DASHBOARD
   ========================================================================== */
export function Dashboard() {
  const { data, loading, error, reload } = useData(() => GL().api.admin.dashboard(), []);
  if (loading) return <Skeleton />;
  if (error) return <LoadError error={error} retry={reload} />;

  const k = data.kpis;
  const days = data.series.depositsByDay;
  const mix = data.series.outcomeMix;
  const dist = data.series.currencyDist;

  return (
    <>
      <PageHead
        eyebrow="Overview"
        title="Platform dashboard"
        sub="Thirty-day activity across the demo dataset. Figures are USD equivalents computed from the shared demo store."
      />

      <div className="kpi-grid">
        <StatCard label="Total users" value={fmt().num(k.totalUsers)} icon="users" sub="Customer accounts (demo)" />
        <StatCard label="Active" value={fmt().num(k.activeUsers)} icon="check-circle" />
        <StatCard label="Frozen" value={fmt().num(k.frozenUsers)} icon="snowflake" tone="warn" sub="Pending security review" />
        <StatCard label="Pending deposits" value={fmt().num(k.pendingDeposits)} icon="clock" tone="warn" sub="Awaiting gateway confirmation" />
        <StatCard label="Total volume" value={fmt().usd(k.volumeUsd)} icon="coins" sub="Sum of all balances (USD eq.)" />
        <StatCard label="Open tickets" value={fmt().num(k.openTickets)} icon="ticket" />
        <StatCard label="Suspicious events" value={fmt().num(k.suspiciousEvents)} icon="shield" tone="danger" sub="Flagged in security monitoring" />
      </div>

      <div className="dash-grid">
        <div className="stack">
          <div className="card chart-card">
            <div className="card-h">
              <h3>Deposits — last 30 days</h3>
              <span className="res-count">Successful deposits, USD equivalent</span>
            </div>
            <div className="card-b">
              <Chart
                height={230}
                label="Successful deposits in USD, last 30 days"
                deps={[data]}
                draw={(c) => GL().charts.line(c, {
                  values: days.map((x) => x.v),
                  labels: days.map((x) => fmt().monthShort(x.t)),
                  color: '#2E5A88',
                  yFmt: usdK,
                  tipFmt: (v) => fmt().usd(v)
                })}
              />
            </div>
          </div>

          <div className="card chart-card">
            <div className="card-h">
              <h3>Payment outcome mix</h3>
              <span className="res-count">Gateway attempts by outcome</span>
            </div>
            <div className="card-b">
              <Chart
                height={190}
                label="Payment attempts by outcome"
                deps={[data]}
                draw={(c) => GL().charts.bars(c, {
                  values: mix.map((x) => x.count),
                  labels: mix.map((x) => x.status.charAt(0).toUpperCase() + x.status.slice(1)),
                  colors: CHART_COLORS,
                  yFmt: (v) => fmt().num(Math.round(v))
                })}
              />
            </div>
          </div>
        </div>

        <div className="card chart-card">
          <div className="card-h">
            <h3>Currency distribution</h3>
            <span className="res-count">Balances, USD eq.</span>
          </div>
          <div className="card-b">
            <div className="donut-flex">
              <Chart
                height={170}
                label="Currency distribution of balances"
                deps={[data]}
                draw={(c) => GL().charts.donut(c, {
                  segments: dist.map((x, i) => ({ value: x.v, color: CHART_COLORS[i % CHART_COLORS.length], label: x.code })),
                  centre: 'USD eq.'
                })}
              />
              <div className="ov-legend">
                {dist.map((x, i) => (
                  <div key={x.code} className="ov-leg-item">
                    <i style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}></i>
                    <span className="lg-code">{x.code}</span>
                    <span className="lg-val">{fmt().usd(x.v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Recent customers</h3>
          <a className="link-sm" href="#/users">All customers</a>
        </div>
        <DataTable
          rows={data.recentUsers}
          rowKey={(u) => u.id}
          onRowClick={(u) => { window.location.hash = '#/users/' + u.id; }}
          empty={<Empty icon="users" title="No customers yet" text="New registrations will appear here." />}
          cols={[
            { label: 'Customer', cell: (u) => (<a className="td-strong" href={'#/users/' + u.id}>{u.name}</a>) },
            { label: 'Country', cell: (u) => u.country },
            { label: 'Currencies', cell: (u) => u.currencies.map((c) => <span key={c} className="cur-chip">{c}</span>) },
            { label: 'Status', cell: (u) => <Badge status={u.status} /> },
            { label: 'Joined', class: 'td-date', cell: (u) => fmt().date(u.createdAt) },
            { label: 'Volume', class: 'num ta-r', cell: (u) => fmt().usd(u.totalUsd) }
          ]}
        />
      </div>

      <div className="grid-2even">
        <div className="card">
          <div className="card-h">
            <h3>Pending deposits</h3>
            <a className="link-sm" href="#/deposits">Deposit management</a>
          </div>
          <div className="card-b">
            {data.pendingDeposits.length ? (
              <ul className="mini-list">
                {data.pendingDeposits.map((d) => (
                  <li key={d.reference} className="mini-row">
                    <div className="mini-main">
                      <b>{d.reference}</b>
                      <span>{d.userName} · {d.methodName}</span>
                    </div>
                    <div className="mini-side">
                      <b className="num">{fmt().money(d.amount, d.currency)}</b>
                      <Badge status={d.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="clock" title="No pending deposits" text="Every gateway attempt has settled." />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Recent payment attempts</h3>
            <a className="link-sm" href="#/payments">Payment monitoring</a>
          </div>
          <div className="card-b">
            {data.recentPayments.length ? (
              <ul className="mini-list">
                {data.recentPayments.map((p) => (
                  <li key={p.id} className="mini-row">
                    <div className="mini-main">
                      <b>{p.reference}</b>
                      <span>{p.userName} · {p.methodName}</span>
                    </div>
                    <div className="mini-side">
                      <b className="num">{p.amount != null ? fmt().money(p.amount, p.currency) : '—'}</b>
                      <Badge status={p.outcome} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="card" title="No payment attempts" text="Simulated gateway activity will appear here." />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================================
   USERS — search + status + country filters
   ========================================================================== */
export function Users() {
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [country, setCountry] = useState('');
  const search = useDebounced(searchInput.trim(), 260);

  const countries = GL().COUNTRIES.map((c) => c.name).sort();

  const q = { search, status, country };
  const { data, loading, error, reload } = useData(() => GL().api.admin.users(q), [search, status, country]);
  const filtering = !!(search || status || country);

  const clear = () => { setSearchInput(''); setStatus(''); setCountry(''); };

  return (
    <>
      <PageHead
        eyebrow="Customers"
        title="User management"
        sub="Every customer account in the demo store. Select a row to open the account viewer."
      />
      <div className="card filt-card">
        <div className="filt-in">
          <div className="field">
            <label htmlFor="usr-search">Search</label>
            <input id="usr-search" type="search" placeholder="Name, email or country"
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <SelectField id="usr-status" label="Status" value={status} onChange={setStatus}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'frozen', label: 'Frozen' }
            ]} />
          <SelectField id="usr-country" label="Country" value={country} onChange={setCountry}
            options={[{ value: '', label: 'All countries' }].concat(
              countries.map((c) => ({ value: c, label: c }))
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
          <p className="res-count">{(data || []).length} customer{(data || []).length === 1 ? '' : 's'}</p>
          <DataTable
            rows={data || []}
            rowKey={(u) => u.id}
            onRowClick={(u) => { window.location.hash = '#/users/' + u.id; }}
            empty={
              filtering
                ? <Empty title="No customers match" text="Try a different search term or clear the filters.">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>Clear filters</button>
                  </Empty>
                : <Empty icon="users" title="No customers yet" text="Register an account in the customer app to populate this list." />
            }
            cols={[
              { label: 'Customer', cell: (u) => (
                <a className="td-strong" href={'#/users/' + u.id}>{u.name}
                  <span className="td-sub">{u.email}</span></a>
              ) },
              { label: 'Country', cell: (u) => u.country },
              { label: 'Currencies', cell: (u) => u.currencies.length
                ? u.currencies.map((c) => <span key={c} className="cur-chip">{c}</span>)
                : <span className="muted">—</span> },
              { label: 'Status', cell: (u) => <Badge status={u.status} /> },
              { label: 'Joined', class: 'td-date', cell: (u) => fmt().date(u.createdAt) },
              { label: 'Volume (USD)', class: 'num ta-r', cell: (u) => fmt().usd(u.totalUsd) }
            ]}
          />
        </>
      )}
    </>
  );
}

/* ============================================================================
   USER VIEWER
   ========================================================================== */
const RESTRICTED_OPS = [
  ['edit_balance', 'Edit balance'],
  ['withdraw', 'Withdraw'],
  ['transfer', 'Transfer'],
  ['alter_deposit', 'Alter deposit confirmation'],
  ['edit_ledger', 'Edit ledger entry']
];

export function UserViewer({ id }) {
  const { data, loading, error, reload } = useData(() => GL().api.admin.user(id), [id]);
  const curr = useData(() => GL().api.admin.currencies(), [id]);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [notify, setNotify] = useState({ title: '', body: '' });
  const [actCode, setActCode] = useState('');
  const [restrict, setRestrict] = useState(null);

  useEffect(() => {
    if (data) {
      const init = {
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        phone: data.user.phone || '',
        address: data.user.address || ''
      };
      setForm((prev) => (prev && dirty ? prev : init));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading) return <Skeleton />;
  if (error) {
    return (
      <>
        <PageHead eyebrow="User Management" title="Customer account" />
        <LoadError error={error} retry={reload} />
        <p className="ta-r"><a className="btn btn-ghost btn-sm" href="#/users">Back to all customers</a></p>
      </>
    );
  }

  const u = data.user;
  const f = () => fmt();

  const setField = (k, v) => { setDirty(true); setForm({ ...form, [k]: v }); };

  const saveProfile = async () => {
    setBusy('profile');
    try {
      const res = await GL().api.admin.updateProfile(id, form);
      toast(res.message || 'Profile updated.', 'ok');
      setDirty(false); reload();
    } catch (e) { toastErr(e); }
    setBusy('');
  };

  const enterTakeover = async () => {
    const ok = await confirmDialog({
      title: 'Enter takeover mode?',
      message: 'You will view ' + u.name + '’s account inside the customer application with read access and permitted edits (profile fields only). Financial operations remain blocked by the service layer.',
      note: 'The customer is not notified automatically. The session appears in the audit log with a permanent on-screen banner.',
      confirmLabel: 'Enter takeover'
    });
    if (!ok) return;
    setBusy('takeover');
    try {
      const res = await GL().api.admin.takeover(id, 'swiss');
      window.location.href = res.data.redirect;
    } catch (e) { toastErr(e); setBusy(''); }
  };

  const freeze = async () => {
    const reason = await confirmDialog({
      title: 'Freeze this account?',
      danger: true,
      confirmLabel: 'Freeze account',
      message: 'Sign-ins and deposits are blocked until the account is unfrozen. The customer sees the reason on the frozen screen.',
      input: { label: 'Reason', placeholder: 'e.g. Security review — suspicious login activity' }
    });
    if (reason === null) return;
    setBusy('freeze');
    try {
      const res = await GL().api.admin.freezeUser(id, reason.trim());
      toast(res.message, 'ok'); reload();
    } catch (e) { toastErr(e); }
    setBusy('');
  };

  const unfreeze = async () => {
    const reason = await confirmDialog({
      title: 'Unfreeze this account?',
      confirmLabel: 'Unfreeze account',
      message: 'The customer will be able to sign in and deposit again.',
      input: { label: 'Note for the audit log (optional)', placeholder: 'e.g. Review completed — no issues found', value: '' }
    });
    if (reason === null) return;
    setBusy('unfreeze');
    try {
      const res = await GL().api.admin.unfreezeUser(id, reason.trim());
      toast(res.message, 'ok'); reload();
    } catch (e) { toastErr(e); }
    setBusy('');
  };

  const sendNotify = async () => {
    if (!notify.title.trim() || !notify.body.trim()) {
      toast('Enter a notification title and message.', 'err');
      return;
    }
    const ok = await confirmDialog({
      title: 'Send this notification?',
      confirmLabel: 'Send notification',
      message: 'It appears immediately in the customer’s notifications feed. Sending is manual — nothing is ever sent automatically on your behalf.'
    });
    if (!ok) return;
    setBusy('notify');
    try {
      const res = await GL().api.admin.notifyUser(id, { title: notify.title.trim(), body: notify.body.trim() });
      toast(res.message, 'ok');
      setNotify({ title: '', body: '' });
    } catch (e) { toastErr(e); }
    setBusy('');
  };

  const setCurrency = async (code, action) => {
    const ok = await confirmDialog(
      action === 'activate'
        ? {
            title: 'Activate ' + code + ' for this customer?',
            confirmLabel: 'Activate ' + code,
            message: 'Creates a new ' + code + ' account with a zero balance. Existing balances are never converted or moved.'
          }
        : {
            title: 'Deactivate ' + code + '?',
            danger: true,
            confirmLabel: 'Deactivate ' + code,
            message: 'The ' + code + ' account is removed from the customer’s dashboard. This is only possible while its balance is zero — the service layer rejects it otherwise.'
          }
    );
    if (!ok) return;
    setBusy('cur-' + code);
    try {
      const res = await GL().api.admin.setUserCurrency(id, code, action);
      toast(res.message, 'ok'); reload();
    } catch (e) { toastErr(e); }
    setBusy('');
  };

  const attempt = async (op) => {
    setBusy('r-' + op);
    try {
      await GL().api.admin.attemptRestricted(op, { userId: id });
    } catch (e) {
      setRestrict({ op, message: e.message, code: e.code, status: e.status });
      toast('Rejected by the service layer (403).', 'err');
    }
    setBusy('');
  };

  const owned = (data.accounts || []).map((a) => a.code);
  const activatable = (curr.data || []).filter((c) => c.status === 'active' && owned.indexOf(c.code) === -1);

  const verifBadge = (on, label) => (
    <span className={'verif' + (on ? ' on' : '')}>
      <Icon name={on ? 'check' : 'x'} size={12} /> {label}
    </span>
  );

  return (
    <>
      <PageHead
        eyebrow="User Management"
        title={u.name}
        sub={<>{u.email} · {u.country} · {u.accountId} · joined {f().date(u.createdAt)} · total {f().usd(data.totalUsd)}</>}
      >
        <Badge status={u.status} />
        <a className="btn btn-ghost btn-sm" href="#/users">
          <Icon name="chevron-l" size={14} /> All customers
        </a>
      </PageHead>

      <div className="uv-grid">
        {/* ---- profile ---- */}
        <div className="card">
          <div className="card-h"><h3>Profile</h3><span className="res-count">Permitted edits</span></div>
          <div className="card-b">
            <dl className="detail-list">
              <div><dt>Email</dt><dd>{u.email}</dd></div>
              <div><dt>Country</dt><dd>{u.country} ({u.countryCode})</dd></div>
              <div><dt>Account ID</dt><dd>{u.accountId}</dd></div>
              <div><dt>Default currency</dt><dd><span className="cur-chip">{u.defaultCurrency}</span></dd></div>
              <div><dt>Verification</dt><dd>{verifBadge(u.verification.email, 'Email')} {verifBadge(u.verification.phone, 'Phone')}</dd></div>
              <div><dt>MFA</dt><dd>{u.mfaEnabled ? 'Enabled' : 'Disabled'}</dd></div>
              {u.status === 'frozen' ? (
                <div className="freeze-row"><dt>Frozen</dt><dd>
                  <Badge status="frozen" /> <span className="muted small">{u.freezeReason || 'No reason recorded'}{u.frozenBy ? ' · by ' + u.frozenBy : ''}</span>
                </dd></div>
              ) : null}
            </dl>

            <hr className="hairline" />
            <form onSubmit={(e) => { e.preventDefault(); saveProfile(); }}>
              <div className="gw-row">
                <TextField id="uv-first" label="First name" value={form ? form.firstName : ''} onChange={(v) => setField('firstName', v)} />
                <TextField id="uv-last" label="Last name" value={form ? form.lastName : ''} onChange={(v) => setField('lastName', v)} />
              </div>
              <TextField id="uv-phone" label="Phone" value={form ? form.phone : ''} onChange={(v) => setField('phone', v)} placeholder="+00 000 000 0000" />
              <TextField id="uv-addr" label="Address" textarea value={form ? form.address : ''} onChange={(v) => setField('address', v)} />
              <div className="form-foot">
                <span className="hint">Whitelisted fields only — financial fields are rejected by the service layer. Edits are audited; the customer is not notified automatically.</span>
                <BusyButton type="submit" busy={busy === 'profile'} className="btn btn-primary btn-sm">
                  Save changes
                </BusyButton>
              </div>
            </form>
          </div>
        </div>

        {/* ---- actions + restrictions ---- */}
        <div className="stack">
          <div className="card">
            <div className="card-h"><h3>Account actions</h3></div>
            <div className="card-b">
              <div className="act-col">
                <BusyButton busy={busy === 'takeover'} className="btn btn-primary" onClick={enterTakeover}>
                  <Icon name="eye" size={16} /> Enter takeover mode
                </BusyButton>
                <p className="hint">Opens the customer app in read + permitted-edit mode with a permanent banner. The customer is not notified automatically.</p>
                {u.status === 'active' ? (
                  <BusyButton busy={busy === 'freeze'} className="btn btn-danger" onClick={freeze}>
                    <Icon name="snowflake" size={16} /> Freeze account
                  </BusyButton>
                ) : (
                  <BusyButton busy={busy === 'unfreeze'} className="btn btn-ghost" onClick={unfreeze}>
                    <Icon name="refresh" size={16} /> Unfreeze account
                  </BusyButton>
                )}
              </div>

              <hr className="hairline" />
              <p className="lab">Send a notification — manual, the customer is not notified automatically</p>
              <TextField id="uv-nt" label="Title" value={notify.title}
                onChange={(v) => setNotify({ ...notify, title: v })}
                placeholder="e.g. Account review completed" />
              <TextField id="uv-nb" label="Message" textarea value={notify.body}
                onChange={(v) => setNotify({ ...notify, body: v })}
                placeholder="Short message for the customer’s notifications feed." />
              <div className="form-foot">
                <span className="hint">Delivered in-app only (demo).</span>
                <BusyButton busy={busy === 'notify'} className="btn btn-ghost btn-sm" onClick={sendNotify}>
                  <Icon name="send" size={15} /> Send
                </BusyButton>
              </div>
            </div>
          </div>

          <div className="card restrict-card">
            <div className="card-h">
              <h3>Financial restrictions</h3>
              <span className="res-count">Always rejected (403)</span>
            </div>
            <div className="card-b">
              <p className="hint">
                These operations are blocked for every administrator role. Pressing one calls the
                API and shows the service-layer rejection — the same enforcement a production
                backend would apply.
              </p>
              <div className="restrict-grid">
                {RESTRICTED_OPS.map(([op, label]) => (
                  <BusyButton key={op} busy={busy === 'r-' + op} className="btn btn-ghost btn-sm"
                    onClick={() => attempt(op)}>
                    <Icon name="ban" size={14} /> {label}
                  </BusyButton>
                ))}
              </div>
              {restrict ? (
                <div className="rejection" role="alert">
                  <Icon name="ban" size={16} />
                  <div>
                    <b>{(RESTRICTED_OPS.filter((x) => x[0] === restrict.op)[0] || [])[1]} — rejected ({restrict.status} · {restrict.code})</b>
                    <p>{restrict.message}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ---- accounts ---- */}
      <div className="card">
        <div className="card-h">
          <h3>Accounts &amp; balances</h3>
          <span className="res-count">Balances are computed from the ledger</span>
        </div>
        <DataTable
          rows={data.accounts}
          rowKey={(a) => a.code}
          empty={<Empty icon="coins" title="No currency accounts" text="Activate a currency below to create the first zero-balance account." />}
          cols={[
            { label: 'Currency', cell: (a) => <><b>{a.code}</b> <span className="muted small">{a.name}</span></> },
            { label: 'Status', cell: (a) => <Badge status={a.status} /> },
            { label: 'Balance', class: 'num ta-r', cell: (a) => f().money(a.balance, a.code) },
            { label: 'Transactions', class: 'num ta-r', cell: (a) => f().num(a.txCount) },
            { label: 'USD equivalent', class: 'num ta-r', cell: (a) => f().usd(a.equivalentUsd) },
            { label: 'Opened', class: 'td-date', cell: (a) => f().date(a.openedAt) },
            {
              label: 'Action',
              cell: (a) => (
                <BusyButton busy={busy === 'cur-' + a.code} className="btn btn-ghost btn-sm"
                  onClick={() => setCurrency(a.code, 'deactivate')}>
                  Deactivate
                </BusyButton>
              )
            }
          ]}
        />
        <div className="card-b act-row">
          <div className="field">
            <label htmlFor="uv-act">Activate a currency for this customer</label>
            <select id="uv-act" value={actCode} onChange={(e) => setActCode(e.target.value)}>
              <option value="">Select currency…</option>
              {activatable.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <BusyButton busy={busy === 'cur-' + actCode} className="btn btn-primary btn-sm"
            disabled={!actCode} onClick={() => actCode && setCurrency(actCode, 'activate')}>
            <Icon name="plus" size={14} /> Activate
          </BusyButton>
          <p className="hint">
            Unavailable currencies (e.g. JPY while disabled) cannot be activated here — the customer
            Activate page reflects the same setting.
          </p>
        </div>
      </div>

      <div className="grid-2even">
        <div className="card">
          <div className="card-h"><h3>Recent transactions</h3><span className="res-count">Last 10</span></div>
          <DataTable
            rows={data.transactions}
            rowKey={(t) => t.ref}
            empty={<Empty icon="receipt" title="No transactions" text="This customer has no ledger entries yet." />}
            cols={[
              { label: 'Reference', cell: (t) => t.ref },
              { label: 'Description', class: 'td-desc', cell: (t) => t.description },
              { label: 'Currency', cell: (t) => t.currency },
              { label: 'Amount', class: 'num ta-r', cell: (t) => <span className={t.amount < 0 ? 'neg' : ''}>{f().money(t.amount, t.currency)}</span> },
              { label: 'Status', cell: (t) => <Badge status={t.status} /> },
              { label: 'Date', class: 'td-date', cell: (t) => f().date(t.ts) }
            ]}
          />
        </div>

        <div className="card">
          <div className="card-h"><h3>Deposits</h3></div>
          <DataTable
            rows={data.deposits}
            rowKey={(d) => d.reference}
            empty={<Empty icon="plus" title="No deposits" text="Deposit records will appear here." />}
            cols={[
              { label: 'Reference', cell: (d) => d.reference },
              { label: 'Amount', class: 'num ta-r', cell: (d) => f().money(d.amount, d.currency) },
              { label: 'Method', cell: (d) => d.methodName },
              { label: 'Fee', class: 'num ta-r', cell: (d) => f().money(d.fee, d.currency) },
              { label: 'Status', cell: (d) => <Badge status={d.status} /> },
              { label: 'Created', class: 'td-date', cell: (d) => f().date(d.createdAt) }
            ]}
          />
        </div>
      </div>

      <div className="grid-2even">
        <div className="card">
          <div className="card-h"><h3>Sessions</h3></div>
          <DataTable
            rows={data.sessions}
            rowKey={(s) => s.id}
            empty={<Empty icon="smartphone" title="No sessions" text="No recorded sessions for this customer." />}
            cols={[
              { label: 'Device', cell: (s) => <>{s.device}{s.current ? <span className="cur-chip on">Current</span> : null}</> },
              { label: 'Browser / OS', cell: (s) => s.browser + ' · ' + s.os },
              { label: 'IP', cell: (s) => s.ip },
              { label: 'Location', cell: (s) => s.location },
              { label: 'Last active', class: 'td-date', cell: (s) => f().dateTime(s.lastActive) },
              { label: 'Status', cell: (s) => <Badge status={s.status} /> }
            ]}
          />
        </div>

        <div className="card">
          <div className="card-h"><h3>Security events</h3></div>
          <DataTable
            rows={data.securityEvents}
            rowKey={(e) => e.id}
            rowClass={(e) => (e.suspicious ? 'row-suspicious' : '')}
            empty={<Empty icon="shield" title="No security events" text="Sign-ins and security changes will appear here." />}
            cols={[
              { label: 'Time', class: 'td-date', cell: (e) => f().dateTime(e.ts) },
              { label: 'Type', cell: (e) => e.type.replace(/_/g, ' ') },
              { label: 'Device', cell: (e) => e.device },
              { label: 'IP', cell: (e) => e.ip },
              { label: 'Detail', class: 'td-desc', cell: (e) => <span className="small">{e.detail || '—'}</span> },
              { label: 'Flag', cell: (e) => (e.suspicious ? <Badge status="suspicious" label="Suspicious" /> : <span className="muted">—</span>) }
            ]}
          />
        </div>
      </div>
    </>
  );
}

/* ============================================================================
   TAKEOVER
   ========================================================================== */
export function Takeover({ session, refreshSession }) {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput.trim(), 260);
  const users = useData(() => GL().api.admin.users(search ? { search } : {}), [search]);
  const audit = useData(() => GL().api.admin.auditLog({}), []);
  const [busyId, setBusyId] = useState('');

  const active = session && session.kind === 'takeover';

  const history = (audit.data || [])
    .filter((a) => a.action === 'takeover_start' || a.action === 'takeover_end')
    .slice(0, 14);

  const enter = async (u) => {
    const ok = await confirmDialog({
      title: 'Enter takeover mode?',
      message: 'You will view ' + u.name + '’s account inside the customer application with read access and permitted edits (profile fields only). Financial operations remain blocked by the service layer.',
      note: 'The customer is not notified automatically. The session appears in the audit log with a permanent on-screen banner.',
      confirmLabel: 'Enter takeover'
    });
    if (!ok) return;
    setBusyId(u.id);
    try {
      const res = await GL().api.admin.takeover(u.id, 'swiss');
      window.location.href = res.data.redirect;
    } catch (e) { toastErr(e); setBusyId(''); }
  };

  const end = async () => {
    const ok = await confirmDialog({
      title: 'End the takeover session?',
      confirmLabel: 'End takeover',
      message: 'Returns this console to normal administration mode. The customer’s session is unaffected.'
    });
    if (!ok) return;
    try {
      const res = await GL().api.admin.endTakeover();
      refreshSession();
      toast(res.message, 'ok');
      audit.reload();
      window.location.hash = '#/dashboard';
    } catch (e) { toastErr(e); }
  };

  return (
    <>
      <PageHead
        eyebrow="Customers"
        title="Account takeover"
        sub="Audited view-mode access to a customer’s account. Takeover grants read access and permitted profile edits — never financial mutations."
      />

      {active ? (
        <div className="card tk-active">
          <div className="card-b tk-active-in">
            <Icon name="eye" size={20} />
            <div>
              <b>Takeover session active</b>
              <p className="muted small">
                You are signed in as an administrator inside a takeover session for customer{' '}
                <code>{session.userId}</code>. End it there or here — the customer is not notified.
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={end}>
              <Icon name="x" size={14} /> End takeover
            </button>
          </div>
        </div>
      ) : null}

      <div className="card policy-card">
        <div className="card-b">
          <p className="eyebrow">Policy</p>
          <ul className="policy-list">
            <li>Takeover is <b>read + permitted edits</b>: profile fields (name, phone, address) and currency activation only.</li>
            <li><b>No financial operations</b> — balances, withdrawals, transfers, deposit confirmations and ledger entries are blocked in the service layer for every role.</li>
            <li>The customer <b>is not notified automatically</b>; a manual notification can be sent from the account viewer.</li>
            <li>Every start and end is written to the <a href="#/audit">audit log</a>, and the customer app shows a permanent banner during the session.</li>
          </ul>
        </div>
      </div>

      <div className="card filt-card">
        <div className="filt-in">
          <div className="field">
            <label htmlFor="tk-search">Find a customer</label>
            <input id="tk-search" type="search" placeholder="Name, email or country"
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
        </div>
      </div>

      {users.loading ? <Skeleton /> : users.error ? <LoadError error={users.error} retry={users.reload} /> : (
        <DataTable
          rows={users.data || []}
          rowKey={(u) => u.id}
          empty={<Empty icon="users" title="No customers match" text="Try a different search term." />}
          cols={[
            { label: 'Customer', cell: (u) => <a className="td-strong" href={'#/users/' + u.id}>{u.name}<span className="td-sub">{u.email}</span></a> },
            { label: 'Country', cell: (u) => u.country },
            { label: 'Currencies', cell: (u) => u.currencies.map((c) => <span key={c} className="cur-chip">{c}</span>) },
            { label: 'Status', cell: (u) => <Badge status={u.status} /> },
            {
              label: 'Action',
              cell: (u) => (
                <BusyButton busy={busyId === u.id} className="btn btn-ghost btn-sm" onClick={() => enter(u)}>
                  <Icon name="eye" size={14} /> Enter takeover
                </BusyButton>
              )
            }
          ]}
        />
      )}

      <div className="card">
        <div className="card-h">
          <h3>Takeover history</h3>
          <a className="link-sm" href="#/audit">Full audit log</a>
        </div>
        <div className="card-b">
          {history.length ? (
            <ul className="mini-list">
              {history.map((a) => (
                <li key={a.id} className="mini-row">
                  <div className="mini-main">
                    <b>{a.action === 'takeover_start' ? 'Takeover started' : 'Takeover ended'}</b>
                    <span>{a.target} · {a.actorName}</span>
                  </div>
                  <div className="mini-side">
                    <span className="td-date">{fmt().dateTime(a.ts)}</span>
                    <Badge status={a.result} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="history" title="No takeover sessions recorded" text="Start a takeover above to create the first audit entry." />
          )}
        </div>
      </div>
    </>
  );
}
