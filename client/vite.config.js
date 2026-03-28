import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { cityHeroPreloadLinkAttrs } from './src/constants/cityHero.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Must match the Node API port (server/.env PORT). Not exposed to the client bundle.
  // Use 127.0.0.1 so the dev proxy matches the API on Windows (IPv6 localhost can mismatch).
  const apiTarget = env.DEV_API_PROXY_TARGET || 'http://127.0.0.1:3095'

  const supabaseOrigin = (env.VITE_SUPABASE_ORIGIN || '').trim().replace(/\/$/, '')
  const supabasePreconnect =
    supabaseOrigin && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseOrigin)
      ? `\n    <link rel="preconnect" href="${supabaseOrigin}" crossorigin />`
      : ''

  return {
    plugins: [
      react(),
      {
        name: 'inject-supabase-preconnect',
        transformIndexHtml(html) {
          let out = html
          if (supabasePreconnect) {
            out = out.replace(/<head>/i, `<head>${supabasePreconnect}`)
          }
          const { imagesrcset, imagesizes } = cityHeroPreloadLinkAttrs()
          const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
          out = out.replace(
            /<link rel="preload" as="image" href="\/city\.png" fetchpriority="high" \/>/i,
            `<link rel="preload" as="image" imagesrcset="${esc(imagesrcset)}" imagesizes="${esc(imagesizes)}" fetchpriority="high" />`
          )
          return out
        },
      },
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    build: {
      // Main chunk still >500k (full i18n in one module); admin/business are lazy. Tune if you split locales.
      chunkSizeWarningLimit: 1024,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('translations.js') || id.includes('i18n\\translations')) {
              return 'i18n';
            }
            if (!id.includes('node_modules')) return;
            if (id.includes('react-router')) return 'react-router';
            if (id.includes('react-dom')) return 'react-dom';
            if (id.includes('/react/') || id.includes('\\react\\')) return 'react';
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
  }
})
