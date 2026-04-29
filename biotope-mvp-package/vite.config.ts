import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

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
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon-source.svg'],
      manifest: {
        name: 'Biotope',
        short_name: 'Biotope',
        description:
          'Look outside, then go outside. Short ecology activities for parents and kids.',
        theme_color: '#1a3a2a',
        background_color: '#1a3a2a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['education', 'kids'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell. Scenario asset bundles get cached at runtime
        // by the asset loader (bd-engn.3) using the same Workbox runtime cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // Don't precache the bench harness — it's developer-only.
        globIgnores: ['bench/**', '**/storage-bench.*'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/bench/],
        runtimeCaching: [
          {
            // Audio (eventually scenario VO + ambient)
            urlPattern: /\.(?:mp3|m4a|ogg|wav)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              rangeRequests: true,
            },
          },
          {
            // 3D / texture / KTX2 / glTF assets
            urlPattern: /\.(?:gltf|glb|ktx2|bin)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-3d',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: {
        // Don't run the SW in dev — it interferes with HMR and the bench page.
        enabled: false,
      },
    }),
  ],
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
