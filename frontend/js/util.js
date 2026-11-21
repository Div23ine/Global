/* Shared utilities: escaping, formatting, time — no React dependency. */
(function () {
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  MG.util = {
    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    money: function (amount, currency, opts) {
      opts = opts || {};
      var n = Number(amount || 0);
      try {
        return new Intl.NumberFormat(MG.config.LOCALE, {
          style: 'currency', currency: currency || MG.config.DEFAULT_CURRENCY,
          minimumFractionDigits: opts.decimals !== undefined ? opts.decimals : 2,
        }).format(n);
      } catch (e) {
        return (currency || '') + ' ' + n.toFixed(2);
      }
    },

    num: function (n) {
      try { return new Intl.NumberFormat(MG.config.LOCALE).format(Number(n || 0)); }
      catch (e) { return String(n); }
    },

    date: function (iso) {
      if (!iso) return '—';
      var d = new Date(iso);
      return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    },

    dateTime: function (iso) {
      if (!iso) return '—';
      var d = new Date(iso);
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      return MG.util.date(iso) + ', ' + hh + ':' + mm;
    },

    timeAgo: function (iso) {
      if (!iso) return '—';
      var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
      if (s < 60) return 'just now';
      if (s < 3600) return Math.floor(s / 60) + ' min ago';
      if (s < 86400) return Math.floor(s / 3600) + ' h ago';
      if (s < 2592000) return Math.floor(s / 86400) + ' d ago';
      return MG.util.date(iso);
    },

    initials: function (name) {
      var parts = String(name || '').trim().split(/\s+/);
      if (!parts[0]) return 'M';
      return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    },

    toast: function (message, tone) {
      var host = document.getElementById('gl-toasts');
      if (!host) { return; }
      var el = document.createElement('div');
      el.className = 'gl-toast tone-' + (tone || 'info');
      el.setAttribute('role', 'status');
      el.textContent = message;
      host.appendChild(el);
      setTimeout(function () { el.classList.add('out'); }, 3600);
      setTimeout(function () { el.remove(); }, 4000);
    },

    downloadText: function (filename, text, mime) {
      var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
    },

    toCsv: function (rows) {
      return rows.map(function (r) {
        return r.map(function (cell) {
          var v = String(cell == null ? '' : cell);
          return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        }).join(',');
      }).join('\n');
    },

    errMessage: function (err) {
      if (!err) return 'Something went wrong.';
      if (err.code === 'NETWORK' || err.code === 'TIMEOUT') {
        return 'Cannot reach the Meridian service. Please check your connection.';
      }
      return err.message || 'Something went wrong.';
    },
  };
})();
