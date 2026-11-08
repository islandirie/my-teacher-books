import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
// import basicSsl from '@vitejs/plugin-basic-ssl';  // uncomment for HTTPS dev

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true
  },
  preview: {
    allowedHosts: ['.trycloudflare.com']
  },
  plugins: [
    // basicSsl(),  // uncomment for HTTPS dev
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'My Teacher Books',
        short_name: 'TeacherBooks',
        description: 'Zero-maintenance classroom library kiosk and inventory app for elementary teachers and students',
        theme_color: '#0c0e1e',
        background_color: '#0c0e1e',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});