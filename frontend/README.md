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
Set the public browser configuration in `js/config.local.js` (loaded before
`js/config.js` by the public site, customer app, and admin console):
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_ANON_KEY` — your Supabase anon/publishable key
- `API_BASE_URL` — optional override; defaults to `https://api.meridian.uk.com/api/v1`

The same values may instead be injected as `window.MG_SUPABASE_URL`,
`window.MG_SUPABASE_ANON_KEY`, and `window.MG_API_BASE_URL` before `config.js`.
The local file contains public browser values only; never put the Supabase
service-role key or any backend secret in it.

The Supabase anon/publishable key is intended for browser use. The Supabase
service-role key must never appear in frontend code. Without configuration,
`app.html` and `admin.html` render an explicit screen and never use simulated data.

## Structure
```
index.html + 9 pages   public marketing site (static, design 02)
app.html               customer application (React CDN SPA, hash-routed)
admin.html             administrator console (React CDN SPA, role-gated)
assets/theme.css       the approved design system
js/config.local.js     public runtime values (Supabase URL + anon key)
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
