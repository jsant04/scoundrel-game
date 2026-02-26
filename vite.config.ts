import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['vite.svg', 'robots.txt'],
      manifest: {
        name: 'Scoundrel',
        short_name: 'Scoundrel',
        description: 'A solo card dungeon adventure optimized for the web.',
        theme_color: '#0e0f12',
        background_color: '#0e0f12',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api\//, /\/?__\/./],
        runtimeCaching: [
          {
            urlPattern: /\/scoundrel\/.*\.jpg$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'scoundrel-art',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
