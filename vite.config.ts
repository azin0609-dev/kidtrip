/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 的專案網址是 https://<帳號>.github.io/<repo>/，
// 部署時由 workflow 設定 BASE_PATH=/<repo>/；本機開發維持 /。
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 有新版本時不自動換，跳提示讓使用者點一下再重新整理。
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '放電研究所',
        short_name: '放電研究所',
        description: '孩子負責放電，我們負責找地方。幫 0–12 歲親子家庭，五分鐘決定週末去哪玩。',
        lang: 'zh-Hant-TW',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#176b57',
        background_color: '#f7f9f3',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // app shell＋景點飯店資料（資料在建置時打包進 JS）全部預先快取，離線也能開。
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['photos/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // 景點照片不預先下載（太大），看過一次就存起來，之後離線也看得到。
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/photos/'),
            handler: 'CacheFirst',
            options: { cacheName: 'kidtrip-photos', expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
