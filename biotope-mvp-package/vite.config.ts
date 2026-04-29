import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Cross-origin isolation headers are required for SharedArrayBuffer, which
 * sqlocal/wa-sqlite uses for the OPFS-backed SQLite worker. The host
 * environment (Cloudflare Pages / Netlify) needs the same headers in production
 * — that's tracked in bd-dist.3.
 */
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 5173,
    strictPort: false,
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  optimizeDeps: {
    exclude: ['sqlocal'],
  },
  worker: {
    format: 'es',
  },
});
