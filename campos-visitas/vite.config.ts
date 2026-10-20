
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'push-worker.js',
        'favicon.ico',
        'apple-touch-icon.png'
      ],

      manifest: {
        name: 'Campos Visitas Farmacêuticas',
        short_name: 'Campos Visitas',
        description: 'Sistema de visitas farmacêuticas da Farmácia Campos',

        theme_color: '#0758bd',
        background_color: '#f4f7fb',

        display: 'standalone',
        start_url: '/',

        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },

      workbox: {
        importScripts: ['/push-worker.js'],
        navigateFallback: '/index.html',
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff2}'
        ]
      },

      devOptions: {
        enabled: false
      }
    })
  ]
});
