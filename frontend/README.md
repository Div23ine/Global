# Meridian Frontend (production)

React 18 via CDN + Babel Standalone — no build step (by design, per project
requirements). Approved visual design: Design 02 — Hong Kong International
Fintech (`assets/theme.css` carried over from the approved prototype).

## Run locally
```bash
cd frontend && python3 -m http.server 4173
# public site:  http://localhost:4173/
# customer app: http://localhost:4173/app.html
# admin:        http://localhost:4173/admin.html
```

## Configure
Edit `js/config.js` (or create gitignored `js/config.local.js` defining
`window.MG_LOCAL_CONFIG`) and set:
- `API_BASE_URL` — backend base, e.g. `https://api.example.com/api/v1`
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` — public browser configuration values

Without configuration, `app.html` and `admin.html` render an explicit
configuration screen — they never fall back to simulated data.

## Structure
```
index.html + 9 pages   public marketing site (static, design 02)
app.html               customer application (React CDN SPA, hash-routed)
admin.html             administrator console (React CDN SPA, role-gated)
assets/theme.css       the approved design system
js/config.js           non-secret configuration
js/util.js             formatting / toast / download helpers
js/site.js             public-site chrome + behaviours
js/services/           supabase-auth.js (Supabase Auth), http.js (fetch+envelope), api.js (resources)
js/components/ui.jsx   shared React UI atoms (badge, card, table, modal, skeleton...)
js/app/                customer views (banking, records, account)
js/admin/              admin views (core, ops)
check.sh               syntax-check every script (node --check + esbuild parse)
```

## Vite migration path (prepared, intentionally not performed)
`js/services/*.js` contain zero React imports by design; migration is a
mechanical repackaging described in ARCHITECTURE.md §8.
