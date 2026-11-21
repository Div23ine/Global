/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — CONCEPT 03 · PREMIUM GLOBAL FINANCIAL PLATFORM
   customer/premium/assets/components.js

   Injects the site header (with mobile drawer) and footer into every public
   page (#gl-header / #gl-footer), and owns the persisted dark/light theme:
   localStorage key "gl_premium_theme" (default 'dark'), applied to <html> and
   <body> as data-theme. The toggle is data-action="premium:theme" with
   aria-pressed — a pure CSS-variable swap, nothing re-renders.

   NOTE: the header/footer are injected synchronously (this script sits at the
   end of <body>, after the shared layer), so shared/site-core.js — which wires
   [data-nav-toggle] on DOMContentLoaded — finds the drawer already in the DOM.
   ========================================================================== */
window.GL = window.GL || {};
(function () {
  var THEME_KEY = 'gl_premium_theme';

  /* ---------------- theme (applied immediately — no flash) ---------------- */
  function themeSaved() {
    try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; }
    catch (e) { return 'dark'; }
  }
  function themeApply(t) {
    try { document.documentElement.setAttribute('data-theme', t); } catch (e) {}
    try { if (document.body) document.body.setAttribute('data-theme', t); } catch (e) {}
  }
  function themePersist(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  themeApply(themeSaved()); /* runs before first paint */

  GL.premiumTheme = {
    saved: themeSaved,
    apply: themeApply,
    flip: function () {
      var t = themeSaved() === 'dark' ? 'light' : 'dark';
      themePersist(t); themeApply(t); return t;
    },
    button: function (extraCls) {
      var dark = themeSaved() === 'dark';
      return '<button type="button" class="theme-toggle' + (extraCls ? ' ' + extraCls : '') + '"'
        + ' data-action="premium:theme" aria-pressed="' + (dark ? 'true' : 'false') + '"'
        + ' aria-label="' + (dark ? 'Switch to the light theme' : 'Switch to the dark theme') + '"'
        + ' title="Toggle dark / light theme">'
        + '<span class="tt-sun">' + GL.icon('sun', 17) + '</span>'
        + '<span class="tt-moon">' + GL.icon('moon', 17) + '</span>'
        + '</button>';
    }
  };

  /* ---------------- markup helpers ---------------- */
  function esc(s) { return GL.esc(s); }

  var PAGES = [
    ['home', 'Home', 'index.html'],
    ['about', 'About', 'about.html'],
    ['what-is-offshore', 'What is an offshore account?', 'what-is-offshore.html'],
    ['how-it-works', 'How it works', 'how-it-works.html'],
    ['currencies', 'Currencies', 'currencies.html'],
    ['features', 'Features', 'features.html'],
    ['faq', 'FAQ', 'faq.html'],
    ['contact', 'Contact', 'contact.html']
  ];

  function brandLink() {
    return '<a class="brand" href="index.html" aria-label="Meridian Global Accounts — home">'
      + '<span class="brand-badge" aria-hidden="true">M</span>'
      + '<span class="brand-name"><b>Meridian</b><small>Global Accounts</small></span>'
      + '</a>';
  }

  function desktopNav() {
    var page = document.body.dataset.page || '';
    return PAGES.map(function (p) {
      return '<a href="' + p[2] + '"' + (p[0] === page ? ' class="active" aria-current="page"' : '') + '>' + esc(p[1]) + '</a>';
    }).join('');
  }

  function drawerNav() {
    var page = document.body.dataset.page || '';
    return PAGES.map(function (p) {
      return '<a class="nav-m' + (p[0] === page ? ' active' : '') + '" href="' + p[2] + '"' + (p[0] === page ? ' aria-current="page"' : '') + '>' + esc(p[1]) + '</a>';
    }).join('');
  }

  function sessionAction() {
    var s = null;
    try { s = GL.api.session.get(); } catch (e) {}
    if (s && (s.kind === 'user' || s.kind === 'takeover')) {
      return '<a class="btn btn-ghost btn-sm btn-signin" href="app.html#/overview">Dashboard</a>';
    }
    return '<a class="btn btn-ghost btn-sm btn-signin" href="app.html#/login">Sign in</a>';
  }

  /* ---------------- header ---------------- */
  function buildHeader() {
    var host = document.getElementById('gl-header');
    if (!host) return;
    host.innerHTML =
      '<header class="site-header" data-site-header>'
      + '<div class="site-head-wrap">'
      + brandLink()
      + '<nav class="site-nav" aria-label="Primary">' + desktopNav() + '</nav>'
      + '<div class="site-head-actions">'
      + sessionAction()
      + '<a class="btn btn-primary btn-sm" href="app.html#/register">Create account</a>'
      + GL.premiumTheme.button()
      + '<button type="button" class="icon-btn nav-burger" data-nav-toggle aria-expanded="false" aria-controls="site-nav-panel" aria-label="Open menu">' + GL.icon('menu', 19) + '</button>'
      + '</div>'
      + '</div>'
      + '<div class="nav-panel" id="site-nav-panel" data-nav-panel aria-label="Menu">'
      + '<button type="button" class="icon-btn nav-panel-close" data-nav-toggle aria-expanded="false" aria-controls="site-nav-panel" aria-label="Close menu">' + GL.icon('x', 18) + '</button>'
      + '<div class="nav-label">Explore</div>'
      + drawerNav()
      + '<div class="panel-actions">'
      + '<a class="btn btn-primary btn-block" href="app.html#/register">Create account</a>'
      + '<a class="btn btn-ghost btn-block" href="app.html#/login">Sign in</a>'
      + '</div>'
      + '<p class="demo-side-note">Design prototype — not a live financial service.</p>'
      + '</div>'
      + '<div class="nav-scrim" aria-hidden="true"></div>'
      + '</header>';
  }

  /* ---------------- footer ---------------- */
  function buildFooter() {
    var host = document.getElementById('gl-footer');
    if (!host) return;
    host.innerHTML =
      '<footer class="site-footer" data-site-footer>'
      + '<div class="foot-wrap">'
      + '<div class="foot-brand">'
      + brandLink()
      + '<p>An international multi-currency platform account for people who earn, save and spend across borders. Meridian provides platform accounts — not bank accounts, and not actual offshore banking services.</p>'
      + '</div>'
      + '<nav class="foot-col" aria-label="Explore">'
      + '<h3>Explore</h3>'
      + '<ul>'
      + '<li><a href="how-it-works.html">How it works</a></li>'
      + '<li><a href="currencies.html">Currencies &amp; rates</a></li>'
      + '<li><a href="features.html">Account features</a></li>'
      + '<li><a href="faq.html">FAQ</a></li>'
      + '</ul>'
      + '</nav>'
      + '<nav class="foot-col" aria-label="Company">'
      + '<h3>Company</h3>'
      + '<ul>'
      + '<li><a href="about.html">About</a></li>'
      + '<li><a href="what-is-offshore.html">What is an offshore account?</a></li>'
      + '<li><a href="contact.html">Contact</a></li>'
      + '</ul>'
      + '</nav>'
      + '<div class="foot-col">'
      + '<h3>Demonstration</h3>'
      + '<div class="foot-demo">Every user, balance, transaction and statement in this prototype is demonstration data held in your browser only. Use the DEMO CONTROLS panel to reset it.</div>'
      + '</div>'
      + '</div>'
      + '<div class="foot-bottom">'
      + '<span>© <span data-year>2026</span> Meridian Global Accounts — placeholder brand for a design prototype.</span>'
      + '<span>Design prototype — not a live financial service. · '
      + '<a href="terms.html">Terms</a> · <a href="privacy.html">Privacy</a></span>'
      + '</div>'
      + '</footer>';
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    /* theme toggle — pure attribute + persistence swap */
    document.querySelectorAll('[data-action="premium:theme"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = GL.premiumTheme.flip();
        b.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
        b.setAttribute('aria-label', t === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme');
      });
    });

    /* drawer scrim + the in-drawer close button (site-core wires the burger) */
    var scrim = document.querySelector('.nav-scrim');
    var panel = document.querySelector('[data-nav-panel]');
    var toggles = document.querySelectorAll('[data-nav-toggle]');
    function closePanel() {
      if (!panel) return;
      panel.classList.remove('is-open');
      toggles.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
    }
    if (scrim && panel) scrim.addEventListener('click', closePanel);
    var closeBtn = panel ? panel.querySelector('.nav-panel-close') : null;
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    if (panel) {
      panel.addEventListener('click', function (e) {
        if (e.target.closest('a')) closePanel();
      });
    }
    /* keep both toggle buttons' aria-expanded in sync with site-core's class flip */
    if (panel && typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(function () {
        var open = panel.classList.contains('is-open');
        toggles.forEach(function (t) { t.setAttribute('aria-expanded', String(open)); });
      });
      mo.observe(panel, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* inject immediately — #gl-header/#gl-footer sit above this script, and
     shared/site-core.js (loaded earlier) wires the drawer on DOMContentLoaded */
  try { buildHeader(); } catch (e) {}
  try { buildFooter(); } catch (e) {}
  try { wire(); } catch (e) {}
})();
