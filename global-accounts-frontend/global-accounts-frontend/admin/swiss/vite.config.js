import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/* Single-file build: dist/index.html inlines all JS+CSS so the admin console
   opens directly via file:// (no server, no CORS) as well as via http. */
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  server: { fs: { allow: ['../..'] } },
  build: { outDir: 'dist', modulePreload: false }
});
