import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Served by the NestJS backend (@nestjs/serve-static) under /dashboard, so
// every asset URL must be prefixed with that base.
// https://vite.dev/config/
export default defineConfig({
  base: '/dashboard/',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Dev-only: proxy API calls to the Nest backend so the SPA can use
    // same-origin relative URLs in both dev and production.
    proxy: {
      '/auth': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
})
