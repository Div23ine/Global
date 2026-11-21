/* Local PostCSS config — prevents Vite from ascending to the workspace-root
   postcss.config.mjs (which references @tailwindcss/postcss, not installed
   in this sub-project). No transformations are needed for this plain CSS. */
export default { plugins: [] };
