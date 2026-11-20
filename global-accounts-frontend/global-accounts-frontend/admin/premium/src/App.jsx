/* ============================================================================
   MERIDIAN ADMIN — CONCEPT 03 · PREMIUM GLOBAL FINANCIAL PLATFORM
   admin/premium/src/App.jsx

   Application shell: login gate (GL.api.session — kind admin|takeover),
   hash router, grouped sidebar, topbar (title, theme toggle, demo chip,
   admin chip, sign out), takeover-session note, mobile off-canvas nav.
   The persisted dark/light theme (localStorage: gl_premium_theme) is applied
   to <html> and <body> before first paint via useLayoutEffect.
   ========================================================================== */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Icon, ThemeToggle, ToastHost, Empty, toast } from './components.jsx';
import { Login, Dashboard, Users, UserViewer, TakeoverPage } from './pages-core.jsx';
import { Currencies, Deposits, Transactions, Payments } from './pages-ops.jsx';
import { Security, Reports, Support, Roles, Audit, Settings } from './pages-sys.jsx';

const NAV = [
  { label: 'Overview', items: [['dashboard', 'Dashboard', 'grid']] },
  { label: 'Customers', items: [
    ['users', 'User Management', 'users'],
    ['takeover', 'Account Takeover', 'eye']
  ] },
  { label: 'Money', items: [
    ['deposits', 'Deposit Management', 'wallet'],
    ['transactions', 'Transactions', 'exchange'],
    ['payments', 'Payment Monitoring', 'card']
  ] },
  { label: 'Platform', items: [
    ['currencies', 'Currency Management', 'coins'],
    ['security', 'Security Monitoring', 'shield-check'],
    ['reports', 'Reports', 'chart'],
    ['support', 'Support', 'ticket'],
    ['roles', 'Admin Roles', 'key'],
    ['audit', 'Audit Logs', 'book'],
    ['settings', 'Settings', 'sliders']
  ] }
];

const TITLES = {
  dashboard: 'Dashboard',
  users: 'User Management',
  takeover: 'Account Takeover',
  deposits: 'Deposit Management',
  transactions: 'Transactions',
  payments: 'Payment Monitoring',
  currencies: 'Currency Management',
  security: 'Security Monitoring',
  reports: 'Reports',
  support: 'Support',
  roles: 'Admin Roles',
  audit: 'Audit Logs',
  settings: 'Settings'
};

