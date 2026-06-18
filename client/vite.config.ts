import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// The release version lives in the root package.json (bumped by release-please);
// the client package.json is unmanaged. Inject it at build time so the dashboard
// can display the running release.
const rootPkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8'),
) as { version: string }

// Served by the NestJS backend (@nestjs/serve-static) under /dashboard, so
// every asset URL must be prefixed with that base.
// https://vite.dev/config/
export default defineConfig({
  base: '/dashboard/',
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
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
      '/telegram': 'http://localhost:3000',
    },
  },
})
