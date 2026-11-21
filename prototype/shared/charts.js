/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — shared/charts.js
   Tiny dependency-free canvas charts with hover tooltips, shared by all three
   designs (and usable from React). Colours are passed IN by each design, so
   charts match each concept's palette.

     GL.charts.line(canvas, { values, labels?, color, fill?, yFmt?, tipFmt? })
     GL.charts.bars(canvas, { values, labels?, color, yFmt?, tipFmt? })
     GL.charts.donut(canvas, { segments: [{ value, color, label }] })
     GL.charts.spark(canvas, { values, color })
   ========================================================================== */
window.GL = window.GL || {};
GL.charts = (function () {
  var tipEl = null;
  /* self-injected minimal tooltip styling — works on every page incl. React */
  (function injectCss() {
    if (document.getElementById('gl-chart-tip-style')) return;
    var st = document.createElement('style');
    st.id = 'gl-chart-tip-style';
    st.textContent = '.gl-chart-tip{position:fixed;z-index:9998;pointer-events:none;opacity:0;transition:opacity .12s;' +
      'background:#14181F;color:#E7ECF3;border:1px solid #2A313D;border-radius:8px;padding:6px 9px;' +
      'font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-shadow:0 8px 24px rgba(9,12,18,.4)}' +
      '.gl-chart-tip b{color:#fff}';
    document.head.appendChild(st);
  })();
  function tip() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'gl-chart-tip';
      tipEl.setAttribute('role', 'status');
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function hideTip() { var t = tip(); t.style.opacity = '0'; }
  function showTip(html, x, y) {
    var t = tip();
    t.innerHTML = html;
    t.style.opacity = '1';
    var r = t.getBoundingClientRect();
    var left = Math.max(8, Math.min(window.innerWidth - r.width - 8, x + 12));
    var top = Math.max(8, y - r.height - 12);
    t.style.left = left + 'px'; t.style.top = top + 'px';
  }
  function setup(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var w = rect.width || canvas.clientWidth || 300;
    var h = rect.height || canvas.clientHeight || 160;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    return Math.ceil(v / mag) * mag;
  }

  function line(canvas, o) {
    var s = setup(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;
    var padL = 38, padR = 8, padT = 10, padB = 20;
    var vals = o.values || [];
    if (vals.length < 2) return;
    var max = niceMax(Math.max.apply(null, vals) * 1.08);
    var iw = w - padL - padR, ih = h - padT - padB;
    var X = function (i) { return padL + (i / (vals.length - 1)) * iw; };
    var Y = function (v) { return padT + ih - (v / max) * ih; };
    /* gridlines */
    ctx.strokeStyle = 'rgba(128,128,140,.16)'; ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(128,128,140,.75)'; ctx.font = '10px Inter, system-ui, sans-serif'; ctx.textAlign = 'right';
    for (var g = 0; g <= 3; g++) {
      var gy = padT + (ih * g) / 3;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
      ctx.fillText(o.yFmt ? o.yFmt(max * (1 - g / 3)) : Math.round(max * (1 - g / 3)), padL - 6, gy + 3);
    }
    /* area fill */
    if (o.fill !== false) {
      var grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
      grad.addColorStop(0, hexA(o.color, 0.22)); grad.addColorStop(1, hexA(o.color, 0.01));
      ctx.beginPath(); ctx.moveTo(X(0), Y(vals[0]));
      for (var i = 1; i < vals.length; i++) ctx.lineTo(X(i), Y(vals[i]));
      ctx.lineTo(X(vals.length - 1), padT + ih); ctx.lineTo(X(0), padT + ih); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
    }
    /* line */
    ctx.beginPath(); ctx.moveTo(X(0), Y(vals[0]));
    for (var j = 1; j < vals.length; j++) ctx.lineTo(X(j), Y(vals[j]));
    ctx.strokeStyle = o.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    /* labels */
    if (o.labels) {
      ctx.fillStyle = 'rgba(128,128,140,.85)'; ctx.textAlign = 'center'; ctx.font = '10px Inter, system-ui, sans-serif';
      var step = Math.ceil(o.labels.length / 6);
      o.labels.forEach(function (l, i) { if (i % step === 0) ctx.fillText(l, X(i), h - 6); });
    }
    /* hover */
    canvas.onmousemove = function (e) {
      var r = canvas.getBoundingClientRect();
      var mx = e.clientX - r.left;
      var idx = Math.round(((mx - padL) / iw) * (vals.length - 1));
      idx = Math.max(0, Math.min(vals.length - 1, idx));
      var lbl = o.labels && o.labels[idx] ? o.labels[idx] : '#' + (idx + 1);
      var val = o.tipFmt ? o.tipFmt(vals[idx]) : vals[idx];
      showTip('<b>' + lbl + '</b> ' + val, e.clientX, e.clientY);
      drawDot(X(idx), Y(vals[idx]));
    };
    canvas.onmouseleave = hideTip;
    function drawDot(x, y) {
      var dpr = window.devicePixelRatio || 1;
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
      var c2 = canvas.getContext('2d'); c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      line(c2.canvas, Object.assign({}, o, { _dot: { x: x, y: y } }));
    }
  }

  function bars(canvas, o) {
    var s = setup(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;
    var padL = 34, padR = 8, padT = 10, padB = 22;
    var vals = o.values || []; var labels = o.labels || [];
    if (!vals.length) return;
    var max = niceMax(Math.max.apply(null, vals) * 1.1);
    var iw = w - padL - padR, ih = h - padT - padB;
    var bw = Math.min(34, (iw / vals.length) * 0.62);
    ctx.strokeStyle = 'rgba(128,128,140,.16)';
    ctx.fillStyle = 'rgba(128,128,140,.75)'; ctx.font = '10px Inter, system-ui, sans-serif'; ctx.textAlign = 'right';
    for (var g = 0; g <= 2; g++) {
      var gy = padT + (ih * g) / 2;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
      ctx.fillText(o.yFmt ? o.yFmt(max * (1 - g / 2)) : Math.round(max * (1 - g / 2)), padL - 6, gy + 3);
    }
    vals.forEach(function (v, i) {
      var x = padL + (i + 0.5) * (iw / vals.length) - bw / 2;
      var bh = (v / max) * ih;
      var y = padT + ih - bh;
      if (o.colors) ctx.fillStyle = o.colors[i] || o.color;
      else ctx.fillStyle = o.color;
      rounded(ctx, x, y, bw, bh, 4); ctx.fill();
      if (labels[i]) { ctx.fillStyle = 'rgba(128,128,140,.85)'; ctx.textAlign = 'center'; ctx.fillText(labels[i], x + bw / 2, h - 7); }
    });
    canvas.onmousemove = function (e) {
      var r = canvas.getBoundingClientRect();
      var mx = e.clientX - r.left;
      var idx = Math.floor(((mx - padL) / iw) * vals.length);
      if (idx < 0 || idx >= vals.length) { hideTip(); return; }
      var lbl = labels[idx] || '#' + (idx + 1);
      showTip('<b>' + lbl + '</b> ' + (o.tipFmt ? o.tipFmt(vals[idx]) : vals[idx]), e.clientX, e.clientY);
    };
    canvas.onmouseleave = hideTip;
  }

  function donut(canvas, o) {
    var s = setup(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;
    var segs = (o.segments || []).filter(function (x) { return x.value > 0; });
    if (!segs.length) return;
    var total = segs.reduce(function (a, b) { return a + b.value; }, 0);
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 6, r = R * 0.62;
    var angle = -Math.PI / 2;
    segs.forEach(function (sg) {
      var a2 = angle + (sg.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, angle, a2); ctx.arc(cx, cy, r, a2, angle, true); ctx.closePath();
      ctx.fillStyle = sg.color; ctx.fill();
      sg._a1 = angle; sg._a2 = a2;
      angle = a2;
    });
    /* centre label */
    ctx.fillStyle = 'rgba(128,128,140,.9)'; ctx.textAlign = 'center';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillText(o.centre || '', cx, cy + 4);
    canvas.onmousemove = function (e) {
      var rect = canvas.getBoundingClientRect();
      var dx = e.clientX - rect.left - cx, dy = e.clientY - rect.top - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < r || dist > R) { hideTip(); return; }
      var ang = Math.atan2(dy, dx);
      var norm = ang < -Math.PI / 2 ? ang + Math.PI * 2 : ang;
      var seg = segs.filter(function (sg) { return norm >= sg._a1 && norm <= sg._a2; })[0];
      if (seg) showTip('<b>' + seg.label + '</b> ' + Math.round((seg.value / total) * 100) + '%', e.clientX, e.clientY);
    };
    canvas.onmouseleave = hideTip;
  }

  function spark(canvas, o) {
    var s = setup(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;
    var vals = o.values || [];
    if (vals.length < 2) return;
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var span = max - min || 1;
    var X = function (i) { return 2 + (i / (vals.length - 1)) * (w - 4); };
    var Y = function (v) { return h - 4 - ((v - min) / span) * (h - 8); };
    ctx.beginPath(); ctx.moveTo(X(0), Y(vals[0]));
    for (var i = 1; i < vals.length; i++) ctx.lineTo(X(i), Y(vals[i]));
    ctx.strokeStyle = o.color; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(X(vals.length - 1), Y(vals[vals.length - 1]), 2.4, 0, Math.PI * 2);
    ctx.fillStyle = o.color; ctx.fill();
  }

  function rounded(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2 || r);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function hexA(hex, a) {
    var m = hex.replace('#', '');
    if (m.length === 3) m = m.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(m, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  return { line: line, bars: bars, donut: donut, spark: spark, hideTip: hideTip };
})();
