/* Public-site chrome for the production frontend (Design 02 preserved).
   Injects header/footer, wires nav toggle, FAQ accordions and the contact
   form. No mock data — content is server-rendered in the HTML pages. */
(function () {
  var NAV = [
    { id: 'home', label: 'Home', href: 'index.html' },
    { id: 'about', label: 'About', href: 'about.html' },
    { id: 'what-is-offshore', label: 'What Is an Offshore Account?', href: 'what-is-offshore.html' },
    { id: 'how-it-works', label: 'How It Works', href: 'how-it-works.html' },
    { id: 'currencies', label: 'Currencies', href: 'currencies.html' },
    { id: 'features', label: 'Features', href: 'features.html' },
    { id: 'faq', label: 'FAQ', href: 'faq.html' },
    { id: 'contact', label: 'Contact', href: 'contact.html' },
  ];

  var BRAND_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>';

  function esc(s) { return MG.util.esc(s); }

  function navLinks(cls, active) {
    return NAV.map(function (n) {
      return '<a class="' + cls + (n.id === active ? ' active' : '') + '" href="' + n.href + '"' +
        (n.id === active ? ' aria-current="page"' : '') + '>' + esc(n.label) + '</a>';
    }).join('');
  }

  function brand(cls, light) {
    return '<a class="' + cls + '" href="index.html" aria-label="Meridian Global Accounts — home">' +
      '<span class="brand-mark' + (light ? ' brand-mark-light' : '') + '" aria-hidden="true">' + BRAND_SVG + '</span>' +
      '<span class="brand-text">Meridian <small>GLOBAL ACCOUNTS</small></span></a>';
  }

  function renderChrome() {
    var host = document.getElementById('gl-header');
    var page = document.body.getAttribute('data-page') || '';
    if (host) {
      host.innerHTML =
        '<header class="site-header" data-site-header>' +
          '<div class="container header-in">' +
            brand('brand') +
            '<nav class="site-nav" aria-label="Primary">' + navLinks('nav-link', page) + '</nav>' +
            '<div class="header-cta">' +
              '<a class="btn btn-ghost btn-sm" href="app.html">Sign in</a>' +
              '<a class="btn btn-primary btn-sm" href="app.html#/register">Create Account</a>' +
            '</div>' +
            '<button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-drawer" aria-label="Open menu">' +
              '<span class="nav-toggle-box" aria-hidden="true">' +
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
              '</span>' +
            '</button>' +
          '</div>' +
        '</header>' +
        '<div class="site-drawer" id="site-drawer" data-nav-panel>' +
          '<nav class="drawer-nav" aria-label="Mobile">' + navLinks('drawer-link', page) + '</nav>' +
          '<div class="drawer-cta">' +
            '<a class="btn btn-ghost btn-block" href="app.html">Sign in</a>' +
            '<a class="btn btn-primary btn-block" href="app.html#/register">Create Account</a>' +
          '</div>' +
          '<p class="drawer-note">Meridian Global Accounts — international multi-currency accounts.</p>' +
        '</div>' +
        '<div class="drawer-scrim" data-drawer-scrim hidden></div>';

      var toggle = host.querySelector('[data-nav-toggle]');
      var panel = host.querySelector('[data-nav-panel]');
      var scrim = host.querySelector('[data-drawer-scrim]');
      function closeDrawer() {
        panel.classList.remove('is-open');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        scrim.hidden = true;
      }
      if (toggle && panel) {
        toggle.addEventListener('click', function () {
          var open = panel.classList.toggle('is-open');
          toggle.classList.toggle('is-open', open);
          toggle.setAttribute('aria-expanded', String(open));
          scrim.hidden = !open;
        });
        if (scrim) scrim.addEventListener('click', closeDrawer);
        panel.querySelectorAll('a').forEach(function (link) { link.addEventListener('click', closeDrawer); });
        document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeDrawer(); });
      }
    }

    var footer = document.getElementById('gl-footer');
    if (footer) {
      footer.innerHTML =
        '<footer class="site-footer" data-site-footer>' +
          '<div class="container">' +
            '<div class="footer-grid">' +
              '<div class="footer-brand">' +
                brand('brand brand-light', true) +
                '<p>One account. Five currencies. Global access. Meridian Global Accounts provides international multi-currency platform accounts for customers in Europe.</p>' +
                '<p class="footer-demo">Meridian Global Accounts is an international multi-currency account platform. Deposits and payments are processed through licensed partners.</p>' +
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
                '<a href="app.html">Sign in</a>' +
              '</nav>' +
              '<nav class="footer-col" aria-label="Legal">' +
                '<h3>Legal</h3>' +
                '<a href="terms.html">Terms &amp; Conditions</a>' +
                '<a href="privacy.html">Privacy Policy</a>' +
              '</nav>' +
            '</div>' +
            '<div class="footer-base">' +
              '<span>© ' + new Date().getFullYear() + ' Meridian Global Accounts. All rights reserved.</span>' +
              '<span>European customers · EUR default presentation currency</span>' +
            '</div>' +
          '</div>' +
        '</footer>';
    }
  }

  function wireAccordions() {
    document.querySelectorAll('[data-acc-item]').forEach(function (item) {
      var btn = item.querySelector('[data-acc-btn]');
      var body = item.querySelector('[data-acc-body]');
      if (!btn || !body) return;
      btn.addEventListener('click', function () {
        var open = item.classList.toggle('acc-open');
        btn.setAttribute('aria-expanded', String(open));
        body.hidden = !open;
      });
    });
  }

  function wireContactForm() {
    var form = document.querySelector('[data-contact-form]');
    if (!form) return;
    var status = document.querySelector('[data-form-status]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name && String(form.elements.name.value || '').trim();
      var email = form.elements.email && String(form.elements.email.value || '').trim();
      var message = form.elements.message && String(form.elements.message.value || '').trim();
      if (!name || !email || !message) {
        if (status) { status.hidden = false; status.textContent = 'Complete your name, a valid email address and message before continuing.'; }
        return;
      }
      if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) {
        if (status) { status.hidden = false; status.textContent = 'Enter a valid email address.'; }
        return;
      }
      if (status) {
        status.hidden = false;
        status.textContent = 'Your message is valid, but this public form is not connected to a delivery service yet. Nothing has been sent.';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderChrome();
    wireAccordions();
    wireContactForm();
  });
})();
