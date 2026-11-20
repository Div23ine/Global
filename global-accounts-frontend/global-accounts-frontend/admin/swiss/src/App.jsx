/* ============================================================================
   MERIDIAN ADMIN — Design Concept 1 · “Swiss Private Banking”
   admin/swiss/src/App.jsx

   Application shell: session gate (administrator or takeover session),
   hash router, grouped sidebar, topbar, mobile off-canvas navigation,
   toast + confirm hosts. All data access goes through window.GL.
   ========================================================================== */
import React, { useEffect, useState } from 'react';
import { Icon, ToastHost, ConfirmHost, toast, toastErr } from './components.jsx';
import { Login, Dashboard, Users, UserViewer, Takeover } from './pages-core.jsx';
import { Currencies, Deposits, Transactions, Payments } from './pages-ops.jsx';
import { Security, Reports, Support, Roles, Audit, Settings } from './pages-sys.jsx';

const GL = () => window.GL;

/* ----------------------------------------------------------------------------
   Hash routing
   ---------------------------------------------------------------------------- */
function useHash() {
  const [hash, setHash] = useState(() => (window.location.hash || '#/dashboard'));
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/dashboard');
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) window.location.replace('#/dashboard');
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

const KNOWN_ROUTES = ['dashboard', 'users', 'takeover', 'deposits', 'transactions', 'payments',
  'currencies', 'security', 'reports', 'support', 'roles', 'audit', 'settings'];

