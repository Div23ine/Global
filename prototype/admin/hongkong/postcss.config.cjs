/* Local PostCSS config for the admin build.
   Vite otherwise walks up the tree and picks up the workspace-root
   postcss.config.mjs (Tailwind), which is not installed in this project
   and breaks `vite build`. This file intentionally defines no plugins —
   the admin CSS is plain hand-written CSS. */
module.exports = { plugins: [] };
