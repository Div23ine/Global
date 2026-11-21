/* ==========================================================================
   MERIDIAN GLOBAL ACCOUNTS — Hong Kong International Fintech (Design 2)
   customer/hongkong/assets/components.js

   Public-site chrome for this design concept: injects the header (plus the
   mobile drawer) into #gl-header and the footer into #gl-footer on every
   public page, then fills the data-driven content hooks ([data-*] elements)
   from the shared dataset so the copy substance always comes from GL.DATA.

   Visual language lives in assets/theme.css. Generic behaviour hooks that
   shared/site-core.js wires (nav toggle, accordions, contact forms, currency
   ticker, FAQ list) are only marked up here.
   ========================================================================== */
window.GL = window.GL || {};
(function () {
  var esc = GL.esc, icon = GL.icon, fmt = GL.fmt;

  var NAV = [
    { id: 'home',             label: 'Home',                       href: 'index.html' },
    { id: 'about',            label: 'About',                      href: 'about.html' },
    { id: 'what-is-offshore', label: 'What Is an Offshore Account?', href: 'what-is-offshore.html' },
    { id: 'how-it-works',     label: 'How It Works',               href: 'how-it-works.html' },
    { id: 'currencies',       label: 'Currencies',                 href: 'currencies.html' },
    { id: 'features',         label: 'Features',                   href: 'features.html' },
    { id: 'faq',              label: 'FAQ',                        href: 'faq.html' },
    { id: 'contact',          label: 'Contact',                    href: 'contact.html' }
  ];

  function navLinks(cls, active) {
    return NAV.map(function (n) {
      return '<a class="' + cls + (n.id === active ? ' active' : '') + '" href="' + n.href + '"' +
        (n.id === active ? ' aria-current="page"' : '') + '>' + esc(n.label) + '</a>';
    }).join('');
  }

  function brandMark(cls, light) {
    return '<a class="' + cls + '" href="index.html" aria-label="Meridian Global Accounts — home">' +
      '<span class="brand-mark' + (light ? ' brand-mark-light' : '') + '" aria-hidden="true">' + icon('globe', 20) + '</span>' +
      '<span class="brand-text">Meridian <small>GLOBAL ACCOUNTS</small></span></a>';
  }

  /* ------------------------------------------------------------------ header */
  function renderHeader() {
    var host = document.getElementById('gl-header');
    if (!host) return;
    var page = document.body.getAttribute('data-page') || '';
    var sess = null;
    try { sess = GL.api.session.get(); } catch (e) { sess = null; }
    var signedIn = !!(sess && (sess.kind === 'user' || sess.kind === 'takeover'));
    var signIn =
      '<a class="btn btn-ghost btn-sm" href="app.html#' + (signedIn ? '/overview' : '/login') + '">' +
      (signedIn ? 'Dashboard' : 'Sign in') + '</a>';

    host.innerHTML =
      '<header class="site-header" data-site-header>' +
        '<div class="container header-in">' +
          brandMark('brand') +
          '<nav class="site-nav" aria-label="Primary">' + navLinks('nav-link', page) + '</nav>' +
          '<div class="header-cta">' + signIn +
            '<a class="btn btn-primary btn-sm" href="app.html#/register">Create Account</a>' +
          '</div>' +
          '<button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-drawer" aria-label="Open menu">' +
            '<span class="nav-toggle-box" aria-hidden="true">' + icon('menu', 20) + '</span>' +
          '</button>' +
        '</div>' +
      '</header>' +
      '<div class="site-drawer" id="site-drawer" data-nav-panel>' +
        '<nav class="drawer-nav" aria-label="Mobile">' + navLinks('drawer-link', page) + '</nav>' +
        '<div class="drawer-cta">' + signIn +
          '<a class="btn btn-primary btn-block" href="app.html#/register">Create Account</a>' +
        '</div>' +
        '<p class="drawer-note">' + icon('info', 14) + ' Design prototype — not a live financial service.</p>' +
      '</div>' +
      '<div class="drawer-scrim" data-drawer-scrim hidden></div>';

    /* keep the scrim in sync with the drawer state (site-core toggles the panel) */
    var panel = host.querySelector('[data-nav-panel]');
    var scrim = host.querySelector('[data-drawer-scrim]');
    var toggle = host.querySelector('[data-nav-toggle]');
    if (panel && scrim) {
      var sync = function () { scrim.hidden = !panel.classList.contains('is-open'); };
      if (window.MutationObserver) {
        new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class'] });
      }
      scrim.addEventListener('click', function () {
        panel.classList.remove('is-open');
        if (toggle) { toggle.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
        sync();
      });
    }
  }

  /* ------------------------------------------------------------------ footer */
  function renderFooter() {
    var host = document.getElementById('gl-footer');
    if (!host) return;
    host.innerHTML =
      '<footer class="site-footer" data-site-footer>' +
        '<div class="container">' +
          '<div class="footer-grid">' +
            '<div class="footer-brand">' +
              brandMark('brand brand-light', true) +
              '<p>One account. Five currencies. Global access. Meridian is a placeholder brand for a frontend design prototype of an international multi-currency platform account.</p>' +
              '<p class="footer-demo">' + icon('info', 14) + ' Design prototype — not a live financial service. No real money, no real payments, no real users.</p>' +
            '</div>' +
            '<nav class="footer-col" aria-label="Product">' +
              '<h3>Product</h3>' +
              '<a href="features.html">Features</a>' +
              '<a href="currencies.html">Currencies</a>' +
              '<a href="how-it-works.html">How it works</a>' +
              '<a href="faq.html">FAQ</a>' +
            '</nav>' +
            '<nav class="footer-col" aria-label="Company">' +
              '<h3>Company</h3>' +
              '<a href="about.html">About</a>' +
              '<a href="what-is-offshore.html">What is an offshore account?</a>' +
              '<a href="contact.html">Contact</a>' +
              '<a href="app.html#/login">Sign in</a>' +
            '</nav>' +
            '<nav class="footer-col" aria-label="Legal">' +
              '<h3>Legal</h3>' +
              '<a href="terms.html">Terms &amp; Conditions</a>' +
              '<a href="privacy.html">Privacy Policy</a>' +
            '</nav>' +
          '</div>' +
          '<div class="footer-bottom">' +
            '<p>© <span data-year>2025</span> Meridian Global Accounts. Every figure on this site is demonstration data held in your browser.</p>' +
            '<p><strong>Design prototype — not a live financial service.</strong></p>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  /* -------------------------------------------------------- content hooks */
  function q(sel) { return document.querySelector(sel); }
  function limitOf(el) { return Number(el.getAttribute('data-limit')) || 0; }

  function hookStats() {
    var el = q('[data-stats-strip]');
    if (!el) return;
    el.innerHTML = (GL.PLATFORM_STATS || []).map(function (s) {
      return '<div class="stat-tile"><b>' + esc(s.num) + '</b><span>' + esc(s.lbl) + '</span></div>';
    }).join('');
  }

  function hookFeatures() {
    var el = q('[data-features-list]');
    if (!el) return;
    var lim = limitOf(el);
    var list = GL.FEATURES.slice(0, lim || GL.FEATURES.length);
    el.innerHTML = list.map(function (f) {
      return '<article class="feature-card">' +
        '<span class="feature-ic" aria-hidden="true">' + icon(f.icon, 22) + '</span>' +
        '<h3>' + esc(f.title) + '</h3><p>' + esc(f.text) + '</p></article>';
    }).join('');
  }

  function hookHow() {
    var el = q('[data-how-list]');
    if (!el) return;
    var lim = limitOf(el);
    var list = GL.HOW_STEPS.slice(0, lim || GL.HOW_STEPS.length);
    el.innerHTML = list.map(function (s) {
      return '<li class="step-item">' +
        '<span class="step-n" aria-hidden="true">' + icon(s.icon, 18) + '</span>' +
        '<div class="step-body"><h3><span class="step-num">Step ' + s.n + '</span>' + esc(s.title) + '</h3>' +
        '<p>' + esc(s.text) + '</p></div></li>';
    }).join('');
  }

  function hookCurStrip() {
    var el = q('[data-currencies-strip]');
    if (!el) return;
    el.innerHTML = (GL.CURRENCIES || []).map(function (c) {
      var off = c.status !== 'active';
      return '<a class="cur-chip' + (off ? ' is-off' : '') + '" href="currencies.html">' +
        '<b class="cur-chip-sym" aria-hidden="true">' + esc(c.symbol) + '</b>' +
        '<span class="cur-chip-txt"><strong>' + esc(c.code) + '</strong><small>' + esc(c.name) + '</small></span>' +
        (off ? '<em>Temporarily unavailable</em>' : '<em>Supported</em>') +
      '</a>';
    }).join('');
  }

  function hookCurGrid() {
    var el = q('[data-currencies-grid]');
    if (!el) return;
    el.innerHTML = (GL.CURRENCIES || []).map(function (c) {
      var off = c.status !== 'active';
      var perUsd = GL.RATES[c.code] ? 1 / GL.RATES[c.code] : null;
      return '<article class="cur-card' + (off ? ' is-off' : '') + '">' +
        '<div class="cur-card-head">' +
          '<span class="cur-sym" aria-hidden="true">' + esc(c.symbol) + '</span>' +
          '<div><h3>' + esc(c.code) + ' — ' + esc(c.name) + '</h3>' +
          '<p>' + (off ? 'Temporarily unavailable for activation' : 'Supported platform currency') + '</p></div>' +
          '<span class="badge ' + (off ? 'b-unavailable' : 'b-active') + '">' + (off ? 'unavailable' : 'active') + '</span>' +
        '</div>' +
        '<p class="cur-rate">' + (perUsd ? 'Indicative demo rate: <b>1 USD ≈ ' + esc(c.symbol) + ' ' + fmt.num(perUsd) + '</b>' : 'No demo rate published') + '</p>' +
        (c.note ? '<p class="cur-note">' + icon('info', 14) + ' ' + esc(c.note) + '</p>' : '') +
        (off ? '' : '<a class="btn btn-primary btn-sm" href="app.html#/activate">Activate this currency</a>') +
      '</article>';
    }).join('');
  }

  function hookRates() {
    var el = q('[data-rates-table]');
    if (!el) return;
    el.innerHTML =
      '<div class="table-wrap"><table>' +
        '<thead><tr><th scope="col">Currency</th><th scope="col">Code</th><th scope="col">Indicative demo rate</th></tr></thead>' +
        '<tbody>' + (GL.CURRENCIES || []).map(function (c) {
          var perUsd = GL.RATES[c.code] ? 1 / GL.RATES[c.code] : null;
          return '<tr><td>' + esc(c.name) + '</td><td><b>' + esc(c.code) + '</b></td>' +
            '<td>' + (perUsd ? '1 USD ≈ ' + esc(c.symbol) + ' ' + fmt.num(perUsd) : '—') + '</td></tr>';
        }).join('') + '</tbody>' +
      '</table></div>' +
      '<p class="table-note">' + icon('info', 14) + ' ' + esc(GL.RATES_NOTE || '') + '</p>';
  }

  function hookCountries() {
    var el = q('[data-country-table]');
    if (!el) return;
    el.innerHTML =
      '<div class="table-wrap"><table>' +
        '<thead><tr><th scope="col">Country</th><th scope="col">Default currency after verification</th></tr></thead>' +
        '<tbody>' + (GL.COUNTRIES || []).map(function (c) {
          var info = (GL.CURRENCIES || []).filter(function (x) { return x.code === c.currency; })[0];
          return '<tr><td>' + esc(c.name) + '</td><td><b>' + esc(c.currency) + '</b>' +
            (info ? ' — ' + esc(info.name) : '') + '</td></tr>';
        }).join('') + '</tbody>' +
      '</table></div>' +
      '<p class="table-note">' + icon('info', 14) + ' ' + esc(GL.COUNTRY_NOTE || '') + '</p>';
  }

  function hookWio() {
    var intro = q('[data-wio-intro]');
    if (intro) intro.innerHTML = esc(GL.WHAT_IS_OFFSHORE.intro);
    var sec = q('[data-wio-sections]');
    if (!sec) return;
    sec.innerHTML = (GL.WHAT_IS_OFFSHORE.sections || []).map(function (s) {
      return '<article class="feature-card">' +
        '<span class="feature-ic" aria-hidden="true">' + icon(s.icon, 22) + '</span>' +
        '<h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></article>';
    }).join('');
  }

  function hookMisconceptions() {
    var el = q('[data-misconceptions]');
    if (!el) return;
    el.innerHTML = (GL.WHAT_IS_OFFSHORE.misconceptions || []).map(function (m, i) {
      return '<div class="acc-item">' +
        '<button class="acc-btn" type="button" aria-expanded="false" aria-controls="mis-a' + i + '" id="mis-q' + i + '">' +
          '<span>' + esc(m.q) + '</span>' + icon('chevron-d', 18) + '</button>' +
        '<div class="acc-body" id="mis-a' + i + '" role="region" aria-labelledby="mis-q' + i + '" hidden><p>' + esc(m.a) + '</p></div>' +
      '</div>';
    }).join('');
    /* Wire this accordion directly. shared/site-core.js binds [data-accordion]
       roots twice when they already exist at DOMContentLoaded (once for static
       roots, once after injecting the FAQ), and the two handlers cancel each
       other — this markup is injected during parsing, so it would hit that
       double-binding. No data-accordion attribute is set; behaviour is the
       same contract the FAQ uses (.acc-item.open + hidden + aria-expanded). */
    Array.prototype.forEach.call(el.querySelectorAll('.acc-item'), function (item) {
      var btn = item.querySelector('.acc-btn');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var open = item.classList.contains('open');
        Array.prototype.forEach.call(el.querySelectorAll('.acc-item.open'), function (o) {
          if (o === item) return;
          o.classList.remove('open');
          var b = o.querySelector('.acc-btn'); if (b) b.setAttribute('aria-expanded', 'false');
          var body = o.querySelector('.acc-body'); if (body) body.hidden = true;
        });
        item.classList.toggle('open', !open);
        btn.setAttribute('aria-expanded', String(!open));
        var body = item.querySelector('.acc-body');
        if (body) body.hidden = open;
      });
    });
  }

  function hookDocSections(attr, sections) {
    var el = q('[' + attr + ']');
    if (!el) return;
    el.innerHTML = (sections || []).map(function (s) {
      return '<section class="doc-section">' +
        '<h2><span class="doc-n" aria-hidden="true"></span>' + esc(s.title) + '</h2>' +
        '<p>' + esc(s.text) + '</p></section>';
    }).join('');
  }

  function hookTeam() {
    var el = q('[data-team-list]');
    if (!el) return;
    el.innerHTML = (GL.ADMIN_ROLES || []).map(function (r) {
      var who = (r.members || [])[0] || '—';
      return '<li class="team-card">' +
        '<span class="avatar" aria-hidden="true">' + esc(fmt.initials(who)) + '</span>' +
        '<div><h3>' + esc(who) + '</h3><p class="team-role">' + esc(r.name) + '</p>' +
        '<p class="muted">' + esc(r.desc) + '</p></div></li>';
    }).join('');
  }

  function hookMethods() {
    var el = q('[data-deposit-methods]');
    if (!el) return;
    el.innerHTML = (GL.DEPOSIT_METHODS || []).map(function (m) {
      return '<li><span class="dm-ic" aria-hidden="true">' + icon(m.icon, 18) + '</span>' +
        '<b>' + esc(m.label) + '</b><small>' + esc(m.desc) + ' <em>' + esc(m.feeNote) + '</em></small></li>';
    }).join('');
  }

  function hookOutcomes() {
    var el = q('[data-outcomes-row]');
    if (!el) return;
    el.innerHTML = ['successful', 'pending', 'failed', 'cancelled', 'duplicate'].map(function (s) {
      return '<span class="badge b-' + s + '">' + s + '</span>';
    }).join('');
  }

  function hookSupportEmail() {
    var els = document.querySelectorAll('[data-support-email]');
    if (!els.length) return;
    var email = 'support@meridian.example';
    try { email = GL.db().settings.supportEmail || email; } catch (e) {}
    els.forEach = els.forEach || Array.prototype.forEach;
    Array.prototype.forEach.call(els, function (el) { el.textContent = email; });
  }

  function runHooks() {
    try {
      hookStats(); hookFeatures(); hookHow(); hookCurStrip(); hookCurGrid();
      hookRates(); hookCountries(); hookWio(); hookMisconceptions();
      hookDocSections('[data-terms-sections]', GL.TERMS_SECTIONS);
      hookDocSections('[data-privacy-sections]', GL.PRIVACY_SECTIONS);
      hookTeam(); hookMethods(); hookOutcomes(); hookSupportEmail();
    } catch (e) { /* never break the page over a content hook */ }
  }

  renderHeader();
  renderFooter();
  runHooks();
})();