function parseRoute(hash) {
  const path = String(hash || '').replace(/^#/, '') || '/dashboard';
  if (path === '/login') return { name: 'login' };
  const m = path.match(/^\/users\/([^/]+)\/?$/);
  if (m) return { name: 'user', id: decodeURIComponent(m[1]) };
  const seg = path.replace(/^\//, '').split('/')[0];
  if (KNOWN_ROUTES.indexOf(seg) > -1) return { name: seg };
  return { name: 'notfound' };
}

const TITLES = {
  dashboard: 'Dashboard', users: 'User Management', user: 'Customer Account',
  takeover: 'Account Takeover', deposits: 'Deposit Management', transactions: 'Transactions',
  payments: 'Payment Monitoring', currencies: 'Currency Management', security: 'Security Monitoring',
  reports: 'Reports', support: 'Support', roles: 'Admin Roles', audit: 'Audit Logs',
  settings: 'Settings', notfound: 'Not found'
};

/* Sidebar navigation — grouped exactly as specified */
const NAV = [
  ['Overview', [
    ['dashboard', 'Dashboard', 'dashboard']
  ]],
  ['Customers', [
    ['users', 'User Management', 'users'],
    ['takeover', 'Account Takeover', 'eye']
  ]],
  ['Money', [
    ['deposits', 'Deposit Management', 'plus'],
    ['transactions', 'Transactions', 'receipt'],
    ['payments', 'Payment Monitoring', 'card']
  ]],
  ['Platform', [
    ['currencies', 'Currency Management', 'exchange'],
    ['security', 'Security Monitoring', 'shield'],
    ['reports', 'Reports', 'chart'],
    ['support', 'Support', 'life'],
    ['roles', 'Admin Roles', 'key'],
    ['audit', 'Audit Logs', 'history'],
    ['settings', 'Settings', 'sliders']
  ]]
];

const BRAND_MARK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 3.5v17M3.5 12h17"></path></svg>';

/* Which nav entry is active for a route (user viewer highlights User Management) */
function activeNav(route) {
  if (route.name === 'user') return 'users';
  return route.name;
}

export default function App() {
  const hash = useHash();
  const route = parseRoute(hash);
  const [session, setSession] = useState(() => GL().api.session.get());
  const [navOpen, setNavOpen] = useState(false);

  const authed = !!session && (session.kind === 'admin' || session.kind === 'takeover');
  const refreshSession = () => setSession(GL().api.session.get());

  /* Normalise the address bar against the session gate */
  useEffect(() => {
    if (authed && route.name === 'login') window.location.replace('#/dashboard');
    else if (!authed && route.name !== 'login') window.location.replace('#/login');
  }, [authed, route.name]);

  /* Close the mobile drawer whenever the route changes */
  useEffect(() => { setNavOpen(false); }, [route.name]);

  const signOut = () => {
    GL().api.auth.logout()
      .then(() => {
        setSession(null);
        window.location.hash = '#/login';
        toast('Signed out of the administration console.', 'info');
      })
      .catch(toastErr);
  };

  /* ---------------- Login gate ---------------- */
  if (!authed) {
    return (
      <>
        <Login onDone={() => { refreshSession(); window.location.hash = '#/dashboard'; }} />
        <ToastHost />
        <ConfirmHost />
      </>
    );
  }

  /* ---------------- Route view ---------------- */
  const view = (() => {
    switch (route.name) {
      /* An authenticated visit to #/login is redirected above; render the
         dashboard meanwhile so no "not found" flash appears. */
      case 'login':
      case 'dashboard': return <Dashboard />;
      case 'users': return <Users />;
      case 'user': return <UserViewer id={route.id} />;
      case 'takeover': return <Takeover session={session} refreshSession={refreshSession} />;
      case 'currencies': return <Currencies />;
      case 'deposits': return <Deposits />;
      case 'transactions': return <Transactions />;
      case 'payments': return <Payments />;
      case 'security': return <Security />;
      case 'reports': return <Reports />;
      case 'support': return <Support />;
      case 'roles': return <Roles />;
      case 'audit': return <Audit />;
      case 'settings': return <Settings />;
      default:
        return (
          <div className="empty">
            <Icon name="search" size={26} />
            <h3>Page not found</h3>
            <p>The address {hash} does not match an administration view.</p>
            <a className="btn btn-ghost btn-sm" href="#/dashboard">Back to dashboard</a>
          </div>
        );
    }
  })();

  const adminName = session.adminName || 'Administrator';
  const initials = GL().fmt.initials(adminName);
  const activeKey = activeNav(route);

  return (
    <div className={'shell' + (session.kind === 'takeover' ? ' has-takeover' : '')}>
      <div className={'scrim' + (navOpen ? ' show' : '')} onClick={() => setNavOpen(false)}></div>

      <aside className={'sidenav' + (navOpen ? ' open' : '')} aria-label="Administration navigation">
        <div className="side-brand">
          <a className="brand" href="#/dashboard">
            <span className="brand-mark" dangerouslySetInnerHTML={{ __html: BRAND_MARK }} />
            <span className="brand-text">Meridian<small>Administration</small></span>
          </a>
        </div>
        <nav className="side-nav">
          {NAV.map((group) => (
            <div key={group[0]}>
              <p className="nav-group-label">{group[0]}</p>
              {group[1].map((item) => (
                <a
                  key={item[0]}
                  className={'nav-item' + (activeKey === item[0] ? ' active' : '')}
                  href={'#/' + item[0]}
                  aria-current={activeKey === item[0] ? 'page' : undefined}
                >
                  <Icon name={item[2]} size={17} />
                  <span>{item[1]}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidenav-foot">
          <div className="side-user">
            <span className="uc-ava">{initials}</span>
            <span className="side-user-meta">
              <span className="side-user-name">{adminName}</span>
              <span className="side-user-role">Super Administrator</span>
            </span>
          </div>
          <button type="button" className="nav-item nav-signout" onClick={signOut}>
            <Icon name="logout" size={17} />
            <span>Sign out</span>
          </button>
          <p className="side-note">Demo environment — sample data shared with the customer apps in this browser.</p>
        </div>
      </aside>

      <div className="shell-main">
        {session.kind === 'takeover' ? (
          <div className="tk-note" role="status">
            <Icon name="eye" size={15} />
            <span>
              Takeover session active — end it from the customer app or the{' '}
              <a href="#/takeover">Takeover page</a>.
            </span>
          </div>
        ) : null}

        <header className="topbar">
          <button
            type="button"
            className="icon-btn nav-toggle"
            aria-expanded={navOpen}
            aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setNavOpen(!navOpen)}
          >
            <Icon name="menu" size={21} />
          </button>
          <h1 className="topbar-title">{TITLES[route.name] || 'Meridian Admin'}</h1>
          <span className="preview-chip">Demo environment — sample data</span>
          <span className="admin-chip" title={session.adminEmail || ''}>
            <span className="uc-ava">{initials}</span>
            <span className="admin-chip-text">{adminName} · Super Administrator</span>
          </span>
          <button type="button" className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out">
            <Icon name="logout" size={19} />
          </button>
        </header>

        <main className="content" id="main">
          {view}
        </main>
      </div>

      <ToastHost />
      <ConfirmHost />
    </div>
  );
}
