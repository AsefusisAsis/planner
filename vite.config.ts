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
      // В нативной обёртке (Capacitor) сервис-воркер не нужен: ассеты и так
      // в APK, а закэшированный SW отдаёт старую версию после обновления.
      // Именно это ломало биометрию: WebView просил чанк со старым хешем
      // (esm-BVkOHErm.js), которого в новом APK уже нет.
      //
      // selfDestroying, а НЕ disable. Просто перестать собирать SW мало: у
      // уже установленных приложений он остаётся зарегистрированным и
      // продолжает отдавать старый бандл, а нового sw.js для обновления не
      // находит — застревает навсегда. selfDestroying публикует воркер,
      // который снимает регистрацию и чистит кэши, поэтому старые установки
      // лечатся сами при первом запуске.
      selfDestroying: mode === 'capacitor',
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
        // Отдельные страницы (смена пароля, политика, удаление аккаунта)
        // не должны подменяться index.html: navigateFallback у workbox
        // включён по умолчанию и отдаёт SPA на любой переход.
        navigateFallbackDenylist: [/reset-password\.html$/, /privacy\.html$/, /delete-account\.html$/],
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
