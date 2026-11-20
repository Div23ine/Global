/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — Design Concept 1 · “Swiss Private Banking”
   customer/swiss/assets/components.js

   Injects the site header (+ mobile drawer) into #gl-header and the footer
   into #gl-footer on every public page. Runs synchronously at parse time
   (the script sits at the end of <body>) so that shared/site-core.js — which
   wires [data-nav-toggle] / [data-nav-panel] on DOMContentLoaded — finds the
   markup already in place.
   ========================================================================== */
window.GL = window.GL || {};
(function () {
  var esc = GL.esc;
  var icon = GL.icon;

  var MARK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 3.5v17M3.5 12h17"></path></svg>';

  var NAV = [
    ['home', 'Home', 'index.html'],
    ['about', 'About', 'about.html'],
    ['what-is-offshore', 'What Is an Offshore Account?', 'what-is-offshore.html'],
    ['how-it-works', 'How It Works', 'how-it-works.html'],
    ['currencies', 'Currencies', 'currencies.html'],
    ['features', 'Features', 'features.html'],
    ['faq', 'FAQ', 'faq.html'],
    ['contact', 'Contact', 'contact.html']
  ];

  function navAttr(page, id) {
    return page === id ? ' class="active" aria-current="page"' : '';
  }

  function brandHtml() {
    return '<a class="brand" href="index.html" aria-label="Meridian Global Accounts — home">' +
      '<span class="brand-mark" aria-hidden="true">' + MARK + '</span>' +
      '<span class="brand-text">Meridian<small>Global Accounts</small></span></a>';
  }

  function header() {
    var host = document.getElementById('gl-header');
    if (!host) return;
    var page = document.body.getAttribute('data-page') || '';
    var session = null;
    try { session = GL.api.session.get(); } catch (e) { session = null; }

    var signIn = session
      ? '<a class="btn btn-ghost btn-sm" href="app.html#/overview">Dashboard</a>'
      : '<a class="btn btn-ghost btn-sm" href="app.html#/login">Sign in</a>';
    var create = '<a class="btn btn-primary btn-sm" href="app.html#/register">Create Account</a>';

    var nav = NAV.map(function (n) {
      return '<a href="' + n[2] + '"' + navAttr(page, n[0]) + '>' + esc(n[1]) + '</a>';
    }).join('');
    var mnav = NAV.map(function (n) {
      return '<a href="' + n[2] + '"' + navAttr(page, n[0]) + '>' + esc(n[1]) + '</a>';
    }).join('');

    host.innerHTML =
      '<header class="site-header" data-site-header>' +
        '<div class="site-head-in">' +
          brandHtml() +
          '<nav class="site-nav" aria-label="Primary">' + nav + '</nav>' +
          '<div class="site-actions">' + signIn + create + '</div>' +
          '<button type="button" class="icon-btn nav-burger" data-nav-toggle aria-expanded="false" ' +
            'aria-controls="site-nav-panel" aria-label="Open menu">' + icon('menu', 21) + '</button>' +
        '</div>' +
        '<div class="nav-panel" id="site-nav-panel" data-nav-panel>' +
          '<div class="nav-panel-in">' +
            '<nav aria-label="Mobile">' + mnav + '</nav>' +
            '<div class="nav-panel-acts">' + signIn + create + '</div>' +
          '</div>' +
        '</div>' +
      '</header>';
  }

  function footer() {
    var host = document.getElementById('gl-footer');
    if (!host) return;
    host.innerHTML =
      '<footer class="site-footer" data-site-footer>' +
        '<div class="foot-in">' +
          '<div class="foot-brand">' +
            brandHtml() +
            '<p>Meridian Global Accounts is a placeholder brand for a frontend design prototype. ' +
              'It does not provide bank accounts, actual offshore accounts, or regulated financial ' +
              'services. Every user, balance, transaction and statement in this demonstration is ' +
              'sample data held in your browser only.</p>' +
          '</div>' +
          '<nav class="foot-col" aria-label="Product">' +
            '<h3>Product</h3>' +
            '<a href="how-it-works.html">How it works</a>' +
            '<a href="currencies.html">Currencies</a>' +
            '<a href="features.html">Features</a>' +
            '<a href="faq.html">FAQ</a>' +
          '</nav>' +
          '<nav class="foot-col" aria-label="Company">' +
            '<h3>Company</h3>' +
            '<a href="about.html">About</a>' +
            '<a href="what-is-offshore.html">What is an offshore account?</a>' +
            '<a href="contact.html">Contact</a>' +
          '</nav>' +
          '<nav class="foot-col" aria-label="Account and legal">' +
            '<h3>Account &amp; legal</h3>' +
            '<a href="app.html#/login">Sign in</a>' +
            '<a href="app.html#/register">Create account</a>' +
            '<a href="terms.html">Terms &amp; conditions</a>' +
            '<a href="privacy.html">Privacy policy</a>' +
          '</nav>' +
        '</div>' +
        '<div class="foot-base"><div class="foot-base-in">' +
          '<span>© <span data-year>2025</span> Meridian Global Accounts — design prototype.</span>' +
          '<span>Design prototype — not a live financial service. Demo data lives in your browser only.</span>' +
        '</div></div>' +
      '</footer>';
  }

  /* fill demo support-email addresses from the live demo store */
  function supportEmail() {
    var nodes = document.querySelectorAll('[data-support-email]');
    if (!nodes.length) return;
    var email = 'support@meridian.example';
    try { email = GL.db().settings.supportEmail || email; } catch (e) { /* keep fallback */ }
    Array.prototype.forEach.call(nodes, function (n) {
      n.textContent = email;
      if (n.tagName === 'A') n.setAttribute('href', 'mailto:' + email);
    });
  }

  header();
  footer();
  supportEmail();
})();
