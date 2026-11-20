/* Meridian Global Accounts — design selector behaviour.
   Records the chosen design in localStorage and manages demo-data reset. */
(function () {
  var KEY = 'gl_chosen_design';
  var NAMES = { swiss: 'Swiss Private Banking', hongkong: 'Hong Kong International Fintech', premium: 'Premium Global Financial Platform' };

  function toast(msg) {
    var t = document.getElementById('sel-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  function applyChosen() {
    var chosen = null;
    try { chosen = localStorage.getItem(KEY); } catch (e) {}
    document.querySelectorAll('.sel-card').forEach(function (c) { c.classList.toggle('chosen', c.id === 'card-' + chosen); });
    document.querySelectorAll('[data-choose]').forEach(function (b) {
      var isChosen = b.getAttribute('data-choose') === chosen;
      b.textContent = isChosen ? 'Selected ✓' : 'Choose this design';
      b.disabled = isChosen;
    });
    return chosen;
  }

  document.querySelectorAll('[data-choose]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var d = btn.getAttribute('data-choose');
      try { localStorage.setItem(KEY, d); } catch (e) {}
      applyChosen();
      toast('“' + NAMES[d] + '” recorded as your preferred design. The production build will follow this direction.');
    });
  });

  var reset = document.getElementById('sel-reset');
  if (reset) reset.addEventListener('click', function () {
    if (!window.confirm('Reset all demo data? Demo users, balances and history return to their original state.')) return;
    try {
      localStorage.removeItem('gl_db_v1');
      localStorage.removeItem('gl_session');
      sessionStorage.clear();
    } catch (e) {}
    toast('Demo data reset. The original demonstration state has been restored.');
  });

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  var chosen = applyChosen();
  if (chosen) console.log('[selector] previously chosen design:', chosen);
})();
