/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — shared/demo-panel.js
   Presentation controls for the prototype. Present on every page of every
   design (collapsible). This is META TOOLING for client demos — deliberately
   styled like a dev tool, clearly separate from the three design systems.

   Sections:
   · Simulated OTP codes for the pending verification
   · Force next payment outcome (success / pending / failed / cancelled / duplicate)
   · Currency availability toggles (affects the customer Activate page live)
   · Design switcher (jump to the same place in another design)
   · Reset demo data
   ========================================================================== */
window.GL = window.GL || {};
(function () {
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  function currentDesign() {
    var m = location.pathname.match(/\/(customer|admin)\/(swiss|hongkong|premium)\//);
    return m ? m[2] : null;
  }
  function designs() { return ['swiss', 'hongkong', 'premium']; }

  function rootHref() {
    /* path to the design-selection page, correct for customer AND admin/dist depths */
    var m = location.pathname.match(/\/(customer|admin)\//);
    if (!m) return 'index.html';
    return location.pathname.split(/\/(customer|admin)\//)[0] + '/index.html';
  }

  function switchHref(target) {
    var cur = currentDesign();
    if (!cur) return target + '/index.html';
    /* map the current location to the equivalent page in the target design */
    var path = location.pathname;
    var rel = path.split('/' + cur + '/')[1] || 'index.html';
    var base = path.split('/' + cur + '/')[0];
    var out = base + '/' + target + '/' + rel + location.hash;
    /* admin dist paths differ between dev (index.html at root) and dist — same relative layout works */
    return out;
  }

  function esc(s) { return GL.esc(s); }

  function render() {
    var host = document.createElement('div');
    host.id = 'gl-demo-panel';
    document.body.appendChild(host);

    var outcomes = [
      ['auto', 'Auto (realistic default)'],
      ['success', 'SUCCESS'],
      ['pending', 'PENDING'],
      ['failed', 'FAILED'],
      ['cancelled', 'CANCELLED'],
      ['duplicate', 'DUPLICATE']
    ];
    var forced = GL.api.demo.forcedOutcome();
    var cur = GL.db().settings.currencyStatus;

    host.innerHTML =
      '<button type="button" id="gl-demo-chip" aria-expanded="false" aria-controls="gl-demo-body">' +
        '<span class="gl-demo-dot"></span> DEMO CONTROLS' +
      '</button>' +
      '<div id="gl-demo-body" hidden>' +
        '<div class="gl-demo-head">' +
          '<b>Demonstration environment</b>' +
          '<span>No real money · data lives in your browser only</span>' +
        '</div>' +

        '<div class="gl-demo-sec"><label>Simulated OTP (current flow)</label><div id="gl-demo-otp" class="gl-demo-otp">—</div></div>' +

        '<div class="gl-demo-sec">' +
          '<label for="gl-demo-outcome">Force next payment outcome</label>' +
          '<select id="gl-demo-outcome">' +
            outcomes.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === forced ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
          '</select>' +
          '<p class="gl-demo-note">Applies to the next simulated deposit confirmation.</p>' +
        '</div>' +

        '<div class="gl-demo-sec">' +
          '<label>Currency availability</label>' +
          '<div class="gl-demo-cur">' +
            Object.keys(cur).map(function (code) {
              return '<button type="button" data-gl-cur="' + code + '" class="' + (cur[code] === 'active' ? 'on' : 'off') + '">' + code + '</button>';
            }).join('') +
          '</div>' +
          '<p class="gl-demo-note">Toggle a currency to see the “temporarily unavailable” state on the customer Activate Currency page.</p>' +
        '</div>' +

        '<div class="gl-demo-sec">' +
          '<label>Switch design</label>' +
          '<div class="gl-demo-switch">' +
            designs().map(function (d) {
              return '<a href="' + switchHref(d) + '"' + (d === currentDesign() ? ' class="cur"' : '') + '>' +
                (d === 'swiss' ? 'Swiss Private Banking' : d === 'hongkong' ? 'Hong Kong Fintech' : 'Premium Global') + '</a>';
            }).join('') +
            '<a href="' + rootHref() + '" class="sel">Design selection page</a>' +
          '</div>' +
        '</div>' +

        '<div class="gl-demo-sec">' +
          '<button type="button" id="gl-demo-reset" class="gl-demo-danger">Reset demo data</button>' +
          '<p class="gl-demo-note">Restores the original demo users, balances and history. Signs you out.</p>' +
        '</div>' +
      '</div>';

    var chip = host.querySelector('#gl-demo-chip');
    var body = host.querySelector('#gl-demo-body');
    chip.addEventListener('click', function () {
      var open = body.hidden;
      body.hidden = !open;
      chip.setAttribute('aria-expanded', String(open));
      if (open) refreshOtp();
    });

    function refreshOtp() {
      var el = host.querySelector('#gl-demo-otp');
      var p = GL.api.demo.pendingOtp();
      if (!p) { el.innerHTML = '<span class="gl-demo-muted">No pending verification. Start a registration to see codes here.</span>'; return; }
      el.innerHTML = '<div><span>' + esc(p.email) + '</span></div>' +
        (p.emailOtp ? '<div>Email code: <b>' + esc(p.emailOtp) + '</b></div>' : '') +
        (p.phoneOtp ? '<div>Phone code: <b>' + esc(p.phoneOtp) + '</b></div>' : '');
    }
    setInterval(function () { if (!body.hidden) refreshOtp(); }, 1500);

    host.querySelector('#gl-demo-outcome').addEventListener('change', function (e) {
      GL.api.demo.setForcedOutcome(e.target.value);
      GL.toast && GL.toast('Next payment outcome forced: ' + e.target.value, 'info');
    });

    host.querySelectorAll('[data-gl-cur]').forEach(function (b) {
      b.addEventListener('click', function () {
        var code = b.getAttribute('data-gl-cur');
        var nowActive = GL.db().settings.currencyStatus[code] === 'active';
        GL.api.demo.setCurrencyStatus(code, nowActive ? 'unavailable' : 'active');
        b.className = nowActive ? 'off' : 'on';
        GL.toast && GL.toast(code + ' is now ' + (nowActive ? 'temporarily unavailable' : 'available') + ' (demo).', 'info');
        /* live refresh if the customer app is showing the Activate page */
        if (window.GL.S && GL.S.view === 'activate' && GL.refreshViewData) {
          GL.refreshViewData('activate').then(GL.rerender);
        }
      });
    });

    host.querySelector('#gl-demo-reset').addEventListener('click', function () {
      if (!window.confirm('Reset all demo data? Demo users, balances and history return to their original state and you will be signed out.')) return;
      GL.api.demo.reset();
      location.href = rootHref();
    });
  }

  /* demo panel CSS is injected so every page gets it without extra <link> tags.
     In bundled environments (React admin), document.currentScript is null —
     there the CSS is imported directly in main.jsx instead. */
  function css() {
    if (!document.currentScript || !document.currentScript.src) return;
    var link = document.createElement('link');
    link.href = document.currentScript.src.replace('demo-panel.js', 'demo-panel.css');
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  ready(function () {
    try { css(); render(); } catch (e) { /* never break the page */ }
  });
})();
