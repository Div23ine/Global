/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — shared/site-core.js
   Behaviour shared by every public site page of all three concepts.
   Design systems stay separate: this file only wires generic hooks
   (data-* attributes) that each concept's own CSS styles.

   Pages provide: [data-nav-toggle], [data-nav-panel], [data-accordion],
   [data-tabs], [data-year], [data-contact-form], [data-currency-ticker],
   [data-faq-list], body[data-page].
   ========================================================================== */
window.GL = window.GL || {};
(function () {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {

    /* ---- mobile navigation ---- */
    var toggle = document.querySelector('[data-nav-toggle]');
    var panel = document.querySelector('[data-nav-panel]');
    if (toggle && panel) {
      toggle.addEventListener('click', function () {
        var open = panel.classList.toggle('is-open');
        toggle.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      panel.addEventListener('click', function (e) { if (e.target.closest('a')) { panel.classList.remove('is-open'); toggle.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); } });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('is-open')) { panel.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); } });
    }

    /* ---- sticky header shadow ---- */
    var header = document.querySelector('[data-site-header]');
    if (header) {
      var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
      window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    }

    /* ---- accordions (FAQ etc.) ----
       NOTE: binding happens in ONE pass, AFTER dynamic FAQ injection below,
       guarded by data-wired so items are never bound twice. */

    /* ---- tabs ---- */
    document.querySelectorAll('[data-tabs]').forEach(function (root) {
      root.querySelectorAll('[role="tab"]').forEach(function (tab) {
        tab.addEventListener('click', function () {
          var id = tab.getAttribute('aria-controls');
          root.querySelectorAll('[role="tab"]').forEach(function (t) { t.setAttribute('aria-selected', 'false'); t.classList.remove('active'); });
          tab.setAttribute('aria-selected', 'true'); tab.classList.add('active');
          root.querySelectorAll('[role="tabpanel"]').forEach(function (p) { p.hidden = p.id !== id; });
        });
      });
    });

    /* ---- smooth in-page anchors ---- */
    document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var t = document.querySelector(a.getAttribute('href'));
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    });

    /* ---- contact / lead forms (frontend-only validation + success state) ---- */
    document.querySelectorAll('[data-contact-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = true;
        form.querySelectorAll('[required]').forEach(function (f) {
          var bad = !f.value.trim() || (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value));
          var err = f.closest('.field') && f.closest('.field').querySelector('.field-err');
          if (err) err.hidden = !bad;
          f.setAttribute('aria-invalid', String(bad));
          if (bad) ok = false;
        });
        if (!ok) return;
        form.hidden = true;
        var done = form.parentElement.querySelector('[data-form-success]');
        if (done) done.hidden = false;
      });
    });

    /* ---- currency ticker (indicative demo rates) ---- */
    document.querySelectorAll('[data-currency-ticker]').forEach(function (el) {
      var items = (GL.CURRENCIES || []).filter(function (c) { return c.status === 'active'; }).map(function (c) {
        var perUsd = 1 / (GL.RATES[c.code] || 1);
        return '<span class="tick-item"><b>' + c.code + '</b> ' + c.symbol + GL.fmt.num(perUsd) + ' <i>per $1</i></span>';
      });
      el.innerHTML = (GL.RATES_NOTE ? '<span class="tick-note">' + GL.esc(GL.RATES_NOTE) + '</span>' : '') + items.join('');
    });

    /* ---- FAQ accordion rendered from shared data ---- */
    document.querySelectorAll('[data-faq-list]').forEach(function (el) {
      el.setAttribute('data-accordion', '');
      el.innerHTML = (GL.FAQ || []).map(function (f, i) {
        return '<div class="acc-item">' +
          '<button class="acc-btn" type="button" aria-expanded="false" aria-controls="faq-a' + i + '" id="faq-q' + i + '">' +
            '<span>' + GL.esc(f.q) + '</span>' + GL.icon('chevron-d', 18) + '</button>' +
          '<div class="acc-body" id="faq-a' + i + '" role="region" aria-labelledby="faq-q' + i + '" hidden><p>' + GL.esc(f.a) + '</p></div>' +
        '</div>';
      }).join('');
    });

    /* ---- footer year ---- */
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

    /* ---- run accordion binding AFTER dynamic FAQ injection ---- */
    document.querySelectorAll('[data-accordion]').forEach(function (root) {
      root.querySelectorAll('.acc-item').forEach(function (item) {
        if (item.dataset.wired) return; item.dataset.wired = '1';
        var btn = item.querySelector('.acc-btn');
        if (!btn) return;
        btn.addEventListener('click', function () {
          var open = item.classList.contains('open');
          root.querySelectorAll('.acc-item.open').forEach(function (o) { if (o !== item) { o.classList.remove('open'); o.querySelector('.acc-body').hidden = true; var b = o.querySelector('.acc-btn'); if (b) b.setAttribute('aria-expanded', 'false'); } });
          var nowOpen = !open;
          item.classList.toggle('open', nowOpen);
          btn.setAttribute('aria-expanded', String(nowOpen));
          var body = item.querySelector('.acc-body'); if (body) body.hidden = !nowOpen;
        });
      });
    });
  });
})();
