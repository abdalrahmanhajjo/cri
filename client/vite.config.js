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
        transformIndexHtml: {
          order: 'post',
          handler(html) {
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
            // LCP /discover: hero uses DM Serif; category pills use Plus Jakarta 600 (latin subset).
            // URLs from fonts.googleapis.com CSS (Chrome UA); update if Google bumps font versions.
            const fontPreloads = `
    <link rel="preload" as="font" type="font/woff2" crossorigin href="https://fonts.gstatic.com/s/dmserifdisplay/v17/-nFnOHM81r4j6k0gjAW3mujVU2B2G_Bx0g.woff2" />
    <link rel="preload" as="font" type="font/woff2" crossorigin href="https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_d0n9TR_V.woff2" />`
            out = out.replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin \/>/i, (m) => `${m}${fontPreloads}`)
            // Remove render-blocking on the main Vite CSS (same pattern as Google Fonts).
            out = out.replace(
              /<link rel="stylesheet" crossorigin href="(\/assets\/index-[^"]+\.css)">/,
              (_, href) =>
                `<link rel="stylesheet" crossorigin href="${href}" media="print" onload="this.media='all'" />` +
                `<noscript><link rel="stylesheet" href="${href}" crossorigin /></noscript>`
            )
            return out
          },
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
