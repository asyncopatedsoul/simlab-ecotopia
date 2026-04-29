import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      sizes: [512],
      padding: 0.3,
      resizeOptions: { background: '#1a3a2a' },
    },
    apple: {
      sizes: [180],
      padding: 0.3,
      resizeOptions: { background: '#1a3a2a' },
    },
  },
  images: ['public/icon-source.svg'],
});