function parseHash(hash) {
  const path = String(hash || '').replace(/^#\/?/, '');
  const seg = path.split('/').filter(Boolean);
  return { view: seg[0] || 'dashboard', param: seg.slice(1).join('/') };
}

function useHash() {
  const [hash, setHash] = useState(() => (location.hash || '#/dashboard'));
  useEffect(() => {
    const on = () => setHash(location.hash || '#/dashboard');
    window.addEventListener('hashchange', on);
    if (!location.hash) {
      try { history.replaceState(null, '', '#/dashboard'); } catch (e) { location.hash = '#/dashboard'; }
      on();
    }
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const { view, param } = parseHash(hash);
  const [session, setSession] = useState(() => {
    try { return window.GL.api.session.get(); } catch (e) { return null; }
  });
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('gl_premium_theme') === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; }
  });
  const [navOpen, setNavOpen] = useState(false);

  /* persisted theme — applied before first paint (useLayoutEffect on mount) */
  useLayoutEffect(() => {
    try { localStorage.setItem('gl_premium_theme', theme); } catch (e) { /* storage guard */ }
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);
  const flipTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  const refreshSession = useCallback(() => {
    try { setSession(window.GL.api.session.get()); } catch (e) { setSession(null); }
  }, []);

  /* keep the session in sync with other tabs / the customer app (same origin) */
  useEffect(() => {
    window.addEventListener('storage', refreshSession);
    return () => window.removeEventListener('storage', refreshSession);
  }, [refreshSession]);

  /* close the mobile drawer on navigation */
  useEffect(() => { setNavOpen(false); }, [hash]);

  const authed = !!(session && (session.kind === 'admin' || session.kind === 'takeover'));

  /* an authenticated admin never needs the login route */
  useEffect(() => {
    if (authed && view === 'login') location.hash = '#/dashboard';
  }, [authed, view]);

  const logout = useCallback(() => {
    window.GL.api.auth.logout().catch(() => {}).then(() => {
      setSession(null);
      location.hash = '#/login';
      toast('Signed out of the admin console.', 'info');
    });
  }, []);

  const onLogin = useCallback(() => {
    refreshSession();
    location.hash = '#/dashboard';
  }, [refreshSession]);

  /* ---------------- session gate ---------------- */
  if (!authed) {
    return (
      <>
        <Login onAuthed={onLogin} theme={theme} onFlipTheme={flipTheme} />
        <ToastHost />
      </>
    );
  }

  /* ---------------- route table ---------------- */
  let page;
  switch (view) {
    case 'dashboard': page = <Dashboard />; break;
    case 'users': page = param ? <UserViewer id={param} /> : <Users />; break;
    case 'takeover': page = <TakeoverPage session={session} onSessionChange={refreshSession} />; break;
    case 'currencies': page = <Currencies />; break;
    case 'deposits': page = <Deposits />; break;
    case 'transactions': page = <Transactions />; break;
    case 'payments': page = <Payments />; break;
    case 'security': page = <Security />; break;
    case 'reports': page = <Reports />; break;
    case 'support': page = <Support />; break;
    case 'roles': page = <Roles />; break;
    case 'audit': page = <Audit />; break;
    case 'settings': page = <Settings />; break;
    default:
      page = (
        <div className="panel">
          <Empty icon="search" title="Page not found" text={'No admin page matches “' + view + '”.'} />
          <div className="center-actions">
            <a className="btn btn-primary" href="#/dashboard">Back to the dashboard</a>
          </div>
        </div>
      );
  }

  const title = view === 'users' && param ? 'Account Viewer' : (TITLES[view] || 'Meridian Admin');
  const adminName = (session && session.adminName) || (window.GL.DEMO_CREDENTIALS.admin.name);

  return (
    <div className={'shell' + (navOpen ? ' nav-open' : '')}>
      <a className="skip-link" href="#main">Skip to content</a>

      <aside className="sidenav" id="admin-sidenav" aria-label="Admin sections">
        <a className="sidenav-brand" href="#/dashboard" aria-label="Meridian admin console — dashboard">
          <span className="brand-badge" aria-hidden="true">M</span>
          <span className="brand-name"><b>Meridian</b><small>· ADMIN</small></span>
        </a>
        <nav className="sidenav-nav" aria-label="Admin navigation">
          {NAV.map((g) => (
            <div className="nav-group" key={g.label}>
              <div className="nav-label">{g.label}</div>
              {g.items.map(([id, label, icon]) => (
                <a key={id} className={'nav-item' + (view === id ? ' active' : '')}
                  href={'#/' + id} aria-current={view === id ? 'page' : undefined}>
                  <Icon name={icon} size={16} /> {label}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidenav-foot">
          <p className="sidenav-note">Design prototype — not a live financial service.</p>
        </div>
      </aside>

      <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />

      <div className="shell-main">
        <header className="topbar">
          <button type="button" className="icon-btn nav-toggle" aria-expanded={navOpen}
            aria-controls="admin-sidenav" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
            <Icon name="menu" size={19} />
          </button>
          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-actions">
            <ThemeToggle theme={theme} onFlip={flipTheme} />
            <span className="env-chip">Demo environment — sample data</span>
            <span className="admin-chip">
              <span className="avatar" aria-hidden="true">{window.GL.fmt.initials(adminName)}</span>
              <span className="admin-chip-meta">
                <b>{adminName}</b>
                <small>Super Administrator</small>
              </span>
            </span>
            <button type="button" className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </header>

        {session.kind === 'takeover' && (
          <div className="tko-note">
            <Icon name="eye" size={15} />
            <span>Takeover session active — end it from the customer app or the Takeover page.</span>
            <a href="#/takeover">Takeover page</a>
          </div>
        )}

        <main className="content" id="main">
          {page}
        </main>
      </div>

      <ToastHost />
    </div>
  );
}
