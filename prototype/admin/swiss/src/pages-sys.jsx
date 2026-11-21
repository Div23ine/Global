/* ============================================================================
   MERIDIAN ADMIN — Design Concept 1 · “Swiss Private Banking”
   admin/swiss/src/pages-sys.jsx

   Security · Reports · Support · Roles · Audit · Settings
   ========================================================================== */
import React, { useEffect, useState } from 'react';
import {
  Icon, Badge, StatCard, DataTable, Skeleton, Empty, LoadError, PageHead,
  toast, toastErr, confirmDialog, TextField, BusyButton,
  useData, useDebounced, Chart, CHART_COLORS
} from './components.jsx';

const GL = () => window.GL;
const fmt = () => GL().fmt;

/* ============================================================================
   SECURITY MONITORING
   ========================================================================== */
export function Security() {
  const [suspOnly, setSuspOnly] = useState(false);
  const events = useData(
    () => GL().api.admin.securityEvents(suspOnly ? { suspiciousOnly: true } : {}), [suspOnly]
  );
  const users = useData(() => GL().api.admin.users({}), []);
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  const list = users.data || [];
  const selected = list.filter((u) => u.id === userId)[0] || null;

  const freeze = async () => {
    if (!selected) { toast('Select a customer first.', 'err'); return; }
    const ok = await confirmDialog({
      title: 'Freeze ' + selected.name + '?',
      danger: true,
      confirmLabel: 'Freeze account',
      message: 'Sign-ins and deposits are blocked until the account is unfrozen. The customer sees the reason on the frozen screen.',
      note: reason ? 'Reason: ' + reason.trim() : 'No reason entered — “Security review” will be recorded.'
    });
    if (!ok) return;
    setBusy('freeze');
    try {
      const res = await GL().api.admin.freezeUser(selected.id, reason.trim());
      toast(res.message, 'ok');
      setReason('');
      users.reload(); events.reload();
    } catch (e) { toastErr(e); }
    setBusy('');
  };

  const unfreeze = async () => {
    if (!selected) { toast('Select a customer first.', 'err'); return; }
    const ok = await confirmDialog({
      title: 'Unfreeze ' + selected.name + '?',
      confirmLabel: 'Unfreeze account',
      message: 'The customer will be able to sign in and deposit again.'
    });
    if (!ok) return;
    setBusy('unfreeze');
    try {
      const res = await GL().api.admin.unfreezeUser(selected.id, reason.trim());
      toast(res.message, 'ok');
      setReason('');
      users.reload(); events.reload();
    } catch (e) { toastErr(e); }
    setBusy('');
  };

  return (
    <>
      <PageHead
        eyebrow="Platform"
        title="Security monitoring"
        sub="Sign-in and account security events recorded in the demo store, with a suspicious-activity filter."
      />

      <div className="grid-2">
        <div className="card">
          <div className="card-h">
            <h3>Event feed</h3>
            <label className="check-toggle">
              <input type="checkbox" checked={suspOnly} onChange={(e) => setSuspOnly(e.target.checked)} />
              <span>Suspicious only</span>
            </label>
          </div>
          {events.loading ? <div className="card-b"><Skeleton /></div> : events.error ? (
            <div className="card-b"><LoadError error={events.error} retry={events.reload} /></div>
          ) : (
            <DataTable
              rows={events.data || []}
              rowKey={(e) => e.id}
              rowClass={(e) => (e.suspicious ? 'row-suspicious' : '')}
              empty={<Empty icon="shield" title="No security events" text={suspOnly ? 'No suspicious events recorded.' : 'Sign-ins and security changes will appear here.'} />}
              cols={[
                { label: 'Time', class: 'td-date', cell: (e) => fmt().dateTime(e.ts) },
                { label: 'Customer', cell: (e) => <a className="td-strong" href={'#/users/' + e.userId}>{e.userName}</a> },
                { label: 'Type', cell: (e) => e.type.replace(/_/g, ' ') },
                { label: 'Device', cell: (e) => e.device },
                { label: 'IP', cell: (e) => e.ip },
                { label: 'Location', cell: (e) => e.location },
                { label: 'Flag', cell: (e) => (e.suspicious ? <Badge status="suspicious" label="Suspicious" /> : <span className="muted">—</span>) }
              ]}
            />
          )}
        </div>

        <div className="card">
          <div className="card-h"><h3>Freeze / unfreeze</h3></div>
          <div className="card-b">
            <p className="hint" style={{ marginBottom: 16 }}>
              Freeze a customer account pending security review. The action is audited and the
              customer is not notified automatically.
            </p>
            <div className="field">
              <label htmlFor="sec-user">Customer</label>
              <select id="sec-user" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Select customer…</option>
                {list.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.email} ({u.status})</option>
                ))}
              </select>
            </div>
            <TextField id="sec-reason" label="Reason" value={reason} onChange={setReason}
              placeholder="e.g. Suspicious login pattern — pending review" />
            {selected && selected.status === 'frozen' ? (
              <BusyButton busy={busy === 'unfreeze'} className="btn btn-ghost btn-block" onClick={unfreeze}>
                <Icon name="refresh" size={16} /> Unfreeze {selected.name}
              </BusyButton>
            ) : (
              <BusyButton busy={busy === 'freeze'} className="btn btn-danger btn-block" onClick={freeze} disabled={!selected}>
                <Icon name="snowflake" size={16} /> Freeze account
              </BusyButton>
            )}
            {selected && selected.status === 'frozen' ? (
              <p className="hint" style={{ marginTop: 12 }}>
                This account is currently frozen. The reason shown to the customer comes from the
                account viewer or this panel.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================================
   REPORTS
   ========================================================================== */
export function Reports() {
  const { data, loading, error, reload } = useData(() => GL().api.admin.reports(), []);
  if (loading) return <Skeleton />;
  if (error) return <LoadError error={error} retry={reload} />;

  const exportCsv = () => {
    const rows = [['Report', 'Item', 'Value']];
    data.byMethod.forEach((m) => {
      rows.push(['Deposits by method', m.method + ' — attempts', m.count]);
      rows.push(['Deposits by method', m.method + ' — volume USD', m.volumeUsd]);
    });
    data.outcomeMix.forEach((o) => rows.push(['Payment outcome mix', o.status, o.count]));
    Object.keys(data.byCountry).sort().forEach((c) => rows.push(['Users by country', c, data.byCountry[c]]));
    rows.push(['Totals', 'Customers', data.totals.users]);
    rows.push(['Totals', 'Deposits', data.totals.deposits]);
    rows.push(['Totals', 'Transactions', data.totals.transactions]);
    GL().util.downloadText('meridian-report-DEMO.csv', GL().util.toCsv(rows));
    toast('Demo CSV exported — sample data only.', 'ok');
  };

  const countryRows = Object.keys(data.byCountry).sort()
    .map((c) => ({ country: c, count: data.byCountry[c] }));

  return (
    <>
      <PageHead
        eyebrow="Platform"
        title="Reports"
        sub="Aggregate views over the demo dataset. The export is a plain CSV for review — sample data only."
      >
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}>
          <Icon name="download" size={15} /> Export CSV
        </button>
      </PageHead>

      <div className="kpi-grid">
        <StatCard label="Customers" value={fmt().num(data.totals.users)} icon="users" />
        <StatCard label="Deposits" value={fmt().num(data.totals.deposits)} icon="plus" />
        <StatCard label="Transactions" value={fmt().num(data.totals.transactions)} icon="receipt" />
      </div>

      <div className="grid-2">
        <div className="card chart-card">
          <div className="card-h"><h3>Deposits by method</h3><span className="res-count">Attempt count</span></div>
          <div className="card-b">
            <Chart
              height={200}
              label="Deposits by method"
              deps={[data]}
              draw={(c) => GL().charts.bars(c, {
                values: data.byMethod.map((m) => m.count),
                labels: data.byMethod.map((m) => m.method.replace(' card', '').replace('Payment gateway', 'Gateway').replace('Bank transfer', 'Transfer')),
                color: '#2E5A88',
                yFmt: (v) => fmt().num(Math.round(v))
              })}
            />
          </div>
          <DataTable
            rows={data.byMethod}
            rowKey={(m) => m.method}
            cols={[
              { label: 'Method', cell: (m) => m.method },
              { label: 'Attempts', class: 'num ta-r', cell: (m) => fmt().num(m.count) },
              { label: 'Volume (USD)', class: 'num ta-r', cell: (m) => fmt().usd(m.volumeUsd) }
            ]}
          />
        </div>

        <div className="stack">
          <div className="card chart-card">
            <div className="card-h"><h3>Payment outcome mix</h3></div>
            <div className="card-b">
              <div className="donut-flex">
                <Chart
                  height={150}
                  label="Payment outcome mix"
                  deps={[data]}
                  draw={(c) => GL().charts.donut(c, {
                    segments: data.outcomeMix.map((o, i) => ({
                      value: o.count, color: CHART_COLORS[i % CHART_COLORS.length],
                      label: o.status.charAt(0).toUpperCase() + o.status.slice(1)
                    })),
                    centre: 'Attempts'
                  })}
                />
                <div className="ov-legend">
                  {data.outcomeMix.map((o, i) => (
                    <div key={o.status} className="ov-leg-item">
                      <i style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}></i>
                      <span className="lg-code">{o.status.charAt(0).toUpperCase() + o.status.slice(1)}</span>
                      <span className="lg-val">{fmt().num(o.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Users by country</h3></div>
            <DataTable
              rows={countryRows}
              rowKey={(r) => r.country}
              empty={<Empty icon="map-pin" title="No customers" text="Country distribution will appear here." />}
              cols={[
                { label: 'Country', cell: (r) => r.country },
                { label: 'Customers', class: 'num ta-r', cell: (r) => fmt().num(r.count) }
              ]}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================================
   SUPPORT
   ========================================================================== */
export function Support() {
  const { data, loading, error, reload } = useData(() => GL().api.admin.tickets(), []);
  const [selId, setSelId] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState('');

  const list = data || [];
  const sel = list.filter((t) => t.id === selId)[0] || list[0] || null;

  useEffect(() => { setReply(''); }, [selId]);

  const sendReply = async () => {
    if (!sel) return;
    if (!reply.trim()) { toast('Write a reply first.', 'err'); return; }
    const ok = await confirmDialog({
      title: 'Send this reply?',
      confirmLabel: 'Send reply',
      message: 'Your message is added to the ticket thread and the customer receives an in-app notification (demo).'
    });
    if (!ok) return;
    setBusy('reply');
    try {
      const res = await GL().api.admin.replyTicket(sel.id, reply.trim());
      toast(res.message, 'ok');
      setReply('');
      reload();
    } catch (e) { toastErr(e); }
    setBusy('');
  };

  const toggleResolve = async () => {
    if (!sel) return;
    const resolving = sel.status !== 'resolved';
    const ok = await confirmDialog({
      title: resolving ? 'Mark this ticket resolved?' : 'Reopen this ticket?',
      confirmLabel: resolving ? 'Mark resolved' : 'Reopen ticket',
      message: resolving
        ? 'The ticket stays in the list with a resolved status; the customer can still read the thread.'
        : 'The ticket returns to the open queue.'
    });
    if (!ok) return;
    setBusy('resolve');
    try {
      const res = await GL().api.admin.resolveTicket(sel.id);
      toast(res.message, 'ok');
      reload();
    } catch (e) { toastErr(e); }
    setBusy('');
  };

  if (loading) return <Skeleton />;
  if (error) return <LoadError error={error} retry={reload} />;

  return (
    <>
      <PageHead
        eyebrow="Platform"
        title="Support"
        sub="Customer support tickets from the demo store. Replies deliver an in-app notification (demo only)."
      />

      {list.length ? (
        <div className="grid-sup">
          <div className="stack">
            {list.map((t) => (
              <button
                key={t.id}
                type="button"
                className={'ticket-pick' + (sel && sel.id === t.id ? ' on' : '')}
                onClick={() => setSelId(t.id)}
              >
                <span className="tp-main">
                  <b>{t.subject}</b>
                  <span>{t.userName} · {t.category}</span>
                </span>
                <span className="tp-side">
                  <Badge status={t.status} />
                  <time>{fmt().timeAgo(t.createdAt)}</time>
                </span>
              </button>
            ))}
          </div>

          {sel ? (
            <div className="card">
              <div className="card-h">
                <div>
                  <h3>{sel.subject}</h3>
                  <p className="ticket-meta">
                    {sel.userName} &lt;{sel.userEmail}&gt; · {sel.category} · opened {fmt().dateTime(sel.createdAt)}
                  </p>
                </div>
                <div className="card-h-acts">
                  <Badge status={sel.status} />
                  <BusyButton busy={busy === 'resolve'} className="btn btn-ghost btn-sm" onClick={toggleResolve}>
                    {sel.status === 'resolved' ? 'Reopen' : 'Resolve'}
                  </BusyButton>
                </div>
              </div>
              <div className="card-b">
                <div className="thread">
                  {sel.messages.map((m, i) => (
                    <div key={i} className={'msg ' + (m.from === 'customer' ? 'msg-customer' : 'msg-support')}>
                      <p>{m.text}</p>
                      <time>{m.from === 'customer' ? sel.userName : 'Meridian support'} · {fmt().dateTime(m.ts)}</time>
                    </div>
                  ))}
                </div>
                <hr className="hairline" />
                <TextField id="sup-reply" label="Reply as Meridian support" textarea value={reply}
                  onChange={setReply} placeholder="Write the support reply…" />
                <div className="form-foot">
                  <span className="hint">The customer receives an in-app notification (demo).</span>
                  <BusyButton busy={busy === 'reply'} className="btn btn-primary btn-sm" onClick={sendReply}>
                    <Icon name="send" size={15} /> Send reply
                  </BusyButton>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <Empty icon="ticket" title="No support tickets" text="Tickets raised in the customer app will appear here." />
      )}
    </>
  );
}

/* ============================================================================
   ROLES
   ========================================================================== */
export function Roles() {
  const { data, loading, error, reload } = useData(() => GL().api.admin.roles(), []);
  if (loading) return <Skeleton />;
  if (error) return <LoadError error={error} retry={reload} />;

  const cellClass = (v) =>
    v === 'Blocked' ? 'cell-blocked' : (v === 'None' ? 'cell-none' : 'cell-val');

  return (
    <>
      <PageHead
        eyebrow="Platform"
        title="Admin roles"
        sub="Demonstration roles and their permission matrix. Financial restrictions are enforced in the service layer for every role — not just hidden in the interface."
      />

      <div className="role-grid">
        {data.roles.map((r) => (
          <div key={r.id} className="card role-card">
            <div className="card-b">
              <p className="eyebrow">{r.members.length} member{r.members.length === 1 ? '' : 's'}</p>
              <h3 className="role-name">{r.name}</h3>
              <p className="muted small">{r.desc}</p>
              <div className="role-members">
                {r.members.map((m) => (
                  <span key={m} className="cur-chip">{m}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Permission matrix</h3>
          <span className="res-count">Blocked = enforced in the service layer</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Area</th>
                {data.matrix.columns.map((c) => <th key={c} className="ta-r">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.matrix.rows.map((row) => (
                <tr key={row.area}>
                  <td className="td-strong">{row.area}</td>
                  {row.v.map((v, i) => (
                    <td key={i} className={'ta-r ' + cellClass(v)}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="notice">
        <Icon name="lock" size={16} />
        <p>
          <b>Financial restrictions are enforced in the service layer.</b> Edit balances, withdraw,
          transfer, alter deposit confirmations and edit ledger entries are rejected with a 403 for
          every role — including Super Administrator. See the account viewer for a live demonstration.
        </p>
      </div>
    </>
  );
}

/* ============================================================================
   AUDIT LOG
   ========================================================================== */
export function Audit() {
  const [searchInput, setSearchInput] = useState('');
  const [result, setResult] = useState('');
  const search = useDebounced(searchInput.trim(), 260);

  const q = { search, result };
  const { data, loading, error, reload } = useData(() => GL().api.admin.auditLog(q), [search, result]);

  return (
    <>
      <PageHead
        eyebrow="Platform"
        title="Audit logs"
        sub="Every administrative action — allowed and denied — with actor, target and result. Denied entries highlight attempts blocked by policy."
      />
      <div className="card filt-card">
        <div className="filt-in">
          <div className="field">
            <label htmlFor="aud-search">Search</label>
            <input id="aud-search" type="search" placeholder="Action, actor, target or detail"
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="aud-result">Result</label>
            <select id="aud-result" value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="">All results</option>
              <option value="allowed">Allowed</option>
              <option value="denied">Denied</option>
            </select>
          </div>
          <div className="filt-acts">
            <span className="res-count">{(data || []).length} entr{(data || []).length === 1 ? 'y' : 'ies'}</span>
          </div>
        </div>
      </div>

      {loading ? <Skeleton /> : error ? <LoadError error={error} retry={reload} /> : (
        <DataTable
          rows={data || []}
          rowKey={(a) => a.id}
          rowClass={(a) => (a.result === 'denied' ? 'row-denied' : '')}
          empty={<Empty icon="history" title="No audit entries" text={search || result ? 'Nothing matches the current filters.' : 'Administrative actions will be recorded here.'} />}
          cols={[
            { label: 'Time', class: 'td-date', cell: (a) => fmt().dateTime(a.ts) },
            { label: 'Actor', cell: (a) => <span className="td-strong">{a.actorName}<span className="td-sub">{a.actor}</span></span> },
            { label: 'Action', cell: (a) => <code className="act-code">{a.action}</code> },
            { label: 'Target', cell: (a) => a.target },
            { label: 'Detail', class: 'td-desc', cell: (a) => <span className="small">{a.detail || '—'}</span> },
            { label: 'Result', cell: (a) => <Badge status={a.result} /> }
          ]}
        />
      )}
    </>
  );
}

/* ============================================================================
   SETTINGS
   ========================================================================== */
export function Settings() {
  const { data, loading, error, reload } = useData(() => GL().api.admin.settings(), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !form) {
      setForm({
        platformName: data.platformName || '',
        maintenanceMode: !!data.maintenanceMode,
        supportEmail: data.supportEmail || ''
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading) return <Skeleton />;
  if (error) return <LoadError error={error} retry={reload} />;
  if (!form) return null;

  const save = async () => {
    setBusy(true);
    try {
      const res = await GL().api.admin.updateSettings({
        platformName: form.platformName.trim(),
        maintenanceMode: form.maintenanceMode,
        supportEmail: form.supportEmail.trim()
      });
      toast(res.message || 'Settings saved.', 'ok');
      reload();
    } catch (e) { toastErr(e); }
    setBusy(false);
  };

  return (
    <>
      <PageHead
        eyebrow="Platform"
        title="Settings"
        sub="Platform-wide configuration. Every change is written to the audit log and shared with the customer apps in this browser."
      />

      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3>Platform</h3></div>
          <div className="card-b">
            <TextField id="set-name" label="Platform name" value={form.platformName}
              onChange={(v) => setForm({ ...form, platformName: v })}
              hint="Shown in the customer applications and public pages (demo)." />
            <TextField id="set-email" label="Support email" type="email" value={form.supportEmail}
              onChange={(v) => setForm({ ...form, supportEmail: v })}
              hint="Displayed on the customer contact page (demo address — nothing is actually sent)." />

            <div className="field switch-field">
              <label htmlFor="set-maint">Maintenance mode</label>
              <div className="switch-row">
                <button
                  type="button"
                  id="set-maint"
                  role="switch"
                  aria-checked={form.maintenanceMode}
                  className={'switch' + (form.maintenanceMode ? ' on' : '')}
                  onClick={() => setForm({ ...form, maintenanceMode: !form.maintenanceMode })}
                >
                  <span className="switch-knob"></span>
                </button>
                <span className="switch-label">
                  {form.maintenanceMode ? 'On — banner shown in the customer apps' : 'Off'}
                </span>
              </div>
              <p className="hint">
                Shows a thin “scheduled maintenance” banner in the customer applications. Nothing is
                actually blocked in this demo.
              </p>
            </div>

            <div className="form-foot">
              <span className="hint">Changes are audited (settings_update).</span>
              <BusyButton busy={busy} className="btn btn-primary" onClick={save}>
                Save settings
              </BusyButton>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Read-only configuration</h3></div>
          <div className="card-b">
            <dl className="detail-list">
              <div><dt>Indicative rates</dt><dd>Static demo values (shared/api.js)</dd></div>
              <div><dt>Last rates update</dt><dd>{fmt().dateTime(data.lastRatesUpdate)}</dd></div>
              <div><dt>Deposit methods</dt><dd>{GL().DEPOSIT_METHODS.length} simulated methods</dd></div>
              <div><dt>Forced outcome</dt><dd>{GL().api.demo.forcedOutcome() === 'auto' ? 'Auto (gateway decides)' : GL().api.demo.forcedOutcome()}</dd></div>
              <div><dt>Currency availability</dt><dd>
                {GL().CURRENCIES.map((c) => (
                  <span key={c.code} className="cur-chip">
                    {c.code} · {(GL().api.demo.currencyStatus()[c.code] || 'unavailable') === 'active' ? 'on' : 'off'}
                  </span>
                ))}
              </dd></div>
            </dl>
            <p className="hint">
              These values come from the shared demo store. Use{' '}
              <a href="#/currencies">Currency Management</a> for availability, or the demo panel
              (bottom right) to force deposit outcomes and reset the data.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
