import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const PRODUCTION_BASE = '/sapro/';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    base: isProduction ? PRODUCTION_BASE : '/',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    plugins: [
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png'],
        manifest: {
          name: 'Sapro Simplex Solver',
          short_name: 'Sapro',
          description: 'Offline linear programming solver using the Simplex method.',
          lang: 'en',
          dir: 'ltr',
          display: 'standalone',
          orientation: 'any',
          theme_color: '#245bdb',
          background_color: '#f4f5f7',
          start_url: PRODUCTION_BASE,
          scope: PRODUCTION_BASE,
          icons: [
            {
              src: `${PRODUCTION_BASE}icons/icon-192.png`,
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: `${PRODUCTION_BASE}icons/icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: `${PRODUCTION_BASE}icons/icon-512-maskable.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2,json}'],
          navigateFallback: `${PRODUCTION_BASE}index.html`,
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
  };
});
