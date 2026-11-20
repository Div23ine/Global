/* ============================================================================
   MERIDIAN ADMIN — CONCEPT 03 · PREMIUM GLOBAL FINANCIAL PLATFORM
   admin/premium/src/pages-sys.jsx

   Platform pages: Security Monitoring, Reports (charts + CSV export),
   Support (ticket threads), Admin Roles (permission matrix), Audit Logs and
   Settings (platform name, maintenance mode, support email).
   ========================================================================== */
import { useState } from 'react';
import {
  Badge, Chart, ConfirmDialog, DataTable, Empty, ErrorPanel, Field, Icon, PageHead,
  PageSkeleton, OUTCOME_COLORS, PALETTE, StatCard, fail, toast, useAsync, useDebounced
} from './components.jsx';

const GL = () => window.GL;

/* --------------------------------------------------------------------------
   SECURITY — events feed + suspicious toggle + freeze/unfreeze panel
   -------------------------------------------------------------------------- */
const EVENT_LABELS = {
  login: 'Sign-in',
  login_failed: 'Failed sign-in',
  password_change: 'Password changed',
  mfa_disabled: 'MFA disabled',
  account_frozen: 'Account frozen'
};

export function Security() {
  const [suspOnly, setSuspOnly] = useState(false);
  const events = useAsync(() => GL().api.admin.securityEvents({ suspiciousOnly: suspOnly }), [suspOnly]);
  const users = useAsync(() => GL().api.admin.users({}), []);
  const [sel, setSel] = useState('');
  const [reason, setReason] = useState('');
  const [ask, setAsk] = useState(null); /* 'freeze' | 'unfreeze' */
  const [busy, setBusy] = useState(false);
  const fmt = GL().fmt;
  const list = events.data || [];
  const target = (users.data || []).find((x) => x.id === sel) || null;

  const act = async () => {
    setBusy(true);
    try {
      const fn = ask === 'freeze' ? GL().api.admin.freezeUser : GL().api.admin.unfreezeUser;
      const res = await fn(sel, reason.trim());
      toast(res.message);
      setAsk(null);
      setReason('');
      events.reload();
      users.reload();
    } catch (err) {
      fail(err);
      setAsk(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHead eyebrow="Platform" title="Security Monitoring"
        sub="Sign-in history, suspicious activity and administrative freeze controls — demonstration data." />

      <div className="cols-2">
        <div className="col">
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Security events</h2>
              <label className="toggle-inline">
                <input type="checkbox" checked={suspOnly} onChange={(e) => setSuspOnly(e.target.checked)} />
                <span>Suspicious only</span>
              </label>
            </div>
            {events.error ? <ErrorPanel error={events.error} /> : (
              events.loading ? (
                <DataTable loading columns={[{ h: 'Event', c: () => null }, { h: 'Detail', c: () => null }]} rows={[]} />
              ) : (!list.length ? (
                <Empty icon="shield-check" title="No security events"
                  text={suspOnly ? 'No suspicious events have been flagged.' : 'Security events will appear here as customers sign in.'} />
              ) : (
                <div className="event-feed">
                  {list.map((ev) => (
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
                        <div className="event-meta">
                          {ev.userName} · {ev.device} · <span className="mono">{ev.ip}</span>
                          {ev.location && ev.location !== '—' ? ' · ' + ev.location : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">Freeze / unfreeze</h2></div>
            <p className="panel-sub">Freezing blocks customer sign-in until it is lifted. The reason is recorded in the audit log — the customer is not notified automatically.</p>
            {users.error ? <ErrorPanel error={users.error} /> : (
              <>
                <Field label="Customer" htmlFor="sec-user">
                  <select id="sec-user" value={sel} onChange={(e) => setSel(e.target.value)}>
                    <option value="">{users.loading ? 'Loading customers…' : 'Select a customer…'}</option>
                    {(users.data || []).map((x) => (
                      <option key={x.id} value={x.id}>{x.name} — {x.status}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Reason (audit log)" htmlFor="sec-reason">
                  <input id="sec-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Suspicious login pattern" />
                </Field>
                <div className="form-actions">
                  <button type="button" className="btn btn-danger" disabled={!sel} onClick={() => setAsk('freeze')}>
                    <Icon name="snowflake" size={15} /> Freeze account
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={!sel} onClick={() => setAsk('unfreeze')}>
                    <Icon name="check-circle" size={15} /> Unfreeze account
                  </button>
                </div>
                {target && target.status === 'frozen' && (
                  <p className="field-hint" style={{ marginTop: 12 }}>
                    <b>{target.name}</b> is currently frozen. Unfreezing restores sign-in immediately.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">About this feed</h2></div>
            <p className="small muted" style={{ margin: 0 }}>
              Events are recorded for sign-ins, failed attempts, password changes, MFA changes and administrative freezes. Suspicious events are flagged by the demonstration detection rules — in production these come from the risk engine.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!ask}
        danger={ask === 'freeze'}
        busy={busy}
        title={ask === 'freeze' ? 'Freeze this account?' : 'Unfreeze this account?'}
        confirmLabel={ask === 'freeze' ? 'Freeze account' : 'Unfreeze account'}
        onCancel={() => setAsk(null)}
        onConfirm={act}
      >
        <p>{ask === 'freeze'
          ? 'The customer will be unable to sign in until the account is unfrozen. The action is recorded in the audit log; the customer is not notified automatically.'
          : 'The customer will be able to sign in again. The action is recorded in the audit log.'}</p>
        {target && <p><b>{target.name}</b> · {target.email}</p>}
      </ConfirmDialog>
    </div>
  );
}

/* --------------------------------------------------------------------------
   REPORTS — charts + tables + CSV export
   -------------------------------------------------------------------------- */
export function Reports() {
  const { data, loading, error } = useAsync(() => GL().api.admin.reports(), []);
  const fmt = GL().fmt;

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorPanel error={error} />;

  const countryRows = Object.entries(data.byCountry).sort((a, b) => b[1] - a[1]);
  const totalCustomers = countryRows.reduce((s, x) => s + x[1], 0);

  const exportCsv = () => {
    const rows = [
      ['Meridian Global Accounts — admin report (demonstration data)'],
      ['Generated', fmt.dateTime(Date.now())],
      [],
      ['Deposits by method'],
      ['Method', 'Deposits', 'Volume USD'],
      ...data.byMethod.map((m) => [m.method, m.count, m.volumeUsd]),
      [],
      ['Payment outcome mix'],
      ['Outcome', 'Attempts'],
      ...data.outcomeMix.map((o) => [o.status, o.count]),
      [],
      ['Users by country'],
      ['Country', 'Customers'],
      ...countryRows.map(([c, n]) => [c, n]),
      [],
      ['Totals'],
      ['Customers', data.totals.users],
      ['Deposits', data.totals.deposits],
      ['Ledger entries', data.totals.transactions]
    ];
    GL().util.downloadText('meridian-report-DEMO.csv', GL().util.toCsv(rows));
    toast('Report exported — meridian-report-DEMO.csv (demo text file).');
  };

  return (
    <div>
      <PageHead eyebrow="Platform" title="Reports"
        sub="Aggregated demonstration figures across deposits, payment attempts and customers. Every number is sample data."
        actions={(
          <button type="button" className="btn btn-primary" onClick={exportCsv}>
            <Icon name="download" size={15} /> Export CSV
          </button>
        )} />

      <div className="kpi-grid">
        <StatCard icon="users" label="Customers" value={fmt.num(data.totals.users)} sub="Registered on the demo platform" />
        <StatCard icon="wallet" tone="t-success" label="Deposits" value={fmt.num(data.totals.deposits)} sub="Across all statuses" />
        <StatCard icon="exchange" tone="t-warn" label="Ledger entries" value={fmt.num(data.totals.transactions)} sub="Across all currencies" />
      </div>

      <div className="cols-2">
        <div className="col">
          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Deposits by method</h2>
              <span className="small muted nowrap">Count of deposits</span>
            </div>
            <Chart height={200} deps={[data]} draw={(c) => GL().charts.bars(c, {
              values: data.byMethod.map((m) => m.count),
              labels: data.byMethod.map((m) => m.method),
              color: PALETTE[0],
              yFmt: (v) => Math.round(v)
            })} />
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr><th>Method</th><th className="num">Deposits</th><th className="num">Volume (USD)</th></tr>
                </thead>
                <tbody>
                  {data.byMethod.map((m) => (
                    <tr key={m.method}>
                      <td className="cell-main">{m.method}</td>
                      <td className="num">{fmt.num(m.count)}</td>
                      <td className="num">{fmt.usd(m.volumeUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">Payment outcome mix</h2></div>
            <Chart height={190} deps={[data]} draw={(c) => GL().charts.donut(c, {
              segments: data.outcomeMix.map((o) => ({ value: o.count, color: OUTCOME_COLORS[o.status], label: o.status })),
              centre: 'attempts'
            })} />
            <div className="legend">
              {data.outcomeMix.map((o) => (
                <div className="legend-row" key={o.status}>
                  <span className="legend-swatch" style={{ background: OUTCOME_COLORS[o.status] }} />
                  <b>{o.status}</b>
                  <span className="legend-val">{o.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">Customers by country</h2></div>
            <DataTable
              columns={[
                { h: 'Country', c: (r) => r[0] },
                { h: 'Customers', num: true, c: (r) => r[1] },
                { h: 'Share', num: true, c: (r) => (totalCustomers ? Math.round((r[1] / totalCustomers) * 100) + '%' : '—') }
              ]}
              rows={countryRows} rowKey={(r) => r[0]}
              empty={{ icon: 'map-pin', title: 'No customers yet', text: 'Registrations will be summarised here.' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   SUPPORT — ticket list, thread view, reply, resolve toggle
   -------------------------------------------------------------------------- */
export function Support() {
  const { data, loading, error, reload } = useAsync(() => GL().api.admin.tickets(), []);
  const [selId, setSelId] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const fmt = GL().fmt;
  const list = data || [];
  const sel = list.find((t) => t.id === selId) || list[0] || null;

  const sendReply = async (e) => {
    e.preventDefault();
    if (!sel || !reply.trim()) return;
    setBusy(true);
    try {
      const res = await GL().api.admin.replyTicket(sel.id, reply.trim());
      toast(res.message || 'Reply sent.');
      setReply('');
      reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const toggleResolve = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const res = await GL().api.admin.resolveTicket(sel.id);
      toast(res.message);
      reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorPanel error={error} />;

  return (
    <div>
      <PageHead eyebrow="Platform" title="Support"
        sub="Customer conversations for the demonstration platform. Replies appear in the customer’s thread and send an in-app notification (demo)." />

      {!list.length ? (
        <div className="panel">
          <Empty icon="ticket" title="No support tickets"
            text="When customers write in from their application, their conversations appear here." />
        </div>
      ) : (
        <div className="support-grid">
          <div className="ticket-list" aria-label="Tickets">
            {list.map((t) => (
              <button type="button" key={t.id}
                className={'ticket-item' + (sel && sel.id === t.id ? ' active' : '')}
                onClick={() => setSelId(t.id)}>
                <div className="ti-top">
                  <span className="ti-subject">{t.subject}</span>
                  <Badge status={t.status} />
                </div>
                <div className="ti-meta">{t.userName} · {t.category}</div>
                <div className="ti-time">{fmt.timeAgo(t.createdAt)} · {t.messages.length} message{t.messages.length === 1 ? '' : 's'}</div>
              </button>
            ))}
          </div>

          {sel && (
            <div className="panel thread-panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">{sel.subject}</h2>
                  <p className="panel-sub">{sel.userName} · {sel.userEmail} · {sel.category} · opened {fmt.date(sel.createdAt)}</p>
                </div>
                <button type="button" className={'btn btn-sm ' + (sel.status === 'open' ? 'btn-primary' : 'btn-ghost')}
                  onClick={toggleResolve} disabled={busy}>
                  {sel.status === 'open' ? 'Resolve ticket' : 'Reopen ticket'}
                </button>
              </div>
              <div className="thread">
                {sel.messages.map((m, i) => (
                  <div key={i} className={'bubble ' + (m.from === 'support' ? 'from-support' : 'from-customer')}>
                    <div className="bubble-text">{m.text}</div>
                    <div className="bubble-time">{m.from === 'support' ? 'Support' : sel.userName} · {fmt.dateTime(m.ts)}</div>
                  </div>
                ))}
              </div>
              <form className="reply-form" onSubmit={sendReply}>
                <Field label="Reply as support" htmlFor="reply-text">
                  <textarea id="reply-text" value={reply} onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply — it will appear in the customer’s thread and send a demo notification." />
                </Field>
                <div className="form-actions">
                  <button type="submit" className={'btn btn-primary' + (busy ? ' is-busy' : '')} disabled={busy || !reply.trim()}>
                    <Icon name="send" size={14} /> Send reply
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   ROLES — role cards + permission matrix
   -------------------------------------------------------------------------- */
function MatrixCell({ v }) {
  const cls = v === 'Blocked' ? 'm-block'
    : v === 'Full' ? 'm-full'
    : v === 'Edit' ? 'm-edit'
    : v === 'None' ? 'm-none'
    : 'm-view';
  return <span className={'m-cell ' + cls}>{v === 'None' ? '—' : v}</span>;
}

export function Roles() {
  const { data, loading, error } = useAsync(() => GL().api.admin.roles(), []);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorPanel error={error} />;

  const m = data.matrix;
  return (
    <div>
      <PageHead eyebrow="Platform" title="Admin Roles"
        sub="The role model for this console (demonstration data). The signed-in demo administrator is a Super Administrator." />

      <div className="role-grid">
        {data.roles.map((r) => (
          <div key={r.id} className="panel role-card">
            <div className="role-head">
              <span className="role-ic"><Icon name="key" size={15} /></span>
              <h2 className="panel-title">{r.name}</h2>
            </div>
            <p className="role-desc">{r.desc}</p>
            <div className="role-members">
              {r.members.map((mm) => (
                <span key={mm} className="member-chip"><Icon name="user" size={11} /> {mm}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Permission matrix</h2>
          <span className="small muted">Areas × roles</span>
        </div>
        <DataTable
          columns={[
            { h: 'Area', c: (r) => <span className="cell-main">{r.area}</span> },
            ...m.columns.map((col, ci) => ({ h: col, c: (r) => <MatrixCell v={r.v[ci]} /> }))
          ]}
          rows={m.rows} rowKey={(r) => r.area}
        />
        <p className="matrix-note">
          <Icon name="shield-check" size={14} />
          <span>“Blocked” is not a UI restriction — the financial service layer rejects those operations for every administrator role. The production backend enforces this server-side; you can see the live rejection in the User Viewer restrictions panel.</span>
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   AUDIT — search + result filter, denied rows highlighted
   -------------------------------------------------------------------------- */
export function Audit() {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const q = useDebounced(search, 300);
  const { data, loading, error } = useAsync(
    () => GL().api.admin.auditLog({ search: q, result }),
    [q, result]
  );
  const fmt = GL().fmt;

  return (
    <div>
      <PageHead eyebrow="Platform" title="Audit Logs"
        sub="Every administrative action — permitted and denied — with actor, target and result. Denied attempts are highlighted." />

      <div className="filters">
        <div className="field">
          <label htmlFor="au-search">Search</label>
          <div className="search-wrap">
            <Icon name="search" size={15} />
            <input id="au-search" type="search" placeholder="Action, target, detail or actor"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="au-result">Result</label>
          <select id="au-result" value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="">Any result</option>
            <option value="allowed">Allowed</option>
            <option value="denied">Denied</option>
          </select>
        </div>
      </div>

      {error ? <ErrorPanel error={error} /> : (
        <DataTable
          loading={loading}
          columns={[
            { h: 'Time', c: (r) => <span className="nowrap">{fmt.dateTime(r.ts)}</span> },
            { h: 'Actor', c: (r) => <div><div className="cell-main">{r.actorName}</div><div className="cell-sub">{r.actor}</div></div> },
            { h: 'Action', c: (r) => <span className="mono">{r.action}</span> },
            { h: 'Target', c: (r) => r.target },
            { h: 'Detail', c: (r) => <span className="detail-cell" title={r.detail}>{r.detail}</span> },
            { h: 'Result', c: (r) => <Badge status={r.result} label={r.result} /> }
          ]}
          rows={data || []} rowKey={(r) => r.id}
          rowClass={(r) => (r.result === 'denied' ? 'denied' : '')}
          empty={{ icon: 'book', title: 'No audit entries', text: 'Administrative actions — allowed and denied — will be recorded here.' }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   SETTINGS — platform name, maintenance toggle, support email
   -------------------------------------------------------------------------- */
export function Settings() {
  const { data, loading, error, reload } = useAsync(() => GL().api.admin.settings(), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const fmt = GL().fmt;

  /* derived so the form is usable on the first render after data arrives */
  const f = form || (data ? {
    platformName: data.platformName || '',
    maintenanceMode: !!data.maintenanceMode,
    supportEmail: data.supportEmail || ''
  } : null);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorPanel error={error} />;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await GL().api.admin.updateSettings(f);
      toast(res.message || 'Settings saved.');
      reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHead eyebrow="Platform" title="Settings"
        sub="Platform-wide configuration for the demonstration environment. Changes are audited and visible across every demo app on this origin." />

      <div className="cols-2">
        <div className="col">
          <form className="panel" onSubmit={save}>
            <div className="panel-head"><h2 className="panel-title">Platform</h2></div>
            <Field label="Platform name" htmlFor="set-name" hint="Shown across the customer applications.">
              <input id="set-name" value={f.platformName} onChange={(e) => setForm({ ...f, platformName: e.target.value })} />
            </Field>
            <Field label="Support email" htmlFor="set-mail" hint="Displayed on the customer contact page.">
              <input id="set-mail" type="email" value={f.supportEmail} onChange={(e) => setForm({ ...f, supportEmail: e.target.value })} />
            </Field>
            <label className="toggle-row" htmlFor="set-maint">
              <input id="set-maint" type="checkbox" checked={f.maintenanceMode}
                onChange={(e) => setForm({ ...f, maintenanceMode: e.target.checked })} />
              <span className="toggle-copy">
                <b>Maintenance mode</b>
                <small>Displays a scheduled-maintenance banner in the customer applications (demo).</small>
              </span>
              <span className="switch" aria-hidden="true" />
            </label>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="submit" className={'btn btn-primary' + (busy ? ' is-busy' : '')} disabled={busy}>
                <Icon name="check" size={15} /> Save settings
              </button>
            </div>
          </form>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">Currency availability</h2></div>
            <p className="panel-sub">Live platform state — managed from Currency Management.</p>
            <div className="chips">
              {Object.entries(data.currencyStatus || {}).map(([code, st]) => (
                <span className="cur-chip" key={code}>{code} <Badge status={st} /></span>
              ))}
            </div>
            <p className="field-hint" style={{ marginTop: 14 }}>
              Rates last updated {fmt.dateTime(data.lastRatesUpdate)} — static demonstration rates, per 1 USD.
            </p>
          </div>
          <div className="panel">
            <div className="panel-head"><h2 className="panel-title">About this console</h2></div>
            <p className="small muted" style={{ margin: 0 }}>
              This administration console is part of a design prototype for the Meridian Global Accounts platform. Every customer, balance, deposit and audit entry is demonstration data held in your browser — no real money moves and no real notifications are delivered. Financial mutations are blocked for every administrator role by policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
