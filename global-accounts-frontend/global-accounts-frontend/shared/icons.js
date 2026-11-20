/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — INTERNATIONAL MULTI-CURRENCY ACCOUNT PLATFORM
   (frontend design prototype — three design concepts for client selection)

   shared/icons.js — neutral inline SVG icon set shared by all three concepts
   and by the React admin apps. Icons are unstyled strokes (currentColor) —
   each design system colours and weights them through its own CSS.
   Usage: GL.icon('wallet', 20)  ·  GL.icon('coins', 16, 'chip-ic')
   ========================================================================== */
window.GL = window.GL || {};
(function () {
  const P = {
    dashboard:  '<rect x="3" y="3" width="7.5" height="9.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.5"/><rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5"/>',
    wallet:     '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z"/><path d="M16 12h2.5"/><path d="M3 9h16"/>',
    coins:      '<circle cx="9" cy="9" r="5.5"/><path d="M6.8 13.6A5.5 5.5 0 1 0 15 8.5"/><path d="M9 6.8v4.4M7.2 9h3.6"/>',
    calendar:   '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4m8-4v4"/>',
    receipt:    '<path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.6z"/><path d="M9.5 8h5M9.5 12h5"/>',
    bank:       '<path d="M3.5 9.5 12 4l8.5 5.5"/><path d="M5 10v9m4.5-9v9m5-9v9M19 10v9M3.5 19.5h17"/>',
    bell:       '<path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13.5 6 9.5"/><path d="M10 18.5a2.2 2.2 0 0 0 4 0"/>',
    user:       '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    users:      '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 6a3.5 3.5 0 0 1 0 7"/><path d="M17.5 14.5a6.5 6.5 0 0 1 4 5.5"/>',
    shield:     '<path d="M12 3.5 5 6v5.5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>',
    'shield-check': '<path d="M12 3.5 5 6v5.5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 11.5 2.2 2.2 4-4.2"/>',
    lock:       '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    key:        '<circle cx="8" cy="15.5" r="4"/><path d="m11 12.5 8.5-8.5M16 7l2.5 2.5M13.5 9.5 16 12"/>',
    settings:   '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4m0 13.6v2.4M4.2 7.4l2.1 1.2m11.4 6.8 2.1 1.2M4.2 16.6l2.1-1.2m11.4-6.8 2.1-1.2"/>',
    sliders:    '<path d="M4 7h10m3 0h3M4 12h4m3 0h9M4 17h10m3 0h3"/><circle cx="15.5" cy="7" r="1.8"/><circle cx="9.5" cy="12" r="1.8"/><circle cx="15.5" cy="17" r="1.8"/>',
    doc:        '<path d="M7 3.5h7L18.5 8v12.5h-11.5z"/><path d="M14 3.5V8h4.5M9.5 12h5m-5 3.5h5"/>',
    upload:     '<path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/><path d="M12 16V4.5m0 0L7.5 9m4.5-4.5L16.5 9"/>',
    download:   '<path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/><path d="M12 4.5V16m0 0 4.5-4.5M12 16l-4.5-4.5"/>',
    chart:      '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7.5" y="12" width="3" height="5" rx=".8"/><rect x="12.5" y="8.5" width="3" height="8.5" rx=".8"/><rect x="17.5" y="5" width="3" height="12" rx=".8"/>',
    globe:      '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.3 4 5.2 4 8.5s-1.4 6.2-4 8.5c-2.6-2.3-4-5.2-4-8.5s1.4-6.2 4-8.5z"/>',
    search:     '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
    filter:     '<path d="M4 6h16M7 12h10m-7 6h4"/>',
    chevron:    '<path d="m8.5 5.5 7 6.5-7 6.5"/>',
    'chevron-l':'<path d="m15.5 5.5-7 6.5 7 6.5"/>',
    'chevron-d':'<path d="m6 9.5 6 6 6-6"/>',
    check:      '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    'check-circle':'<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    x:          '<path d="M6 6l12 12M18 6 6 18"/>',
    'x-circle': '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5l5 5m0-5-5 5"/>',
    clock:      '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.5l3.5 2"/>',
    'arrow-up': '<path d="M7 17 17 7M9 7h8v8"/>',
    'arrow-dn': '<path d="M7 7l10 10M17 9v8H9"/>',
    'arrow-r':  '<path d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5"/>',
    logout:     '<path d="M14.5 4.5h-9v15h9"/><path d="M10 12h10m0 0-3.5-3.5M20 12l-3.5 3.5"/>',
    menu:       '<path d="M4 7h16M4 12h16M4 17h16"/>',
    eye:        '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off':  '<path d="M4 4l16 16"/><path d="M10.5 5.9A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.5 17.5 0 0 1-3 3.8M6.6 6.9A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9.5 9.5 0 0 0 4-1"/><path d="M9.9 10a3 3 0 0 0 4.2 4.2"/>',
    edit:       '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m13.5 6.5 3 3"/>',
    plus:       '<path d="M12 5v14M5 12h14"/>',
    minus:      '<path d="M5 12h14"/>',
    alert:      '<path d="M12 3.5 2.5 20h19z"/><path d="M12 9.5V14m0 2.8v.2"/>',
    info:       '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5m0-8.3v.3"/>',
    phone:      '<path d="M6 3.5h3l1.5 4.5-2 1.5a12 12 0 0 0 6 6l1.5-2 4.5 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.7 2 2 0 0 1 6 3.5z"/>',
    smartphone: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10.5 18.8h3"/>',
    mail:       '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
    'map-pin':  '<path d="M12 21s-6.5-5.5-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.5 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.3"/>',
    building:   '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2M10.5 20.5v-3h3v3"/>',
    home:       '<path d="m4 11 8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-6h4v6"/>',
    percent:    '<path d="M19 5 5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
    refresh:    '<path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L20 9"/><path d="M20 4.5V9h-4.5"/><path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4 15"/><path d="M4 19.5V15h4.5"/>',
    card:       '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    flag:       '<path d="M5.5 21V4"/><path d="M5.5 5h11l-2 3.5 2 3.5h-11"/>',
    send:       '<path d="M20.5 3.5 3.5 10.5l6 2.5 2.5 6z"/><path d="m9.5 13 11-9.5"/>',
    external:   '<path d="M14 5h5v5"/><path d="M19 5 10.5 13.5"/><path d="M19 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5H10"/>',
    snowflake:  '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M12 6.5 9.8 4.7M12 6.5l2.2-1.8M12 17.5l-2.2 1.8m2.2-1.8 2.2 1.8"/>',
    history:    '<path d="M4 12a8 8 0 1 1 2.3 5.6"/><path d="M4 21v-4.5h4.5"/><path d="M12 8v4.3l3 1.7"/>',
    message:    '<path d="M4 5.5h16v11H12l-5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    ticket:     '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v1.8a2 2 0 0 0 0 3.4v1.8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 15.5v-1.8a2 2 0 0 0 0-3.4z"/><path d="M14 7v10" stroke-dasharray="2 2.4"/>',
    'trend-up': '<path d="m4 16.5 5-5 3.5 3.5L20 8"/><path d="M14.5 8H20v5.5"/>',
    'trend-dn': '<path d="m4 7.5 5 5 3.5-3.5L20 16"/><path d="M14.5 16H20v-5.5"/>',
    sun:        '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2m0 15v2M4.6 4.6l1.4 1.4m12 12 1.4 1.4M2.5 12h2m15 0h2M4.6 19.4l1.4-1.4m12-12 1.4-1.4"/>',
    moon:       '<path d="M20 13.2A8 8 0 1 1 10.8 4 6.5 6.5 0 0 0 20 13.2z"/>',
    landmark:   '<path d="M3.5 9.5 12 4l8.5 5.5"/><path d="M5 11v6m4.5-6v6m5-6v6M19 11v6M3.5 19.5h17"/>',
    exchange:   '<path d="M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5"/><path d="M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5"/>',
    help:       '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.3A2.5 2.5 0 0 1 14.5 10c0 1.7-2.5 2-2.5 3.5m0 2.6v.2"/>',
    printer:    '<path d="M7 8V3.5h10V8"/><rect x="4" y="8" width="16" height="8" rx="1.5"/><path d="M7 13.5h10v7H7z"/>',
    layers:     '<path d="m12 3.5 8.5 4.5L12 12.5 3.5 8z"/><path d="m4.5 12 7.5 4 7.5-4"/><path d="m4.5 16 7.5 4 7.5-4"/>',
    star:       '<path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"/>',
    life:       '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="m6 6 3.2 3.2m5.6 5.6L18 18M18 6l-3.2 3.2M9.2 14.8 6 18"/>',
    pause:      '<path d="M9 5.5v13M15 5.5v13"/>',
    ban:        '<circle cx="12" cy="12" r="8.5"/><path d="m6.5 17.5 11-11"/>',
    grid:       '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    book:       '<path d="M4 5.5A2 2 0 0 1 6 3.5h13v17H6a2 2 0 0 0-2 2z"/><path d="M4 18.5a2 2 0 0 1 2-2h13"/>'
  };
  GL.icon = function (name, size, cls) {
    var s = size || 20;
    var body = P[name] || P.info;
    return '<svg class="' + (cls || 'gl-ic') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  };
  /* html-escape helper — must load before the view templates use it */
  GL.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
})();
