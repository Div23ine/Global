/* ==========================================================================
   MERIDIAN ADMIN — Hong Kong International Fintech (Design 2)
   admin/hongkong/src/App.jsx

   Application shell: hash router, admin session gate (kind admin or
   takeover), dark-navy grouped sidebar, topbar, mobile off-canvas drawer,
   toast host + confirm provider. All routing is hash-based so the built
   bundle opens directly from the filesystem.
   ========================================================================== */
import React, { useState, useEffect, useRef } from 'react';
import { Icon, ToastHost, ConfirmProvider, toast } from './components.jsx';
import { Login, Dashboard, Users, UserViewer, Takeover } from './pages-core.jsx';
import { Currencies, Deposits, Transactions, Payments } from './pages-ops.jsx';
import { Security, Reports, Support, Roles, Audit, Settings } from './pages-sys.jsx';

const GL = window.GL;

/* ---------------------------------------------------------------- routing */
function useHash() {
  const [hash, setHash] = useState(() => window.location.hash || '#/dashboard');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/dashboard');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function parseRoute(hash) {
  const path = (hash || '').replace(/^#/, '') || '/dashboard';
  const parts = path.split('/').filter(Boolean);
  const head = parts[0] || 'dashboard';
  if (head === 'users' && parts[1]) return { page: 'user', id: parts[1], key: 'user:' + parts[1] };
  if (['login', 'dashboard', 'users', 'takeover', 'currencies', 'deposits', 'transactions', 'payments',
    'security', 'reports', 'support', 'roles', 'audit', 'settings'].indexOf(head) > -1) {
    return { page: head, key: head };
  }
  return { page: 'notFound', key: 'notFound' };
}

const TITLES = {
  dashboard: 'Dashboard', users: 'User Management', user: 'Individual Account Viewer',
  takeover: 'Account Takeover', currencies: 'Currency Management', deposits: 'Deposit Management',
  transactions: 'Transactions', payments: 'Payment Monitoring', security: 'Security Monitoring',
  reports: 'Reports', support: 'Support', roles: 'Admin Roles', audit: 'Audit Logs', settings: 'Settings'
};

const NAV = [
  { group: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' }] },
  { group: 'Customers', items: [
    { id: 'users', label: 'User Management', icon: 'users' },
    { id: 'takeover', label: 'Account Takeover', icon: 'eye' }
  ] },
  { group: 'Money', items: [
    { id: 'deposits', label: 'Deposit Management', icon: 'wallet' },
    { id: 'transactions', label: 'Transactions', icon: 'receipt' },
    { id: 'payments', label: 'Payment Monitoring', icon: 'card' }
  ] },
  { group: 'Platform', items: [
    { id: 'currencies', label: 'Currency Management', icon: 'coins' },
    { id: 'security', label: 'Security Monitoring', icon: 'shield' },
    { id: 'reports', label: 'Reports', icon: 'chart' },
    { id: 'support', label: 'Support', icon: 'ticket' },
    { id: 'roles', label: 'Admin Roles', icon: 'key' },
    { id: 'audit', label: 'Audit Logs', icon: 'history' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ] }
];

const PAGES = {
  dashboard: Dashboard, users: Users, user: UserViewer, takeover: Takeover,
  currencies: Currencies, deposits: Deposits, transactions: Transactions, payments: Payments,
  security: Security, reports: Reports, support: Support, roles: Roles, audit: Audit, settings: Settings
};

/* ------------------------------------------------------------------- shell */
export default function App() {
  const hash = useHash();
  const route = parseRoute(hash);
  const [session, setSession] = useState(() => GL.api.session.get());
  const [navOpen, setNavOpen] = useState(false);
  const titleRef = useRef(null);

  const signedIn = !!(session && (session.kind === 'admin' || session.kind === 'takeover'));
  const refreshSession = () => setSession(GL.api.session.get());
  const navigate = (h) => { window.location.hash = h; };

  /* close drawer + reset scroll + move focus on every route change */
  useEffect(() => {
    setNavOpen(false);
    window.scrollTo(0, 0);
    if (titleRef.current && signedIn) titleRef.current.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.key]);

  /* lock body scroll while the mobile drawer is open */
  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [navOpen]);

  const signOut = async () => {
    try { await GL.api.auth.logout(); } finally {
      setSession(null);
      window.location.hash = '#/login';
      toast('Signed out of the admin console.', 'info');
    }
  };

  /* ------------------------------------------------ session gate: login */
  if (!signedIn) {
    return (
      <ConfirmProvider>
        <Login onLogin={() => { refreshSession(); window.location.hash = '#/dashboard'; }} />
        <ToastHost />
      </ConfirmProvider>
    );
  }

  const page = route.page === 'login' ? 'dashboard' : route.page;
  const Page = PAGES[page];
  const adminName = session.adminName || 'Administrator';

  return (
    <ConfirmProvider>
      <div className={'shell' + (navOpen ? ' nav-open' : '')}>
        <a className="skip-link" href="#main"
          onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); if (m) { m.setAttribute('tabindex', '-1'); m.focus({ preventScroll: false }); } }}>Skip to content</a>

        <aside className="sidenav" id="sidenav" aria-label="Admin navigation">
          <div className="sidenav-brand">
            <span className="brand-mark" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon('globe', 20) }} />
            <span className="brand-text">Meridian · ADMIN<small>GLOBAL ACCOUNTS</small></span>
          </div>
          <nav className="sidenav-nav">
            {NAV.map((g) => (
              <React.Fragment key={g.group}>
                <p className="nav-group">{g.group}</p>
                {g.items.map((it) => (
                  <a key={it.id} className={'nav-item' + (page === it.id || (it.id === 'users' && page === 'user') ? ' active' : '')}
                    href={'#/' + it.id} aria-current={page === it.id || (it.id === 'users' && page === 'user') ? 'page' : undefined}>
                    <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon(it.icon, 17) }} />
                    {it.label}
                  </a>
                ))}
              </React.Fragment>
            ))}
          </nav>
          <div className="sidenav-foot">
            <div className="sidenav-user">
              <span className="avatar">{GL.fmt.initials(adminName)}</span>
              <div className="sidenav-user-txt">
                <b>{adminName}</b>
                <small>Super Administrator</small>
              </div>
            </div>
            <button type="button" className="btn btn-outline btn-sm sidenav-out" onClick={signOut}>
              <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon('logout', 15) }} /> Sign out
            </button>
            <p className="sidenav-note">Demo environment — sample data only.</p>
          </div>
        </aside>

        <div className="shell-main">
          <header className="topbar">
            <button type="button" className="icon-btn menu-btn" onClick={() => setNavOpen(!navOpen)}
              aria-expanded={navOpen} aria-controls="sidenav" aria-label="Open navigation menu">
              <Icon name="menu" size={18} />
            </button>
            <h1 className="topbar-title" tabIndex={-1} ref={titleRef}>{TITLES[page] || 'Meridian Admin'}</h1>
            <div className="topbar-actions">
              <span className="preview-chip"><span className="dot" aria-hidden="true" /> Demo environment — sample data</span>
              <span className="user-chip" title={session.adminEmail || ''}>
                <span className="avatar">{GL.fmt.initials(adminName)}</span>
                <span className="user-chip-name">{adminName}</span>
                <span className="user-chip-role">Super Administrator</span>
              </span>
              <button type="button" className="icon-btn" onClick={signOut} title="Sign out" aria-label="Sign out">
                <Icon name="logout" size={17} />
              </button>
            </div>
          </header>

          {session.kind === 'takeover' ? (
            <div className="takeover-note" role="status">
              <Icon name="eye" size={15} />
              <p><b>Takeover session active</b> — you are viewing a customer's account in the customer app. End it from the customer app banner or from the <a href="#/takeover">Takeover page</a>.</p>
            </div>
          ) : null}

          <main className="content" id="main">
            {Page ? (
              <Page route={route} session={session} navigate={navigate} refreshSession={refreshSession} />
            ) : (
              <div className="gate-card">
                <span className="gate-ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: GL.icon('search', 26) }} />
                <h2>Page not found</h2>
                <p className="muted">There is no admin page at <code>{hash}</code>.</p>
                <div className="gate-actions">
                  <a className="btn btn-primary" href="#/dashboard"><Icon name="dashboard" size={15} /> Back to dashboard</a>
                </div>
              </div>
            )}
          </main>
        </div>

        <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />
        <ToastHost />
      </div>
    </ConfirmProvider>
  );
}
