import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  // На GitHub Pages проект отдаётся с /<имя-репо>/. В CI это значение
  // подставляется автоматически (VITE_BASE), локально и на корневом домене — '/'.
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // в нативной обёртке (Capacitor) сервис-воркер не нужен: ассеты и так
      // в APK, а закэшированный SW может отдавать старую версию после обновления
      disable: mode === 'capacitor',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Life Planner',
        short_name: 'Planner',
        description: 'Планировщик жизни — траты, задачи, покупки, календарь',
        theme_color: '#18181b',
        background_color: '#18181b',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.nbrb\.by\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'nbrb-api', expiration: { maxAgeSeconds: 60 * 60 * 4 } },
          },
          {
            urlPattern: /^https:\/\/api\.github\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
}))
